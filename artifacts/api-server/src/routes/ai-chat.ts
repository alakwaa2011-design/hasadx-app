import crypto from "node:crypto";
import { Router } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  aiCache,
  aiUsageDaily,
  aiCustomInstructionsTable,
  conversations,
  messages,
  notificationsTable,
  teachersTable,
} from "@workspace/db";
import { anthropic, SONNET_MODEL, estimateCostMicroUsd } from "../lib/anthropic-client";
import { checkCredits, captureCredits, refundCredits } from "../lib/check-credits";
import { recordCachedAiUsage, trackAiUsageCall } from "../lib/ai-usage-ledger";
import { buildSystemPrompt, HASAD_SYSTEM_PROMPT } from "../lib/ai-system-prompt";
import { resolveAiContentLanguage } from "../lib/ai-content-language";
import { logActivity } from "../lib/activity-logger";
import { trackEvent } from "../lib/analytics";
import { sendEmail, getAppBaseUrl } from "../lib/email";
import { esc } from "../lib/html-escape";
import { logger } from "../lib/logger";
import { emitToTeacher } from "../lib/realtime";

const router: Router = Router();

// Retain recent turns for conversational continuity.
const HISTORY_TURNS = 4; // last 4 user+assistant pairs
const MAX_CHAT_MESSAGE_CHARS = 24_000;
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeForHash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashQuestion(s: string): string {
  return crypto.createHash("sha256").update(normalizeForHash(s)).digest("hex");
}

// Changes automatically whenever the bundled persona, knowledge, or FAQ changes,
// preventing an old first-turn answer from surviving a knowledge update.
const KNOWLEDGE_CACHE_VERSION = hashQuestion(HASAD_SYSTEM_PROMPT).slice(0, 16);

async function getTeacherId(req: any, res: any): Promise<number | null> {
  const tid = req.session?.teacherId;
  if (!tid) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return tid;
}

async function isAdmin(teacherId: number): Promise<boolean> {
  const row = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  return !!row[0]?.isAdmin;
}

async function getTodayUsage(teacherId: number) {
  const day = todayUtc();
  const rows = await db
    .select()
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.teacherId, teacherId), eq(aiUsageDaily.day, day)))
    .limit(1);
  return rows[0] ?? null;
}

// Hasaad Guide is open to every teacher and organizer with no daily cap.
// We still bump the per-day counter for stats/observability, but never deny.
async function reserveSlot(teacherId: number): Promise<number> {
  const day = todayUtc();
  const result = await db.execute(sql`
    INSERT INTO ai_usage_daily (teacher_id, day, message_count, tokens_in, tokens_out, cost_micro_usd)
    VALUES (${teacherId}, ${day}, 1, 0, 0, 0)
    ON CONFLICT (teacher_id, day) DO UPDATE
      SET message_count = ai_usage_daily.message_count + 1
    RETURNING message_count AS new_count
  `);
  const rows = (result as any).rows ?? result;
  const n = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).new_count) : NaN;
  return Number.isFinite(n) ? n : 1;
}

// Add token/cost data to today's row after the provider call completes.
async function addUsageStats(
  teacherId: number,
  tokensIn: number,
  tokensOut: number,
  costMicroUsd: number,
) {
  const day = todayUtc();
  await db
    .update(aiUsageDaily)
    .set({
      tokensIn: sql`${aiUsageDaily.tokensIn} + ${tokensIn}`,
      tokensOut: sql`${aiUsageDaily.tokensOut} + ${tokensOut}`,
      costMicroUsd: sql`${aiUsageDaily.costMicroUsd} + ${costMicroUsd}`,
    })
    .where(and(eq(aiUsageDaily.teacherId, teacherId), eq(aiUsageDaily.day, day)));
}

// Refund a slot if the provider call failed (so the user isn't charged a slot).
async function refundSlot(teacherId: number) {
  const day = todayUtc();
  await db.execute(sql`
    UPDATE ai_usage_daily
    SET message_count = GREATEST(message_count - 1, 0)
    WHERE teacher_id = ${teacherId} AND day = ${day}
  `);
}

// GET /api/ai-chat/usage — today's usage and plan-driven limit
router.get("/usage", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  // Daily cap removed for all teachers/organizers — return open quota so the
  // UI does not display a usage counter or hit-limit warnings.
  const usage = await getTodayUsage(teacherId);
  res.json({
    used: usage?.messageCount ?? 0,
    limit: null,
    remaining: null,
    resetAt: `${todayUtc()}T23:59:59Z`,
  });
});

// GET /api/ai-chat/conversations — list user's conversations
router.get("/conversations", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      supportStatus: conversations.supportStatus,
      supportRequestedAt: conversations.supportRequestedAt,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(eq(conversations.teacherId, teacherId))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
  res.json({ conversations: rows });
});

// GET /api/ai-chat/conversations/:id — get one conversation with all messages
router.get("/conversations/:id", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const convo = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.teacherId, teacherId)))
    .limit(1);
  if (!convo[0]) return res.status(404).json({ error: "not_found" });
  const msgs = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
      cached: messages.cached,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ conversation: convo[0], messages: msgs });
});

// DELETE /api/ai-chat/conversations/:id
router.delete("/conversations/:id", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.teacherId, teacherId)));
  res.json({ ok: true });
});

const sendBody = z.object({
  conversationId: z.number().int().positive().nullable().optional(),
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS),
  language: z.enum(["ar", "en"]).optional(),
});

const supportMessageBody = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS),
});

async function notifyAdminsOfSupportRequest(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: { teacherId: number; teacherName: string; conversationId: number; title: string; preview: string },
) {
  const admins = await tx
    .select({ id: teachersTable.id, email: teachersTable.email })
    .from(teachersTable)
    .where(eq(teachersTable.isAdmin, true));
  const recipients = admins.filter((admin) => admin.id !== input.teacherId);
  if (recipients.length === 0) return [];
  await tx.insert(notificationsTable).values(
    recipients.map((admin) => ({
      teacherId: admin.id,
      type: "ai_support_request",
      title: `طلب دعم عبر مرشد حصاد من ${input.teacherName}`,
      body: input.preview.length > 120 ? `${input.preview.slice(0, 120)}…` : input.preview,
      actionUrl: `/teacher/admin?tab=ai-chat&conversation=${input.conversationId}`,
    })),
  );
  return recipients;
}

async function emailAdminsOfSupportRequest(
  recipients: Array<{ id: number; email: string | null }>,
  input: { teacherName: string; conversationId: number; title: string },
): Promise<void> {
  const emails = [...new Set(recipients.map((admin) => admin.email?.trim()).filter(Boolean))] as string[];
  if (emails.length === 0) return;
  const actionUrl = `${getAppBaseUrl()}/teacher/admin?tab=ai-chat&conversation=${input.conversationId}`;
  const subject = `طلب دعم جديد من ${input.teacherName} — مرشد حصاد`;
  const text = [
    `طلب ${input.teacherName} دعمًا فنيًا عبر مرشد حصاد.`,
    `المحادثة: ${input.title}`,
    `فتح المحادثة والرد مباشرة: ${actionUrl}`,
  ].join("\n");
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#163028">
      <h2 style="margin:0 0 12px">طلب دعم جديد عبر مرشد حصاد</h2>
      <p>طلب <strong>${esc(input.teacherName)}</strong> دعمًا فنيًا.</p>
      <p style="padding:12px;background:#f3f7f5;border-radius:10px">${esc(input.title)}</p>
      <p><a href="${actionUrl}" style="display:inline-block;background:#225739;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:bold">فتح المحادثة والرد</a></p>
      <p style="font-size:12px;color:#65756d">سيبقى ردك داخل محادثة مرشد حصاد نفسها.</p>
    </div>`;
  const results = await Promise.all(emails.map((to) => sendEmail({ to, subject, html, text })));
  results.forEach((result, index) => {
    if (!result.delivered) {
      logger.warn({ reason: result.reason, recipientIndex: index }, "Hasaad Guide support email was not delivered");
    }
  });
}

// POST /api/ai-chat/conversations/:id/request-support
router.post("/conversations/:id/request-support", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "bad_id" });

  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        id: conversations.id,
        title: conversations.title,
        supportStatus: conversations.supportStatus,
        teacherName: teachersTable.name,
      })
      .from(conversations)
      .innerJoin(teachersTable, eq(conversations.teacherId, teachersTable.id))
      .where(and(eq(conversations.id, id), eq(conversations.teacherId, teacherId)))
      .limit(1);
    if (!conversation) return null;
    if (conversation.supportStatus !== "ai") {
      return { supportStatus: conversation.supportStatus, alreadyRequested: true };
    }

    const now = new Date();
    const updated = await tx
      .update(conversations)
      .set({ supportStatus: "requested", supportRequestedAt: now, updatedAt: now })
      .where(and(
        eq(conversations.id, id),
        eq(conversations.teacherId, teacherId),
        eq(conversations.supportStatus, "ai"),
      ))
      .returning({ supportStatus: conversations.supportStatus });
    if (!updated[0]) {
      const [current] = await tx
        .select({ supportStatus: conversations.supportStatus })
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.teacherId, teacherId)))
        .limit(1);
      return {
        supportStatus: current?.supportStatus ?? "requested",
        alreadyRequested: true,
      };
    }
    await tx.insert(messages).values({
      conversationId: id,
      role: "support_system",
      content: "تم تحويل هذه المحادثة إلى الدعم الفني. يمكنك متابعة الكتابة هنا، وسيظهر رد فريق حصاد داخل المحادثة نفسها.",
    });
    const recipients = await notifyAdminsOfSupportRequest(tx, {
      teacherId,
      teacherName: conversation.teacherName,
      conversationId: id,
      title: conversation.title,
      preview: conversation.title,
    });
    return {
      supportStatus: "requested" as const,
      alreadyRequested: false as const,
      recipients,
      teacherName: conversation.teacherName,
      title: conversation.title,
    };
  });

  if (!result) return res.status(404).json({ error: "not_found" });
  if (
    "recipients" in result &&
    Array.isArray(result.recipients) &&
    typeof result.teacherName === "string" &&
    typeof result.title === "string"
  ) {
    await emailAdminsOfSupportRequest(result.recipients, {
      teacherName: result.teacherName,
      conversationId: id,
      title: result.title,
    });
    result.recipients.forEach((admin) => emitToTeacher(admin.id, "ai-support:update", {
      conversationId: id,
      type: "requested",
    }));
  }
  res.json({
    supportStatus: result.supportStatus,
    alreadyRequested: result.alreadyRequested,
  });
});

// POST /api/ai-chat/conversations/:id/support-messages
router.post("/conversations/:id/support-messages", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  const id = Number(req.params.id);
  const parsed = supportMessageBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) {
    return res.status(400).json({ error: "bad_request" });
  }

  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        id: conversations.id,
        title: conversations.title,
        supportStatus: conversations.supportStatus,
        teacherName: teachersTable.name,
      })
      .from(conversations)
      .innerJoin(teachersTable, eq(conversations.teacherId, teachersTable.id))
      .where(and(eq(conversations.id, id), eq(conversations.teacherId, teacherId)))
      .limit(1);
    if (!conversation) return { kind: "not_found" as const };
    if (!["requested", "human"].includes(conversation.supportStatus)) {
      return { kind: "not_support" as const };
    }
    const [created] = await tx.insert(messages).values({
      conversationId: id,
      role: "user",
      content: parsed.data.message,
    }).returning({ id: messages.id, createdAt: messages.createdAt });
    await tx.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
    const recipients = await notifyAdminsOfSupportRequest(tx, {
      teacherId,
      teacherName: conversation.teacherName,
      conversationId: id,
      title: conversation.title,
      preview: parsed.data.message,
    });
    return { kind: "ok" as const, message: created, recipients };
  });
  if (result.kind === "not_found") return res.status(404).json({ error: "not_found" });
  if (result.kind === "not_support") return res.status(409).json({ error: "not_in_support" });
  result.recipients.forEach((admin) => emitToTeacher(admin.id, "ai-support:update", {
    conversationId: id,
    type: "teacher_message",
  }));
  res.status(201).json({ ok: true, message: result.message });
});

// POST /api/ai-chat/messages — send a message, get a reply
router.post("/messages", checkCredits("ai-chat"), async (req, res) => {
  try {
    await handleSendMessage(req, res);
  } catch (err) {
    // Any unexpected throw (DB failure etc.) must not strand the credit hold.
    await refundCredits(req, "unexpected error");
    req.log?.error?.({ err }, "ai-chat message failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "server_error", message: "حدث خطأ غير متوقع. حاول مرة أخرى." });
    }
  }
});

async function handleSendMessage(req: any, res: any) {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;

  const parsed = sendBody.safeParse(req.body);
  if (!parsed.success) {
    await refundCredits(req, "invalid input");
    const messageIssue = parsed.error.issues.find((issue) => issue.path.includes("message"));
    const message = messageIssue?.code === "too_big"
      ? `النص طويل جداً. الحد الأقصى ${MAX_CHAT_MESSAGE_CHARS.toLocaleString("ar-KW")} حرف.`
      : "أدخل نصاً صالحاً ثم حاول مرة أخرى.";
    return res.status(400).json({ error: "bad_request", message, details: parsed.error.message });
  }
  const { message } = parsed.data;
  const language = resolveAiContentLanguage({
    preferredLanguage: parsed.data.language,
    primaryText: message,
  });

  logActivity({
    req,
    userId: teacherId,
    userRole: "teacher",
    action: "ai_use",
    details: { feature: "ai_chat", messageLength: message.length },
  });
  trackEvent({
    req,
    userId: teacherId,
    userRole: "teacher",
    eventName: "ai_generation_requested",
    eventCategory: "ai",
    metadata: { feature: "ai_chat", messageLength: message.length },
  });

  // Find or create conversation FIRST so we can detect first-turn for cache lookup.
  let conversationId = parsed.data.conversationId ?? null;
  let isFirstTurn: boolean;
  if (conversationId) {
    const owned = await db
      .select({ id: conversations.id, supportStatus: conversations.supportStatus })
      .from(conversations)
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.teacherId, teacherId)),
      )
      .limit(1);
    if (!owned[0]) {
      await refundCredits(req, "conversation not found");
      return res.status(404).json({ error: "conversation_not_found" });
    }
    if (owned[0].supportStatus !== "ai") {
      await refundCredits(req, "conversation is handled by human support");
      return res.status(409).json({
        error: "support_mode",
        message: "هذه المحادثة محالة إلى الدعم الفني. ستصل رسالتك التالية إلى فريق حصاد مباشرة.",
        supportStatus: owned[0].supportStatus,
      });
    }
    const priorCount = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    isFirstTurn = (priorCount[0]?.c ?? 0) === 0;
  } else {
    isFirstTurn = true;
  }

  // First-turn cache lookup — runs BEFORE rate-limit, since cached hits are free.
  const qHash = hashQuestion(`${KNOWLEDGE_CACHE_VERSION}:${language}:${message}`);
  if (isFirstTurn) {
    const cached = await db
      .select()
      .from(aiCache)
      .where(eq(aiCache.questionHash, qHash))
      .limit(1);
    if (cached[0]) {
      const answer = cached[0].answer;
      await recordCachedAiUsage(req, {
        toolKey: "ai-chat",
        callKey: "anthropic-chat:first-turn-cache",
        provider: "anthropic",
        model: cached[0].model,
        modality: "text",
      });
      // Materialize conversation if needed.
      if (!conversationId) {
        const inserted = await db
          .insert(conversations)
          .values({ teacherId, title: message.slice(0, 60) })
          .returning({ id: conversations.id });
        conversationId = inserted[0].id;
      }
      await db.insert(messages).values({
        conversationId: conversationId!,
        role: "user",
        content: message,
      });
      await db.insert(messages).values({
        conversationId: conversationId!,
        role: "assistant",
        content: answer,
        model: cached[0].model,
        cached: 1,
      });
      await db
        .update(aiCache)
        .set({
          hitCount: sql`${aiCache.hitCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(aiCache.questionHash, qHash));
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId!));
      const usageNow = await getTodayUsage(teacherId);
      // Cached hit — no provider cost, so return the held credits.
      await refundCredits(req, "cached response — free");
      return res.json({
        conversationId,
        reply: answer,
        cached: true,
        usage: {
          used: usageNow?.messageCount ?? 0,
          limit: null,
          remaining: null,
        },
      });
    }
  }

  // No cap — bump the per-day counter for stats and continue.
  const newCount = await reserveSlot(teacherId);
  const used = newCount - 1; // count BEFORE this slot was reserved

  // Materialize conversation now that we've reserved a slot.
  if (!conversationId) {
    const inserted = await db
      .insert(conversations)
      .values({ teacherId, title: message.slice(0, 60) })
      .returning({ id: conversations.id });
    conversationId = inserted[0].id;
  }
  await db.insert(messages).values({
    conversationId: conversationId!,
    role: "user",
    content: message,
  });

  // Build short rolling history (last N turns) for context
  const recent = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId!))
    .orderBy(desc(messages.id))
    .limit(HISTORY_TURNS * 2);
  recent.reverse();

  const apiMessages = recent
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "assistant" | "user",
      content: m.content,
    }));

  let assistantText = "";
  let tokensIn = 0;
  let tokensOut = 0;

  // Load admin custom instructions (cached per request — one fast PK lookup)
  const customRows = await db.select().from(aiCustomInstructionsTable).limit(1);
  const fullSystemPrompt = buildSystemPrompt(customRows[0]?.content, language);

  try {
    const completion = await trackAiUsageCall(req, {
      toolKey: "ai-chat",
      callKey: "anthropic-chat:reply",
      provider: "anthropic",
      model: SONNET_MODEL,
      modality: "text",
    }, () => anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages: apiMessages,
    }), (result) => ({
      tokensIn: result.usage?.input_tokens,
      tokensOut: result.usage?.output_tokens,
    }));
    if (!completion) throw new Error("AI usage call was already completed");
    for (const block of completion.content) {
      if (block.type === "text") assistantText += block.text;
    }
    tokensIn = completion.usage?.input_tokens ?? 0;
    tokensOut = completion.usage?.output_tokens ?? 0;
  } catch (err: any) {
    console.error("[ai-chat] Anthropic call failed:", err?.message || err);
    // Refund the slot we reserved since no provider work was done.
    await refundSlot(teacherId).catch(() => {});
    await refundCredits(req, "ai provider error");
    return res.status(502).json({
      error: "ai_provider_error",
      message: "تعذّر الاتصال بالمساعد الذكي حالياً. حاول مرة أخرى بعد قليل.",
    });
  }

  if (!assistantText.trim()) {
    assistantText = "عذراً، لم أتمكن من توليد رد. حاول صياغة سؤالك بشكل مختلف.";
  }

  const costMicroUsd = estimateCostMicroUsd(tokensIn, tokensOut);

  await db.insert(messages).values({
    conversationId: conversationId!,
    role: "assistant",
    content: assistantText,
    model: SONNET_MODEL,
    tokensIn,
    tokensOut,
    costMicroUsd,
  });
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId!));
  await addUsageStats(teacherId, tokensIn, tokensOut, costMicroUsd);

  // Cache first-turn responses for cheap reuse
  if (isFirstTurn && tokensOut > 0) {
    await db
      .insert(aiCache)
      .values({
        questionHash: qHash,
        question: message,
        answer: assistantText,
        model: SONNET_MODEL,
      })
      .onConflictDoNothing();
  }

  const finalUsage = await getTodayUsage(teacherId);
  const responseBody = {
    conversationId,
    reply: assistantText,
    cached: false,
    usage: {
      used: finalUsage?.messageCount ?? 0,
      limit: null,
      remaining: null,
    },
  };
  await captureCredits(req, responseBody);
  res.json(responseBody);
}

// ============== Admin endpoints ==============

// GET /api/ai-chat/admin/instructions — get custom instructions
router.get("/admin/instructions", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "forbidden" });
  const rows = await db.select().from(aiCustomInstructionsTable).limit(1);
  res.json({ content: rows[0]?.content ?? "" });
});

// PUT /api/ai-chat/admin/instructions — save custom instructions
router.put("/admin/instructions", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "forbidden" });
  const { content } = z.object({ content: z.string().max(8000) }).parse(req.body);
  const existing = await db.select({ id: aiCustomInstructionsTable.id }).from(aiCustomInstructionsTable).limit(1);
  if (existing[0]) {
    await db.update(aiCustomInstructionsTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(aiCustomInstructionsTable.id, existing[0].id));
  } else {
    await db.insert(aiCustomInstructionsTable).values({ content });
  }
  res.json({ ok: true });
});

// GET /api/ai-chat/admin/conversations — admin: list all conversations
router.get("/admin/conversations", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "forbidden" });

  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      teacherId: conversations.teacherId,
      teacherName: teachersTable.name,
      teacherEmail: teachersTable.email,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      supportStatus: conversations.supportStatus,
      supportRequestedAt: conversations.supportRequestedAt,
      supportAdminId: conversations.supportAdminId,
    })
    .from(conversations)
    .leftJoin(teachersTable, eq(conversations.teacherId, teachersTable.id))
    .orderBy(
      sql`CASE WHEN ${conversations.supportStatus} = 'requested' THEN 0 WHEN ${conversations.supportStatus} = 'human' THEN 1 ELSE 2 END`,
      desc(conversations.updatedAt),
    )
    .limit(200);
  res.json({ conversations: rows });
});

// GET /api/ai-chat/admin/conversations/:id — admin: any conversation's messages
router.get("/admin/conversations/:id", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "forbidden" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "bad_id" });
  const convo = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      teacherId: conversations.teacherId,
      teacherName: teachersTable.name,
      teacherEmail: teachersTable.email,
      createdAt: conversations.createdAt,
      supportStatus: conversations.supportStatus,
      supportRequestedAt: conversations.supportRequestedAt,
      supportAdminId: conversations.supportAdminId,
    })
    .from(conversations)
    .leftJoin(teachersTable, eq(conversations.teacherId, teachersTable.id))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!convo[0]) return res.status(404).json({ error: "not_found" });
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ conversation: convo[0], messages: msgs });
});

const adminReplyBody = z.object({
  message: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_CHARS),
});

// POST /api/ai-chat/admin/conversations/:id/reply — continue a transferred chat as support
router.post("/admin/conversations/:id/reply", async (req, res) => {
  const adminId = await getTeacherId(req, res);
  if (!adminId) return;
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: "forbidden" });
  const id = Number(req.params.id);
  const parsed = adminReplyBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) {
    return res.status(400).json({ error: "bad_request" });
  }

  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({
        teacherId: conversations.teacherId,
        supportStatus: conversations.supportStatus,
      })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    if (!conversation) return { kind: "not_found" as const };
    if (!["requested", "human"].includes(conversation.supportStatus)) {
      return { kind: "not_support" as const };
    }
    const now = new Date();
    const [created] = await tx.insert(messages).values({
      conversationId: id,
      role: "admin",
      content: parsed.data.message,
    }).returning({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    });
    await tx.update(conversations).set({
      supportStatus: "human",
      supportAdminId: adminId,
      updatedAt: now,
    }).where(eq(conversations.id, id));
    await tx.insert(notificationsTable).values({
      teacherId: conversation.teacherId,
      type: "ai_support_reply",
      title: "رد جديد من دعم حصاد",
      body: parsed.data.message.length > 120
        ? `${parsed.data.message.slice(0, 120)}…`
        : parsed.data.message,
      actionUrl: `/teacher/dashboard?guideConversation=${id}`,
    });
    return { kind: "ok" as const, message: created, teacherId: conversation.teacherId };
  });
  if (result.kind === "not_found") return res.status(404).json({ error: "not_found" });
  if (result.kind === "not_support") return res.status(409).json({ error: "not_in_support" });
  emitToTeacher(result.teacherId, "ai-support:update", {
    conversationId: id,
    type: "admin_reply",
  });
  res.status(201).json({ ok: true, supportStatus: "human", message: result.message });
});

// POST /api/ai-chat/admin/conversations/:id/close-support — return the chat to the guide
router.post("/admin/conversations/:id/close-support", async (req, res) => {
  const adminId = await getTeacherId(req, res);
  if (!adminId) return;
  if (!(await isAdmin(adminId))) return res.status(403).json({ error: "forbidden" });
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "bad_id" });

  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx
      .select({ teacherId: conversations.teacherId, supportStatus: conversations.supportStatus })
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    if (!conversation) return null;
    const now = new Date();
    await tx.update(conversations).set({
      supportStatus: "ai",
      supportAdminId: null,
      updatedAt: now,
    }).where(eq(conversations.id, id));
    if (conversation.supportStatus !== "ai") {
      await tx.insert(messages).values({
        conversationId: id,
        role: "support_system",
        content: "أنهى فريق الدعم المحادثة. يمكنك الآن متابعة الحديث مع مرشد حصاد.",
      });
      await tx.insert(notificationsTable).values({
        teacherId: conversation.teacherId,
        type: "ai_support_closed",
        title: "اكتملت متابعة دعم حصاد",
        body: "يمكنك الآن متابعة الحديث مع مرشد حصاد في المحادثة نفسها.",
        actionUrl: `/teacher/dashboard?guideConversation=${id}`,
      });
    }
    return { supportStatus: "ai" as const, teacherId: conversation.teacherId };
  });
  if (!result) return res.status(404).json({ error: "not_found" });
  emitToTeacher(result.teacherId, "ai-support:update", {
    conversationId: id,
    type: "closed",
  });
  res.json({ supportStatus: result.supportStatus });
});

// GET /api/ai-chat/admin/stats — admin: usage stats
router.get("/admin/stats", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;
  if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "forbidden" });

  const totals = await db
    .select({
      conversations: sql<number>`(select count(*)::int from conversations)`,
      messages: sql<number>`(select count(*)::int from messages where role = 'assistant')`,
      cacheEntries: sql<number>`(select count(*)::int from ai_cache)`,
      cacheHits: sql<number>`(select coalesce(sum(hit_count),0)::int from ai_cache)`,
      totalCostMicroUsd: sql<number>`(select coalesce(sum(cost_micro_usd),0)::bigint from ai_usage_daily)`,
    })
    .from(sql`(select 1) as _`);
  const today = todayUtc();
  const todayUsage = await db
    .select({
      messages: sql<number>`coalesce(sum(${aiUsageDaily.messageCount}),0)::int`,
      costMicroUsd: sql<number>`coalesce(sum(${aiUsageDaily.costMicroUsd}),0)::bigint`,
    })
    .from(aiUsageDaily)
    .where(eq(aiUsageDaily.day, today));

  res.json({
    totals: totals[0],
    today: todayUsage[0],
  });
});

export default router;
