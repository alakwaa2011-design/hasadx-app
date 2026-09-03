import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql as dsql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, assignmentsTable, type TtsAudioCache } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ttsLimiter } from "../lib/rate-limiter";
import { safeAccessCodeEqual } from "../lib/access-code";
import { holdCreditsForToolRequest, InsufficientCreditsError } from "../lib/check-credits";
import { CreditService } from "../lib/credit-service";
import * as ttsCache from "../lib/tts-cache";
import {
  recordCachedAiUsage,
  trackAiUsageCall,
  type ExtractedAiUsage,
} from "../lib/ai-usage-ledger";
import {
  getGame,
  getPlayerByToken,
  getDictationListenCount,
  incrementDictationListenCount,
  decrementDictationListenCount,
  getCachedDictationAudioByIndex,
  cacheDictationAudio,
  getInFlightDictationSynthesis,
  setInFlightDictationSynthesis,
  clearInFlightDictationSynthesis,
} from "../game/manager.js";

const router: IRouter = Router();

const MAX_TEXT_LENGTH = 6000;
const CHUNK_TARGET = 900;

function chunkText(text: string, target = CHUNK_TARGET): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= target) return [trimmed];

  const sentences = trimmed
    .split(/([.!؟?\n]+\s*)/)
    .reduce<string[]>((acc, part, i, arr) => {
      if (i % 2 === 0) {
        const next = (arr[i + 1] || "");
        const piece = (part + next).trim();
        if (piece) acc.push(piece);
      }
      return acc;
    }, []);

  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > target) {
      if (buf) { chunks.push(buf); buf = ""; }
      for (let i = 0; i < s.length; i += target) {
        chunks.push(s.slice(i, i + target));
      }
      continue;
    }
    if ((buf + " " + s).trim().length > target) {
      if (buf) chunks.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

interface AudioChatResponse {
  choices: Array<{
    message?: {
      audio?: { data?: string };
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface TtsUsageContext {
  teacherId: number;
  callKeyPrefix: string;
}

function extractAudioUsage(response: AudioChatResponse, input: string): ExtractedAiUsage {
  const usage = response.usage;
  const tokensIn = usage?.prompt_tokens ?? usage?.input_tokens;
  const tokensOut = usage?.completion_tokens ?? usage?.output_tokens;
  const total = usage?.total_tokens ?? (
    typeof tokensIn === "number" || typeof tokensOut === "number"
      ? (tokensIn ?? 0) + (tokensOut ?? 0)
      : undefined
  );
  if (typeof total === "number" || typeof tokensIn === "number" || typeof tokensOut === "number") {
    return {
      tokensIn,
      tokensOut,
      usageQuantity: total,
      usageUnit: "tokens",
      costSource: "unavailable",
    };
  }
  return {
    usageQuantity: input.trim().length,
    usageUnit: "characters",
    costSource: "unavailable",
  };
}

async function generateChunk(
  req: Request,
  text: string,
  voice: string,
  usageContext: TtsUsageContext,
  chunkIndex: number,
): Promise<Buffer> {
  // gpt-audio uses non-standard modalities/audio fields not present in the
  // base ChatCompletion types; cast the request once at the call site.
  const response = await trackAiUsageCall(
    req,
    {
      toolKey: "tts",
      callKey: `${usageContext.callKeyPrefix}:chunk:${chunkIndex}`,
      provider: "openai",
      model: "gpt-audio",
      modality: "audio",
      teacherId: usageContext.teacherId,
      metadata: { chunkIndex, inputCharacters: text.trim().length },
    },
    () => openai.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text", "audio"],
      audio: { voice, format: "mp3" },
      messages: [
        {
          role: "system",
          content: ttsCache.TTS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text.trim(),
        },
      ],
    } as Parameters<typeof openai.chat.completions.create>[0]) as unknown as Promise<AudioChatResponse>,
    (result) => extractAudioUsage(result, text),
  );

  const audioData = response?.choices[0]?.message?.audio?.data ?? "";
  if (!audioData) throw new Error("empty audio");
  return Buffer.from(audioData, "base64");
}

/* ── Teacher TTS with persistent per-teacher cache (approved plan v1–v5) ─────
   pending → hold → generate → store(verified) → capture OK → ready → serve
   Cache hit: NO provider call, NO hold, NO charge. */

function sendAudio(res: Response, buffer: Buffer): void {
  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", String(buffer.length));
  res.set("Cache-Control", "private, max-age=3600");
  res.send(buffer);
}

const TEMP_ERROR = { error: "تعذر تجهيز الصوت حالياً، حاول مرة أخرى بعد قليل." };

/** Plain uncached synthesis — used by the assignment listening-audio route,
    which is deliberately uncharged (no credit hold exists on it). */
async function synthesizeAndSend(
  req: Request,
  res: Response,
  text: string,
  voice: string,
  usageContext: TtsUsageContext,
) {
  try {
    const combined = await synthesizeFull(req, text, voice, usageContext);
    sendAudio(res, combined);
  } catch (err) {
    req.log.error({ err: err instanceof Error ? err.message : "unknown" }, "TTS error");
    res.status(500).json({ error: "فشل توليد الصوت" });
  }
}

async function synthesizeFull(
  req: Request,
  text: string,
  voice: string,
  usageContext: TtsUsageContext,
): Promise<Buffer> {
  const chunks = chunkText(text);
  const buffers: Buffer[] = [];
  for (const [chunkIndex, chunk] of chunks.entries()) {
    buffers.push(await generateChunk(req, chunk, voice, usageContext, chunkIndex));
  }
  return Buffer.concat(buffers);
}

function recordTtsCacheHit(req: Request, teacherId: number | undefined, cacheKey: string): void {
  if (!teacherId) return;
  void recordCachedAiUsage(req, {
    toolKey: "tts",
    callKey: "cache-hit",
    provider: "openai",
    model: "gpt-audio",
    modality: "audio",
    teacherId,
    metadata: { cacheKey },
  });
}

/** Serve a ready row from Object Storage. Missing file on a ready row is an
    anomaly (cleanup deletes metadata with the file): drop the row and let the
    caller start a fresh cycle (approved plan v1 §cleanup). */
async function serveReadyRow(
  req: Request,
  res: Response,
  row: TtsAudioCache,
): Promise<"served" | "file_lost" | "transient_error"> {
  if (!row.storageKey) return "transient_error"; // anomalous ready row — never definitive absence
  try {
    const buf = await ttsCache.downloadTtsAudio(row.storageKey);
    void ttsCache.touchLastUsed(row.id);
    sendAudio(res, buf);
    return "served";
  } catch (err: any) {
    // GCS download throws 404-coded errors on definitive absence
    const code = err?.code ?? err?.response?.status;
    if (code === 404) {
      // Paid file definitively gone: compensate the captured hold (idempotent)
      // and flip ready → failed atomically. No auto-regeneration this request;
      // the failed-state cooldown governs the next manual attempt.
      req.log.error({ rowId: row.id }, "tts cache: ready row lost its file — compensating");
      await ttsCache.handleReadyFileLost(row);
      return "file_lost";
    }
    req.log.error({ err, rowId: row.id }, "tts cache: transient storage error on serve");
    return "transient_error";
  }
}

/** Full generation cycle for a pending row THIS request owns. */
async function runGenerationCycle(
  req: Request,
  res: Response,
  rowId: number,
  creditRequestId: string,
  teacherId: number,
  text: string,
  voice: string,
): Promise<void> {
  const usageReq = ttsCache.createTtsUsageRequestContext(req, creditRequestId);
  const usageContext: TtsUsageContext = { teacherId, callKeyPrefix: "generation" };
  // ── hold (after ownership, before any provider call) ──────────────────────
  let holdMode: "none" | "held";
  try {
    const h = await holdCreditsForToolRequest(teacherId, "tts", creditRequestId);
    holdMode = h.mode;
  } catch (err) {
    // No hold was created (hold is transactional). Row must not stay pending.
    await db.execute(dsql`DELETE FROM tts_audio_cache WHERE id = ${rowId} AND status = 'pending'`);
    if (err instanceof InsufficientCreditsError) {
      res.status(402).json({
        message: err.required !== undefined && err.balance !== undefined
          ? `لا يكفي رصيدك لإتمام هذه العملية. تحتاج إلى ${err.required} نقطة حصاد، ورصيدك الحالي ${err.balance} نقطة.`
          : err.message,
        code: "INSUFFICIENT_CREDITS",
        required: err.required,
        balance: err.balance,
      });
      return;
    }
    req.log.error({ err, teacherId }, "tts: hold failed unexpectedly — fail closed");
    res.status(503).json({
      code: "CREDITS_CHECK_UNAVAILABLE",
      message: "تعذر التحقق من رصيد نقاط حصاد حالياً، حاول مرة أخرى بعد قليل.",
    });
    return;
  }

  // ── generate → store → verify ──────────────────────────────────────────────
  let combined: Buffer;
  let storageKey: string;
  try {
    combined = await synthesizeFull(usageReq, text, voice, usageContext);
    storageKey = ttsCache.newTtsStorageKey();
    await ttsCache.uploadTtsAudio(storageKey, combined);
    // Record the storage key BEFORE capture so recovery can find the file.
    // Fenced by credit_request_id: if a takeover happened, we lost the lease.
    const keyWrite = await db.execute(dsql`
      UPDATE tts_audio_cache SET storage_key = ${storageKey}
      WHERE id = ${rowId} AND status = 'pending' AND credit_request_id = ${creditRequestId}
      RETURNING id
    `);
    if (keyWrite.rows.length === 0) throw new Error("lost generation ownership before capture");
    // Verified store: transient verify errors count as generation failure
    // (pre-capture — refund is unambiguous).
    if ((await ttsCache.checkTtsFile(storageKey)) !== "exists") {
      throw new Error("upload verification failed");
    }
  } catch (err) {
    req.log.error({ err: err instanceof Error ? err.message : err }, "TTS generation/store error");
    if (holdMode === "held") {
      try { await CreditService.refund(creditRequestId, "tts: فشل التوليد أو التخزين"); } catch { /* sweeper */ }
    }
    await ttsCache.markFailed(rowId, creditRequestId, err instanceof Error ? err.message : "generation failed");
    res.status(500).json({ error: "فشل توليد الصوت" });
    return;
  }

  // ── capture (only gate to ready) ───────────────────────────────────────────
  if (holdMode === "held") {
    try {
      const { captured } = await CreditService.capture(creditRequestId);
      if (!captured) {
        // Zero-row capture: the hold was no longer pending. Either an
        // idempotent replay (already completed → serving is paid for) or we
        // LOST ownership (refunded/expired by orphan recovery or the sweeper)
        // → serving would be uncharged audio. Decide by re-reading the status.
        const holdStatus = await CreditService.getHoldStatus(creditRequestId);
        if (holdStatus !== "completed") {
          req.log.warn({ rowId, holdStatus }, "tts: capture lost — hold no longer pending, not serving");
          await tryDeleteTtsAudioSafely(storageKey); // our blob; new owner has its own key
          res.status(503).json(TEMP_ERROR);
          return;
        }
      }
    } catch (captureErr) {
      // UNCERTAIN result — never refund/delete directly (plan v3).
      req.log.error({ err: captureErr, rowId }, "tts: uncertain capture — resolving via hold status");
      const row = await ttsCache.getCacheRowById(rowId);
      const resolution = row
        ? await ttsCache.resolveUncertainCapture(row)
        : ({ outcome: "indeterminate" } as const);
      if (resolution.outcome === "ready") {
        sendAudio(res, combined); // charge landed; audio is paid for
        return;
      }
      // refunded / compensated / new_cycle / indeterminate → temp error;
      // row state already correct (or left pending & unservable).
      res.status(503).json(TEMP_ERROR);
      return;
    }
  }

  // ── ready → serve (capture confirmed; fenced by credit_request_id) ─────────
  try {
    const promoted = await ttsCache.markReady(rowId, creditRequestId, storageKey, combined.length);
    if (!promoted) {
      // Lease lost between capture and promotion is impossible for a held
      // capture (takeover requires resolving OUR completed hold first, which
      // promotes to ready, never takes over). For credits-off cycles a stale
      // fence just means recovery will settle the row; audio itself is fine.
      req.log.warn({ rowId }, "tts: ready-promotion matched no row (lazy recovery will settle)");
    }
  } catch (err) {
    // Captured but ready-update failed: recovery promotes it later via the
    // stored credit_request_id. Serving now is correct — it was paid for.
    req.log.error({ err, rowId }, "tts: ready-update failed after capture (lazy recovery will promote)");
  }
  sendAudio(res, combined);
  void ttsCache.maybeRunTtsCleanup(req.log);
}

async function tryDeleteTtsAudioSafely(storageKey: string): Promise<void> {
  try { await ttsCache.tryDeleteTtsAudio(storageKey); } catch { /* best-effort */ }
}

router.post("/tts/preview", ttsLimiter, async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "يجب تسجيل الدخول لاستخدام هذه الخدمة" });
    return;
  }

  const { text, voice = "nova" } = (req.body || {}) as { text?: unknown; voice?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TEXT_LENGTH} حرف)` });
    return;
  }

  await synthesizeAndSend(req, res, text, voice, {
    teacherId,
    callKeyPrefix: "preview",
  });
});

router.post("/tts", ttsLimiter, async (req, res) => {
  // Teachers only — unauthenticated callers are blocked here.
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "يجب تسجيل الدخول لاستخدام هذه الخدمة" });
    return;
  }

  const { text, voice = "nova" } = (req.body || {}) as { text?: unknown; voice?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TEXT_LENGTH} حرف)` });
    return;
  }

  const cacheKey = ttsCache.buildTtsCacheKey(text, voice);

  // Bounded state loop: each iteration either serves, errors out, or claims
  // ownership and generates. Max a few iterations (insert race, orphan resolution).
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await ttsCache.getCacheRow(teacherId, cacheKey);

    if (!row) {
      const requestId = randomUUID();
      const won = await ttsCache.tryInsertPending(teacherId, cacheKey, requestId);
      if (!won) continue; // lost the insert race — re-read state
      await runGenerationCycle(req, res, won.id, requestId, teacherId, text, voice);
      return;
    }

    if (row.status === "ready") {
      const outcome = await serveReadyRow(req, res, row);
      if (outcome === "served") {
        recordTtsCacheHit(req, teacherId, cacheKey);
        return;
      }
      // file_lost: hold compensated, row is failed — cooldown governs the next
      // attempt (no automatic regeneration). transient_error: retry later.
      res.status(503).json(TEMP_ERROR);
      return;
    }

    if (row.status === "failed") {
      const failedAt = row.failedAt ? new Date(row.failedAt).getTime() : 0;
      if (Date.now() - failedAt < ttsCache.FAILED_COOLDOWN_MS) {
        res.status(429).json({ error: "تعذر توليد هذا الصوت قبل قليل. انتظر دقائق ثم أعد المحاولة." });
        return;
      }
      const requestId = randomUUID();
      const won = await ttsCache.tryTakeoverRow(row.id, "failed", requestId);
      if (!won) continue;
      await runGenerationCycle(req, res, row.id, requestId, teacherId, text, voice);
      return;
    }

    // ── pending ──────────────────────────────────────────────────────────────
    const ageMs = Date.now() - new Date(row.createdAt).getTime();
    if (ageMs < ttsCache.PENDING_ORPHAN_MS) {
      // Fresh pending owned by a concurrent request: wait server-side (no 202 —
      // the current client treats any non-OK as failure). NO hold, NO charge.
      const deadline = Date.now() + ttsCache.WAIT_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, ttsCache.WAIT_POLL_MS));
        const fresh = await ttsCache.getCacheRowById(row.id);
        if (!fresh) break; // deleted → fresh cycle
        if (fresh.status === "ready") {
          const outcome = await serveReadyRow(req, res, fresh);
          if (outcome === "served") {
            recordTtsCacheHit(req, teacherId, cacheKey);
            return;
          }
          res.status(503).json(TEMP_ERROR);
          return;
        }
        if (fresh.status === "failed") { res.status(500).json({ error: "فشل توليد الصوت" }); return; }
      }
      res.status(503).json(TEMP_ERROR); // rare: still pending after 60s
      return;
    }

    // Orphaned pending (owner crashed): resolve financially first — never
    // generate or charge before the previous cycle's money state is settled.
    const resolution = await ttsCache.resolveUncertainCapture(row);
    if (resolution.outcome === "ready") {
      const promoted = await ttsCache.getCacheRowById(row.id);
      const outcome = promoted ? await serveReadyRow(req, res, promoted) : "transient_error";
      if (outcome === "served") {
        recordTtsCacheHit(req, teacherId, cacheKey);
        return;
      }
      res.status(503).json(TEMP_ERROR);
      return;
    }
    if (resolution.outcome === "indeterminate") { res.status(503).json(TEMP_ERROR); return; }
    if (resolution.outcome === "compensated" || resolution.outcome === "refunded") {
      // Row is now failed — no automatic retry this request (plan v4).
      res.status(503).json(TEMP_ERROR);
      return;
    }
    // new_cycle: previous cycle left no financial trace — take over atomically.
    const requestId = randomUUID();
    const won = await ttsCache.tryTakeoverRow(
      row.id, "pending", requestId,
      dsql`AND created_at < NOW() - INTERVAL '2 minutes'`,
    );
    if (!won) continue;
    await runGenerationCycle(req, res, row.id, requestId, teacherId, text, voice);
    return;
  }

  res.status(503).json(TEMP_ERROR);
});

/* Protected audio retrieval by cache row id — owner-only, ready-only.
   storage_key is never exposed; the server streams the object itself. */
router.get("/tts/audio/:id", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "غير موجود" });
    return;
  }
  const row = await ttsCache.getCacheRowById(id);
  if (!row || row.teacherId !== teacherId || row.status !== "ready" || !row.storageKey) {
    res.status(404).json({ error: "غير موجود" }); // same response for exists-but-not-yours
    return;
  }
  try {
    const buf = await ttsCache.downloadTtsAudio(row.storageKey);
    void ttsCache.touchLastUsed(row.id);
    sendAudio(res, buf);
    recordTtsCacheHit(req, teacherId, row.cacheKey);
  } catch {
    res.status(503).json(TEMP_ERROR);
  }
});

// Student dictation TTS — tightly scoped to the CURRENT active dictation
// question of an active game.  The client never supplies text or voice; the
// server resolves both from the game state.
//
// Authorization: `audioToken` is a random UUID issued per-player at socket
// join time.  An attacker who only knows the PIN + player name cannot obtain
// it.  The server looks up the player by token (not by name).
//
// Cost controls (all enforced server-side, bypass-proof):
//
//   Atomic quota reservation — listen count is incremented SYNCHRONOUSLY,
//   before any `await`.  Because Node.js is single-threaded, two concurrent
//   requests from the same token both see the state as of their respective
//   synchronous setup phase; neither can race past the quota check.
//
//   Single-flight synthesis — when no cached audio exists, exactly one
//   synthesis promise is created and stored synchronously in the game's
//   in-flight map before the first await.  All other concurrent requests find
//   it in the map and await it instead of starting their own synthesis.
//
//   Question-index pinning — the authorized question index is captured before
//   any await.  After synthesis, we verify the index is still current before
//   writing to the cache or accepting the listen-count reservation; if the
//   question advanced mid-flight the quota is released and the stale audio is
//   discarded (the player gets a 503 and can retry on the new question).
//
//   Cache — first synthesis result is stored in the game; all subsequent
//   valid requests are served from cache with no provider call.
//
//   All maps (cache, counts, in-flight) are cleared when the question advances.
router.post("/tts/game", ttsLimiter, async (req, res) => {
  const { pin, audioToken } = (req.body || {}) as {
    pin?: unknown;
    audioToken?: unknown;
  };

  // ── 1. Validate PIN format ──────────────────────────────────────────────
  if (!pin || typeof pin !== "string" || !/^\d{6}$/.test(pin)) {
    res.status(400).json({ error: "رمز اللعبة مطلوب" });
    return;
  }

  // ── 2. Validate token format ────────────────────────────────────────────
  const tokenStr = typeof audioToken === "string" ? audioToken.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tokenStr)) {
    res.status(400).json({ error: "بيانات المصادقة مطلوبة" });
    return;
  }

  // ── 3. Game must exist ──────────────────────────────────────────────────
  const game = getGame(pin);
  if (!game) {
    res.status(403).json({ error: "لا توجد لعبة نشطة بهذا الرمز" });
    return;
  }

  // ── 4. Game must be in the active question phase ────────────────────────
  if (game.state !== "question") {
    res.status(403).json({ error: "لا يوجد سؤال نشط حالياً" });
    return;
  }

  // ── 5. Current question must be dictation type ──────────────────────────
  // Capture the question index NOW — before any await — so we can detect
  // question-advance races after synthesis completes.
  const authorizedIndex = game.currentQuestionIndex;
  const currentQuestion = game.questions[authorizedIndex];
  if (!currentQuestion || currentQuestion.questionType !== "dictation") {
    res.status(403).json({ error: "السؤال الحالي ليس إملاءً" });
    return;
  }

  // ── 6. Validate token against an active player ──────────────────────────
  const player = getPlayerByToken(game, tokenStr);
  if (!player) {
    res.status(403).json({ error: "بيانات المصادقة غير صالحة" });
    return;
  }

  // ── 7. Resolve dictation text server-side ───────────────────────────────
  const text = currentQuestion.optionA?.trim() ?? "";
  if (!text) {
    res.status(404).json({ error: "لا يوجد نص إملاء للسؤال الحالي" });
    return;
  }

  // ── 8. ATOMIC quota reservation (synchronous, before any await) ─────────
  // Increment FIRST; if synthesis later fails we decrement to release the slot.
  // Because this is synchronous, concurrent requests see the incremented value
  // on their own synchronous checks — no two requests can both see the same
  // count below maxListens and then both exceed the quota.
  const maxListens = parseInt(currentQuestion.optionB || "3", 10) || 3;
  const listensSoFar = getDictationListenCount(game, tokenStr);
  if (listensSoFar >= maxListens) {
    res.status(429).json({ error: "تجاوزت الحد المسموح به من الاستماع لهذا السؤال" });
    return;
  }
  incrementDictationListenCount(game, tokenStr); // reserve slot now

  // ── 9. Single-flight: check cache → in-flight → start synthesis ─────────
  // All checks and promise registration are synchronous (no await yet),
  // so concurrent requests cannot all independently start synthesis.
  const cached = getCachedDictationAudioByIndex(game, authorizedIndex);
  if (cached) {
    // Already cached — serve immediately, quota already reserved above.
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(cached.length));
    res.set("Cache-Control", "no-store");
    res.send(cached);
    recordTtsCacheHit(req, game.teacherId, `game:${game.assignmentId}:${authorizedIndex}`);
    return;
  }

  let audioPromise = getInFlightDictationSynthesis(game, authorizedIndex);
  if (!audioPromise) {
    // No synthesis running yet — start one and register it synchronously.
    const voice = "nova"; // fixed server-side; no client influence
    audioPromise = (async () => {
      const chunks = chunkText(text);
      const buffers: Buffer[] = [];
      const usageContext: TtsUsageContext = {
        teacherId: game.teacherId,
        callKeyPrefix: `game:${game.assignmentId}:${authorizedIndex}`,
      };
      for (const [chunkIndex, chunk] of chunks.entries()) {
        buffers.push(await generateChunk(req, chunk, voice, usageContext, chunkIndex));
      }
      return Buffer.concat(buffers);
    })();
    setInFlightDictationSynthesis(game, authorizedIndex, audioPromise); // sync
  }
  // All other concurrent requests found the in-flight promise and await it here.

  // ── 10. Await synthesis ─────────────────────────────────────────────────
  let audio: Buffer;
  try {
    audio = await audioPromise;
  } catch (err) {
    // Release the quota reservation so the player can retry.
    decrementDictationListenCount(game, tokenStr);
    clearInFlightDictationSynthesis(game, authorizedIndex);
    req.log.error({ err: err instanceof Error ? err.message : String(err) }, "Game TTS synthesis error");
    res.status(500).json({ error: "فشل توليد الصوت" });
    return;
  }

  // ── 11. Question-index check after await ────────────────────────────────
  // If the question advanced while we were synthesizing, the cache/count maps
  // were already cleared by nextQuestion().  We must NOT write into the new
  // question's maps.  Release the (now-stale) quota reservation and tell the
  // client to retry — the question has already changed for them too.
  if (game.currentQuestionIndex !== authorizedIndex) {
    // counts were cleared by nextQuestion; no-op decrement is safe
    decrementDictationListenCount(game, tokenStr);
    res.status(503).json({ error: "تغيّر السؤال أثناء التحضير، أعد المحاولة" });
    return;
  }

  // ── 12. Cache the synthesized audio (once) and clear the in-flight entry ─
  if (!getCachedDictationAudioByIndex(game, authorizedIndex)) {
    cacheDictationAudio(game, authorizedIndex, audio);
  }
  clearInFlightDictationSynthesis(game, authorizedIndex);

  // ── 13. Respond ─────────────────────────────────────────────────────────
  res.set("Content-Type", "audio/mpeg");
  res.set("Content-Length", String(audio.length));
  res.set("Cache-Control", "no-store");
  res.send(audio);
});

// Listening-activity audio for students: synthesizes from the assignment's
// stored transcript without ever exposing that transcript over the API.
// Mirrors the access-control rules of GET /api/assignments/:id.
router.get("/assignments/:id/listening-audio", ttsLimiter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "معرف غير صالح" });
    return;
  }

  const [assignment] = await db
    .select({
      teacherId: assignmentsTable.teacherId,
      activityType: assignmentsTable.activityType,
      accessMode: assignmentsTable.accessMode,
      accessCode: assignmentsTable.accessCode,
      isShared: assignmentsTable.isShared,
      isShareApproved: assignmentsTable.isShareApproved,
      listeningAudioText: assignmentsTable.listeningAudioText,
      listeningVoice: assignmentsTable.listeningVoice,
    })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, id))
    .limit(1);

  if (!assignment || assignment.activityType !== "listening" || !assignment.listeningAudioText?.trim()) {
    res.status(404).json({ error: "لا يوجد صوت لهذا النشاط" });
    return;
  }

  const isTeacher = req.session.teacherId === assignment.teacherId;
  const isApprovedSharedForTeacher =
    !!req.session.teacherId && !isTeacher && assignment.isShared && assignment.isShareApproved;

  if (assignment.accessMode === "private" && !isTeacher && !isApprovedSharedForTeacher) {
    const headerCode = (req.headers["x-access-code"] as string | undefined)?.trim();
    if (!safeAccessCodeEqual(headerCode, assignment.accessCode)) {
      res.status(403).json({ error: "هذا الواجب مغلق ويحتاج إلى رمز وصول." });
      return;
    }
  }

  const text = assignment.listeningAudioText.slice(0, MAX_TEXT_LENGTH);
  const voice = assignment.listeningVoice || "nova";
  await synthesizeAndSend(req, res, text, voice, {
    teacherId: assignment.teacherId,
    callKeyPrefix: `assignment:${id}`,
  });
});

export default router;
