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
  teachersTable,
} from "@workspace/db";
import { anthropic, SONNET_MODEL, estimateCostMicroUsd } from "../lib/anthropic-client";
import { buildSystemPrompt } from "../lib/ai-system-prompt";
import { logActivity } from "../lib/activity-logger";
import { trackEvent } from "../lib/analytics";

const router: Router = Router();

// Per-plan daily AI caps are the source of truth via @workspace/billing.
const HISTORY_TURNS = 4; // last 4 user+assistant pairs

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeForHash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashQuestion(s: string): string {
  return crypto.createHash("sha256").update(normalizeForHash(s)).digest("hex");
}

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

// Hasad Guide is open to every teacher and organizer with no daily cap.
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
  message: z.string().min(1).max(4000),
});

// POST /api/ai-chat/messages — send a message, get a reply
router.post("/messages", async (req, res) => {
  const teacherId = await getTeacherId(req, res);
  if (!teacherId) return;

  const parsed = sendBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "bad_request", details: parsed.error.message });
  }
  const { message } = parsed.data;

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
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.teacherId, teacherId)),
      )
      .limit(1);
    if (!owned[0]) return res.status(404).json({ error: "conversation_not_found" });
    const priorCount = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    isFirstTurn = (priorCount[0]?.c ?? 0) === 0;
  } else {
    isFirstTurn = true;
  }

  // First-turn cache lookup — runs BEFORE rate-limit, since cached hits are free.
  const qHash = hashQuestion(message);
  if (isFirstTurn) {
    const cached = await db
      .select()
      .from(aiCache)
      .where(eq(aiCache.questionHash, qHash))
      .limit(1);
    if (cached[0]) {
      const answer = cached[0].answer;
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

  const apiMessages = recent.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));

  let assistantText = "";
  let tokensIn = 0;
  let tokensOut = 0;

  // Load admin custom instructions (cached per request — one fast PK lookup)
  const customRows = await db.select().from(aiCustomInstructionsTable).limit(1);
  const fullSystemPrompt = buildSystemPrompt(customRows[0]?.content);

  try {
    const completion = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages: apiMessages,
    });
    for (const block of completion.content) {
      if (block.type === "text") assistantText += block.text;
    }
    tokensIn = completion.usage?.input_tokens ?? 0;
    tokensOut = completion.usage?.output_tokens ?? 0;
  } catch (err: any) {
    console.error("[ai-chat] Anthropic call failed:", err?.message || err);
    // Refund the slot we reserved since no provider work was done.
    await refundSlot(teacherId).catch(() => {});
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
  res.json({
    conversationId,
    reply: assistantText,
    cached: false,
    usage: {
      used: finalUsage?.messageCount ?? 0,
      limit: null,
      remaining: null,
    },
  });
});

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
    })
    .from(conversations)
    .leftJoin(teachersTable, eq(conversations.teacherId, teachersTable.id))
    .orderBy(desc(conversations.updatedAt))
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
