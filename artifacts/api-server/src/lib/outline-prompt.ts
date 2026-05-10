/* AI Presentation Builder — Phase 1A
   Prompt construction + density rules + banned phrases.

   The prompt casts the model as an "AI presentation director" — its
   job is not just to write text, but to choose the right visual layout
   per slide, condense ideas into headlines, and keep one idea per
   slide. The materializer then turns each card into a polished layout.
*/

export type OutlineLanguage = "ar" | "en";
export type OutlineDensity = "minimal" | "balanced" | "detailed";
export type PresentationKind =
  | "explain"
  | "review"
  | "interactive"
  | "quick"
  | "contest";
export type LanguageLevel = "simple" | "medium" | "advanced";

export interface OutlineToggles {
  activities: boolean;
  questions: boolean;
  poll: boolean;
  quiz: boolean;
}

export interface OutlineBrief {
  language: OutlineLanguage;
  subject: string;
  gradeLevel: string;
  topic: string;
  presentationKind: PresentationKind;
  slideCount: number;
  durationMinutes: 15 | 30 | 45 | 60;
  languageLevel: LanguageLevel;
  density: OutlineDensity;
  toggles: OutlineToggles;
  notes?: string;
}

/* Banned AI-speak. Lowercased + normalized whitespace before checking
   against generated text. Lists are intentionally short to avoid false
   positives — we only block the most identifiable filler. */
export const BANNED_PHRASES_AR = [
  "في هذا الدرس سنتعلم",
  "في هذا الدرس سوف نتعلم",
  "كما رأينا",
  "في الختام",
  "في النهاية يمكننا القول",
  "دعونا نتعمق",
  "خلاصة القول",
  "كما هو موضح أعلاه",
];

export const BANNED_PHRASES_EN = [
  "let's dive into",
  "in conclusion",
  "as we discussed",
  "as we have seen",
  "in this lesson we will learn",
  "in summary",
  "as shown above",
  "delve into",
];

export function bannedPhrasesFor(lang: OutlineLanguage): string[] {
  return lang === "ar" ? BANNED_PHRASES_AR : BANNED_PHRASES_EN;
}

/* Density caps used by both the prompt and the guardrails layer. The
   prompt asks the model to respect them; guardrails truncate / drop
   anything that slips through.

   Tightened vs the original "Phase 1A" caps so the model is forced to
   write headlines, not paragraphs. Walls of text are the #1 cause of
   the deck looking like a generated essay instead of a presentation. */
export interface DensityLimits {
  minPoints: number;
  maxPoints: number;
  maxWordsPerPoint: number;
  allowSubtitle: boolean;
}

export function densityLimits(d: OutlineDensity): DensityLimits {
  switch (d) {
    case "minimal":
      return { minPoints: 2, maxPoints: 3, maxWordsPerPoint: 6, allowSubtitle: false };
    case "detailed":
      return { minPoints: 3, maxPoints: 5, maxWordsPerPoint: 12, allowSubtitle: true };
    case "balanced":
    default:
      return { minPoints: 3, maxPoints: 4, maxWordsPerPoint: 9, allowSubtitle: false };
  }
}

const KIND_LABELS_AR: Record<PresentationKind, string> = {
  explain: "شرح درس جديد",
  review: "مراجعة",
  interactive: "حصة تفاعلية",
  quick: "عرض سريع",
  contest: "مسابقة",
};
const KIND_LABELS_EN: Record<PresentationKind, string> = {
  explain: "explain a new lesson",
  review: "review",
  interactive: "interactive lesson",
  quick: "quick recap",
  contest: "contest",
};

const LEVEL_LABELS_AR: Record<LanguageLevel, string> = {
  simple: "بسيط",
  medium: "متوسط",
  advanced: "متقدّم",
};
const LEVEL_LABELS_EN: Record<LanguageLevel, string> = {
  simple: "simple",
  medium: "intermediate",
  advanced: "advanced",
};

const DENSITY_RULES_AR: Record<OutlineDensity, string> = {
  minimal:
    "كثافة قليلة: 2-3 نقاط لكل شريحة، كل نقطة ≤ 6 كلمات. عناوين قصيرة كشعارات. أكثر من شريحة لكل فكرة بدلاً من تكديس النصوص.",
  balanced:
    "كثافة متوسطة: 3-4 نقاط لكل شريحة، كل نقطة ≤ 9 كلمات بأسلوب عناوين. ممنوع الفقرات الطويلة. كل شريحة فكرة واحدة فقط.",
  detailed:
    "كثافة عالية: 3-5 نقاط لكل شريحة، كل نقطة ≤ 12 كلمة. يُسمح بـ subtitle لشريحة العنوان فقط. كل نقطة سطر واحد قصير، لا فقرة.",
};
const DENSITY_RULES_EN: Record<OutlineDensity, string> = {
  minimal:
    "Minimal density: 2-3 points per slide, each ≤ 6 words. Headline-style only. Use more slides instead of cramming text.",
  balanced:
    "Balanced density: 3-4 points per slide, each ≤ 9 words in headline style. NO paragraphs. Each slide = one idea.",
  detailed:
    "Detailed density: 3-5 points per slide, each ≤ 12 words. `subtitle` allowed only on the title slide. Every point is one short line, never a paragraph.",
};

/* Designer-grade system prompt. Stable so the response stays cacheable
   on (brief-hash, model). */
export const OUTLINE_SYSTEM_PROMPT_AR = `أنت "مدير عروض ذكي" (AI Presentation Director) — ولست مجرد مولد نصوص.
وظيفتك ليست كتابة النصوص فقط، بل التفكير كمصمم شرائح مبتكر يبتكر هيكلاً مختلفاً لكل عرض:
- تختار التخطيط البصري المناسب لكل شريحة بناءً على نوع المحتوى.
- تختصر كل فكرة في عنوان قصير قابل للقراءة من بعيد، وليس فقرة.
- تضع فكرة واحدة لكل شريحة، وتفصل الأفكار المختلفة على شرائح منفصلة.
- كل عرض تُنتجه له بنيته الخاصة المميزة: تخيّر ترتيب الشرائح وأنواعها (kind) بأسلوب يختلف عن الأنماط المكررة.

لديك مكتبة تخطيطات جاهزة (سيتم رسمها لاحقًا)، أنت تختار النوع المناسب لكل شريحة.

أعد رداً بصيغة JSON صارم فقط — بدون شرح، بدون code fences، بدون أي نص خارج كائن JSON.`;

export const OUTLINE_SYSTEM_PROMPT_EN = `You are an "AI Presentation Director" — not a text generator.
Your job is to think like an innovative slide designer who crafts a distinct structure for every deck:
- Choose the right visual layout for each slide based on what the content is.
- Compress each idea into a headline readable from across a room, never a paragraph.
- One idea per slide. Split different ideas onto different slides.
- Every deck you produce should have its own structural personality: choose slide kinds and ordering that feel fresh, not a repeated template.

A library of polished layouts will render your output. You pick the right kind per slide.

Reply with strict JSON ONLY — no prose, no code fences, no text outside the JSON object.`;

export function systemPromptFor(lang: OutlineLanguage): string {
  return lang === "ar" ? OUTLINE_SYSTEM_PROMPT_AR : OUTLINE_SYSTEM_PROMPT_EN;
}

/* Layout-selection rules. The model picks ONE `kind` per slide based
   on the content type. This is the heart of the "presentation
   director" upgrade — without these rules the model defaults to
   concept-card for everything and the deck looks monotonous. */
const LAYOUT_RULES_AR = `قواعد اختيار نوع الشريحة (kind) — اقرأها قبل كل شريحة:
- title         → فقط شريحة الافتتاح. عنوان كبير + عنوان فرعي قصير.
- objectives    → سرد أهداف الدرس (2-4 أهداف فقط).
- concept-card  → فكرة محورية واحدة تحتاج شرحاً سريعاً بعدة نقاط مرتبطة.
- comparison    → عند ذكر طرفين/فكرتين/خيارين/قبل-بعد. ممنوع استخدامه لقائمة عادية.
- steps         → عملية أو إجراء من 2-4 خطوات متتالية.
- timeline      → تطوّر زمني/تاريخي من 3-5 أحداث على محور.
- visual-hero   → تعريف مفهوم جديد بصورة بصرية كبيرة + نقاط داعمة.
- formula       → قاعدة/معادلة رياضية أو علمية مع شرح بسيط.
- stat          → إبراز رقم/إحصائية صادمة (1-3 أرقام). كل نقطة بصيغة "92% — رضا المعلمين".
- quote         → اقتباس أو حكمة قصيرة. talkingPoints[0] = نص الاقتباس، talkingPoints[1] = القائل.
- callout       → ملاحظة مهمة جداً يجب لفت الانتباه إليها (تنبيه، نصيحة، خطر شائع).
- interactive   → سؤال/استطلاع/نشاط. talkingPoints[0] = نص السؤال.
- closure       → الشريحة الأخيرة فقط. ملخص نهائي مختصر.

ممنوع تكرار نفس kind أكثر من 3 مرات متتالية. نوّع التخطيطات لتعطي إيقاعاً بصرياً.`;

const LAYOUT_RULES_EN = `Layout-selection rules (pick ONE kind per slide):
- title         → Only the opening slide. Big title + short subtitle.
- objectives    → Listing 2-4 lesson objectives.
- concept-card  → One central idea explained in a few related points.
- comparison    → Two sides/ideas/options/before-after. NOT for plain lists.
- steps         → A 2-4 step process or procedure.
- timeline      → A 3-5 event chronological progression on an axis.
- visual-hero   → Introducing a new concept with a big visual + supporting points.
- formula       → A math/science rule or formula plus brief explanation.
- stat          → Highlighting striking numbers (1-3 stats). Format: "92% — teacher satisfaction".
- quote         → Short quote or wisdom. talkingPoints[0] = quote text, talkingPoints[1] = attribution.
- callout       → A high-importance note (warning, key tip, common pitfall).
- interactive   → Question/poll/activity. talkingPoints[0] = the question text.
- closure       → Only the final slide. Concise final recap.

Never repeat the same kind more than 3 times in a row. Vary layouts so the deck has visual rhythm.`;

/* Phase 7 — Activity questions are now SLIDE-NATIVE content, not a
   "pick a platform game" decision. The teacher feedback was clear:
   don't label slides with a Hasad game's brand name, just write the
   activity's questions and answers and show them on the slide. The
   AI's job is to produce a clean MCQ set when a slide warrants
   classroom interaction; the platform decides at runtime how to
   render and run it. We keep the underlying `gameSuggestion` field
   for backward compatibility but instruct the model to leave it
   null — the slide's identity is the questions themselves. */
const GAMES_RULES_AR = `قواعد إنتاج أسئلة النشاط (gameQuestions) — إلزامي على كل شريحة تفاعلية:
⚠️ القاعدة الإلزامية: كل شريحة يكون فيها interactionHint = "quiz" أو "activity" يجب أن تحتوي على gameQuestions. لا يُقبل تركها فارغة.
- أنتج أسئلة فقط على الشرائح التي تستفيد فعلاً من نشاط أو مسابقة صفية (مراجعة، تطبيق مفهوم، اختبار سريع، استراحة محفّزة). اضبط interactionHint = "quiz" أو "activity" على هذه الشرائح.
- لا تنتج أسئلة على شرائح العنوان أو الخاتمة أو الشرح النظري البحت.
- في عرض من 8 شرائح: 1-3 شرائح نشاط كحد أقصى. لا تكدّسها.
- لا تذكر اسم أي لعبة من ألعاب المنصة (كاهوت، عجلة، مليون، …) في عنوان الشريحة أو نقاط الحديث أو نص السؤال. الشريحة تعرض السؤال والإجابات مباشرة.
- اترك gameSuggestion = null دائماً.

شكل gameQuestions — الزامي على الشرائح التفاعلية:
- مصفوفة من 5 إلى 8 أسئلة جاهزة للعرض الفوري (لا أقل من 5 حتى تكفي جلسة نشاط كاملة).
- كل سؤال: { "prompt": "نص السؤال", "options": ["خ1","خ2","خ3","خ4"], "correctIndex": 0 }
- 4 خيارات نموذجياً (أو 2 لـ صح/خطأ)، إجابة صحيحة واحدة فقط، خيارات مميّزة (لا تكرار).
- صياغة عربية فصحى قصيرة وواضحة، تتدرّج من السهل إلى الأصعب، وتغطي محور الشريحة فعلاً.
- الأسئلة تعكس محتوى الشريحة حرفياً — لا أسئلة عامة أو مستوردة من موضوع آخر.
- لا تنتج gameQuestions على الشرائح غير التفاعلية.`;

const GAMES_RULES_EN = `Activity questions (gameQuestions) — REQUIRED on every interactive slide:
⚠️ MANDATORY RULE: every slide with interactionHint = "quiz" or "activity" MUST include gameQuestions. Empty is not accepted.
- Only produce questions on slides that genuinely benefit from a class activity (review, application, quick quiz, energiser). Set interactionHint = "quiz" or "activity" on those slides.
- Do NOT produce questions on title, closure, or pure-explanation slides.
- In an 8-slide deck: at most 1–3 activity slides. Don't stuff them.
- Do NOT mention the name of any platform game (Kahoot, Wheel, Millionaire, …) anywhere in the slide title, talking points, or question text. The slide displays the question and answers directly.
- Always leave gameSuggestion = null.

gameQuestions shape — mandatory on interactive slides:
- Array of 5–8 ready-to-display questions (no fewer than 5 — enough for a complete activity session).
- Each: { "prompt": "...", "options": ["A","B","C","D"], "correctIndex": 0 }
- Typically 4 options (or 2 for true/false), exactly one correct, distinct distractors.
- Short, clear wording; increasing difficulty; questions must directly cover the slide's topic — no generic or off-topic items.
- Do NOT emit gameQuestions on non-interactive slides.`;

/* Phase 4 — Deck-wide visual consistency.
   All slides in a deck share ONE unified color theme (the deck's
   palette, chosen by the teacher or picked by the server default).
   Per-slide theme overrides stay null so the deck looks polished and
   coherent — not a noisy patchwork of competing backgrounds.

   Visual variety across decks comes from:
     a) the server/editor randomly picking a tasteful default theme for
        each new deck (mist / obsidian / linen / ink / sage / ocean / …)
     b) the AI varying slide *kinds*, icons, and structural order —
        making each deck's arrangement feel fresh, not templated. */
const DESIGN_RULES_AR = `قواعد التصميم البصري — هوية لونية واحدة موحّدة للعرض كاملاً (slideTheme):

⚠️ القاعدة الأساسية الإلزامية: slideTheme = null على كل شريحة بلا استثناء.
للعرض ثيم موحّد واحد يختاره المعلم أو يُخصَّص تلقائياً — ويُطبَّق على جميع الشرائح.
تغيير اللون من شريحة لأخرى يجعل العرض يبدو مبعثراً وغير احترافي — ممنوع منعاً باتاً.

التنوع البصري يأتي من: اختيار kind مختلف لكل شريحة، تنويع الأيقونات، وترتيب متميّز للمحتوى.
الثيم اللوني شأن العرض كله — لا شأن الشريحة الفردية.

الإلزامي: slideTheme = null على كل شريحة. لا استثناءات.`;

const DESIGN_RULES_EN = `Visual design — ONE unified color theme for the entire deck (slideTheme):

⚠️ MANDATORY RULE: slideTheme = null on EVERY slide, no exceptions.
The deck has a single unified theme chosen by the teacher, applied automatically to all slides.
Varying the color slide-by-slide looks scattered and unprofessional — strictly forbidden.

Visual variety comes from: choosing different kinds per slide, varying icons, and a distinctive content arrangement.
Color theme is a deck-wide concern — not a per-slide decision.

Mandatory: slideTheme = null on every single slide. No exceptions.`;

/* Build the user-message prompt for one outline-generation call. */
export function buildOutlinePrompt(brief: OutlineBrief): string {
  const ar = brief.language === "ar";
  const lim = densityLimits(brief.density);
  const banned = bannedPhrasesFor(brief.language);

  const kindLabel = ar ? KIND_LABELS_AR[brief.presentationKind] : KIND_LABELS_EN[brief.presentationKind];
  const levelLabel = ar ? LEVEL_LABELS_AR[brief.languageLevel] : LEVEL_LABELS_EN[brief.languageLevel];
  const densityRule = ar ? DENSITY_RULES_AR[brief.density] : DENSITY_RULES_EN[brief.density];
  const layoutRules = ar ? LAYOUT_RULES_AR : LAYOUT_RULES_EN;
  const gamesRules = ar ? GAMES_RULES_AR : GAMES_RULES_EN;
  const designRules = ar ? DESIGN_RULES_AR : DESIGN_RULES_EN;

  const togglesAr: string[] = [];
  const togglesEn: string[] = [];
  if (brief.toggles.activities) { togglesAr.push("أنشطة"); togglesEn.push("activities"); }
  if (brief.toggles.questions)  { togglesAr.push("أسئلة"); togglesEn.push("questions"); }
  if (brief.toggles.poll)       { togglesAr.push("استطلاع"); togglesEn.push("poll"); }
  if (brief.toggles.quiz)       { togglesAr.push("اختبار سريع"); togglesEn.push("quiz"); }
  const togglesLine = ar
    ? (togglesAr.length ? `الإشارات المسموحة للتفاعل: ${togglesAr.join("، ")}.` : "ممنوع اقتراح أي تفاعل — كل interactionHint=null.")
    : (togglesEn.length ? `Allowed interaction hints: ${togglesEn.join(", ")}.` : "Do NOT suggest any interaction — set every interactionHint to null.");

  const schema = `{
  "language": "${brief.language}",
  "density": "${brief.density}",
  "totalEstimatedMinutes": ${brief.durationMinutes},
  "objectives": ["...", "..."],
  "teachingFlow": [
    { "stage": "opener",   "slideIndices": [1],     "estimatedMinutes": N },
    { "stage": "concept",  "slideIndices": [2,3,4], "estimatedMinutes": N },
    { "stage": "practice", "slideIndices": [5,6],   "estimatedMinutes": N },
    { "stage": "closure",  "slideIndices": [${brief.slideCount}], "estimatedMinutes": N }
  ],
  "slides": [
    {
      "index": 1,
      "kind": "title|objectives|concept-card|comparison|visual-hero|steps|interactive|closure|timeline|formula|stat|quote|callout",
      "title": "...",
      ${lim.allowSubtitle ? '"subtitle": "...",\n      ' : ""}"purpose": "...",
      "talkingPoints": ["...", "..."],
      "interactionHint": "poll|quiz|discussion|activity|null",
      "gameSuggestion": null,
      "gameQuestions": [
        { "prompt": "...", "options": ["...","...","...","..."], "correctIndex": 0 },
        { "prompt": "...", "options": ["...","...","...","..."], "correctIndex": 2 },
        { "prompt": "...", "options": ["...","...","...","..."], "correctIndex": 1 }
      ],
      "slideTheme": null,
      "visualDirection": { "icon": "lightbulb|target|chart|...", "shape": "rect|circle|line|arrow|divider", "layoutHint": "..." },
      "source": "..."
    }
  ]
}`;

  const designerPrinciples = ar
    ? [
        `كل شريحة لها فكرة واحدة فقط. لا تخلط فكرتين على نفس الشريحة.`,
        `talkingPoints بأسلوب عناوين قصيرة — وليس جملاً كاملة. تخيّل أنها تظهر على شاشة كبيرة وتُقرأ من آخر الصف.`,
        `نوّع الـ kind: على عرض من 8 شرائح يجب أن نرى ≥ 4 أنواع مختلفة.`,
        `ابدأ بـ title، أنهِ بـ closure. ضع stat أو quote عند وجود رقم لافت أو حكمة لإضفاء إيقاع بصري.`,
        `استخدم visualDirection.icon من المفردات: lightbulb, target, chart, brain, atom, leaf, globe, clock, check, info, alert, sparkles, trophy, users, book, compass, layers, zap, heart, flask. اختر ما يناسب فكرة الشريحة بدقة.`,
        `لا تكرر نفس العنوان أو نفس الأيقونة في شرائح متتالية.`,
        `اجعل لكل عرض شخصيته الهيكلية الخاصة: نوّع ترتيب الأنواع (kind) واختر إيقاعاً مختلفاً عن العروض النمطية.`,
      ]
    : [
        `One idea per slide. Never mix two ideas on the same slide.`,
        `talkingPoints are short headlines — NOT full sentences. Imagine they appear on a big screen, readable from the back row.`,
        `Vary kind: in an 8-slide deck we expect ≥ 4 different kinds.`,
        `Start with title, end with closure. Drop in stat or quote when a striking number or wise line exists, to add visual rhythm.`,
        `Use visualDirection.icon from this vocabulary: lightbulb, target, chart, brain, atom, leaf, globe, clock, check, info, alert, sparkles, trophy, users, book, compass, layers, zap, heart, flask. Pick the one that best fits the slide's idea.`,
        `Don't reuse the same title or icon in consecutive slides.`,
        `Give each deck its own structural personality: vary the ordering and mix of kinds so no two generated decks feel like copies of the same template.`,
      ];

  const rules = ar
    ? [
        `اللغة: العربية الفصحى المبسّطة، أسلوب طبيعي للمعلم العربي (ليس ترجمة من الإنجليزية)، مستوى لغوي ${levelLabel}.`,
        densityRule,
        ...designerPrinciples,
        `قسّم العرض إلى 4 مراحل: opener (1-2 شرائح) → concept (الجزء الأكبر) → practice (1-3 شرائح) → closure (1 شريحة). كل index لشريحة يجب أن يظهر في exactly one stage.`,
        `كل شريحة لها purpose واحد فقط. ممنوع تكرار العنوان عبر الشرائح.`,
        `إذا ذكرت رقماً أو إحصائية، أضف حقل source يقترح المرجع. وإلا اترك source فارغاً.`,
        togglesLine,
        `ممنوع استخدام العبارات التالية: ${banned.map((p) => `"${p}"`).join("، ")}.`,
        `أنتج بالضبط ${brief.slideCount} شريحة. مجموع estimatedMinutes في teachingFlow ≈ ${brief.durationMinutes} دقيقة.`,
        `objectives: 3-5 أهداف بصياغة "سيكون الطالب قادراً على ..."`,
      ]
    : [
        `Language: ${brief.language === "en" ? "natural classroom English" : "Arabic"}, language level ${levelLabel}.`,
        densityRule,
        ...designerPrinciples,
        `Split the deck into 4 stages: opener (1-2 slides) → concept (largest) → practice (1-3 slides) → closure (1 slide). Every slide index appears in exactly one stage.`,
        `Each slide has exactly one purpose. Never repeat a title across slides.`,
        `If you cite a number/fact, add a "source" field suggesting a reference. Otherwise leave it empty.`,
        togglesLine,
        `NEVER use these phrases: ${banned.map((p) => `"${p}"`).join(", ")}.`,
        `Produce exactly ${brief.slideCount} slides. Sum of estimatedMinutes in teachingFlow ≈ ${brief.durationMinutes} minutes.`,
        `Objectives: 3-5 items, phrased "Students will be able to ..."`,
      ];

  const briefBlock = ar
    ? [
        `المادة: ${brief.subject}`,
        `الصف: ${brief.gradeLevel}`,
        `موضوع الدرس: ${brief.topic}`,
        `نوع العرض: ${kindLabel}`,
        `عدد الشرائح المطلوب: ${brief.slideCount}`,
        `مدة الحصة: ${brief.durationMinutes} دقيقة`,
        brief.notes ? `ملاحظات المعلم: ${brief.notes}` : "",
      ]
    : [
        `Subject: ${brief.subject}`,
        `Grade level: ${brief.gradeLevel}`,
        `Topic: ${brief.topic}`,
        `Presentation kind: ${kindLabel}`,
        `Requested slide count: ${brief.slideCount}`,
        `Period length: ${brief.durationMinutes} minutes`,
        brief.notes ? `Teacher notes: ${brief.notes}` : "",
      ];

  return [
    ar ? "BRIEF" : "BRIEF",
    ...briefBlock.filter(Boolean),
    "",
    ar ? "تخطيطات الشرائح المتاحة" : "AVAILABLE LAYOUTS",
    layoutRules,
    "",
    ar ? "ألعاب حصاد الحية" : "HASAD LIVE GAMES",
    gamesRules,
    "",
    ar ? "ذكاء التصميم البصري" : "VISUAL DESIGN INTELLIGENCE",
    designRules,
    "",
    ar ? "القواعد" : "RULES",
    ...rules.map((r) => `- ${r}`),
    "",
    ar ? "صيغة الرد (JSON صارم فقط)" : "REPLY SHAPE (strict JSON only)",
    schema,
  ].join("\n");
}
