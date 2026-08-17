import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, assignmentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ttsLimiter } from "../lib/rate-limiter";
import { safeAccessCodeEqual } from "../lib/access-code";
import { checkCredits, captureCredits, refundCredits } from "../lib/check-credits";
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
}

async function generateChunk(text: string, voice: string): Promise<Buffer> {
  // gpt-audio uses non-standard modalities/audio fields not present in the
  // base ChatCompletion types; cast the request once at the call site.
  const response = (await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "mp3" },
    messages: [
      {
        role: "system",
        content: "أنت نظام تحويل نص إلى كلام. مهمتك الوحيدة: اقرأ النص الذي يُرسَل إليك بصوت واضح وطبيعي، بالضبط كما هو، دون إضافة أي كلمة أو عبارة من عندك.",
      },
      {
        role: "user",
        content: text.trim(),
      },
    ],
  } as Parameters<typeof openai.chat.completions.create>[0])) as unknown as AudioChatResponse;

  const audioData = response.choices[0]?.message?.audio?.data ?? "";
  if (!audioData) throw new Error("empty audio");
  return Buffer.from(audioData, "base64");
}

async function synthesizeAndSend(
  req: Request,
  res: Response,
  text: string,
  voice: string,
) {
  try {
    const chunks = chunkText(text);
    const buffers: Buffer[] = [];
    for (const c of chunks) {
      const buf = await generateChunk(c, voice);
      buffers.push(buf);
    }
    const combined = Buffer.concat(buffers);
    // Capture BEFORE sending: once the client has the audio the provider cost
    // is spent, so persist the charge first (crash-safe ordering).
    await captureCredits(req);
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(combined.length));
    res.set("Cache-Control", "public, max-age=3600");
    res.send(combined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    req.log.error({ err: message }, "TTS error");
    await refundCredits(req, "tts failed");
    res.status(500).json({ error: "فشل توليد الصوت" });
  }
}

router.post("/tts", ttsLimiter, checkCredits("tts"), async (req, res) => {
  // Teachers only — unauthenticated callers are blocked here.
  if (!req.session?.teacherId) {
    res.status(401).json({ error: "يجب تسجيل الدخول لاستخدام هذه الخدمة" });
    return;
  }

  const { text, voice = "nova" } = (req.body || {}) as { text?: unknown; voice?: string };

  if (!text || typeof text !== "string" || !text.trim()) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TEXT_LENGTH} حرف)` });
    return;
  }

  await synthesizeAndSend(req, res, text, voice);
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
    return;
  }

  let audioPromise = getInFlightDictationSynthesis(game, authorizedIndex);
  if (!audioPromise) {
    // No synthesis running yet — start one and register it synchronously.
    const voice = "nova"; // fixed server-side; no client influence
    audioPromise = (async () => {
      const chunks = chunkText(text);
      const buffers: Buffer[] = [];
      for (const c of chunks) buffers.push(await generateChunk(c, voice));
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
  await synthesizeAndSend(req, res, text, voice);
});

export default router;
