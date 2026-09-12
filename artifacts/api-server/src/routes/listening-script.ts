import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic, SONNET_MODEL } from "../lib/anthropic-client";
import { isClaudeTier, modelForTier, resolveTier, type AiTier } from "../lib/ai-tier";
import { resolveAiContentLanguage } from "../lib/ai-content-language";
import { trackAiUsageCall } from "../lib/ai-usage-ledger";
import { sensitiveActionLimiter } from "../lib/rate-limiter";

const router: IRouter = Router();

function requireTeacher(req: any, res: any, next: any) {
  if (req.session?.teacherId) return next();
  res.status(401).json({ message: "Unauthorized" });
}

const generateBody = z.object({
  topic: z.string().trim().min(2).max(600),
  textType: z.enum(["auto", "story", "dialogue", "educational"]).default("auto"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  diacritics: z.enum(["none", "ambiguous", "full"]).default("ambiguous"),
  language: z.enum(["ar", "en"]).default("ar"),
  gradeLevel: z.string().trim().max(80).optional(),
  activityTitle: z.string().trim().max(120).optional(),
});

async function runCompletion(req: Request, tier: AiTier, system: string, prompt: string, maxTokens: number) {
  const usage = { req, toolKey: "listening-script", callKey: "generate:completion" };
  if (isClaudeTier(tier)) {
    const invoke = () => anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const response = await trackAiUsageCall(usage.req, {
      toolKey: usage.toolKey,
      callKey: usage.callKey,
      provider: "anthropic",
      model: SONNET_MODEL,
      modality: "text",
    }, invoke, (result) => ({
      tokensIn: result.usage.input_tokens,
      tokensOut: result.usage.output_tokens,
    }));
    const block = response.content.find((item) => item.type === "text");
    return block && "text" in block ? block.text : "";
  }

  const model = modelForTier(tier);
  const invoke = () => openai.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  const response = await trackAiUsageCall(usage.req, {
    toolKey: usage.toolKey,
    callKey: usage.callKey,
    provider: "openai",
    model,
    modality: "text",
  }, invoke, (result) => ({
    tokensIn: result.usage?.prompt_tokens,
    tokensOut: result.usage?.completion_tokens,
  }));
  return response.choices[0]?.message?.content || "";
}

function cleanGeneratedScript(value: string): string {
  return value
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^(?:بالطبع[،,]?\s*)?(?:إليك|هذا)\s+(?:نص(?:اً|ًا)?|النص)\s*(?:مقترح(?:اً|ًا)?\s*)?(?::|-)\s*/i, "")
    .replace(/^(?:Certainly[,.]?\s*)?(?:Here is|Here's)\s+(?:the\s+)?(?:suggested\s+)?(?:listening\s+)?(?:text|script)\s*[:\-]\s*/i, "")
    .trim()
    .slice(0, 5000);
}

router.post("/listening-script/generate", requireTeacher, sensitiveActionLimiter, async (req, res) => {
  let language: "ar" | "en" = req.body?.language === "en" ? "en" : "ar";
  try {
    const parsed = generateBody.parse(req.body);
    language = resolveAiContentLanguage({
      preferredLanguage: parsed.language,
      primaryText: parsed.topic,
    });
    const tier = await resolveTier(req.session.teacherId as number, (req.body as { tier?: string })?.tier);
    const isArabic = language === "ar";
    const typeLabel = isArabic
      ? { auto: "اختر البنية الأنسب للموضوع", story: "قصة", dialogue: "حوار", educational: "نص تعليمي" }[parsed.textType]
      : { auto: "choose the structure best suited to the topic", story: "story", dialogue: "dialogue", educational: "educational text" }[parsed.textType];
    const lengthGuide = isArabic
      ? { short: "قصير: نحو 100–160 كلمة", medium: "متوسط: نحو 220–320 كلمة", long: "طويل: نحو 450–650 كلمة" }[parsed.length]
      : { short: "short: about 100–160 words", medium: "medium: about 220–320 words", long: "long: about 450–650 words" }[parsed.length];
    const diacriticsGuide = !isArabic
      ? "The output is English; do not add Arabic diacritics."
      : {
          none: "اكتب بلا تشكيل، إلا عند الضرورة القصوى في اسم خاص.",
          ambiguous: "شكّل الكلمات الملتبسة فقط عندما قد يتغير نطقها أو معناها، ولا تشكّل كل الكلمات.",
          full: "شكّل النص كاملًا قدر الإمكان بتشكيل لغوي وسياقي صحيح، ولا تضف حركة غير واثق منها.",
        }[parsed.diacritics];

    const system = isArabic
      ? "أنت كاتب محتوى تعليمي خبير. أنشئ نص استماع تعليميًا جاهزًا للقراءة أو التحويل إلى صوت للطلاب. أعد النص نفسه فقط دون عنوان تمهيدي أو شرح أو عبارات مثل «بالطبع، إليك النص» و«هذا نص مقترح». استخدم لغة واضحة وجملًا سهلة الاستماع ومناسبة تربويًا."
      : "You are an expert educational writer. Create an educational listening script ready to be read aloud or converted to student audio. Return only the script itself, with no preface, explanation, or phrases such as “Here is the script.” Use clear, age-appropriate language and sentences suited to listening.";
    const prompt = [
      isArabic ? `الموضوع المطلوب: ${parsed.topic}` : `Requested topic: ${parsed.topic}`,
      isArabic ? `نوع النص: ${typeLabel}` : `Text type: ${typeLabel}`,
      isArabic ? `الطول: ${lengthGuide}` : `Length: ${lengthGuide}`,
      parsed.gradeLevel ? (isArabic ? `الصف الدراسي: ${parsed.gradeLevel}` : `Grade level: ${parsed.gradeLevel}`) : "",
      parsed.activityTitle ? (isArabic ? `عنوان النشاط للسياق فقط: ${parsed.activityTitle}` : `Activity title for context only: ${parsed.activityTitle}`) : "",
      diacriticsGuide,
      isArabic
        ? "راعِ عمر الطلاب ومستواهم، وتجنب الجمل المعقدة بلا داعٍ. لا تضف أسئلة أو تعليمات للمعلم إلا إذا طلبها الموضوع صراحة."
        : "Match the students' age and level. Avoid unnecessary complexity. Do not add teacher instructions or questions unless the topic explicitly asks for them.",
    ].filter(Boolean).join("\n");
    const maxTokens = parsed.length === "long" ? 2200 : parsed.length === "medium" ? 1300 : 800;
    const script = cleanGeneratedScript(await runCompletion(req, tier, system, prompt, maxTokens));
    if (!script) {
      res.status(502).json({ message: isArabic ? "لم يُرجع المولّد نصًا صالحًا" : "The generator returned no usable text" });
      return;
    }
    res.json({ script, language });
  } catch (error: any) {
    if (error?.issues) {
      res.status(400).json({ message: language === "ar" ? "تحقق من موضوع النص والخيارات" : "Check the topic and options" });
      return;
    }
    req.log.error({ err: error }, "Listening script generation failed");
    res.status(500).json({ message: language === "ar" ? "تعذّر إنشاء النص. حاول مرة أخرى." : "Could not generate the script. Please try again." });
  }
});

export default router;