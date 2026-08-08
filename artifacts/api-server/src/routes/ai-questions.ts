import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { imageUploadLimiter } from "../lib/rate-limiter";
import { checkCredits, captureCredits, refundCredits } from "../lib/check-credits";

const router: IRouter = Router();

const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;
const MAX_TOPIC_LENGTH = 500;
const MAX_SUBJECT_LENGTH = 200;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 30;

router.post("/ai/generate-questions", checkCredits("ai-questions"), async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const { topic, count, difficulty, subject } = req.body;

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({ message: "يجب تحديد موضوع الأسئلة" });
    return;
  }

  if (topic.length > MAX_TOPIC_LENGTH) {
    res.status(400).json({ message: `الموضوع طويل جداً (الحد الأقصى ${MAX_TOPIC_LENGTH} حرف)` });
    return;
  }

  if (subject && (typeof subject !== "string" || subject.length > MAX_SUBJECT_LENGTH)) {
    res.status(400).json({ message: `اسم المادة طويل جداً (الحد الأقصى ${MAX_SUBJECT_LENGTH} حرف)` });
    return;
  }

  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount) || parsedCount < MIN_QUESTIONS || parsedCount > MAX_QUESTIONS) {
    res.status(400).json({ message: `عدد الأسئلة يجب أن يكون بين ${MIN_QUESTIONS} و ${MAX_QUESTIONS}` });
    return;
  }

  const diff = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
  const difficultyText = diff === "easy" ? "سهلة" : diff === "hard" ? "صعبة" : "متوسطة";

  const prompt = `أنت خبير تعليمي متخصص في إعداد أسئلة الاختيار من متعدد.

المطلوب: إنشاء ${parsedCount} سؤال اختيار من متعدد عن الموضوع التالي:
الموضوع: ${topic.trim()}
${subject ? `المادة: ${subject.trim()}` : ""}
الصعوبة: ${difficultyText}

القواعد:
- كل سؤال له 4 خيارات (A, B, C, D)
- إجابة صحيحة واحدة فقط لكل سؤال
- مهم جداً: وزّع الإجابات الصحيحة بشكل عشوائي ومتنوع بين A و B و C و D. لا تجعل الإجابة الصحيحة دائماً هي الخيار الأول (A). نوّع مواقع الإجابات الصحيحة
- الأسئلة والخيارات باللغة العربية
- الأسئلة متنوعة وتغطي جوانب مختلفة من الموضوع
- الخيارات الخاطئة يجب أن تكون منطقية ومعقولة

أعد النتيجة بتنسيق JSON فقط بدون أي نص إضافي:
[
  {
    "text": "نص السؤال",
    "optionA": "الخيار أ",
    "optionB": "الخيار ب",
    "optionC": "الخيار ج",
    "optionD": "الخيار د",
    "correctAnswer": "B",
    "points": 1
  }
]`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content || "";

    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى." });
      return;
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ message: "خطأ في تنسيق الإجابة من الذكاء الاصطناعي. حاول مرة أخرى." });
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      res.status(500).json({ message: "لم يتم توليد أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    const validQuestions = parsed
      .filter((q: any) => q && typeof q.text === "string" && q.text.trim())
      .map((q: any) => ({
        text: q.text.trim(),
        optionA: typeof q.optionA === "string" ? q.optionA.trim() : "",
        optionB: typeof q.optionB === "string" ? q.optionB.trim() : "",
        optionC: typeof q.optionC === "string" ? q.optionC.trim() : "",
        optionD: typeof q.optionD === "string" ? q.optionD.trim() : "",
        correctAnswer: ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A",
        points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
      }));

    if (validQuestions.length === 0) {
      res.status(500).json({ message: "لم يتم توليد أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    await captureCredits(req);
    res.json({ questions: validQuestions });
  } catch (error: any) {
    await refundCredits(req, "خطأ في توليد الأسئلة");
    req.log.error({ err: error }, "AI question generation error");
    res.status(500).json({ message: "خطأ في توليد الأسئلة. يرجى المحاولة مرة أخرى." });
  }
});

router.post("/ai/extract-questions-from-image", imageUploadLimiter, async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  if (!teacher?.isAdmin) {
    res.status(403).json({ message: "هذه الميزة متاحة للمسؤولين فقط" });
    return;
  }

  const { images, count, difficulty } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    res.status(400).json({ message: "يجب رفع صورة واحدة على الأقل" });
    return;
  }

  if (images.length > 5) {
    res.status(400).json({ message: "الحد الأقصى 5 صور" });
    return;
  }

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  for (const img of images) {
    if (typeof img !== "string" || !img.startsWith("data:image/")) {
      res.status(400).json({ message: "صيغة الصورة غير صحيحة" });
      return;
    }
    if (img.length > MAX_IMAGE_SIZE) {
      res.status(400).json({ message: "حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت لكل صورة)" });
      return;
    }
  }

  const parsedCount = parseInt(count, 10);
  const questionCount = isNaN(parsedCount) || parsedCount < 1 || parsedCount > 30 ? 10 : parsedCount;

  const diff = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
  const difficultyText = diff === "easy" ? "سهلة" : diff === "hard" ? "صعبة" : "متوسطة";

  const textContent = `أنت خبير تعليمي. قم بتحليل الصور المرفقة (صفحات من كتاب أو درس أو ملخص) واستخراج ${questionCount} سؤال اختيار من متعدد.

القواعد:
- استخرج الأسئلة من المحتوى الموجود في الصور فقط
- كل سؤال له 4 خيارات (A, B, C, D)
- إجابة صحيحة واحدة فقط لكل سؤال
- وزّع الإجابات الصحيحة بشكل عشوائي بين A و B و C و D
- الأسئلة والخيارات باللغة العربية (إلا إذا كان المحتوى بلغة أخرى فاستخدم نفس اللغة)
- الصعوبة: ${difficultyText}
- الخيارات الخاطئة يجب أن تكون منطقية ومعقولة
- إذا كان المحتوى لا يكفي لعدد الأسئلة المطلوب، أنشئ أسئلة بقدر ما يسمح المحتوى

أعد النتيجة بتنسيق JSON فقط بدون أي نص إضافي:
[
  {
    "text": "نص السؤال",
    "optionA": "الخيار أ",
    "optionB": "الخيار ب",
    "optionC": "الخيار ج",
    "optionD": "الخيار د",
    "correctAnswer": "B",
    "points": 1
  }
]`;

  const imageContents = images.map((img: string) => ({
    type: "image_url" as const,
    image_url: { url: img },
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: textContent },
            ...imageContents,
          ],
        },
      ],
    });

    const responseText = completion.choices[0]?.message?.content || "";

    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من استخراج الأسئلة. تأكد أن الصور واضحة وحاول مرة أخرى." });
      return;
    }

    let parsed: unknown[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ message: "خطأ في تنسيق الإجابة من الذكاء الاصطناعي. حاول مرة أخرى." });
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. تأكد أن الصور تحتوي على محتوى تعليمي." });
      return;
    }

    const validQuestions = parsed
      .filter((q: unknown) => {
        if (!q || typeof q !== "object") return false;
        const obj = q as Record<string, unknown>;
        return typeof obj.text === "string" && (obj.text as string).trim().length > 0;
      })
      .map((q: unknown) => {
        const obj = q as Record<string, unknown>;
        return {
          text: (obj.text as string).trim(),
          optionA: typeof obj.optionA === "string" ? (obj.optionA as string).trim() : "",
          optionB: typeof obj.optionB === "string" ? (obj.optionB as string).trim() : "",
          optionC: typeof obj.optionC === "string" ? (obj.optionC as string).trim() : "",
          optionD: typeof obj.optionD === "string" ? (obj.optionD as string).trim() : "",
          correctAnswer: ["A", "B", "C", "D"].includes(obj.correctAnswer as string) ? obj.correctAnswer : "A",
          points: typeof obj.points === "number" && (obj.points as number) > 0 ? obj.points : 1,
        };
      });

    if (validQuestions.length === 0) {
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    res.json({ questions: validQuestions });
  } catch (error: unknown) {
    req.log.error({ err: error }, "AI image question extraction error");
    res.status(500).json({ message: "خطأ في استخراج الأسئلة. يرجى المحاولة مرة أخرى." });
  }
});

export default router;
