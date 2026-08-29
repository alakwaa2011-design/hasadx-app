import { describe, expect, it } from "vitest";
import {
  canUseQualityDegradedQuickOutline,
  sanitizeOutline,
  needsCorrectiveOutlineRetry,
  shouldAdoptCorrectiveOutline,
  type SanitizedDesignFamily,
  type SanitizedSlideType,
} from "../lib/outline-guardrails";
import type { OutlineBrief } from "../lib/outline-prompt";

const baseBrief: OutlineBrief = {
  language: "ar",
  subject: "اللغة العربية",
  gradeLevel: "الصف السادس",
  topic: "المفعول معه",
  presentationKind: "explain",
  slideCount: 5,
  durationMinutes: 30,
  languageLevel: "medium",
  density: "balanced",
  toggles: { activities: false, questions: false, poll: false, quiz: false },
};

function fixedLesson(
  topic: string,
  family: SanitizedDesignFamily,
  types: SanitizedSlideType[],
) {
  return {
    language: "ar",
    density: "balanced",
    totalEstimatedMinutes: 30,
    designBrief: { designFamily: family, visualMotif: `${topic} بصور تعليمية واضحة` },
    objectives: [`يفسر الطالب ${topic}`, `يوظف الطالب ${topic} في مثال صحيح`],
    teachingFlow: [
      { stage: "opener", slideIndices: [1], estimatedMinutes: 4 },
      { stage: "concept", slideIndices: [2, 3], estimatedMinutes: 14 },
      { stage: "practice", slideIndices: [4], estimatedMinutes: 8 },
      { stage: "closure", slideIndices: [5], estimatedMinutes: 4 },
    ],
    slides: types.map((slideType, index) => ({
      index: index + 1,
      kind: ["title", "concept", "visualHero", "process", "comparison", "timeline", "workedExample", "quote", "misconception", "activity", "quiz", "summary"].includes(slideType)
        ? undefined
        : "concept-card",
      slideType,
      layoutVariant: ["poster", "editorial", "classic", "staggered", "poster"][index],
      title: `${topic} — فكرة ${index + 1}`,
      purpose: `يبني فهماً واضحاً لموضوع ${topic}`,
      talkingPoints: index === 0
        ? []
        : ["مثال محدد يقود إلى الفكرة", "دليل قصير يوضح العلاقة", "تطبيق يكشف الفهم"],
      interactionHint: null,
      imagePlan: index === 1
        ? {
            reason: "توضيح المفهوم بصورة واقعية",
            imageQuery: `${topic} education illustration`,
            mediaType: "illustration",
            placement: "side",
            fallback: "coloredExample",
          }
        : { fallback: index === 2 ? "diagram" : "icon" },
      visualDirection: { icon: index === 1 ? "book" : "lightbulb" },
    })),
  };
}

describe("presentation visual contract fixtures", () => {
  it.each([
    ["المفعول معه", "editorial", ["title", "concept", "comparison", "misconception", "summary"]],
    ["دورة الماء", "scientific", ["title", "visualHero", "process", "workedExample", "summary"]],
    ["الحضارة الإسلامية", "narrative", ["title", "timeline", "concept", "comparison", "summary"]],
  ] as const)(
    "keeps a structured, varied, non-paid fixture for %s",
    (topic, family, types) => {
      const result = sanitizeOutline(fixedLesson(topic, family, [...types]), {
        ...baseBrief,
        topic,
        subject: family === "scientific" ? "العلوم" : family === "narrative" ? "التاريخ" : "اللغة العربية",
      });

      expect(result.report.fatal).toBe(false);
      expect(result.outline.designBrief?.designFamily).toBe(family);
      expect(new Set(result.outline.slides.map((slide) => slide.kind)).size).toBeGreaterThanOrEqual(4);
      expect(result.outline.slides[1].imagePlan).toMatchObject({
        imageQuery: expect.stringContaining(topic),
        placement: "side",
        fallback: "coloredExample",
      });
      expect(result.outline.slides[2].imagePlan?.imageQuery).toBeUndefined();
      expect(result.outline.slides.every((slide) =>
        !slide.talkingPoints.some((point) => point === "..." || point === "…"),
      )).toBe(true);
    },
  );

  it("rejects placeholder padding instead of silently saving it", () => {
    const raw = fixedLesson("المفعول معه", "editorial", [
      "title", "concept", "comparison", "misconception", "summary",
    ]);
    raw.slides[1].talkingPoints = ["...", "TODO", "…"];

    const result = sanitizeOutline(raw, baseBrief);

    expect(result.report.fatal).toBe(true);
    expect(result.report.feedback.join(" ")).toMatch(/placeholder|incomplete/i);
    expect(result.outline.slides[1].talkingPoints).toEqual([]);
  });

  it("accepts a quiz slide whose validated questions are its content", () => {
    const raw = fixedLesson("المفعول معه", "editorial", [
      "title", "concept", "comparison", "quiz", "summary",
    ]);
    const quiz = raw.slides[3] as Record<string, unknown>;
    quiz.kind = "interactive";
    quiz.slideType = "quiz";
    quiz.interactionHint = "quiz";
    quiz.talkingPoints = [];
    quiz.gameQuestions = [
      {
        prompt: "أي جملة تحتوي مفعولاً معه؟",
        options: ["سرت والنهر", "قرأت الكتاب", "كتب الطالب"],
        correctIndex: 0,
      },
      {
        prompt: "ما علامة نصب المفعول معه المفرد؟",
        options: ["الفتحة", "الضمة", "الكسرة"],
        correctIndex: 0,
      },
    ];

    const result = sanitizeOutline(raw, {
      ...baseBrief,
      toggles: { activities: true, questions: true, poll: false, quiz: true },
    });

    expect(result.report.fatal).toBe(false);
    expect(result.outline.slides[3].talkingPoints).toEqual([]);
    expect(result.outline.slides[3].gameQuestions).toHaveLength(2);
  });

  it("adopts a complete corrective outline even if it has more minor feedback", () => {
    expect(shouldAdoptCorrectiveOutline(
      { fatal: true, feedback: ["Outline has 4/5 required slides."] },
      { fatal: false, feedback: ["Teaching flow rebuilt", "Unknown layout variant"] },
    )).toBe(true);
    expect(shouldAdoptCorrectiveOutline(
      { fatal: false, feedback: ["one issue"] },
      { fatal: false, feedback: ["one issue", "another issue"] },
    )).toBe(false);
  });

  it("does not make teachers wait for a second call for non-fatal cleanup", () => {
    expect(needsCorrectiveOutlineRetry({
      fatal: false,
      feedback: ["Slide 2: generic slide title", "Teaching flow rebuilt from default split."],
    })).toBe(false);
    expect(needsCorrectiveOutlineRetry({
      fatal: true,
      feedback: ["Outline has 4/5 required slides."],
    })).toBe(true);
  });

  it("keeps numbered educational content instead of making the slide empty", () => {
    const raw = fixedLesson("دورة الماء", "scientific", [
      "title", "visualHero", "process", "workedExample", "summary",
    ]);
    raw.slides[2].talkingPoints = [
      "1. يتبخر الماء بفعل حرارة الشمس",
      "2. يتكاثف بخار الماء في طبقات الجو",
      "3. يعود الماء هطولاً إلى سطح الأرض",
    ];

    const result = sanitizeOutline(raw, { ...baseBrief, topic: "دورة الماء", subject: "العلوم" });

    expect(result.report.fatal).toBe(false);
    expect(result.outline.slides[2].talkingPoints).toHaveLength(3);
  });

  it("keeps a complete outline when a slide is sparse or has a longer useful point", () => {
    const raw = fixedLesson("دورة الماء", "scientific", [
      "title", "visualHero", "process", "workedExample", "summary",
    ]);
    raw.slides[1].talkingPoints = [
      "يتحول الماء إلى بخار عند تسخينه ثم يصعد إلى طبقات الجو العليا ويبدأ دورة جديدة",
      "توضح الصورة مراحل التغير المتتابعة",
    ];
    raw.slides[3].talkingPoints = ["يتتبع الطالب مرحلة واحدة من الدورة في مثال واقعي"];

    const result = sanitizeOutline(raw, { ...baseBrief, topic: "دورة الماء", subject: "العلوم" });

    expect(result.report.fatal).toBe(false);
    expect(result.outline.slides[1].talkingPoints).toHaveLength(2);
    expect(result.outline.slides[1].talkingPoints[0]).toContain("يتحول الماء");
    expect(result.outline.slides[3].talkingPoints).toHaveLength(1);
  });

  it("accepts a professional outline that is one usable slide short instead of failing everything", () => {
    const raw = mafoulMaahFullLesson();
    raw.slides.pop();

    const result = sanitizeOutline(raw, fullLessonBrief);

    expect(result.outline.slides).toHaveLength(10);
    expect(result.report.fatal).toBe(false);
    expect(result.report.feedback.join(" ")).toMatch(/10\/11 required slides/);
  });

  it("rejects a shallow quick deck that has no worked example, practice, or assessment", () => {
    const raw = fixedLesson("المفعول معه", "editorial", [
      "title", "concept", "visualHero", "concept", "concept",
    ]);
    raw.slides = [
      ...raw.slides,
      ...fixedLesson("المفعول معه", "editorial", ["concept", "concept", "summary"]).slides.map(
        (slide, index) => ({ ...slide, index: index + 6, title: `${slide.title} — إضافي ${index}` }),
      ),
    ];
    for (const slide of raw.slides) {
      (slide as typeof slide & { pedagogicalRole: string }).pedagogicalRole =
        slide.slideType === "title" ? "hook" : slide.slideType === "summary" ? "summary" : "explain";
    }

    const result = sanitizeOutline(raw, {
      ...baseBrief,
      presentationKind: "quick",
      slideCount: 8,
    });

    expect(result.report.fatal).toBe(true);
    expect(result.report.feedback.join(" ")).toMatch(/missing core pedagogical role/);
  });

  it("distinguishes editable quick-deck quality warnings from missing content", () => {
    const raw = mafoulMaahFullLesson();
    for (const slide of raw.slides) {
      if (slide.pedagogicalRole === "example" || slide.pedagogicalRole === "practice") {
        slide.pedagogicalRole = "explain";
      }
    }

    const brief = {
      ...fullLessonBrief,
      presentationKind: "quick" as const,
    };
    const result = sanitizeOutline(raw, brief);

    expect(result.report.fatal).toBe(true);
    expect(result.report.fatalKind).toBe("quality");
    expect(canUseQualityDegradedQuickOutline(brief, result.report)).toBe(true);
  });

  it("requires both a worked example and guided practice in quick strategy decks", () => {
    const raw = mafoulMaahFullLesson();
    for (const slide of raw.slides) {
      if (slide.pedagogicalRole === "example" || slide.pedagogicalRole === "practice") {
        slide.pedagogicalRole = "activity";
      }
    }

    const result = sanitizeOutline(raw, {
      ...fullLessonBrief,
      presentationKind: "quick",
      educationalStrategy: "active_learning",
    });

    expect(result.report.fatal).toBe(true);
    expect(result.report.feedback.join(" ")).toMatch(/example/);
    expect(result.report.feedback.join(" ")).toMatch(/practice/);
  });

  it("keeps missing visual plans text-led while still varying layouts", () => {
    const raw = fixedLesson("دورة الماء", "scientific", [
      "title", "visualHero", "process", "workedExample", "summary",
    ]);
    for (const slide of raw.slides) {
      delete (slide as Record<string, unknown>).imagePlan;
      delete (slide as Record<string, unknown>).layoutVariant;
    }

    const result = sanitizeOutline(raw, {
      ...baseBrief,
      topic: "دورة الماء",
      subject: "العلوم",
    });

    expect(result.report.fatal).toBe(false);
    expect(result.outline.slides.every((slide) =>
      slide.imagePlan?.fallback === "none",
    )).toBe(true);
    expect(result.outline.slides.every((slide) =>
      slide.imagePlan?.imageQuery === undefined && slide.imagePlan?.placement === "none",
    )).toBe(true);
    expect(new Set(result.outline.slides.map((slide) => slide.layoutVariant)).size).toBeGreaterThanOrEqual(4);
    expect(result.report.feedback.join(" ")).toMatch(/text-led instead of inventing decoration/);
  });
});

/* Full-lesson depth contract — a normal lesson request must come back as a
   complete teachable lesson (hook → objective → explain → examples →
   misconception → guided practice → activity → assess → summary), never a
   decorated summary. Safe fixture: no paid AI calls. */

const fullLessonBrief: OutlineBrief = {
  ...baseBrief,
  slideCount: 11,
  durationMinutes: 45,
  toggles: { activities: true, questions: true, poll: false, quiz: true },
};

function mafoulMaahFullLesson() {
  return {
    language: "ar",
    density: "balanced",
    totalEstimatedMinutes: 45,
    designBrief: { designFamily: "editorial", visualMotif: "أمثلة عربية محللة بألوان الإعراب" },
    objectives: [
      "يميز الطالب واو العطف من واو المعية في جمل متنوعة",
      "يعرب الطالب المفعول معه إعراباً صحيحاً كاملاً",
      "يصوغ الطالب جملاً صحيحة تتضمن مفعولاً معه",
    ],
    teachingFlow: [
      { stage: "opener", slideIndices: [1, 2], estimatedMinutes: 6 },
      { stage: "concept", slideIndices: [3, 4, 5, 6, 7], estimatedMinutes: 20 },
      { stage: "practice", slideIndices: [8, 9, 10], estimatedMinutes: 14 },
      { stage: "closure", slideIndices: [11], estimatedMinutes: 5 },
    ],
    slides: [
      {
        index: 1, kind: "title", slideType: "title", pedagogicalRole: "hook",
        title: "المفعول معه — الواو التي تعني (مع)",
        purpose: "غلاف الحصة يقدم الفكرة المحورية",
        talkingPoints: [], interactionHint: null,
        visualDirection: { icon: "book" },
      },
      {
        index: 2, kind: "callout", pedagogicalRole: "hook",
        title: "سرتُ والنيلَ… ماذا أفادت الواو هنا؟",
        purpose: "سؤال استكشافي يهيئ الطلاب ويربط بمعرفتهم السابقة",
        talkingPoints: [
          "الواو هنا لا تُشرك النيل في فعل السير",
          "المعنى المقصود: سرتُ بمحاذاة النيل في وقت واحد",
          "سؤال الحصة: متى تكون الواو بمعنى (مع)؟",
        ],
        interactionHint: null,
        visualDirection: { icon: "lightbulb" },
      },
      {
        index: 3, kind: "objectives", pedagogicalRole: "objective",
        title: "ماذا سنتقن في هذه الحصة؟",
        purpose: "تحديد نواتج التعلم الثلاثة للحصة",
        talkingPoints: [
          "نميز واو العطف من واو المعية بدقة",
          "نعرب المفعول معه إعراباً صحيحاً كاملاً",
          "نصوغ جملاً سليمة فيها مفعول معه",
        ],
        interactionHint: null,
        visualDirection: { icon: "target" },
      },
      {
        index: 4, kind: "concept-card", slideType: "concept", pedagogicalRole: "explain",
        title: "تعريف المفعول معه وشروطه",
        purpose: "شرح المفهوم الأساسي بأركانه الثلاثة",
        talkingPoints: [
          "المفعول معه اسم فضلة منصوب يقع بعد واو المعية",
          "تسبقه جملة فيها فعل أو ما يشبه الفعل",
          "الواو قبله بمعنى (مع) وتفيد المصاحبة الزمنية",
        ],
        interactionHint: null,
        imagePlan: { reason: "مخطط أركان المفهوم", fallback: "relationshipMap" },
        visualDirection: { icon: "layers" },
      },
      {
        index: 5, kind: "comparison", slideType: "comparison", pedagogicalRole: "misconception",
        title: "واو العطف أم واو المعية؟ الفرق الحاسم",
        purpose: "معالجة اللبس الأكثر شيوعاً بين الواوين",
        talkingPoints: [
          "واو العطف تُشرك ما بعدها في الحكم: جاء المعلمُ والطالبُ",
          "واو المعية تفيد المصاحبة فقط: سرتُ والجبلَ",
          "جرب إحلال (مع) مكان الواو: إن استقام المعنى فهي معية",
        ],
        interactionHint: null,
        imagePlan: { reason: "جدول مقارنة ملون", fallback: "coloredExample" },
        visualDirection: { icon: "compass" },
      },
      {
        index: 6, kind: "formula", slideType: "workedExample", pedagogicalRole: "example",
        title: "مثال محلل: سار القائدُ والجيشَ",
        purpose: "تحليل مثال أول خطوة بخطوة حتى الإعراب الكامل",
        talkingPoints: [
          "سار: فعل ماضٍ، والقائدُ: فاعل مرفوع بالضمة",
          "الواو: واو المعية لأن المعنى سار بمصاحبة الجيش",
          "الجيشَ: مفعول معه منصوب وعلامة نصبه الفتحة",
        ],
        interactionHint: null,
        imagePlan: { reason: "تلوين مواقع الإعراب", fallback: "coloredExample" },
        visualDirection: { icon: "check" },
      },
      {
        index: 7, kind: "steps", pedagogicalRole: "example",
        title: "مثال ثانٍ بخطوات الإعراب الأربع",
        purpose: "ترسيخ منهجية الإعراب على مثال جديد",
        talkingPoints: [
          "الجملة: استيقظتُ وأذانَ الفجرِ",
          "الخطوة الأولى: حدد الفعل والفاعل (استيقظ + التاء)",
          "الخطوة الثانية: اختبر الواو بإحلال (مع) مكانها",
          "الخطوة الثالثة: انصب الاسم بعدها: أذانَ مفعول معه",
        ],
        interactionHint: null,
        visualDirection: { icon: "clock" },
      },
      {
        index: 8, kind: "callout", pedagogicalRole: "practice",
        title: "جرب بنفسك: ذاكرتُ والمصباحَ",
        purpose: "تدريب موجه يحل أمام الطلاب مع الإجابة الكاملة",
        talkingPoints: [
          "أعرب الجملة كاملة قبل كشف الحل",
          "الإجابة: ذاكر فعل ماضٍ والتاء فاعل",
          "الواو واو المعية، والمصباحَ مفعول معه منصوب بالفتحة",
        ],
        interactionHint: null,
        visualDirection: { icon: "sparkles" },
      },
      {
        index: 9, kind: "interactive", slideType: "activity", pedagogicalRole: "activity",
        title: "مسابقة: صنف الواو في كل جملة",
        purpose: "نشاط تفاعلي جماعي يميز بين الواوين",
        interactionHint: "quiz",
        gameSuggestion: "kahoot",
        gameQuestions: [
          {
            question: "سافرتُ وشروقَ الشمس — ما نوع الواو؟",
            options: ["واو العطف", "واو المعية", "واو القسم", "واو الحال"],
            correctIndex: 1,
          },
          {
            question: "حضر المديرُ والمعلمون — ما نوع الواو؟",
            options: ["واو المعية", "واو القسم", "واو العطف", "واو الاستئناف"],
            correctIndex: 2,
          },
          {
            question: "ما إعراب (الشاطئَ) في: مشيتُ والشاطئَ؟",
            options: ["مفعول به", "معطوف منصوب", "حال", "مفعول معه منصوب"],
            correctIndex: 3,
          },
        ],
        talkingPoints: ["ثلاث جمل متدرجة الصعوبة يصنفها الفريقان"],
        visualDirection: { icon: "trophy" },
      },
      {
        index: 10, kind: "interactive", slideType: "quiz", pedagogicalRole: "assess",
        title: "تقويم سريع: أنشئ جملتك الصحيحة",
        purpose: "تحقق ختامي من إتقان النواتج بتطبيق جديد",
        interactionHint: "quiz",
        talkingPoints: [
          "اكتب جملة فيها مفعول معه وأعربها كاملة",
          "معيار النجاح: واو بمعنى (مع) بعدها اسم منصوب",
          "زميلك يراجع جملتك بقاعدة إحلال (مع)",
        ],
        visualDirection: { icon: "check" },
      },
      {
        index: 11, kind: "closure", slideType: "summary", pedagogicalRole: "summary",
        title: "خلاصة الحصة في ثلاث قواعد",
        purpose: "تجميع منظم لما تعلمه الطلاب اليوم",
        talkingPoints: [
          "المفعول معه اسم فضلة منصوب بعد واو المعية",
          "اختبار الواو: أحل (مع) مكانها واستقم المعنى",
          "تحدٍ اختياري: ابحث عن مفعول معه في نص قرأته اليوم",
        ],
        interactionHint: null,
        visualDirection: { icon: "book" },
      },
    ],
  };
}

describe("full-lesson depth contract", () => {
  it("accepts a complete المفعول معه lesson with all core pedagogical roles", () => {
    const result = sanitizeOutline(mafoulMaahFullLesson(), fullLessonBrief);

    expect(result.report.fatal).toBe(false);
    const joined = result.report.feedback.join(" ");
    expect(joined).not.toMatch(/missing core pedagogical|repeats on/);

    const slides = result.outline.slides;
    expect(slides).toHaveLength(11);

    const roles = new Set(slides.map((s) => s.pedagogicalRole));
    for (const role of ["hook", "objective", "explain", "misconception", "example", "practice", "activity", "assess", "summary"]) {
      expect(roles.has(role as never)).toBe(true);
    }

    expect(new Set(slides.map((s) => s.kind)).size).toBeGreaterThanOrEqual(6);
    expect(slides[8].gameQuestions).toHaveLength(3);
    expect(slides.slice(1).every((s) => s.talkingPoints.length >= 1)).toBe(true);

    const allText = slides.map((s) => `${s.title} ${s.talkingPoints.join(" ")}`).join(" ");
    expect(allText).toContain("واو المعية");
    expect(allText).toContain("واو العطف");
    expect(allText).toContain("مفعول معه منصوب");
  });

  it("rejects a decorated summary that lacks example/practice and assessment", () => {
    const raw = mafoulMaahFullLesson();
    /* Strip the lesson down to definitions + recap: replace example,
       practice, activity, and assess slides with more explanation. */
    for (const idx of [5, 6, 7, 8, 9]) {
      raw.slides[idx] = {
        ...raw.slides[idx],
        kind: "concept-card",
        slideType: "concept",
        pedagogicalRole: "explain",
        interactionHint: null,
        gameSuggestion: undefined,
        gameQuestions: undefined,
        title: `${raw.slides[idx].title} — شرح إضافي ${idx}`,
        talkingPoints: [`معلومة نظرية إضافية رقم ${idx} عن المفعول معه`],
      } as (typeof raw.slides)[number];
    }

    const result = sanitizeOutline(raw, fullLessonBrief);

    expect(result.report.fatal).toBe(true);
    expect(result.report.feedback.join(" ")).toMatch(/missing core pedagogical role/);
    expect(needsCorrectiveOutlineRetry(result.report)).toBe(true);
  });

  it("rejects shallow one-line explanation and practice slides", () => {
    const raw = mafoulMaahFullLesson();
    raw.slides[3].talkingPoints = ["المفعول معه اسم منصوب بعد واو المعية"];
    raw.slides[7].talkingPoints = ["أعرب الجملة ثم تحقق من الإجابة"];

    const result = sanitizeOutline(raw, fullLessonBrief);

    expect(result.report.fatal).toBe(true);
    expect(result.report.feedback.join(" ")).toMatch(/Shallow teaching content/);
    expect(result.report.feedback.join(" ")).toMatch(/4, 8/);
  });

  it("rejects a deck where one pedagogical role dominates the majority of slides", () => {
    const raw = mafoulMaahFullLesson();
    /* Keep coverage (explain, assess exist) but make example dominate. */
    for (const idx of [1, 2, 4, 7]) {
      raw.slides[idx] = {
        ...raw.slides[idx],
        pedagogicalRole: "example",
        title: `${raw.slides[idx].title} — مثال ${idx}`,
      } as (typeof raw.slides)[number];
    }

    const result = sanitizeOutline(raw, fullLessonBrief);

    expect(result.report.fatal).toBe(true);
    expect(result.report.feedback.join(" ")).toMatch(/repeats on/);
  });

  it("keeps role findings advisory for contest decks (no false-positive 422)", () => {
    const raw = mafoulMaahFullLesson();
    /* Contest decks are legitimately assessment-dominant. */
    for (const idx of [3, 4, 5, 6, 7]) {
      raw.slides[idx] = {
        ...raw.slides[idx],
        kind: "interactive",
        slideType: "quiz",
        pedagogicalRole: "assess",
        interactionHint: "quiz",
        title: `${raw.slides[idx].title} — جولة ${idx}`,
        talkingPoints: [`سؤال المسابقة رقم ${idx} عن المفعول معه`],
      } as (typeof raw.slides)[number];
    }

    const result = sanitizeOutline(raw, { ...fullLessonBrief, presentationKind: "contest" });

    expect(result.report.fatal).toBe(false);
    expect(result.report.feedback.join(" ")).toMatch(/repeats on/);
  });

  it("keeps role findings advisory when an educational strategy shapes the deck", () => {
    const raw = mafoulMaahFullLesson();
    /* SCAMPER-style strategies legitimately stack activity slides. */
    for (const idx of [3, 4, 5, 6, 7, 9]) {
      raw.slides[idx] = {
        ...raw.slides[idx],
        pedagogicalRole: "activity",
        title: `${raw.slides[idx].title} — نشاط ${idx}`,
      } as (typeof raw.slides)[number];
    }

    const result = sanitizeOutline(raw, { ...fullLessonBrief, educationalStrategy: "scamper" });

    expect(result.report.fatal).toBe(false);
  });

  it("derives pedagogical roles for outlines that omit the field", () => {
    const raw = mafoulMaahFullLesson();
    for (const slide of raw.slides) delete (slide as Record<string, unknown>).pedagogicalRole;

    const result = sanitizeOutline(raw, fullLessonBrief);

    expect(result.report.fatal).toBe(false);
    const roles = result.outline.slides.map((s) => s.pedagogicalRole);
    expect(roles[0]).toBe("hook");
    expect(roles[3]).toBe("explain");
    expect(roles[5]).toBe("example");
    expect(roles[9]).toBe("assess");
    expect(roles[10]).toBe("summary");
  });
});