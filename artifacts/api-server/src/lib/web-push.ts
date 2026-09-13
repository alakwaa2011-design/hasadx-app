import crypto from "node:crypto";
import webpush from "web-push";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@hasaadx.com";
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

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
    SELECT title, body, type, action_url, assignment_id, message_id
    FROM notifications
    WHERE id = $1 AND teacher_id = $2
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
  const body = JSON.stringify({
    notificationId: delivery.notification_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    actionUrl: actionUrlFor(payload),
  });

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify({ ...JSON.parse(body), silent: !target.sound_enabled }),
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