import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, assignmentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ttsLimiter } from "../lib/rate-limiter";
import { safeAccessCodeEqual } from "../lib/access-code";

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
        content: "أنت مساعد يقرأ النصوص بصوت واضح وطبيعي دون إضافة أي كلام آخر.",
      },
      {
        role: "user",
        content: `اقرأ هذا النص كما هو بالضبط: ${text.trim()}`,
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
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(combined.length));
    res.set("Cache-Control", "public, max-age=3600");
    res.send(combined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    req.log.error({ err: message }, "TTS error");
    res.status(500).json({ error: "فشل توليد الصوت" });
  }
}

router.post("/tts", ttsLimiter, async (req, res) => {
  const { text, voice = "nova" } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TEXT_LENGTH} حرف)` });
    return;
  }

  await synthesizeAndSend(req, res, text, voice);
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
