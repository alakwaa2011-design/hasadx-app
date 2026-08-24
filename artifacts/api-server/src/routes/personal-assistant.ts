import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  personalAssistantActionsTable,
  personalAssistantMessagesTable,
  personalAssistantThreadsTable,
  teachersTable,
} from "@workspace/db";
import {
  getPersonalAssistantConfig,
  getPersonalAssistantOwnerAccountIds,
  normalizeWhatsAppPhone,
  verifyWhatsAppSignature,
} from "../lib/personal-assistant-whatsapp";
import { z } from "zod";

const router: IRouter = Router();
const ACTION_STATUSES = ["pending_review", "confirmed", "cancelled"] as const;
type ActionStatus = (typeof ACTION_STATUSES)[number];

function queryValue(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return typeof value === "string" ? value : "";
}

function rawBody(req: Request): Buffer {
  return Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
}

/**
 * Meta verification endpoint. It is intentionally public, but only returns
 * the challenge after both the mode and secret token match.
 */
router.get("/webhooks/whatsapp", (req, res): void => {
  const mode = queryValue(req.query["hub.mode"]);
  const token = queryValue(req.query["hub.verify_token"]);
  const challenge = queryValue(req.query["hub.challenge"]);
  const configuredToken = process.env.PERSONAL_ASSISTANT_WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && Boolean(configuredToken) && token === configuredToken && challenge) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).json({ message: "التحقق مرفوض" });
});

function supportedInboundMessages(payload: unknown): Array<{
  externalMessageId: string;
  from: string;
  text: string;
  receivedAt: Date;
}> {
  if (!payload || typeof payload !== "object") return [];
  const entries = Array.isArray((payload as any).entry) ? (payload as any).entry : [];
  const result: Array<{
    externalMessageId: string;
    from: string;
    text: string;
    receivedAt: Date;
  }> = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        const id = typeof message?.id === "string" ? message.id.trim() : "";
        const from = normalizeWhatsAppPhone(message?.from);
        const text = typeof message?.text?.body === "string" ? message.text.body : "";
        if (!id || !from || message?.type !== "text" || !text || text.length > 20_000) continue;

        const seconds = Number(message?.timestamp);
        const receivedAt = Number.isFinite(seconds) && seconds > 0
          ? new Date(seconds * 1000)
          : new Date();
        if (Number.isNaN(receivedAt.getTime())) continue;
        result.push({ externalMessageId: id.slice(0, 500), from, text, receivedAt });
      }
    }
  }
  return result;
}

export async function ingestPersonalAssistantMessage(message: {
  externalMessageId: string;
  from: string;
  text: string;
  receivedAt: Date;
}): Promise<boolean> {
  const [ownerPhone] = [normalizeWhatsAppPhone(process.env.PERSONAL_ASSISTANT_OWNER_PHONE)];
  if (!ownerPhone || message.from !== ownerPhone) return false;

  return db.transaction(async (tx) => {
    const createdThread = await tx
      .insert(personalAssistantThreadsTable)
      .values({
        channel: "whatsapp",
        externalContactPhone: message.from,
        lastMessageAt: message.receivedAt,
      })
      .onConflictDoNothing({ target: personalAssistantThreadsTable.externalContactPhone })
      .returning({ id: personalAssistantThreadsTable.id });

    const threadId = createdThread[0]?.id ?? (
      await tx
        .select({ id: personalAssistantThreadsTable.id })
        .from(personalAssistantThreadsTable)
        .where(eq(personalAssistantThreadsTable.externalContactPhone, message.from))
        .limit(1)
    )[0]?.id;
    if (!threadId) throw new Error("Personal assistant thread was not available");

    const createdMessage = await tx
      .insert(personalAssistantMessagesTable)
      .values({
        threadId,
        externalMessageId: message.externalMessageId,
        direction: "inbound",
        messageText: message.text,
        receivedAt: message.receivedAt,
      })
      .onConflictDoNothing({ target: personalAssistantMessagesTable.externalMessageId })
      .returning({ id: personalAssistantMessagesTable.id });

    if (createdMessage.length === 0) return false;
    const messageId = createdMessage[0].id;

    await tx
      .insert(personalAssistantActionsTable)
      .values({
        threadId,
        messageId,
        actionType: "review",
        status: "pending_review",
      })
      .onConflictDoNothing({ target: personalAssistantActionsTable.messageId });

    await tx
      .update(personalAssistantThreadsTable)
      .set({ lastMessageAt: message.receivedAt, updatedAt: new Date() })
      .where(eq(personalAssistantThreadsTable.id, threadId));
    return true;
  });
}

router.post("/webhooks/whatsapp", async (req, res): Promise<void> => {
  const body = rawBody(req);
  const validSignature = verifyWhatsAppSignature(
    body,
    typeof req.headers["x-hub-signature-256"] === "string"
      ? req.headers["x-hub-signature-256"]
      : undefined,
    process.env.PERSONAL_ASSISTANT_WHATSAPP_APP_SECRET,
  );
  if (!validSignature) {
    res.status(401).json({ message: "توقيع غير صالح" });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    res.status(400).json({ message: "حمولة غير صالحة" });
    return;
  }

  const ownerPhone = normalizeWhatsAppPhone(process.env.PERSONAL_ASSISTANT_OWNER_PHONE);
  if (!ownerPhone) {
    res.status(200).json({ status: "ignored" });
    return;
  }

  try {
    let accepted = 0;
    for (const message of supportedInboundMessages(payload)) {
      if (message.from !== ownerPhone) continue;
      if (await ingestPersonalAssistantMessage(message)) accepted++;
    }
    res.status(200).json({ status: accepted > 0 ? "accepted" : "ignored" });
  } catch (err) {
    req.log?.error?.(err, "Personal assistant webhook processing failed");
    res.status(500).json({ message: "تعذّرت معالجة الرسالة" });
  }
});

async function requirePersonalAssistantOwner(req: Request, res: Response): Promise<number | null> {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return null;
  }
  const accountId = Number(req.session.teacherId);
  const ownerIds = getPersonalAssistantOwnerAccountIds();
  if (!Number.isSafeInteger(accountId) || ownerIds.size === 0 || !ownerIds.has(accountId)) {
    res.status(403).json({ message: "غير مصرح" });
    return null;
  }

  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, accountId))
    .limit(1);
  if (!teacher?.isAdmin) {
    res.status(403).json({ message: "غير مصرح" });
    return null;
  }
  return accountId;
}

router.get("/admin/personal-assistant", async (req, res): Promise<void> => {
  if ((await requirePersonalAssistantOwner(req, res)) === null) return;
  try {
    const [threads, messages, actions] = await Promise.all([
      db.select({
        id: personalAssistantThreadsTable.id,
        channel: personalAssistantThreadsTable.channel,
        lastMessageAt: personalAssistantThreadsTable.lastMessageAt,
        createdAt: personalAssistantThreadsTable.createdAt,
        updatedAt: personalAssistantThreadsTable.updatedAt,
      }).from(personalAssistantThreadsTable).orderBy(desc(personalAssistantThreadsTable.updatedAt)),
      db.select({
        id: personalAssistantMessagesTable.id,
        threadId: personalAssistantMessagesTable.threadId,
        externalMessageId: personalAssistantMessagesTable.externalMessageId,
        direction: personalAssistantMessagesTable.direction,
        messageText: personalAssistantMessagesTable.messageText,
        receivedAt: personalAssistantMessagesTable.receivedAt,
      }).from(personalAssistantMessagesTable).orderBy(desc(personalAssistantMessagesTable.receivedAt)),
      db.select({
        id: personalAssistantActionsTable.id,
        threadId: personalAssistantActionsTable.threadId,
        messageId: personalAssistantActionsTable.messageId,
        actionType: personalAssistantActionsTable.actionType,
        status: personalAssistantActionsTable.status,
        createdAt: personalAssistantActionsTable.createdAt,
        reviewedAt: personalAssistantActionsTable.reviewedAt,
      }).from(personalAssistantActionsTable).orderBy(desc(personalAssistantActionsTable.createdAt)),
    ]);
    res.json({
      configuration: getPersonalAssistantConfig(),
      threads,
      messages,
      actions,
    });
  } catch (err) {
    req.log?.error?.(err, "Failed to load personal assistant data");
    res.status(500).json({ message: "تعذّر تحميل بيانات المساعد الشخصي" });
  }
});

const ActionParamSchema = z.object({ id: z.coerce.number().int().positive() });
const DeleteThreadBodySchema = z.object({ confirm: z.literal(true) }).strict();

async function changeActionStatus(req: Request, res: Response, status: ActionStatus): Promise<void> {
  if ((await requirePersonalAssistantOwner(req, res)) === null) return;
  const parsed = ActionParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  try {
    const [updated] = await db
      .update(personalAssistantActionsTable)
      .set({ status, reviewedAt: new Date() })
      .where(and(
        eq(personalAssistantActionsTable.id, parsed.data.id),
        eq(personalAssistantActionsTable.status, "pending_review"),
      ))
      .returning({
        id: personalAssistantActionsTable.id,
        status: personalAssistantActionsTable.status,
        reviewedAt: personalAssistantActionsTable.reviewedAt,
      });
    if (updated) {
      res.json(updated);
      return;
    }

    const [existing] = await db
      .select({ id: personalAssistantActionsTable.id, status: personalAssistantActionsTable.status })
      .from(personalAssistantActionsTable)
      .where(eq(personalAssistantActionsTable.id, parsed.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "مهمة المراجعة غير موجودة" });
      return;
    }
    res.status(409).json({ message: "لا يمكن تغيير حالة هذه المهمة", status: existing.status });
  } catch (err) {
    req.log?.error?.(err, "Failed to change personal assistant action");
    res.status(500).json({ message: "تعذّر تحديث المهمة" });
  }
}

router.patch("/admin/personal-assistant/actions/:id/confirm", async (req, res): Promise<void> => {
  await changeActionStatus(req, res, "confirmed");
});

router.patch("/admin/personal-assistant/actions/:id/cancel", async (req, res): Promise<void> => {
  await changeActionStatus(req, res, "cancelled");
});

router.delete("/admin/personal-assistant/threads/:id", async (req, res): Promise<void> => {
  if ((await requirePersonalAssistantOwner(req, res)) === null) return;
  const parsed = ActionParamSchema.safeParse(req.params);
  const body = DeleteThreadBodySchema.safeParse(req.body);
  if (!parsed.success || !body.success) {
    res.status(400).json({ message: "يلزم تأكيد حذف المحادثة" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(personalAssistantThreadsTable)
      .where(eq(personalAssistantThreadsTable.id, parsed.data.id))
      .returning({ id: personalAssistantThreadsTable.id });
    if (!deleted) {
      res.status(404).json({ message: "المحادثة غير موجودة" });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    req.log?.error?.(err, "Failed to delete personal assistant thread");
    res.status(500).json({ message: "تعذّر حذف المحادثة" });
  }
});

export { requirePersonalAssistantOwner };
export default router;