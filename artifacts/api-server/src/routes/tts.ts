import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const MAX_TEXT_LENGTH = 1000;

router.post("/tts", async (req, res) => {
  if (!req.session?.teacherId && !req.session?.studentId) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return;
  }

  const { text, voice = "nova", speed = 0.85 } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TEXT_LENGTH} حرف)` });
    return;
  }

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1-hd",
      voice: voice as "nova" | "shimmer" | "alloy" | "echo" | "fable" | "onyx",
      input: text.trim(),
      speed: Math.min(1.5, Math.max(0.25, Number(speed) || 0.85)),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(buffer.length));
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch (err: any) {
    console.error("TTS error:", err?.message);
    res.status(500).json({ error: "فشل توليد الصوت" });
  }
});

export default router;
