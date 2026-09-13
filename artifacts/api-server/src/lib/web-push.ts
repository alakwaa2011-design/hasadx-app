import crypto from "node:crypto";
import webpush from "web-push";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@hasaadx.com";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

const ALLOWED_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);
type ClaimedDelivery = {
  id: number;
  notification_id: number;
  teacher_id: number;
  subscription_id: number;
  attempts: number;
};

type DeliveryPayload = ClaimedDelivery & {
  title: string;
  body: string;
  type: string;
  action_url: string | null;
  assignment_id: number | null;
  message_id: number | null;
  timer_run_id: string | null;
  schedule_sound_enabled: boolean | null;
};

type PushTarget = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  sound_enabled: boolean;
};

let configured = false;
let processing = false;
let workerTimer: NodeJS.Timeout | null = null;
let lastScheduleScanAt = 0;

export function isAllowedWebPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return false;
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    return ALLOWED_PUSH_HOSTS.has(hostname) || hostname.endsWith(".notify.windows.com");
  } catch {
    return false;
  }
}

export async function removePushSubscriptionsForSession(
  teacherId: number,
  sessionId: string,
  endpoint: string | null,
): Promise<void> {
  await pool.query({
    text: `DELETE FROM push_subscriptions
           WHERE teacher_id = $1
             AND (session_id = $2 OR ($3::text IS NOT NULL AND endpoint = $3))`,
    values: [teacherId, sessionId, endpoint],
    query_timeout: 750,
  } as any);
}

export async function createDueTimerNotifications(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const due = await client.query<{
      teacher_id: number;
      version: number;
      task_name: string;
    }>(`
      SELECT teacher_id, version, task_name
      FROM teacher_timer_states
      WHERE status = 'running'
        AND end_at <= NOW() - INTERVAL '10 seconds'
        AND client_handled_at IS NULL
        AND notification_id IS NULL
      ORDER BY end_at
      FOR UPDATE SKIP LOCKED
      LIMIT 50
    `);
    for (const timer of due.rows) {
      const title = "انتهى مؤقت الحصة";
      const body = timer.task_name
        ? `انتهى وقت: ${timer.task_name}`
        : "انتهى الوقت المحدد في مؤقت الحصة.";
      const run = await client.query<{ run_id: string }>(
        `SELECT run_id FROM teacher_timer_states
         WHERE teacher_id = $1 AND version = $2 AND status = 'running'`,
        [timer.teacher_id, timer.version],
      );
      if (!run.rows[0]?.run_id) continue;
      const alreadyCreated = await client.query<{ notification_id: number }>(
        `SELECT notification_id FROM teacher_timer_notifications WHERE run_id = $1`,
        [run.rows[0].run_id],
      );
      if (alreadyCreated.rows[0]) {
        await client.query(
          `UPDATE teacher_timer_states
           SET status = 'completed', notification_id = $3,
               version = version + 1, updated_at = NOW()
           WHERE teacher_id = $1 AND version = $2`,
          [timer.teacher_id, timer.version, alreadyCreated.rows[0].notification_id],
        );
        continue;
      }
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO notifications (teacher_id, type, title, body, action_url)
         VALUES ($1, 'class_timer_complete', $2, $3, '/teacher/tools/timer')
         RETURNING id`,
        [timer.teacher_id, title, body],
      );
      await client.query(
        `UPDATE teacher_timer_states
         SET status = 'completed', notification_id = $3,
             version = version + 1, updated_at = NOW()
         WHERE teacher_id = $1 AND version = $2 AND notification_id IS NULL`,
        [timer.teacher_id, timer.version, inserted.rows[0].id],
      );
      await client.query(
        `INSERT INTO teacher_timer_notifications (run_id, teacher_id, notification_id)
         VALUES ($1, $2, $3)`,
        [run.rows[0].run_id, timer.teacher_id, inserted.rows[0].id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function addLocalDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function zonedLocalTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"));
    guess += desired - represented;
  }
  return new Date(guess);
}

export async function createDueScheduleNotifications(now = new Date()): Promise<void> {
  const entries = await pool.query<{
    id: number; teacher_id: number; kind: string; title: string; class_name: string | null;
    day_of_week: number | null; appointment_date: string | null; start_time: string;
    end_time: string | null; alert_minutes: number; end_alert_minutes: number;
    sound_enabled: boolean; locale: "ar" | "en"; timezone: string;
  }>(`
    SELECT schedule.id, schedule.teacher_id, schedule.kind, schedule.title, schedule.class_name,
           schedule.day_of_week, schedule.appointment_date::text, schedule.start_time, schedule.end_time,
           preferences.alert_minutes, preferences.end_alert_minutes, preferences.sound_enabled,
           preferences.locale, preferences.timezone
    FROM teacher_schedule schedule
    JOIN teacher_schedule_notification_preferences preferences
      ON preferences.teacher_id = schedule.teacher_id AND preferences.enabled = TRUE
    WHERE schedule.kind IN ('weekly', 'appointment')
  `);
  for (const entry of entries.rows) {
    let parts;
    try {
      parts = localDateParts(now, entry.timezone);
    } catch {
      continue;
    }
    const today = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    for (const occurrenceDate of [today, addLocalDays(today, 1)]) {
      const weekday = new Date(`${occurrenceDate}T00:00:00Z`).getUTCDay();
      if (entry.kind === "appointment"
        ? entry.appointment_date !== occurrenceDate
        : entry.day_of_week !== weekday) continue;
      const alerts: Array<{ kind: "start" | "end"; time: string; lead: number }> = [
        { kind: "start", time: entry.start_time, lead: entry.alert_minutes },
      ];
      if (entry.end_time && entry.end_alert_minutes > 0) {
        alerts.push({ kind: "end", time: entry.end_time, lead: entry.end_alert_minutes });
      }
      for (const alert of alerts) {
        const eventAt = zonedLocalTimeToUtc(occurrenceDate, alert.time, entry.timezone);
        const dueAt = new Date(eventAt.getTime() - alert.lead * 60_000);
        if (now < dueAt || now >= eventAt) continue;
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const current = await client.query<{
            id: number; teacher_id: number; kind: string; title: string; class_name: string | null;
            day_of_week: number | null; appointment_date: string | null; start_time: string;
            end_time: string | null; enabled: boolean; alert_minutes: number;
            end_alert_minutes: number; sound_enabled: boolean; locale: "ar" | "en"; timezone: string;
          }>(
            `SELECT schedule.id, schedule.teacher_id, schedule.kind, schedule.title, schedule.class_name,
                    schedule.day_of_week, schedule.appointment_date::text, schedule.start_time, schedule.end_time,
                    preferences.enabled, preferences.alert_minutes, preferences.end_alert_minutes,
                    preferences.sound_enabled, preferences.locale, preferences.timezone
             FROM teacher_schedule schedule
             JOIN teacher_schedule_notification_preferences preferences
               ON preferences.teacher_id = schedule.teacher_id
             WHERE schedule.id = $1 AND schedule.teacher_id = $2
             FOR UPDATE OF schedule, preferences`,
            [entry.id, entry.teacher_id],
          );
          const fresh = current.rows[0];
          if (!fresh || !fresh.enabled) {
            await client.query("ROLLBACK");
            continue;
          }
          const freshWeekday = new Date(`${occurrenceDate}T00:00:00Z`).getUTCDay();
          const stillOccurs = fresh.kind === "appointment"
            ? fresh.appointment_date === occurrenceDate
            : fresh.kind === "weekly" && fresh.day_of_week === freshWeekday;
          const freshLead = alert.kind === "start" ? fresh.alert_minutes : fresh.end_alert_minutes;
          const freshTime = alert.kind === "start" ? fresh.start_time : fresh.end_time;
          if (!stillOccurs || !freshTime || freshLead <= 0) {
            await client.query("ROLLBACK");
            continue;
          }
          const freshEventAt = zonedLocalTimeToUtc(occurrenceDate, freshTime, fresh.timezone);
          const freshDueAt = new Date(freshEventAt.getTime() - freshLead * 60_000);
          if (now < freshDueAt || now >= freshEventAt) {
            await client.query("ROLLBACK");
            continue;
          }
          const claimed = await client.query<{ id: number }>(
            `INSERT INTO teacher_schedule_notification_runs
               (teacher_id, schedule_entry_id, occurrence_date, alert_kind)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (schedule_entry_id, occurrence_date, alert_kind) DO NOTHING
             RETURNING id`,
            [entry.teacher_id, entry.id, occurrenceDate, alert.kind],
          );
          if (!claimed.rows[0]) {
            await client.query("ROLLBACK");
            continue;
          }
          const isStart = alert.kind === "start";
          let expiresAt = freshEventAt;
          if (isStart && fresh.end_time) {
            expiresAt = zonedLocalTimeToUtc(occurrenceDate, fresh.end_time, fresh.timezone);
            if (expiresAt <= freshEventAt) {
              expiresAt = zonedLocalTimeToUtc(addLocalDays(occurrenceDate, 1), fresh.end_time, fresh.timezone);
            }
          }
          const title = fresh.locale === "en"
            ? (isStart ? "Upcoming lesson" : "Lesson ending soon")
            : (isStart ? "حصة قادمة" : "اقترب انتهاء الحصة");
          const context = fresh.class_name ? `${fresh.title} — ${fresh.class_name}` : fresh.title;
          const body = fresh.locale === "en"
            ? `${context} ${isStart ? "starts" : "ends"} in ${freshLead} minutes.`
            : `${context} ${isStart ? "تبدأ" : "تنتهي"} بعد ${freshLead} دقائق.`;
          const inserted = await client.query<{ id: number }>(
            `INSERT INTO notifications (teacher_id, type, title, body, action_url, expires_at)
             VALUES ($1, $2, $3, $4, '/teacher/tools/schedule', $5) RETURNING id`,
            [entry.teacher_id, isStart ? "teacher_schedule_start" : "teacher_schedule_end", title, body, expiresAt],
          );
          await client.query(
            `UPDATE teacher_schedule_notification_runs SET notification_id = $2 WHERE id = $1`,
            [claimed.rows[0].id, inserted.rows[0].id],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    }
  }
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function deriveVapidKeys(): { publicKey: string; privateKey: string } | null {
  const explicitPublic = process.env.VAPID_PUBLIC_KEY;
  const explicitPrivate = process.env.VAPID_PRIVATE_KEY;
  if (explicitPublic && explicitPrivate) {
    return { publicKey: explicitPublic, privateKey: explicitPrivate };
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return null;

  for (let counter = 0; counter < 8; counter += 1) {
    const privateKey = crypto
      .createHmac("sha256", sessionSecret)
      .update(`hasadx:web-push:v1:${counter}`)
      .digest();
    try {
      const ecdh = crypto.createECDH("prime256v1");
      ecdh.setPrivateKey(privateKey);
      return {
        publicKey: toBase64Url(ecdh.getPublicKey(undefined, "uncompressed")),
        privateKey: toBase64Url(privateKey),
      };
    } catch {
      // Try the next deterministic scalar if this one is outside the curve order.
    }
  }
  return null;
}

export function configureWebPush(): boolean {
  if (configured) return true;
  const keys = deriveVapidKeys();
  if (!keys) {
    logger.warn("Web Push is disabled because VAPID keys and SESSION_SECRET are unavailable");
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  const keys = deriveVapidKeys();
  return keys?.publicKey ?? null;
}

function actionUrlFor(payload: DeliveryPayload): string {
  if (payload.action_url) return payload.action_url;
  if (payload.type === "direct_message") return "/teacher";
  if (
    (payload.type === "parent_message_read" || payload.type === "parent_message_reply") &&
    payload.message_id
  ) {
    return `/teacher/messages?tab=parents&message=${payload.message_id}`;
  }
  if (payload.assignment_id) return `/teacher/assignment/${payload.assignment_id}`;
  if (payload.type === "maraqui_approval") return "/teacher/admin?tab=maraqui";
  return "/teacher";
}

async function claimDeliveries(): Promise<ClaimedDelivery[]> {
  const result = await pool.query<ClaimedDelivery>(`
    WITH claimed AS (
      SELECT id
      FROM push_notification_deliveries
      WHERE processed_at IS NULL
        AND next_attempt_at <= NOW()
        AND attempts < $1
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT $2
    )
    UPDATE push_notification_deliveries AS outbox
    SET attempts = outbox.attempts + 1,
        next_attempt_at = NOW() + INTERVAL '5 minutes'
    FROM claimed
    WHERE outbox.id = claimed.id
    RETURNING outbox.id, outbox.notification_id, outbox.teacher_id,
              outbox.subscription_id, outbox.attempts
  `, [MAX_ATTEMPTS, BATCH_SIZE]);
  return result.rows;
}

async function loadPayload(delivery: ClaimedDelivery): Promise<DeliveryPayload | null> {
  const result = await pool.query<Omit<DeliveryPayload, keyof ClaimedDelivery>>(`
    SELECT n.title, n.body, n.type, n.action_url, n.assignment_id, n.message_id,
           timer_runs.run_id::text AS timer_run_id,
           schedule_preferences.sound_enabled AS schedule_sound_enabled
    FROM notifications n
    LEFT JOIN teacher_timer_notifications timer_runs ON timer_runs.notification_id = n.id
    LEFT JOIN teacher_schedule_notification_runs schedule_runs ON schedule_runs.notification_id = n.id
    LEFT JOIN teacher_schedule_notification_preferences schedule_preferences
      ON schedule_preferences.teacher_id = schedule_runs.teacher_id
    WHERE n.id = $1 AND n.teacher_id = $2
    LIMIT 1
  `, [delivery.notification_id, delivery.teacher_id]);
  return result.rows[0] ? { ...delivery, ...result.rows[0] } : null;
}

async function markProcessed(id: number, lastError: string | null = null): Promise<void> {
  await pool.query(
    `UPDATE push_notification_deliveries
     SET processed_at = NOW(), last_error = $2
     WHERE id = $1`,
    [id, lastError],
  );
}

async function markRetry(delivery: ClaimedDelivery, reason: string): Promise<void> {
  if (delivery.attempts >= MAX_ATTEMPTS) {
    await markProcessed(delivery.id, reason);
    return;
  }
  const delaySeconds = Math.min(900, 15 * (2 ** Math.max(0, delivery.attempts - 1)));
  await pool.query(
    `UPDATE push_notification_deliveries
     SET next_attempt_at = NOW() + ($2 * INTERVAL '1 second'), last_error = $3
     WHERE id = $1 AND processed_at IS NULL`,
    [delivery.id, delaySeconds, reason.slice(0, 500)],
  );
}

async function sendDelivery(delivery: ClaimedDelivery): Promise<void> {
  const payload = await loadPayload(delivery);
  if (!payload) {
    await markProcessed(delivery.id, "Notification no longer exists");
    return;
  }

  const targetResult = await pool.query<PushTarget>(`
    SELECT id, endpoint, p256dh, auth, sound_enabled
    FROM push_subscriptions
    WHERE teacher_id = $1 AND id = $2
  `, [delivery.teacher_id, delivery.subscription_id]);
  const targets = targetResult.rows;
  if (targets.length === 0) {
    await markProcessed(delivery.id);
    return;
  }

  const target = targets[0];
  if (!isAllowedWebPushEndpoint(target.endpoint)) {
    await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [target.id]);
    await markProcessed(delivery.id, "Rejected unsafe Web Push endpoint");
    logger.warn({ subscriptionId: target.id }, "Rejected unsafe Web Push endpoint");
    return;
  }
  const body = JSON.stringify({
    notificationId: delivery.notification_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    actionUrl: actionUrlFor(payload),
    runId: payload.timer_run_id,
  });

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify({
        ...JSON.parse(body),
        silent: payload.type.startsWith("teacher_schedule_")
          ? !payload.schedule_sound_enabled
          : !target.sound_enabled,
      }),
      { TTL: 60 * 60 * 24, urgency: "normal" },
    );
    await pool.query(
      `UPDATE push_subscriptions
       SET failure_count = 0, last_success_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [target.id],
    );
    await markProcessed(delivery.id);
  } catch (error) {
    const statusCode = Number((error as { statusCode?: number }).statusCode);
    if (statusCode === 404 || statusCode === 410) {
      await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [target.id]);
      return;
    }
    await pool.query(
      `UPDATE push_subscriptions
       SET failure_count = failure_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [target.id],
    );
    const retryable = !statusCode || statusCode === 408 || statusCode === 429 || statusCode >= 500;
    if (retryable) {
      await markRetry(delivery, `Push service failed with ${statusCode || "a transport error"}`);
    } else {
      await markProcessed(delivery.id, `Permanent push failure: ${statusCode}`);
      logger.warn({ statusCode, subscriptionId: target.id }, "Permanent Web Push delivery failure");
    }
  }
}

export async function drainPushNotificationOutbox(): Promise<void> {
  if (!configured || processing) return;
  processing = true;
  try {
    await createDueTimerNotifications();
    if (Date.now() - lastScheduleScanAt >= 30_000) {
      lastScheduleScanAt = Date.now();
      await createDueScheduleNotifications();
      await pool.query(`DELETE FROM teacher_schedule_notification_runs WHERE created_at < NOW() - INTERVAL '60 days'`);
    }
    const deliveries = await claimDeliveries();
    await Promise.all(deliveries.map((delivery) => sendDelivery(delivery)));
  } catch (error) {
    logger.warn({ err: error }, "Web Push outbox processing failed");
  } finally {
    processing = false;
  }
}

export function startWebPushWorker(): void {
  if (workerTimer || !configureWebPush()) return;
  void drainPushNotificationOutbox();
  workerTimer = setInterval(() => void drainPushNotificationOutbox(), 5_000);
  workerTimer.unref();
  logger.info("Web Push outbox worker started");
}
