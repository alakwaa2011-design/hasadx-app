import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { imageUploadLimiter } from "../lib/rate-limiter";
import { checkCredits, captureCredits, refundCredits } from "../lib/check-credits";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;

/* ── Per-question type support (template-driven AI generation) ─────────────
   The wizard templates prepare question slots typed mcq / true_false /
   fill_blank. When the teacher then uses AI generation we receive the slot
   types so the generated questions match the chosen template structure. */
const VALID_AI_QTYPES = ["mcq", "true_false", "fill_blank"] as const;
type AiQType = (typeof VALID_AI_QTYPES)[number];

/** Sanitize the requested types and cycle them to exactly `count` slots.
    Returns null when nothing usable / all-MCQ (caller keeps the MCQ-only path). */
function parseQuestionTypes(raw: unknown, count: number): AiQType[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cleaned = raw.filter((t): t is AiQType => VALID_AI_QTYPES.includes(t));
  if (cleaned.length === 0) return null;
  const cycled = Array.from({ length: count }, (_, i) => cleaned[i % cleaned.length]);
  return cycled.every((t) => t === "mcq") ? null : cycled;
}

const AR_TYPE_LABEL: Record<AiQType, string> = {
  mcq: "اختيار من متعدد",
  true_false: "صح أو خطأ",
  fill_blank: "أكمل الفراغ",
};

/** Arabic prompt block describing the exact per-question type plan. */
function typePlanPrompt(types: AiQType[]): string {
  const plan = types.map((t, i) => `السؤال ${i + 1}: ${AR_TYPE_LABEL[t]}`).join("\n");
  return `أنواع الأسئلة المطلوبة (التزم بها بالترتيب حرفياً):
${plan}

قواعد كل نوع:
- "اختيار من متعدد": 4 خيارات (A, B, C, D)، "questionType": "mcq"، و"correctAnswer" أحد A/B/C/D — وزّع الإجابات الصحيحة عشوائياً
- "صح أو خطأ": عبارة يحكم عليها الطالب، "questionType": "true_false"، الخيارات فارغة ""، و"correctAnswer" إما "true" أو "false" — نوّع بين الصح والخطأ
- "أكمل الفراغ": نص السؤال يحتوي فراغاً هكذا ____، "questionType": "fill_blank"، الخيارات فارغة ""، و"correctAnswer" هي الكلمة أو العبارة الصحيحة للفراغ`;
}

/** Map one raw AI question to the app shape, validating per the expected type.
    Returns null when the question is invalid for its slot type — callers must
    map by RAW index (before any filtering) so slot types never shift. */
function mapTypedQuestion(q: any, expectedType: AiQType) {
  if (!q || typeof q.text !== "string" || !q.text.trim()) return null;
  const base = {
    text: q.text.trim(),
    optionA: "", optionB: "", optionC: "", optionD: "",
    points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
    questionType: expectedType,
  };
  if (expectedType === "true_false") {
    /* Accept only recognized true/false forms — never default a malformed
       answer to "true" (that could publish a factually wrong answer). */
    const raw = typeof q.correctAnswer === "boolean" ? String(q.correctAnswer) : String(q.correctAnswer ?? "").trim().toLowerCase();
    const truthy = ["true", "صح", "صحيح"].includes(raw);
    const falsy = ["false", "خطأ", "خاطئ"].includes(raw);
    if (!truthy && !falsy) return null;
    return { ...base, correctAnswer: truthy ? "true" : "false" };
  }
  if (expectedType === "fill_blank") {
    const answer = typeof q.correctAnswer === "string" ? q.correctAnswer.trim() : "";
    if (!answer) return null;
    return { ...base, correctAnswer: answer };
  }
  const opts = {
    optionA: typeof q.optionA === "string" ? q.optionA.trim() : "",
    optionB: typeof q.optionB === "string" ? q.optionB.trim() : "",
    optionC: typeof q.optionC === "string" ? q.optionC.trim() : "",
    optionD: typeof q.optionD === "string" ? q.optionD.trim() : "",
  };
  if (!opts.optionA || !opts.optionB || !opts.optionC || !opts.optionD) return null;
  if (!["A", "B", "C", "D"].includes(q.correctAnswer)) return null;
  return { ...base, ...opts, correctAnswer: q.correctAnswer };
}
/** Extract the FIRST complete top-level JSON array from model output.
    Quote/escape-aware bracket balancing — robust against both truncation
    (non-greedy regex stopped at the first "]") and trailing prose containing
    "]" (greedy regex swallowed it). Returns null when no balanced array. */
export function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

const MAX_TOPIC_LENGTH = 500;
const MAX_SUBJECT_LENGTH = 200;
const MIN_QUESTIONS = 1;
const MAX_QUESTIONS = 30;

router.post("/ai/generate-questions", checkCredits("ai-questions"), async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const { topic, count, difficulty, subject } = req.body || {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: "يجب تحديد موضوع الأسئلة" });
    return;
  }

  if (topic.length > MAX_TOPIC_LENGTH) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: `الموضوع طويل جداً (الحد الأقصى ${MAX_TOPIC_LENGTH} حرف)` });
    return;
  }

  if (subject && (typeof subject !== "string" || subject.length > MAX_SUBJECT_LENGTH)) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: `اسم المادة طويل جداً (الحد الأقصى ${MAX_SUBJECT_LENGTH} حرف)` });
    return;
  }

  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount) || parsedCount < MIN_QUESTIONS || parsedCount > MAX_QUESTIONS) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: `عدد الأسئلة يجب أن يكون بين ${MIN_QUESTIONS} و ${MAX_QUESTIONS}` });
    return;
  }

  const diff = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
  const difficultyText = diff === "easy" ? "سهلة" : diff === "hard" ? "صعبة" : "متوسطة";
  const qTypes = parseQuestionTypes(req.body.questionTypes, parsedCount);

  const prompt = qTypes
    ? `أنت خبير تعليمي متخصص في إعداد أسئلة الاختبارات.

المطلوب: إنشاء ${parsedCount} سؤال عن الموضوع التالي:
الموضوع: ${topic.trim()}
${subject ? `المادة: ${subject.trim()}` : ""}
الصعوبة: ${difficultyText}

${typePlanPrompt(qTypes)}

قواعد عامة:
- الأسئلة باللغة العربية ومتنوعة وتغطي جوانب مختلفة من الموضوع
- أعد الأسئلة بنفس ترتيب الأنواع المطلوب أعلاه تماماً

أعد النتيجة بتنسيق JSON فقط بدون أي نص إضافي:
[
  {
    "text": "نص السؤال",
    "questionType": "mcq",
    "optionA": "الخيار أ",
    "optionB": "الخيار ب",
    "optionC": "الخيار ج",
    "optionD": "الخيار د",
    "correctAnswer": "B",
    "points": 1
  }
]`
    : `أنت خبير تعليمي متخصص في إعداد أسئلة الاختيار من متعدد.

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
      /* Verified live (evidence run): gpt-5.2 with this exact prompt returns
         10 complete MCQs at 4000 tokens with zero hidden reasoning tokens,
         and it REJECTS reasoning_effort:"minimal" (400 unsupported_value) —
         do not add reasoning params or raise the budget here. */
      max_completion_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content || "";

    const jsonArray = extractJsonArray(responseText);
    if (!jsonArray) {
      await refundCredits(req, "لا مصفوفة JSON في رد النموذج");
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى." });
      return;
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(jsonArray);
    } catch {
      await refundCredits(req, "خطأ في تحليل JSON من النموذج");
      res.status(500).json({ message: "خطأ في تنسيق الإجابة من الذكاء الاصطناعي. حاول مرة أخرى." });
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      await refundCredits(req, "مصفوفة أسئلة فارغة من النموذج");
      res.status(500).json({ message: "لم يتم توليد أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    /* Map by RAW index (before filtering) so each answer is validated against
       its slot's expected type, then drop invalid entries. Cap at the count. */
    const validQuestions = parsed
      .slice(0, parsedCount)
      .map((q: any, idx: number) => mapTypedQuestion(q, qTypes?.[idx] ?? "mcq"))
      .filter((q): q is NonNullable<typeof q> => q !== null);

    if (validQuestions.length === 0) {
      await refundCredits(req, "لا أسئلة صالحة بعد التحقق من الشكل");
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

/* ── Generate questions WITH AI-generated images (DALL-E 3) ─────────────── */
router.post("/ai/generate-questions-with-images", checkCredits("ai-questions-images"), async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  const { topic, count, difficulty, subject } = req.body || {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: "يجب تحديد موضوع الأسئلة" });
    return;
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: `الموضوع طويل جداً (الحد الأقصى ${MAX_TOPIC_LENGTH} حرف)` });
    return;
  }

  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount) || parsedCount < MIN_QUESTIONS || parsedCount > 20) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: `عدد الأسئلة يجب أن يكون بين 1 و 20 عند توليد الصور` });
    return;
  }

  const diff = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : "medium";
  const difficultyText = diff === "easy" ? "سهلة" : diff === "hard" ? "صعبة" : "متوسطة";
  const subjectText = typeof subject === "string" && subject.trim() ? subject.trim().slice(0, 100) : "";
  const qTypesImg = parseQuestionTypes(req.body.questionTypes, parsedCount);

  /* Step 1 — Ask GPT to produce questions + a short English image prompt per question */
  const prompt = `أنت خبير تعليمي. المطلوب: إنشاء ${parsedCount} سؤال عن الموضوع التالي:
الموضوع: ${topic.trim()}
${subjectText ? `المادة: ${subjectText}` : ""}
الصعوبة: ${difficultyText}

${qTypesImg ? typePlanPrompt(qTypesImg) : `القواعد:
- كل سؤال له 4 خيارات (A, B, C, D) وإجابة صحيحة واحدة
- وزّع الإجابات الصحيحة عشوائياً بين A وB وC وD`}

- كل سؤال يعتمد على صورة يراها الطالب (لا تذكر "الصورة" في نص السؤال إذا كانت الصورة تعبّر عن نفسها)
- أضف حقل "imagePrompt": وصف بالإنجليزية لصورة واضحة تُمثّل السؤال (مناسب لتوليد الصور بالذكاء الاصطناعي، تصوير فوتوغرافي أو رسم توضيحي بسيط، خلفية بيضاء، بدون نصوص)

أعد JSON فقط بدون أي نص إضافي:
[
  {
    "text": "نص السؤال",
    "imagePrompt": "A clear photographic image of ..., white background, no text",
    "optionA": "الخيار أ",
    "optionB": "الخيار ب",
    "optionC": "الخيار ج",
    "optionD": "الخيار د",
    "correctAnswer": "B",
    "points": 1
  }
]`;

  let parsed: any[];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      /* Same rule as /ai/generate-questions: no reasoning params on gpt-5.2. */
      max_completion_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = completion.choices[0]?.message?.content || "";
    const jsonArray = extractJsonArray(responseText);
    if (!jsonArray) {
      await refundCredits(req, "لا مصفوفة JSON في رد نموذج الصور");
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى." });
      return;
    }
    parsed = JSON.parse(jsonArray);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
  } catch (err: any) {
    /* Throw-path: either the JSON.parse above threw, or we threw "empty".
       Both are genuine failures — refund before responding. */
    if (!res.headersSent) {
      await refundCredits(req, "خطأ في تحليل رد نموذج الأسئلة مع الصور");
      res.status(500).json({ message: "خطأ في توليد الأسئلة. يرجى المحاولة مرة أخرى." });
    }
    return;
  }

  /* Map by RAW index against the type plan BEFORE filtering, so dropping an
     invalid entry never shifts later questions onto the wrong slot type. */
  const validParsed = parsed
    .slice(0, parsedCount)
    .map((q: any, idx: number) => ({ raw: q, mapped: mapTypedQuestion(q, qTypesImg?.[idx] ?? "mcq") }))
    .filter((e): e is { raw: any; mapped: NonNullable<ReturnType<typeof mapTypedQuestion>> } => e.mapped !== null);
  if (validParsed.length === 0) {
    await refundCredits(req, "لا أسئلة صالحة بعد التحقق (مع صور)");
    res.status(500).json({ message: "لم يتم توليد أسئلة صالحة. حاول مرة أخرى." });
    return;
  }

  /* Step 2 — Generate images in parallel (max 6 concurrent to avoid rate limits).
     Wrapped so any unexpected throw (storage init, batch mapping) refunds. */
  try {
  const storage = new ObjectStorageService();

  const generateImage = async (imagePrompt: string): Promise<string | null> => {
    try {
      const imgRes = await openai.images.generate({
        model: "gpt-image-1",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
      });
      const b64 = imgRes.data?.[0]?.b64_json;
      if (!b64) {
        req.log.error({ imagePrompt }, "image generation returned no b64_json");
        return null;
      }
      const buffer = Buffer.from(b64, "base64");
      const objectUrl = await storage.uploadBufferAsPublic({ buffer, contentType: "image/png", extension: ".png" });
      return objectUrl;
    } catch (err) {
      req.log.error({ err, imagePrompt }, "image generation failed");
      return null;
    }
  };

  /* Process in batches of 4 to stay within rate limits */
  const BATCH = 4;
  const imageUrls: (string | null)[] = [];
  for (let i = 0; i < validParsed.length; i += BATCH) {
    const batch = validParsed.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((e) => generateImage(e.raw.imagePrompt || `Educational illustration of: ${e.mapped.text}`)));
    imageUrls.push(...results);
  }

  const failedCount = imageUrls.filter((u) => u === null).length;
  if (failedCount === validParsed.length) {
    await refundCredits(req, "فشل توليد الصور");
    res.status(500).json({ message: "تعذّر توليد الصور. لم يتم خصم أي رصيد — حاول مرة أخرى." });
    return;
  }

  const questions = validParsed.map((e, idx: number) => ({
    ...e.mapped,
    imageUrl: imageUrls[idx] || null,
  }));

  await captureCredits(req);
  res.json({ questions, failedImages: failedCount });
  } catch (err) {
    req.log.error({ err }, "generate-questions-with-images unexpected failure");
    await refundCredits(req, "unexpected error");
    if (!res.headersSent) {
      res.status(500).json({ message: "خطأ غير متوقع أثناء توليد الصور. لم يُخصم رصيدك." });
    }
  }
});

router.post("/ai/extract-questions-from-image", imageUploadLimiter, checkCredits("extract_questions_from_source"), async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }

  let teacher: { isAdmin: boolean | null } | undefined;
  try {
    [teacher] = await db
      .select({ isAdmin: teachersTable.isAdmin })
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);
  } catch (err) {
    req.log.error({ err }, "admin lookup failed in extract-questions-from-image");
    await refundCredits(req, "db error");
    res.status(500).json({ message: "خطأ مؤقت. حاول مرة أخرى." });
    return;
  }
  if (!teacher?.isAdmin) {
    await refundCredits(req, "admins only");
    res.status(403).json({ message: "هذه الميزة متاحة للمسؤولين فقط" });
    return;
  }

  const { images, count, difficulty } = req.body || {};

  if (!images || !Array.isArray(images) || images.length === 0) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: "يجب رفع صورة واحدة على الأقل" });
    return;
  }

  if (images.length > 5) {
    await refundCredits(req, "invalid input");
    res.status(400).json({ message: "الحد الأقصى 5 صور" });
    return;
  }

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  for (const img of images) {
    if (typeof img !== "string" || !img.startsWith("data:image/")) {
      await refundCredits(req, "invalid input");
      res.status(400).json({ message: "صيغة الصورة غير صحيحة" });
      return;
    }
    if (img.length > MAX_IMAGE_SIZE) {
      await refundCredits(req, "invalid input");
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
      await refundCredits(req, "no json in ai response");
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من استخراج الأسئلة. تأكد أن الصور واضحة وحاول مرة أخرى." });
      return;
    }

    let parsed: unknown[];
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      await refundCredits(req, "json parse failed");
      res.status(500).json({ message: "خطأ في تنسيق الإجابة من الذكاء الاصطناعي. حاول مرة أخرى." });
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      await refundCredits(req, "empty extraction");
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
      await refundCredits(req, "no valid questions");
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    await captureCredits(req, { questions: validQuestions });
    res.json({ questions: validQuestions });
  } catch (error: unknown) {
    req.log.error({ err: error }, "AI image question extraction error");
    await refundCredits(req, "extraction failed");
    res.status(500).json({ message: "خطأ في استخراج الأسئلة. يرجى المحاولة مرة أخرى." });
  }
});

export default router;
