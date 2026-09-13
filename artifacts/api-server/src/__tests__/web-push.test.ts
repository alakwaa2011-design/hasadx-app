import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, sendNotification, setVapidDetails } = vi.hoisted(() => ({
  query: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock("@workspace/db", () => ({ pool: { query } }));
vi.mock("web-push", () => ({
  default: { sendNotification, setVapidDetails },
}));
vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

import {
  configureWebPush,
  drainPushNotificationOutbox,
  isAllowedWebPushEndpoint,
  removePushSubscriptionsForSession,
} from "../lib/web-push";

type Delivery = {
  id: number;
  notification_id: number;
  teacher_id: number;
  subscription_id: number;
  attempts: number;
};

function arrangeDrain(deliveries: Delivery[], statuses: Map<number, number | undefined> = new Map()) {
  query.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("WITH claimed AS")) return { rows: deliveries };
    if (sql.includes("FROM notifications")) {
      return {
        rows: [{
          title: "تنبيه",
          body: "حان الوقت",
          type: "timer",
          action_url: "/teacher",
          assignment_id: null,
          message_id: null,
        }],
      };
    }
    if (sql.includes("FROM push_subscriptions")) {
      const subscriptionId = Number(params[1]);
      return {
        rows: [{
          id: subscriptionId,
          endpoint: `https://fcm.googleapis.com/fcm/send/device-${subscriptionId}`,
          p256dh: "p256dh",
          auth: "auth",
          sound_enabled: true,
        }],
      };
    }
    return { rows: [] };
  });

  sendNotification.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
    const subscriptionId = Number(endpoint.split("-").at(-1));
    const statusCode = statuses.get(subscriptionId);
    if (statusCode !== undefined) throw Object.assign(new Error("push failed"), { statusCode });
  });
}

function updateStatements() {
  return query.mock.calls.map(([sql, params]) => ({ sql: String(sql), params }));
}

describe("Web Push delivery outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "web-push-test-session-secret";
    configureWebPush();
  });

  it("keeps delivery state independent per device and retries only the failed device", async () => {
    arrangeDrain([
      { id: 11, notification_id: 91, teacher_id: 7, subscription_id: 101, attempts: 1 },
      { id: 12, notification_id: 91, teacher_id: 7, subscription_id: 102, attempts: 1 },
    ], new Map([[102, 503]]));
    await drainPushNotificationOutbox();

    expect(sendNotification.mock.calls.map(([target]) => target.endpoint)).toEqual([
      "https://fcm.googleapis.com/fcm/send/device-101",
      "https://fcm.googleapis.com/fcm/send/device-102",
    ]);
    expect(updateStatements().some(({ sql, params }) =>
      sql.includes("SET processed_at = NOW()") && params[0] === 11
    )).toBe(true);
    expect(updateStatements().some(({ sql, params }) =>
      sql.includes("SET next_attempt_at") && params[0] === 12
    )).toBe(true);

    query.mockReset();
    sendNotification.mockReset();
    arrangeDrain([
      { id: 12, notification_id: 91, teacher_id: 7, subscription_id: 102, attempts: 2 },
    ]);
    await drainPushNotificationOutbox();

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0].endpoint).toBe(
      "https://fcm.googleapis.com/fcm/send/device-102",
    );
  });

  it.each([404, 410])("deletes an expired subscription after status %s", async (statusCode) => {
    arrangeDrain([
      { id: 21, notification_id: 92, teacher_id: 8, subscription_id: 201, attempts: 1 },
    ], new Map([[201, statusCode]]));
    await drainPushNotificationOutbox();

    expect(updateStatements().some(({ sql, params }) =>
      sql.includes("DELETE FROM push_subscriptions") && params[0] === 201
    )).toBe(true);
    expect(updateStatements().some(({ sql }) => sql.includes("SET next_attempt_at"))).toBe(false);
  });

  it.each([429, 500, 503])("classifies status %s as retryable", async (statusCode) => {
    arrangeDrain([
      { id: 31, notification_id: 93, teacher_id: 9, subscription_id: 301, attempts: 1 },
    ], new Map([[301, statusCode]]));
    await drainPushNotificationOutbox();

    expect(updateStatements().some(({ sql, params }) =>
      sql.includes("SET next_attempt_at") &&
      params[0] === 31 &&
      String(params[2]).includes(String(statusCode))
    )).toBe(true);
  });

  it("deletes a previously stored unsafe endpoint instead of contacting it", async () => {
    arrangeDrain([
      { id: 41, notification_id: 94, teacher_id: 10, subscription_id: 401, attempts: 1 },
    ]);
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("WITH claimed AS")) {
        return {
          rows: [{ id: 41, notification_id: 94, teacher_id: 10, subscription_id: 401, attempts: 1 }],
        };
      }
      if (sql.includes("FROM notifications")) {
        return {
          rows: [{
            title: "تنبيه",
            body: "حان الوقت",
            type: "timer",
            action_url: "/teacher",
            assignment_id: null,
            message_id: null,
          }],
        };
      }
      if (sql.includes("FROM push_subscriptions")) {
        return {
          rows: [{
            id: 401,
            endpoint: "https://127.0.0.1/internal",
            p256dh: "p256dh",
            auth: "auth",
            sound_enabled: true,
          }],
        };
      }
      return { rows: [] };
    });

    await drainPushNotificationOutbox();

    expect(sendNotification).not.toHaveBeenCalled();
    expect(updateStatements().some(({ sql, params }) =>
      sql.includes("DELETE FROM push_subscriptions") && params[0] === 401
    )).toBe(true);
    expect(updateStatements().some(({ sql, params }) =>
      sql.includes("SET processed_at = NOW()") &&
      params[0] === 41 &&
      String(params[1]).includes("unsafe")
    )).toBe(true);
  });
});

describe("Web Push endpoint policy", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/token",
    "https://wns2-am3p.notify.windows.com/w/?token=abc",
  ])("allows a supported browser push endpoint: %s", (endpoint) => {
    expect(isAllowedWebPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/token",
    "https://user:password@fcm.googleapis.com/fcm/send/token",
    "https://fcm.googleapis.com:8443/fcm/send/token",
    "https://127.0.0.1/internal",
    "https://169.254.169.254/latest/meta-data",
    "https://push.example/token",
    "https://fcm.googleapis.com.attacker.example/token",
  ])("rejects an unsafe or unsupported endpoint: %s", (endpoint) => {
    expect(isAllowedWebPushEndpoint(endpoint)).toBe(false);
  });
});

describe("Web Push session cleanup", () => {
  it("deletes only the authenticated session subscriptions when endpoint lookup is unavailable", async () => {
    query.mockResolvedValue({ rows: [] });

    await removePushSubscriptionsForSession(17, "session-current", null);

    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("session_id = $2"),
      values: [17, "session-current", null],
      query_timeout: 750,
    }));
  });

  it("uses the endpoint only as an additional selector for legacy subscriptions", async () => {
    query.mockResolvedValue({ rows: [] });

    await removePushSubscriptionsForSession(
      18,
      "session-current",
      "https://fcm.googleapis.com/fcm/send/current-device",
    );

    expect(query).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("endpoint = $3"),
      values: [
        18,
        "session-current",
        "https://fcm.googleapis.com/fcm/send/current-device",
      ],
      query_timeout: 750,
    }));
  });
});