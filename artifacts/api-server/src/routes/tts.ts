import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const MAX_TEXT_LENGTH = 1000;

router.post("/tts", async (req, res) => {
  const { text, voice = "nova" } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "النص مطلوب" });
    return;
  }

  if (text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `النص طويل جداً (الحد ${MAX_TEXT_LENGTH} حرف)` });
    return;
  }

  try {
    const response = await (openai.chat.completions as any).create({
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
    });

    const audioData: string = (response.choices[0]?.message as any)?.audio?.data ?? "";
    if (!audioData) {
      res.status(500).json({ error: "لم يتم توليد الصوت" });
      return;
    }

    const buffer = Buffer.from(audioData, "base64");
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
