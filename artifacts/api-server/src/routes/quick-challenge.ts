import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, assignmentsTable, questionsTable, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createGame, getGame, type GameQuestion } from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";

const router: IRouter = Router();

const QUICK_QUESTION_COUNT = 8;
const MAX_GUEST_QUESTIONS = 30;
const MAX_TEXT_LENGTH = 1000;
const MAX_TITLE_LENGTH = 200;
const MAX_TOPIC_LENGTH = 500;

const guestRateMap = new Map<string, { count: number; windowStart: number }>();
const GUEST_RATE_WINDOW_MS = 60 * 60 * 1000;
const GUEST_RATE_FALLBACK_MAX = 5;

function getClientIp(req: any): string {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
}

async function getGuestLimit(): Promise<number> {
  try {
    const [row] = await db.select({ guestLimit: platformSettingsTable.guestLimit }).from(platformSettingsTable).limit(1);
    return row?.guestLimit ?? 1;
  } catch { return 1; }
}

function checkGuestRate(ip: string, maxAllowed: number): boolean {
  const now = Date.now();
  const entry = guestRateMap.get(ip);
  if (!entry || now - entry.windowStart > GUEST_RATE_WINDOW_MS) {
    guestRateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxAllowed) return false;
  entry.count++;
  return true;
}

function sanitizeText(val: any, maxLen: number): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

function buildPrompt(questionType: string, topic: string): string {
  const topicLine = topic.trim()
    ? `الموضوع: ${topic.trim()}`
    : "الموضوع: معلومات عامة ومتنوعة";

  if (questionType === "true_false") {
    return `أنت خبير تعليمي. المطلوب: إنشاء ${QUICK_QUESTION_COUNT} أسئلة صح أو خطأ.
${topicLine}
القواعد:
- نص السؤال باللغة العربية
- correctAnswer إما "true" أو "false"
- وزّع الإجابات بالتساوي بين true و false
أعد JSON فقط:
[{"text":"...","correctAnswer":"true","points":1},...]`;
  }

  if (questionType === "fill_blank") {
    return `أنت خبير تعليمي. المطلوب: إنشاء ${QUICK_QUESTION_COUNT} أسئلة أملأ الفراغ.
${topicLine}
القواعد:
- استخدم ___ لتمثيل الفراغ في نص السؤال
- الإجابة كلمة واحدة أو عبارة قصيرة
- الأسئلة والإجابات باللغة العربية
أعد JSON فقط:
[{"text":"العاصمة ___ هي أكبر مدينة في فرنسا","correctAnswer":"باريس","points":1},...]`;
  }

  return `أنت خبير تعليمي. المطلوب: إنشاء ${QUICK_QUESTION_COUNT} أسئلة اختيار من متعدد.
${topicLine}
الصعوبة: متوسطة
القواعد:
- 4 خيارات (A,B,C,D) لكل سؤال، إجابة صحيحة واحدة
- وزّع الإجابات الصحيحة عشوائياً بين A و B و C و D
- الأسئلة والخيارات باللغة العربية
أعد JSON فقط:
[{"text":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"B","points":1},...]`;
}

router.post("/api/quick-challenge/create", async (req, res) => {
  const teacherId = req.session?.teacherId;

  const { questionType = "mcq", topic = "" } = req.body || {};
  const validTypes = ["mcq", "true_false", "fill_blank", "mixed"];
  const type = validTypes.includes(questionType) ? questionType : "mcq";

  const title = topic.trim()
    ? `تحدي سريع: ${topic.trim()}`
    : "تحدي سريع متنوع";

  try {
    let questions: any[] = [];

    if (type === "mixed") {
      const [mcqRaw, tfRaw] = await Promise.all([
        openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 2000,
          messages: [{ role: "user", content: buildPrompt("mcq", topic) }],
        }),
        openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 1000,
          messages: [{ role: "user", content: buildPrompt("true_false", topic) }],
        }),
      ]);

      const parseMcq = parseAiResponse(mcqRaw.choices[0]?.message?.content || "");
      const parseTf = parseAiResponse(tfRaw.choices[0]?.message?.content || "");
      questions = [...parseMcq.slice(0, 5), ...parseTf.slice(0, 3)];
      questions = shuffleArray(questions);
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2500,
        messages: [{ role: "user", content: buildPrompt(type, topic) }],
      });
      questions = parseAiResponse(completion.choices[0]?.message?.content || "");
    }

    if (questions.length === 0) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى." });
      return;
    }

    const inferType = (q: any): string => {
      if (q.correctAnswer === "true" || q.correctAnswer === "false") return "true_false";
      if (q.optionA) return "mcq";
      return "fill_blank";
    };

    let assignmentId = 0;

    if (teacherId) {
      const [assignment] = await db
        .insert(assignmentsTable)
        .values({
          title,
          subject: "تحدي سريع",
          description: `تحدي سريع تلقائي - ${type === "mcq" ? "اختيار متعدد" : type === "true_false" ? "صح أو خطأ" : type === "fill_blank" ? "أملأ الفراغ" : "متنوع"}`,
          submissionMode: "kahoot",
          accessMode: "open",
          accessCode: null,
          targetClass: null,
          showResults: true,
          modelImageBase64: null,
          totalPoints: questions.reduce((s: number, q: any) => s + (q.points || 1), 0),
          deadline: null,
          examMode: false,
          examDurationMinutes: null,
          resultsReleaseMode: "immediate",
          aiGradingInstructions: null,
          isShared: false,
          teacherId,
        })
        .returning();

      if (assignment) {
        assignmentId = assignment.id;
        await db.insert(questionsTable).values(
          questions.map((q: any) => ({
            assignmentId: assignment.id,
            text: q.text,
            optionA: q.optionA || null,
            optionB: q.optionB || null,
            optionC: q.optionC || null,
            optionD: q.optionD || null,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            questionType: type === "mixed" ? inferType(q) : type,
          }))
        );
      }
    }

    const gameQuestions: GameQuestion[] = questions.map((q: any, i: number) => ({
      id: i + 1,
      text: q.text,
      optionA: q.optionA || null,
      optionB: q.optionB || null,
      optionC: q.optionC || null,
      optionD: q.optionD || null,
      correctAnswer: q.correctAnswer,
      points: q.points || 1,
      imageUrl: null,
      questionType: type === "mixed"
        ? (q.correctAnswer === "true" || q.correctAnswer === "false" ? "true_false" : (q.optionA ? "mcq" : "fill_blank"))
        : type,
      readAloud: false,
    }));

    const game = createGame(
      assignmentId,
      title,
      `quickgame-${Date.now()}`,
      teacherId || 0,
      gameQuestions,
      20,
      true,
      "solo",
      2
    );

    res.json({
      pin: game.pin,
      assignmentId,
      title,
      questionCount: gameQuestions.length,
    });
  } catch (err: any) {
    req.log?.error({ err }, "Quick challenge create error");
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء التحدي. حاول مرة أخرى." });
  }
});

router.post("/api/quick-challenge/create-from-questions", async (req, res) => {
  const teacherId = req.session?.teacherId;

  if (!teacherId) {
    const ip = getClientIp(req);
    const limit = await getGuestLimit();
    if (limit === 0) {
      res.status(403).json({ message: "إنشاء المسابقات غير متاح للزوار حالياً", limitReached: true });
      return;
    }
    if (!checkGuestRate(ip, limit)) {
      res.status(429).json({ message: "وصلت للحد الأقصى. سجّل حساباً للاستمرار.", limitReached: true });
      return;
    }
  }

  const { title, questions: rawQuestions } = req.body || {};

  const cleanTitle = sanitizeText(title, MAX_TITLE_LENGTH);
  if (!cleanTitle) {
    res.status(400).json({ message: "يجب تحديد عنوان المسابقة" });
    return;
  }

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    res.status(400).json({ message: "أضف سؤالاً واحداً على الأقل" });
    return;
  }

  if (rawQuestions.length > MAX_GUEST_QUESTIONS) {
    res.status(400).json({ message: `الحد الأقصى ${MAX_GUEST_QUESTIONS} سؤال` });
    return;
  }

  try {
    const validTypes = ["mcq", "true_false", "fill_blank"];
    const gameQuestions: GameQuestion[] = rawQuestions
      .filter((q: any) => q && typeof q.text === "string" && q.text.trim() && q.correctAnswer)
      .slice(0, MAX_GUEST_QUESTIONS)
      .map((q: any, i: number) => ({
        id: i + 1,
        text: sanitizeText(q.text, MAX_TEXT_LENGTH),
        optionA: sanitizeText(q.optionA, MAX_TEXT_LENGTH) || null,
        optionB: sanitizeText(q.optionB, MAX_TEXT_LENGTH) || null,
        optionC: sanitizeText(q.optionC, MAX_TEXT_LENGTH) || null,
        optionD: sanitizeText(q.optionD, MAX_TEXT_LENGTH) || null,
        correctAnswer: sanitizeText(q.correctAnswer, 50),
        points: Math.min(Math.max(q.points || 1, 1), 10),
        imageUrl: null,
        questionType: validTypes.includes(q.questionType) ? q.questionType : "mcq",
        readAloud: false,
      }));

    if (gameQuestions.length === 0) {
      res.status(400).json({ message: "لا توجد أسئلة صالحة" });
      return;
    }

    let assignmentId = 0;

    if (teacherId) {
      const [assignment] = await db
        .insert(assignmentsTable)
        .values({
          title: cleanTitle,
          subject: req.body.subject || "عام",
          description: "",
          submissionMode: "kahoot",
          accessMode: "open",
          accessCode: null,
          targetClass: null,
          showResults: true,
          modelImageBase64: null,
          totalPoints: gameQuestions.reduce((s, q) => s + (q.points || 1), 0),
          deadline: null,
          examMode: false,
          examDurationMinutes: null,
          resultsReleaseMode: "immediate",
          aiGradingInstructions: null,
          isShared: false,
          teacherId,
        })
        .returning();

      if (assignment) {
        assignmentId = assignment.id;
        await db.insert(questionsTable).values(
          gameQuestions.map((q) => ({
            assignmentId: assignment.id,
            text: q.text,
            optionA: q.optionA ?? null,
            optionB: q.optionB ?? null,
            optionC: q.optionC ?? null,
            optionD: q.optionD ?? null,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            questionType: q.questionType as string,
          }))
        );
      }
    }

    const game = createGame(
      assignmentId,
      title.trim(),
      `guest-create-${Date.now()}`,
      teacherId || 0,
      gameQuestions,
      20,
      true,
      "solo",
      2
    );

    res.json({
      pin: game.pin,
      assignmentId,
      title: cleanTitle,
      questionCount: gameQuestions.length,
    });
  } catch (err: any) {
    req.log?.error({ err }, "Quick challenge create-from-questions error");
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء اللعبة. حاول مرة أخرى." });
  }
});

router.post("/api/quick-challenge/guest-ai-generate", async (req, res) => {
  const ip = getClientIp(req);
  const limit = await getGuestLimit();
  if (limit === 0 || !checkGuestRate(ip, Math.max(limit, GUEST_RATE_FALLBACK_MAX))) {
    res.status(429).json({ message: "وصلت للحد الأقصى. حاول لاحقاً.", limitReached: true });
    return;
  }

  const { topic, count = 5, difficulty = "medium", questionType = "mcq" } = req.body || {};

  const cleanTopic = sanitizeText(topic, MAX_TOPIC_LENGTH);
  if (!cleanTopic) {
    res.status(400).json({ message: "يجب تحديد الموضوع" });
    return;
  }

  const validTypes = ["mcq", "true_false", "fill_blank"];
  const type = validTypes.includes(questionType) ? questionType : "mcq";
  const parsedCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);

  const difficultyText = difficulty === "easy" ? "سهلة" : difficulty === "hard" ? "صعبة" : "متوسطة";

  let prompt: string;
  if (type === "true_false") {
    prompt = `أنت خبير تعليمي. المطلوب: إنشاء ${parsedCount} أسئلة صح أو خطأ.
الموضوع: ${cleanTopic}
الصعوبة: ${difficultyText}
القواعد:
- نص السؤال باللغة العربية
- correctAnswer إما "true" أو "false"
- وزّع الإجابات بالتساوي بين true و false
أعد JSON فقط:
[{"text":"...","correctAnswer":"true","questionType":"true_false","points":1},...]`;
  } else if (type === "fill_blank") {
    prompt = `أنت خبير تعليمي. المطلوب: إنشاء ${parsedCount} أسئلة أملأ الفراغ.
الموضوع: ${cleanTopic}
الصعوبة: ${difficultyText}
القواعد:
- استخدم ___ لتمثيل الفراغ في نص السؤال
- الإجابة كلمة واحدة أو عبارة قصيرة
- الأسئلة والإجابات باللغة العربية
أعد JSON فقط:
[{"text":"العاصمة ___ هي أكبر مدينة في فرنسا","correctAnswer":"باريس","questionType":"fill_blank","points":1},...]`;
  } else {
    prompt = `أنت خبير تعليمي. المطلوب: إنشاء ${parsedCount} أسئلة اختيار من متعدد.
الموضوع: ${cleanTopic}
الصعوبة: ${difficultyText}
القواعد:
- 4 خيارات (A,B,C,D) لكل سؤال، إجابة صحيحة واحدة
- وزّع الإجابات الصحيحة عشوائياً بين A و B و C و D
- الأسئلة والخيارات باللغة العربية
أعد JSON فقط:
[{"text":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"B","questionType":"mcq","points":1},...]`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const parsed = parseAiResponse(completion.choices[0]?.message?.content || "");
    if (parsed.length === 0) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى." });
      return;
    }

    const questions = parsed.map((q: any) => ({
      text: q.text?.trim() || "",
      optionA: q.optionA?.trim() || "",
      optionB: q.optionB?.trim() || "",
      optionC: q.optionC?.trim() || "",
      optionD: q.optionD?.trim() || "",
      correctAnswer: q.correctAnswer || "A",
      questionType: q.questionType || type,
      points: q.points || 1,
    }));

    res.json({ questions });
  } catch (err: any) {
    req.log?.error({ err }, "Guest AI generate error");
    res.status(500).json({ message: "خطأ في توليد الأسئلة. يرجى المحاولة مرة أخرى." });
  }
});

router.post("/api/quick-challenge/start/:pin", async (req, res) => {
  const teacherId = req.session?.teacherId;

  const { pin } = req.params;
  const game = getGame(pin);
  if (!game) {
    res.status(404).json({ message: "اللعبة غير موجودة" });
    return;
  }

  if (teacherId && game.teacherId !== teacherId) {
    res.status(403).json({ message: "غير مصرح" });
    return;
  }

  const result = startGameFromRest(pin);
  if (!result.success) {
    res.status(400).json({ message: result.error || "لا يمكن بدء اللعبة" });
    return;
  }

  res.json({ success: true });
});

/* ── POST /api/quick-challenge/from-assignment/:id ──────────────
   Teacher starts a وميض game from an existing assignment (no AI needed).
   Requires login. Returns { pin, title, questionCount }. */
router.post("/api/quick-challenge/from-assignment/:id", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  const assignmentId = parseInt(req.params.id);
  if (isNaN(assignmentId)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }

  try {
    const [assignment] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title, teacherId: assignmentsTable.teacherId, isShared: assignmentsTable.isShared })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (assignment.teacherId !== teacherId && !assignment.isShared) {
      res.status(403).json({ message: "ليس لديك صلاحية على هذا الواجب" });
      return;
    }

    const dbQuestions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, assignmentId));

    const gameQuestions: GameQuestion[] = dbQuestions
      .filter(q => q.questionType === "mcq" || q.questionType === "true_false" || q.questionType === "fill_blank")
      .map(q => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType as string,
        optionA: q.optionA ?? null,
        optionB: q.optionB ?? null,
        optionC: q.optionC ?? null,
        optionD: q.optionD ?? null,
        correctAnswer: q.correctAnswer ?? "",
        points: q.points ?? 1,
        duration: 20,
        imageUrl: q.imageUrl ?? null,
        readAloud: q.readAloud ?? false,
      }));

    if (gameQuestions.length === 0) {
      res.status(400).json({ message: "لا توجد أسئلة قابلة للعب في هذا الواجب" });
      return;
    }

    const game = createGame(
      assignmentId,
      assignment.title,
      "rest-api",
      teacherId,
      gameQuestions,
      20,
      false,
      "solo",
    );

    res.json({ pin: game.pin, title: assignment.title, questionCount: gameQuestions.length });
  } catch (err: any) {
    req.log.error(err, "quick-challenge/from-assignment error");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

function parseAiResponse(text: string): any[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((q: any) => q && typeof q.text === "string" && q.text.trim() && q.correctAnswer);
  } catch {
    return [];
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default router;
