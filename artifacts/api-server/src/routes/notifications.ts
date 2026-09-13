import { Router, type IRouter } from "express";
import { db, notificationsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import {
  getVapidPublicKey,
  drainPushNotificationOutbox,
  isAllowedWebPushEndpoint,
} from "../lib/web-push";

const router: IRouter = Router();
const pushTestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "يرجى الانتظار قبل إرسال إشعار تجريبي آخر" },
});

const PushSubscriptionBody = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(20).max(512),
    auth: z.string().min(8).max(256),
  }),
  locale: z.enum(["ar", "en"]).default("ar"),
  soundEnabled: z.boolean().default(true),
});

const PushPreferencesBody = z.object({
  endpoint: z.string().url().max(4096),
  soundEnabled: z.boolean(),
  locale: z.enum(["ar", "en"]).optional(),
});

router.get("/notifications", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.teacherId, req.session.teacherId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    assignmentId: n.assignmentId,
    messageId: (n as any).messageId ?? null,
    actionUrl: n.actionUrl ?? null,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  })));
});

router.patch("/notifications/:id/read", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "معرف غير صالح" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.teacherId, req.session.teacherId)));

  res.json({ success: true });
});

router.patch("/notifications/read-all", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.teacherId, req.session.teacherId), eq(notificationsTable.isRead, false)));

  res.json({ success: true });
});

router.get("/notifications/push/public-key", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({ message: "الإشعارات الخارجية غير متاحة حاليًا" });
    return;
  }
  res.json({ publicKey });
});

router.get("/notifications/push/status", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint : "";
  if (!endpoint) {
    res.json({ subscribed: false });
    return;
  }
  const [subscription] = await db
    .select({ soundEnabled: pushSubscriptionsTable.soundEnabled })
    .from(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.teacherId, req.session.teacherId),
      eq(pushSubscriptionsTable.endpoint, endpoint),
    ))
    .limit(1);
  res.json({ subscribed: Boolean(subscription), soundEnabled: subscription?.soundEnabled ?? true });
});

router.post("/notifications/push/subscribe", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const parsed = PushSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اشتراك الإشعارات غير صالح" });
    return;
  }
  const { endpoint, keys, locale, soundEnabled } = parsed.data;
  if (!isAllowedWebPushEndpoint(endpoint)) {
    res.status(400).json({ message: "عنوان خدمة الإشعارات غير مدعوم" });
    return;
  }
  await db
    .insert(pushSubscriptionsTable)
    .values({
      teacherId: req.session.teacherId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      sessionId: req.sessionID,
      locale,
      soundEnabled,
      userAgent: req.get("user-agent")?.slice(0, 500),
    })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: {
        teacherId: req.session.teacherId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        sessionId: req.sessionID,
        locale,
        soundEnabled,
        failureCount: 0,
        updatedAt: new Date(),
      },
    });
  res.status(201).json({ success: true });
});

router.patch("/notifications/push/preferences", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const parsed = PushPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "إعدادات الإشعارات غير صالحة" });
    return;
  }
  await db
    .update(pushSubscriptionsTable)
    .set({
      soundEnabled: parsed.data.soundEnabled,
      ...(parsed.data.locale ? { locale: parsed.data.locale } : {}),
      updatedAt: new Date(),
    })
    .where(and(
      eq(pushSubscriptionsTable.teacherId, req.session.teacherId),
      eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
    ));
  res.json({ success: true });
});

router.post("/notifications/push/unsubscribe", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (endpoint) {
    await db.delete(pushSubscriptionsTable).where(and(
      eq(pushSubscriptionsTable.teacherId, req.session.teacherId),
      eq(pushSubscriptionsTable.endpoint, endpoint),
    ));
  }
  res.json({ success: true });
});

router.post("/notifications/push/test", pushTestLimiter, async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  await db.insert(notificationsTable).values({
    teacherId: req.session.teacherId,
    type: "push_test",
    title: "إشعار تجريبي من حصاد",
    body: "تم تفعيل إشعارات الجهاز بنجاح.",
    actionUrl: "/teacher",
  });
  void drainPushNotificationOutbox();
  res.status(201).json({ success: true });
});

export default router;
