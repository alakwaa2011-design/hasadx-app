/* AI Presentation Builder — Phase 1A
   Outline generation + draft CRUD. NO slide build here — Phase 1B
   (task #458) will read drafts whose `status === 'outline_ready'` and
   produce real `presentations` rows. */

import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z, ZodError } from "zod";
import {
  db,
  presentationDraftsTable,
  aiCache,
  aiUsageDaily,
  presentationsTable,
} from "@workspace/db";
import { buildOneSlide } from "../lib/materialize-slide";
import { slideSchema, slidesSchema } from "./presentations";
import type { OutlineCard, Density, Lang } from "@workspace/slide-templates";
import { openai } from "@workspace/integrations-openai-ai-server";
import { resolveTier, modelForTier, isClaudeTier, type AiTier } from "../lib/ai-tier";
import { anthropic, SONNET_MODEL, estimateCostMicroUsd } from "../lib/anthropic-client";
import { sensitiveActionLimiter } from "../lib/rate-limiter";
import {
  buildOutlinePrompt,
  systemPromptFor,
  type OutlineBrief,
} from "../lib/outline-prompt";
import {
  sanitizeOutline,
  buildRetryMessage,
  sanitizeText,
} from "../lib/outline-guardrails";

const router: IRouter = Router();

function requireTeacher(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/* ── Tier-driven daily caps for outline generation. Mirrors the
   model-routing scheme in ai-tier.ts but expressed as outline-specific
   limits (decisions documented in task #457). */
interface OutlineTierConfig {
  dailyOutlines: number;
  maxSlides: number;
  allowedDensities: Array<"minimal" | "balanced" | "detailed">;
  allowClaude: boolean;
}

function outlineConfigForTier(tier: AiTier): OutlineTierConfig {
  if (tier === "claude") {
    return {
      dailyOutlines: 30,
      maxSlides: 30,
      allowedDensities: ["minimal", "balanced", "detailed"],
      allowClaude: true,
    };
  }
  if (tier === "pro") {
    return {
      dailyOutlines: 15,
      maxSlides: 20,
      allowedDensities: ["minimal", "balanced", "detailed"],
      allowClaude: false,
    };
  }
  // Free / standard tier.
  return {
    dailyOutlines: 3,
    maxSlides: 10,
    allowedDensities: ["balanced"],
    allowClaude: false,
  };
}

const briefSchema = z.object({
  language: z.enum(["ar", "en"]).default("ar"),
  subject: z.string().trim().min(1).max(100),
  gradeLevel: z.string().trim().min(1).max(50),
  topic: z.string().trim().min(1).max(120),
  presentationKind: z.enum(["explain", "review", "interactive", "quick", "contest"]),
  slideCount: z.number().int().min(5).max(30),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  languageLevel: z.enum(["simple", "medium", "advanced"]).default("medium"),
  density: z.enum(["minimal", "balanced", "detailed"]).default("balanced"),
  toggles: z.object({
    activities: z.boolean().default(false),
    questions: z.boolean().default(false),
    poll: z.boolean().default(false),
    quiz: z.boolean().default(false),
  }).default({ activities: false, questions: false, poll: false, quiz: false }),
  notes: z.string().trim().max(200).optional(),
});

/* ── Outline schema (matches the OpenAPI types and the prompt's JSON
   example). Bounded everywhere so the model can't blow up the row. */
const outlineSlideKindSchema = z.enum([
  "title", "objectives", "concept-card", "comparison", "visual-hero",
  "steps", "interactive", "closure", "timeline", "formula",
  /* Presentation-director additions — see lib/slide-templates. */
  "stat", "quote", "callout",
]);

const outlineSlideCardSchema = z.object({
  index: z.number().int().min(1).max(30),
  kind: outlineSlideKindSchema,
  title: z.string().min(1).max(80),
  subtitle: z.string().max(80).optional(),
  purpose: z.string().min(1).max(140),
  talkingPoints: z.array(z.string().min(1).max(140)).min(1).max(6),
  interactionHint: z.enum(["poll", "quiz", "discussion", "activity"]).nullable(),
  /* Phase 3 — optional Hasad live-game suggestion. Allowed values
     mirror the discriminated `hasad-game` element in `presentations.ts`
     and the materializer in `lib/slide-templates`. Nullable so the
     model can omit it on slides where no game fits. */
  gameSuggestion: z.enum([
    "kahoot", "wheel", "millionaire", "flag-quiz", "capitals",
    "letrly", "rocket", "tug", "maraqui", "hack",
  ]).nullable().optional(),
  /* Phase 5 — AI-generated complete question set for the slide's
     suggested game. When present, the editor + live-control "Start
     activity" button opens the in-Hasad Activity Runner with these
     questions pre-loaded instead of the legacy game-setup page. */
  gameQuestions: z.array(z.object({
    prompt: z.string().min(1).max(500),
    options: z.array(z.string().min(1).max(200)).min(2).max(6),
    correctIndex: z.number().int().min(0).max(5),
  })).max(20).optional(),
  /* Phase 4 — per-slide design intelligence. Allowed values mirror
     the SLIDE_THEMES registry. Persisted on the outline so the
     materializer can read it back and stamp a per-slide background.
     Zod object parsing strips unknown keys, so this MUST be declared
     here even though guardrails already validate the value. */
  slideTheme: z.enum([
    "harvest", "ocean", "sunset", "midnight", "rose",
    "royal", "noor", "sage", "sand", "obsidian",
    "linen", "mist", "clay", "pine", "ink",
  ]).nullable().optional(),
  visualDirection: z.object({
    icon: z.string().max(80).optional(),
    shape: z.enum(["rect", "circle", "line", "arrow", "divider"]).optional(),
    layoutHint: z.string().max(200).optional(),
  }),
  source: z.string().max(200).optional(),
});

const outlineSchema = z.object({
  language: z.enum(["ar", "en"]),
  density: z.enum(["minimal", "balanced", "detailed"]),
  totalEstimatedMinutes: z.number().int().min(1).max(240),
  objectives: z.array(z.string().min(1).max(140)).min(2).max(6),
  teachingFlow: z.array(z.object({
    stage: z.enum(["opener", "concept", "practice", "closure"]),
    slideIndices: z.array(z.number().int().min(1).max(30)).min(1),
    estimatedMinutes: z.number().int().min(1).max(240),
  })).length(4),
  slides: z.array(outlineSlideCardSchema).min(3).max(30),
});

const patchBody = z.object({
  outline: outlineSchema.optional(),
  status: z.enum(["draft", "outline_ready"]).optional(),
});

/* ── Helpers ───────────────────────────────────────────────────── */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeForHash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function briefHash(brief: OutlineBrief, model: string): string {
  // Stable hash over the meaningful brief fields + model so a teacher
  // hitting "regenerate" with the same brief returns from cache.
  // v3: reverted per-slide color variety — ONE deck theme, null per slide.
  //     Added structural layout personality per deck instead (May 2026).
  //     Bump this constant whenever DESIGN_RULES or system prompt changes.
  const PROMPT_VERSION = "v3-deck-theme-consistency";
  const obj = {
    _pv: PROMPT_VERSION,
    m: model,
    l: brief.language,
    s: normalizeForHash(brief.subject),
    g: normalizeForHash(brief.gradeLevel),
    t: normalizeForHash(brief.topic),
    k: brief.presentationKind,
    n: brief.slideCount,
    d: brief.durationMinutes,
    lvl: brief.languageLevel,
    den: brief.density,
    tg: brief.toggles,
    nt: normalizeForHash(brief.notes ?? ""),
  };
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function parseJsonLoose(text: string): unknown {
  if (!text) return null;
  const trimmed = text.trim();
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    try { return JSON.parse(fence[1]); } catch { /* fall through */ }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch { /* fall through */ }
  }
  return null;
}

interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

/* Local completion runner. Same routing as lesson_plans.runTierCompletion
   but exposes token counts so we can persist usage on the draft row. */
async function runOutlineCompletion(opts: {
  tier: AiTier;
  system: string;
  userMessages: string[];
}): Promise<CompletionResult> {
  if (isClaudeTier(opts.tier)) {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 4000,
      system: opts.system,
      messages: opts.userMessages.map((content) => ({ role: "user" as const, content })),
    });
    const block = response.content.find((c) => c.type === "text");
    return {
      text: block && "text" in block ? block.text : "",
      tokensIn: response.usage?.input_tokens ?? 0,
      tokensOut: response.usage?.output_tokens ?? 0,
    };
  }
  const completion = await openai.chat.completions.create({
    model: modelForTier(opts.tier),
    max_completion_tokens: 4000,
    messages: [
      { role: "system" as const, content: opts.system },
      ...opts.userMessages.map((content) => ({ role: "user" as const, content })),
    ],
  });
  return {
    text: completion.choices[0]?.message?.content || "",
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
  };
}

/* Reserve one outline attempt slot for today. Bumped per non-cached
   provider call (success OR failure) so retry storms can't exceed the
   daily quota. Uses a dedicated `outline_count` column independent of
   chat's `message_count`. */
async function reserveOutlineSlot(teacherId: number): Promise<void> {
  const day = todayUtc();
  await db.execute(sql`
    INSERT INTO ai_usage_daily (teacher_id, day, outline_count, tokens_in, tokens_out, cost_micro_usd)
    VALUES (${teacherId}, ${day}, 1, 0, 0, 0)
    ON CONFLICT (teacher_id, day) DO UPDATE
      SET outline_count = ai_usage_daily.outline_count + 1
  `);
}

async function addOutlineUsage(
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

/* Today's outline attempts (the gate source). Counts every reserved
   slot, so failed generations are still charged — preventing retry
   storms from bypassing the daily limit. */
async function todaysOutlineCount(teacherId: number): Promise<number> {
  const day = todayUtc();
  const [row] = await db
    .select({ n: aiUsageDaily.outlineCount })
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.teacherId, teacherId), eq(aiUsageDaily.day, day)))
    .limit(1);
  return Number(row?.n ?? 0);
}

/* ── GET /api/presentations/ai/limits — UI uses this to decide which
   density radios to disable + show "X / Y outlines today". */
router.get("/presentations/ai/limits", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const tier = await resolveTier(teacherId);
    const cfg = outlineConfigForTier(tier);
    const used = await todaysOutlineCount(teacherId);
    res.json({
      tier,
      dailyOutlines: cfg.dailyOutlines,
      used,
      remaining: Math.max(0, cfg.dailyOutlines - used),
      maxSlides: cfg.maxSlides,
      allowedDensities: cfg.allowedDensities,
      allowClaude: cfg.allowClaude,
    });
  } catch (err) {
    req.log.error({ err }, "Read outline limits failed");
    res.status(500).json({ message: "Failed to read limits" });
  }
});

/* ── POST /api/presentations/ai/outline — Step 1 → Step 2 generation.
   Tier-gated, density-gated, slide-count-gated, rate-limited. */
router.post("/presentations/ai/outline", requireTeacher, sensitiveActionLimiter, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const brief = briefSchema.parse(req.body) as OutlineBrief;

    const tier = await resolveTier(teacherId);
    const cfg = outlineConfigForTier(tier);

    if (brief.slideCount > cfg.maxSlides) {
      res.status(403).json({
        code: "LIMIT_EXCEEDED",
        kind: "slides",
        limit: cfg.maxSlides,
        message: brief.language === "ar"
          ? `الخطة الحالية تسمح بـ ${cfg.maxSlides} شريحة كحد أقصى. ارفع الخطة لزيادة العدد.`
          : `Your plan allows up to ${cfg.maxSlides} slides. Upgrade to raise this cap.`,
      });
      return;
    }
    if (!cfg.allowedDensities.includes(brief.density)) {
      res.status(403).json({
        code: "LIMIT_EXCEEDED",
        kind: "density",
        allowed: cfg.allowedDensities,
        message: brief.language === "ar"
          ? "هذه الكثافة متاحة في الخطة الاحترافية فقط."
          : "This density is available on Pro plans only.",
      });
      return;
    }

    const used = await todaysOutlineCount(teacherId);
    if (used >= cfg.dailyOutlines) {
      res.status(429).json({
        code: "DAILY_LIMIT_REACHED",
        limit: cfg.dailyOutlines,
        message: brief.language === "ar"
          ? `وصلت للحد اليومي (${cfg.dailyOutlines} مخططات). جرّب غداً أو ارفع الخطة.`
          : `Daily outline limit reached (${cfg.dailyOutlines}). Try again tomorrow or upgrade.`,
      });
      return;
    }

    const model = modelForTier(tier);
    const hash = briefHash(brief, model);

    /* Cache short-circuit: if the same brief was generated within the
       last hour, serve the cached outline as a fresh draft (still
       counts the slot for stats but no provider call). */
    const [cached] = await db
      .select()
      .from(aiCache)
      .where(eq(aiCache.questionHash, hash))
      .limit(1);

    let outlineRaw: unknown = null;
    let tokensIn = 0;
    let tokensOut = 0;
    let usedCache = false;

    if (cached && (Date.now() - cached.lastUsedAt.getTime()) < 60 * 60 * 1000) {
      try {
        outlineRaw = JSON.parse(cached.answer);
        usedCache = true;
        await db
          .update(aiCache)
          .set({ hitCount: sql`${aiCache.hitCount} + 1`, lastUsedAt: new Date() })
          .where(eq(aiCache.questionHash, hash));
      } catch { /* fall through, regenerate */ }
    }

    const system = systemPromptFor(brief.language);
    const userPrompt = buildOutlinePrompt(brief);

    if (!outlineRaw) {
      try {
        await reserveOutlineSlot(teacherId);
        const first = await runOutlineCompletion({
          tier,
          system,
          userMessages: [userPrompt],
        });
        tokensIn += first.tokensIn;
        tokensOut += first.tokensOut;
        outlineRaw = parseJsonLoose(first.text);

        if (!outlineRaw) {
          // JSON-repair retry — counts against the daily quota.
          await reserveOutlineSlot(teacherId);
          const retryMsg = brief.language === "ar"
            ? "ردّك السابق لم يكن JSON صالحاً. أعد المحاولة بكائن JSON صارم فقط، بدون أي نص خارجه."
            : "Your previous reply was not valid JSON. Reply with a strict JSON object ONLY — no surrounding text.";
          const second = await runOutlineCompletion({
            tier,
            system,
            userMessages: [userPrompt, retryMsg],
          });
          tokensIn += second.tokensIn;
          tokensOut += second.tokensOut;
          outlineRaw = parseJsonLoose(second.text);
        }
      } catch (err) {
        req.log.error({ err }, "Outline completion failed");
        res.status(502).json({
          message: brief.language === "ar"
            ? "تعذّر الوصول لخدمة الذكاء الاصطناعي. حاول بعد قليل."
            : "AI service unavailable. Please try again shortly.",
        });
        return;
      }
    }

    if (!outlineRaw || typeof outlineRaw !== "object") {
      res.status(422).json({
        message: brief.language === "ar"
          ? "تعذّر إنتاج مخطط صالح. عدّل الموضوع أو أعد المحاولة."
          : "Could not produce a valid outline. Adjust the brief and retry.",
      });
      return;
    }

    let { outline, report } = sanitizeOutline(outlineRaw, brief);

    /* If the guardrails reported issues AND we still have budget, try
       one corrective retry with feedback to the model. Skipped when
       we served from cache (no provider call to retry against). */
    if (!usedCache && report.feedback.length > 0 && !report.fatal) {
      try {
        // Corrective retry — counts against the daily quota.
        await reserveOutlineSlot(teacherId);
        const retry = await runOutlineCompletion({
          tier,
          system,
          userMessages: [userPrompt, buildRetryMessage(report, brief.language)],
        });
        tokensIn += retry.tokensIn;
        tokensOut += retry.tokensOut;
        const retried = parseJsonLoose(retry.text);
        if (retried && typeof retried === "object") {
          const second = sanitizeOutline(retried, brief);
          // Adopt the retry only if it has FEWER feedback issues; else
          // keep the first attempt so we don't regress quality.
          if (second.report.feedback.length < report.feedback.length && !second.report.fatal) {
            outline = second.outline;
            report = second.report;
          }
        }
      } catch (err) {
        req.log.warn({ err }, "Outline corrective retry failed; keeping first sanitized result");
      }
    }

    /* Validate against the strict Zod schema. Sanitize already padded
       talking points and rebuilt the flow, so failure here means the
       model produced something we genuinely can't recover from. */
    const parsed = outlineSchema.safeParse(outline);
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, "Outline failed strict validation");
      res.status(422).json({
        message: brief.language === "ar"
          ? "تعذّر إنتاج مخطط صالح. عدّل الموضوع أو أعد المحاولة."
          : "Could not produce a valid outline. Adjust the brief and retry.",
        issues: parsed.error.issues.slice(0, 5),
      });
      return;
    }

    /* Cache the raw outline (post-sanitize) so subsequent hits skip
       the provider entirely. We store the validated shape, not the
       model's raw text, because we already paid the sanitization cost. */
    if (!usedCache) {
      const cacheValue = JSON.stringify(parsed.data);
      await db
        .insert(aiCache)
        .values({
          questionHash: hash,
          question: `outline:${brief.subject}/${brief.topic}`,
          answer: cacheValue,
          model,
          hitCount: 1,
        })
        .onConflictDoUpdate({
          target: aiCache.questionHash,
          set: { answer: cacheValue, lastUsedAt: new Date() },
        });
    }

    const costMicroUsd = isClaudeTier(tier) ? estimateCostMicroUsd(tokensIn, tokensOut) : 0;
    if (!usedCache && (tokensIn > 0 || tokensOut > 0)) {
      await addOutlineUsage(teacherId, tokensIn, tokensOut, costMicroUsd);
    }

    /* Sanitize free-text brief fields before persisting. Zod already
       trimmed/clipped; sanitizeText additionally strips HTML, control,
       and bidi/zero-width chars so downstream PPTX/PDF/email consumers
       can render safely without re-escaping. */
    const safeBrief = briefSchema.parse({
      ...brief,
      subject: sanitizeText(brief.subject, 100),
      gradeLevel: sanitizeText(brief.gradeLevel, 50),
      topic: sanitizeText(brief.topic, 120),
      notes: brief.notes ? sanitizeText(brief.notes, 200) : undefined,
    });

    const [row] = await db
      .insert(presentationDraftsTable)
      .values({
        teacherId,
        brief: safeBrief,
        outline: parsed.data,
        status: "draft",
        modelUsed: model,
        tokensUsed: tokensIn + tokensOut,
        costMicroUsd,
      })
      .returning();

    res.status(201).json({
      ...row,
      guardrails: { feedback: report.feedback, usedCache },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Invalid brief", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Generate outline failed");
    res.status(500).json({ message: "Failed to generate outline" });
  }
});

/* GET /api/presentations/drafts — list teacher's drafts. */
router.get("/presentations/drafts", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const rows = await db
      .select()
      .from(presentationDraftsTable)
      .where(eq(presentationDraftsTable.teacherId, teacherId))
      .orderBy(desc(presentationDraftsTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List drafts failed");
    res.status(500).json({ message: "Failed to list drafts" });
  }
});

/* ── GET /api/presentations/drafts/:id — single draft (owner only). */
router.get("/presentations/drafts/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    const [row] = await db
      .select()
      .from(presentationDraftsTable)
      .where(eq(presentationDraftsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    if (row.teacherId !== teacherId) { res.status(403).json({ message: "Forbidden" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Read draft failed");
    res.status(500).json({ message: "Failed to read draft" });
  }
});

/* ── PATCH /api/presentations/drafts/:id — owner edits the outline or
   transitions to outline_ready. Outline is re-validated through the
   strict schema. */
router.patch("/presentations/drafts/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    const body = patchBody.parse(req.body);

    const [existing] = await db
      .select()
      .from(presentationDraftsTable)
      .where(eq(presentationDraftsTable.id, id))
      .limit(1);
    if (!existing) { res.status(404).json({ message: "Not found" }); return; }
    if (existing.teacherId !== teacherId) { res.status(403).json({ message: "Forbidden" }); return; }
    /* Built drafts are immutable from this endpoint — Phase 1B owns
       transitions out of `building`/`built`. */
    if (existing.status === "building" || existing.status === "built") {
      res.status(409).json({ message: "Draft is locked once Phase 1B begins" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.outline) updates.outline = body.outline;
    if (body.status) updates.status = body.status;

    const [row] = await db
      .update(presentationDraftsTable)
      .set(updates)
      .where(eq(presentationDraftsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Invalid patch", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Patch draft failed");
    res.status(500).json({ message: "Failed to update draft" });
  }
});

/* ── DELETE /api/presentations/drafts/:id — owner only. */
router.delete("/presentations/drafts/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    const [existing] = await db
      .select({ teacherId: presentationDraftsTable.teacherId })
      .from(presentationDraftsTable)
      .where(eq(presentationDraftsTable.id, id))
      .limit(1);
    if (!existing) { res.status(404).json({ message: "Not found" }); return; }
    if (existing.teacherId !== teacherId) { res.status(403).json({ message: "Forbidden" }); return; }
    await db.delete(presentationDraftsTable).where(eq(presentationDraftsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Delete draft failed");
    res.status(500).json({ message: "Failed to delete draft" });
  }
});

/* ── Phase 1B build helpers
   • Allowed theme keys mirror the frontend SLIDE_THEMES registry. We
     validate against this list rather than accepting an arbitrary
     string so a malformed body cannot persist an unknown theme.
   • In-memory cancel flag map keyed by draftId: the cancel endpoint
     flips the flag, the build loop polls it once per slide. This is
     intentionally simple — single-instance deployment is the current
     target. A future move to multi-instance would migrate the flag
     to the draft row's buildProgress payload. */
/* Mirrors the SLIDE_THEMES registry in
   `artifacts/homework-app/src/lib/slide-themes.ts`. Keep in sync. */
const ALLOWED_THEME_KEYS = [
  "harvest","ocean","sunset","midnight","rose","royal","noor","sage",
  "sand","obsidian","linen","mist","clay","pine","ink",
] as const;
type ThemeKey = (typeof ALLOWED_THEME_KEYS)[number];
function isAllowedTheme(s: string): s is ThemeKey {
  return (ALLOWED_THEME_KEYS as readonly string[]).includes(s);
}
/* Mirrors the SLIDE_PATTERNS registry on the frontend. Anything outside
   this set is silently coerced to "solid" by the build endpoint. */
const ALLOWED_PATTERN_KEYS = new Set<string>([
  "solid","dots","grid","lines","waves","geometric",
]);
const buildBody = z
  .object({
    theme: z.string().max(40).optional(),
    pattern: z.string().max(40).optional(),
    coverEmoji: z.string().max(8).optional(),
  })
  .strict();
const buildCancelFlags = new Map<number, { cancelled: boolean }>();

/* ── POST /api/presentations/ai/build/:draftId — Phase 1B
   Materialize an approved outline (`status === 'outline_ready'`) into
   a real `presentations` row using per-slide layout templates.
   Behaviour:
     • Per-slide validation through the same Zod union the editor PUT
       enforces. A failed slide is SKIPPED with a warning so the rest
       of the build can proceed (spec: "if one slide fails, continue
       remaining + warn").
     • Progress is persisted after every slide so a parallel poll on
       GET /presentations/drafts/:id can drive a real progress bar
       without needing SSE plumbing through the proxy.
     • Cancel is supported via a sibling endpoint that flips an
       in-memory flag; the build loop returns early and persists
       whatever slides were already validated. */
router.post("/presentations/ai/build/:draftId", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const draftId = parseInt(String(req.params.draftId), 10);
    if (!Number.isFinite(draftId)) {
      res.status(400).json({ message: "Bad draftId" });
      return;
    }
    const body = buildBody.parse(req.body ?? {});
    /* Theme/pattern/coverEmoji are optional — we honour what the
       teacher selected in the brief or fall back to the deck-default
       harvest palette. Unknown theme keys are rejected silently
       (logged) and replaced with the default rather than failing the
       whole build for a presentation-layer config glitch. */
    const requestedTheme = body.theme && isAllowedTheme(body.theme) ? body.theme : "harvest";
    if (body.theme && !isAllowedTheme(body.theme)) {
      req.log.warn({ themeKey: body.theme }, "Unknown theme requested for build; falling back to harvest");
    }
    /* Allowlist patterns to keep the editor's renderer happy and to
       prevent arbitrary/long strings from leaking into the stored
       deck. Unknown values silently fall back to "solid". */
    const requestedPattern = body.pattern && ALLOWED_PATTERN_KEYS.has(body.pattern)
      ? body.pattern
      : "solid";
    const requestedCover = (body.coverEmoji ?? "📚").slice(0, 8);

    /* Atomic compare-and-set: only the request that actually flips
       status from `outline_ready` → `building` proceeds with the
       build. Concurrent callers either see "already built" (when a
       previous build succeeded) or get a 409 reflecting current
       status. This prevents duplicate decks under racing requests. */
    const locked = await db
      .update(presentationDraftsTable)
      .set({
        status: "building",
        buildProgress: { current: 0, total: 0, warnings: [] },
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(presentationDraftsTable.id, draftId),
          eq(presentationDraftsTable.teacherId, teacherId),
          /* Allow retry from `failed` so a teacher can re-attempt a
             build without manually rewinding the draft state. */
          inArray(presentationDraftsTable.status, ["outline_ready", "failed"]),
        ),
      )
      .returning();

    const draft = locked[0];
    if (!draft) {
      /* Lock not acquired — find out why so we return the right code. */
      const [existing] = await db
        .select()
        .from(presentationDraftsTable)
        .where(eq(presentationDraftsTable.id, draftId))
        .limit(1);
      if (!existing) { res.status(404).json({ message: "Not found" }); return; }
      if (existing.teacherId !== teacherId) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      if (existing.status === "built" && existing.presentationId) {
        res.status(200).json({
          presentationId: existing.presentationId,
          warnings: [],
          alreadyBuilt: true,
        });
        return;
      }
      res.status(409).json({
        message: "Only approved outlines can be built",
        status: existing.status,
      });
      return;
    }

    const outline = draft.outline as {
      language: Lang;
      density: Density;
      slides: OutlineCard[];
    };
    const brief = draft.brief as {
      language: Lang;
      subject?: string;
      gradeLevel?: string;
      topic: string;
    };

    const themeKey = requestedTheme;
    const validSlides: unknown[] = [];
    const warnings: string[] = [];
    const skipped: number[] = [];
    const total = outline.slides.length;
    let cancelled = false;

    /* Insert the empty deck UP-FRONT so we can persist slides
       incrementally and so a cancellation mid-build retains whatever
       slides have already been validated (per spec). The deck starts
       in status="draft" with `slides: []`. */
    const safeTitle = (brief.topic ?? "").slice(0, 200) || (outline.language === "ar" ? "عرض جديد" : "New deck");
    const [deck] = await db
      .insert(presentationsTable)
      .values({
        teacherId,
        title: safeTitle,
        language: outline.language,
        subject: brief.subject ?? null,
        gradeLevel: brief.gradeLevel ?? null,
        theme: themeKey,
        pattern: requestedPattern,
        coverEmoji: requestedCover,
        slides: [],
        status: "draft",
      })
      .returning();

    /* Wire the draft to the new presentation immediately so the
       polling frontend (and the editor route, if the teacher
       navigates early) can already see the in-flight deck. */
    await db
      .update(presentationDraftsTable)
      .set({
        presentationId: deck.id,
        updatedAt: new Date(),
      })
      .where(eq(presentationDraftsTable.id, draftId));

    /* Register a cancel slot before the loop so the cancel endpoint
       has somewhere to flip. Cleared in `finally`. */
    const cancelSlot = { cancelled: false };
    buildCancelFlags.set(draftId, cancelSlot);

    try {
      for (let i = 0; i < total; i++) {
        if (cancelSlot.cancelled) {
          cancelled = true;
          break;
        }
        const card = outline.slides[i];
        const out = buildOneSlide({
          card,
          themeKey,
          density: outline.density,
          lang: outline.language,
        });
        out.warnings.forEach((w) => warnings.push(`#${card.index}: ${w}`));

        /* Per-slide validation. A single failing card should NOT abort
           the build — we record a warning and skip it so the teacher
           still gets the rest of the deck and can author the missing
           slide manually in the editor. */
        const parsedOne = slideSchema.safeParse(out.slide);
        if (parsedOne.success) {
          validSlides.push(parsedOne.data);
          /* Append the freshly validated slide to the persisted deck.
             We use a deck-level array schema check on the running list
             so the stored deck is never invalid mid-build. */
          const partialParsed = slidesSchema.safeParse(validSlides);
          if (partialParsed.success) {
            await db
              .update(presentationsTable)
              .set({ slides: partialParsed.data, updatedAt: new Date() })
              .where(eq(presentationsTable.id, deck.id));
          } else {
            /* Extremely defensive — a single slide passed but the deck
               total tripped a length cap. Roll the slide back from the
               in-memory list and record a warning. */
            validSlides.pop();
            skipped.push(card.index);
            warnings.push(
              outline.language === "ar"
                ? `الشريحة ${card.index} تجاوزت سعة العرض`
                : `Slide ${card.index} would exceed the deck cap; skipped`,
            );
          }
        } else {
          skipped.push(card.index);
          warnings.push(
            outline.language === "ar"
              ? `الشريحة ${card.index} لم تُنشأ — أنشئها يدوياً`
              : `Slide ${card.index} could not be created — please author manually`,
          );
          req.log.warn(
            { draftId, slideIndex: card.index, issues: parsedOne.error.issues.slice(0, 3) },
            "Slide failed validation; skipping",
          );
        }

        /* Persist per-slide progress on the draft so the polling /
           SSE drivers can drive a real progress bar. */
        await db
          .update(presentationDraftsTable)
          .set({
            buildProgress: {
              current: i + 1,
              total,
              warnings: warnings.slice(0, 50),
              skipped: skipped.slice(0, 50),
            },
            updatedAt: new Date(),
          })
          .where(eq(presentationDraftsTable.id, draftId));
      }
    } finally {
      buildCancelFlags.delete(draftId);
    }

    /* Cancellation: keep the partial deck so the teacher can pick up
       where the AI left off in the editor. Mark the draft as `built`
       pointing at the partial deck so subsequent visits land in the
       editor and don't try to re-run the build. */
    if (cancelled) {
      await db
        .update(presentationDraftsTable)
        .set({
          status: "built",
          presentationId: deck.id,
          buildProgress: {
            current: validSlides.length,
            total,
            warnings: warnings.slice(0, 50),
            skipped: skipped.slice(0, 50),
          },
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(presentationDraftsTable.id, draftId));
      res.status(200).json({
        presentationId: deck.id,
        warnings,
        skipped,
        cancelled: true,
        alreadyBuilt: false,
      });
      return;
    }

    if (validSlides.length === 0) {
      /* No slides materialized — clean up the empty deck shell so we
         don't leave orphaned rows behind, then mark the draft failed
         so the teacher can retry. */
      await db.delete(presentationsTable).where(eq(presentationsTable.id, deck.id));
      await db
        .update(presentationDraftsTable)
        .set({
          status: "failed",
          presentationId: null,
          errorMessage: "All slides failed validation",
          updatedAt: new Date(),
        })
        .where(eq(presentationDraftsTable.id, draftId));
      res.status(500).json({
        message: outline.language === "ar"
          ? "لم تُبنَ أي شريحة. حاول مرة أخرى."
          : "No slides were built. Please retry.",
      });
      return;
    }

    /* Mark the draft as built. The deck row already holds the full
       slides[] thanks to the per-iteration update above. */
    await db
      .update(presentationDraftsTable)
      .set({
        status: "built",
        presentationId: deck.id,
        buildProgress: {
          current: total,
          total,
          warnings: warnings.slice(0, 50),
          skipped: skipped.slice(0, 50),
        },
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(presentationDraftsTable.id, draftId));

    res.status(201).json({
      presentationId: deck.id,
      warnings,
      skipped,
      cancelled,
      alreadyBuilt: false,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Invalid build body", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Build presentation failed");
    /* Best-effort: mark failed so the teacher can retry. */
    try {
      const draftId = parseInt(String(req.params.draftId), 10);
      if (Number.isFinite(draftId)) {
        await db
          .update(presentationDraftsTable)
          .set({
            status: "failed",
            errorMessage: err instanceof Error ? err.message.slice(0, 500) : "build error",
            updatedAt: new Date(),
          })
          .where(eq(presentationDraftsTable.id, draftId));
      }
    } catch (markErr) {
      req.log.warn({ err: markErr }, "Could not mark draft failed");
    }
    res.status(500).json({ message: "Failed to build presentation" });
  }
});

/* ── GET /api/presentations/ai/build/:draftId/stream — Phase 1B SSE
   Server-Sent-Events feed for the build progress modal. Polls the
   draft row at a fast cadence and emits `progress` events; emits a
   terminal `done` event (with status + presentationId) when the
   draft transitions to `built` or `failed`, then closes the stream.
   Designed as a primary live driver for the BuildProgress UI; the
   modal also keeps a polling query as a fallback if the connection
   drops. Requires the same teacher session as the build endpoint. */
router.get("/presentations/ai/build/:draftId/stream", requireTeacher, async (req, res) => {
  const teacherId = req.session.teacherId as number;
  const draftId = parseInt(String(req.params.draftId), 10);
  if (!Number.isFinite(draftId)) {
    res.status(400).json({ message: "Bad draftId" });
    return;
  }
  const [existing] = await db
    .select({
      teacherId: presentationDraftsTable.teacherId,
    })
    .from(presentationDraftsTable)
    .where(eq(presentationDraftsTable.id, draftId))
    .limit(1);
  if (!existing) { res.status(404).json({ message: "Not found" }); return; }
  if (existing.teacherId !== teacherId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let closed = false;
  req.on("close", () => { closed = true; });

  /* Per-slide event model. We track the last emitted slide index so
     each newly persisted slide gets its own `slide` event with the
     full payload — this is what powers the live preview strip in
     the build modal. We additionally emit `progress` snapshots
     (status + counters + warnings) every tick and a terminal
     `done` event once the draft hits `built`/`failed`. */
  let lastEmittedIdx = 0;
  let lastWarnCount = 0;
  let lastSkipCount = 0;
  const deadline = Date.now() + 5 * 60_000;

  while (!closed && Date.now() < deadline) {
    const [row] = await db
      .select({
        status: presentationDraftsTable.status,
        presentationId: presentationDraftsTable.presentationId,
        buildProgress: presentationDraftsTable.buildProgress,
        errorMessage: presentationDraftsTable.errorMessage,
      })
      .from(presentationDraftsTable)
      .where(eq(presentationDraftsTable.id, draftId))
      .limit(1);
    if (!row) break;

    /* If the deck row exists, fan out any newly persisted slides. */
    if (row.presentationId) {
      const [deckRow] = await db
        .select({ slides: presentationsTable.slides })
        .from(presentationsTable)
        .where(eq(presentationsTable.id, row.presentationId))
        .limit(1);
      const slidesArr = Array.isArray(deckRow?.slides)
        ? (deckRow.slides as unknown[])
        : [];
      for (let i = lastEmittedIdx; i < slidesArr.length; i++) {
        send("slide", {
          type: "slide",
          index: i,
          presentationId: row.presentationId,
          slide: slidesArr[i],
        });
      }
      lastEmittedIdx = slidesArr.length;
    }

    /* Emit the new warnings/skipped entries since the last tick so
       the modal can show them in real time without dedupe work. */
    const bp = row.buildProgress as
      | { current: number; total: number; warnings?: string[]; skipped?: number[] }
      | null;
    const warnings = bp?.warnings ?? [];
    const skipped = bp?.skipped ?? [];
    for (let i = lastWarnCount; i < warnings.length; i++) {
      send("warning", { type: "warning", message: warnings[i] });
    }
    for (let i = lastSkipCount; i < skipped.length; i++) {
      send("skipped", { type: "skipped", index: skipped[i] });
    }
    lastWarnCount = warnings.length;
    lastSkipCount = skipped.length;

    send("progress", {
      type: "progress",
      status: row.status,
      presentationId: row.presentationId ?? null,
      buildProgress: bp,
    });

    if (row.status === "built" || row.status === "failed") {
      send("done", {
        type: "done",
        status: row.status,
        presentationId: row.presentationId ?? null,
        errorMessage: row.errorMessage ?? null,
        buildProgress: bp,
      });
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!closed) res.end();
});

/* ── POST /api/presentations/ai/build/:draftId/cancel — Phase 1B
   Sets the in-memory cancel flag for an active build. The build loop
   checks this flag once per slide and exits cleanly, preserving any
   slides already validated. Idempotent — repeated calls are no-ops. */
router.post("/presentations/ai/build/:draftId/cancel", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const draftId = parseInt(String(req.params.draftId), 10);
    if (!Number.isFinite(draftId)) {
      res.status(400).json({ message: "Bad draftId" });
      return;
    }
    const [existing] = await db
      .select({
        teacherId: presentationDraftsTable.teacherId,
        status: presentationDraftsTable.status,
      })
      .from(presentationDraftsTable)
      .where(eq(presentationDraftsTable.id, draftId))
      .limit(1);
    if (!existing) { res.status(404).json({ message: "Not found" }); return; }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const slot = buildCancelFlags.get(draftId);
    if (slot) slot.cancelled = true;
    res.json({ ok: true, wasActive: !!slot, status: existing.status });
  } catch (err) {
    req.log.error({ err }, "Cancel build failed");
    res.status(500).json({ message: "Failed to cancel build" });
  }
});

/* ── POST /api/presentations/ai/single-slide
   Generate ONE slide card from a kind + optional prompt using the
   teacher's deck context (title, subject, gradeLevel, language).
   Tier-routed like the outline endpoint but not quota-gated — single
   slides are cheap and teachers need them in the flow of editing.
   Returns { slide: Slide } that the editor inserts immediately. */
const singleSlideBody = z.object({
  presentationId: z.number().int().positive(),
  kind: outlineSlideKindSchema,
  prompt: z.string().max(300).default(""),
  theme: z.string().max(40).optional(),
});

function buildSingleSlidePrompt(opts: {
  kind: string;
  deckTitle: string;
  subject: string | null;
  gradeLevel: string | null;
  language: "ar" | "en";
  userPrompt: string;
}): string {
  const ar = opts.language === "ar";
  const kindLabels: Record<string, { ar: string; en: string }> = {
    "concept-card":  { ar: "فكرة محورية مع شرح ونقاط",          en: "Key concept with explanation and points" },
    "interactive":   { ar: "شريحة نشاط بأسئلة اختيار من متعدد", en: "Activity slide with multiple-choice questions" },
    "steps":         { ar: "خطوات أو إجراءات متسلسلة",            en: "Sequential steps or procedure" },
    "comparison":    { ar: "مقارنة بين طرفين أو خيارين",          en: "Comparison between two sides or options" },
    "visual-hero":   { ar: "عرض بصري كبير مع نقاط داعمة",        en: "Big visual intro with supporting points" },
    "objectives":    { ar: "أهداف الدرس — قائمة مُنسَّقة",        en: "Lesson objectives — formatted list" },
    "stat":          { ar: "إحصائية أو رقم لافت (1-3 أرقام)",     en: "Striking statistic (1-3 numbers)" },
    "quote":         { ar: "اقتباس أو حكمة قصيرة",                en: "Short quote or wisdom" },
    "closure":       { ar: "خلاصة ختامية للدرس",                   en: "Final lesson summary" },
    "callout":       { ar: "تنبيه أو ملاحظة مهمة جداً",           en: "Important callout or warning" },
    "timeline":      { ar: "تسلسل زمني بأحداث على محور",          en: "Timeline with events on an axis" },
    "formula":       { ar: "قاعدة أو معادلة علمية مع شرح",        en: "Scientific formula or rule with explanation" },
    "title":         { ar: "شريحة عنوان رئيسي",                    en: "Main title slide" },
  };
  const desc = kindLabels[opts.kind] ?? { ar: opts.kind, en: opts.kind };

  const context = [
    ar ? `عنوان العرض: ${opts.deckTitle}` : `Deck: ${opts.deckTitle}`,
    opts.subject    ? (ar ? `المادة: ${opts.subject}` : `Subject: ${opts.subject}`) : "",
    opts.gradeLevel ? (ar ? `الصف: ${opts.gradeLevel}` : `Grade: ${opts.gradeLevel}`) : "",
    opts.userPrompt ? (ar ? `طلب المعلم: ${opts.userPrompt}` : `Teacher request: ${opts.userPrompt}`) : "",
  ].filter(Boolean).join("\n");

  const isInteractive = opts.kind === "interactive";
  const gameQBlock = isInteractive
    ? `  "gameQuestions": [
    {"prompt": "...", "options": ["أ","ب","ج","د"], "correctIndex": 0}
  ],`
    : `  "gameQuestions": [],`;

  if (ar) {
    return `${context}

المطلوب: شريحة واحدة من نوع "${opts.kind}" — ${desc.ar}.

أنتج JSON واحداً فقط بالبنية التالية (بدون أي نص خارج JSON، بدون code fences):
{
  "kind": "${opts.kind}",
  "title": "عنوان قصير ≤ 8 كلمات",
  "purpose": "الهدف من الشريحة",
  "talkingPoints": ["نقطة 1", "نقطة 2", "نقطة 3"],
  "interactionHint": ${isInteractive ? `"quiz"` : "null"},
  "gameSuggestion": null,
${gameQBlock}
  "slideTheme": null,
  "visualDirection": {"icon": "brain|target|chart|lightbulb|atom|zap|clock|check|sparkles|trophy|users|book", "layoutHint": ""},
  "source": ""
}

قواعد:
- title: عنوان قصير قابل للقراءة من آخر الفصل (≤ 8 كلمات)
- talkingPoints: 3-4 عناوين قصيرة بأسلوب صحفي (≤ 9 كلمات لكل نقطة)
- إذا كان النوع "interactive": أضف 5-7 أسئلة جاهزة في gameQuestions${isInteractive ? "\n- كل سؤال: 4 خيارات، إجابة صحيحة واحدة، صياغة قصيرة وواضحة" : ""}
- لا تضع نصاً خارج كائن JSON`;
  } else {
    return `${context}

Required: ONE slide of kind "${opts.kind}" — ${desc.en}.

Return ONLY a JSON object (no prose, no code fences):
{
  "kind": "${opts.kind}",
  "title": "Short title ≤ 8 words",
  "purpose": "Slide's purpose",
  "talkingPoints": ["Point 1", "Point 2", "Point 3"],
  "interactionHint": ${isInteractive ? `"quiz"` : "null"},
  "gameSuggestion": null,
${gameQBlock}
  "slideTheme": null,
  "visualDirection": {"icon": "brain|target|chart|lightbulb|atom|zap|clock|check|sparkles|trophy|users|book", "layoutHint": ""},
  "source": ""
}

Rules:
- title: short, readable from the back of the room (≤ 8 words)
- talkingPoints: 3-4 short headline-style points (≤ 9 words each)
- If kind is "interactive": add 5-7 ready questions in gameQuestions${isInteractive ? "\n- Each question: 4 options, one correct, short clear phrasing" : ""}
- No text outside the JSON object`;
  }
}

router.post("/presentations/ai/single-slide", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const body = singleSlideBody.parse(req.body);

    /* Load deck context — ownership check included. */
    const [deck] = await db
      .select({
        teacherId: presentationsTable.teacherId,
        title: presentationsTable.title,
        language: presentationsTable.language,
        subject: presentationsTable.subject,
        gradeLevel: presentationsTable.gradeLevel,
      })
      .from(presentationsTable)
      .where(eq(presentationsTable.id, body.presentationId))
      .limit(1);

    if (!deck) { res.status(404).json({ message: "Presentation not found" }); return; }
    if (deck.teacherId !== teacherId) { res.status(403).json({ message: "Forbidden" }); return; }

    const lang = (deck.language ?? "ar") as "ar" | "en";
    const themeKey = body.theme && isAllowedTheme(body.theme) ? body.theme : "harvest";

    const userMsg = buildSingleSlidePrompt({
      kind: body.kind,
      deckTitle: deck.title ?? "",
      subject: deck.subject ?? null,
      gradeLevel: deck.gradeLevel ?? null,
      language: lang,
      userPrompt: body.prompt,
    });

    const systemMsg = lang === "ar"
      ? `أنت مصمم شرائح خبير. مهمتك توليد شريحة واحدة محكمة البناء. أجب بـ JSON صارم فقط — بدون أي نص خارج الكائن.`
      : `You are an expert slide designer. Your task is to generate one well-crafted slide. Reply with strict JSON only — no text outside the object.`;

    const tier = await resolveTier(teacherId);
    const result = await runOutlineCompletion({
      tier,
      system: systemMsg,
      userMessages: [userMsg],
    });

    /* Parse the AI response as a single card object. */
    const parsed = parseJsonLoose(result.text);
    if (!parsed || typeof parsed !== "object") {
      res.status(502).json({ message: lang === "ar" ? "تعذّر تفسير رد الذكاء الاصطناعي" : "Could not parse AI response" });
      return;
    }

    /* Validate against the outline card schema — same rules as full deck
       generation so bad output gets rejected consistently. */
    const raw = parsed as Record<string, unknown>;
    /* Stamp the index as 1 if missing — single-slide calls don't need it. */
    if (raw.index === undefined) raw.index = 1;
    const cardResult = outlineSlideCardSchema.safeParse(raw);
    if (!cardResult.success) {
      req.log.warn({ err: cardResult.error.flatten() }, "Single-slide schema mismatch");
      /* Lenient fallback: build a minimal valid card from what we got. */
      const title = typeof raw.title === "string" ? raw.title.slice(0, 80) : (lang === "ar" ? "شريحة جديدة" : "New Slide");
      const points = Array.isArray(raw.talkingPoints)
        ? (raw.talkingPoints as unknown[]).filter((p): p is string => typeof p === "string").slice(0, 5)
        : [];
      raw.title = title;
      raw.talkingPoints = points.length ? points : [lang === "ar" ? "أضف محتوى هنا" : "Add content here"];
      raw.kind = body.kind;
      raw.purpose = typeof raw.purpose === "string" ? raw.purpose.slice(0, 140) : "";
      raw.interactionHint = null;
      raw.gameSuggestion = null;
      raw.gameQuestions = [];
      raw.slideTheme = null;
      /* Sanitize visualDirection — truncate fields that might exceed
         the schema's length constraints so the second parse succeeds. */
      const vd = (typeof raw.visualDirection === "object" && raw.visualDirection)
        ? (raw.visualDirection as Record<string, unknown>)
        : {};
      raw.visualDirection = {
        icon: typeof vd.icon === "string" ? vd.icon.slice(0, 80) : undefined,
        layoutHint: typeof vd.layoutHint === "string" ? vd.layoutHint.slice(0, 200) : undefined,
      };
      raw.source = "";
    }

    const card = cardResult.success ? cardResult.data : outlineSlideCardSchema.parse(raw);

    const { slide } = buildOneSlide({
      card: card as import("@workspace/slide-templates").OutlineCard,
      themeKey,
      density: "balanced",
      lang,
    });

    /* Validate the materialized slide against the presentations route
       schema so the client gets something it can always autosave. */
    const validated = slideSchema.safeParse(slide);
    if (!validated.success) {
      req.log.warn({ err: validated.error.flatten() }, "Single-slide slide schema mismatch");
      res.status(502).json({ message: lang === "ar" ? "الشريحة المولَّدة غير صالحة" : "Generated slide failed validation" });
      return;
    }

    /* Fire-and-forget usage tracking (same table as outline). */
    addOutlineUsage(teacherId, result.tokensIn, result.tokensOut, estimateCostMicroUsd(result.tokensIn, result.tokensOut)).catch(() => {});

    res.json({ slide: validated.data });
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ message: "Bad request", issues: err.flatten() });
      return;
    }
    req.log.error({ err }, "Single-slide generation failed");
    res.status(500).json({ message: "Generation failed" });
  }
});

export default router;
