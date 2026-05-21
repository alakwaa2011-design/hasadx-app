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

/* ── Educational strategy ──────────────────────────────────────────────
   When set (anything other than "none"), the prompt injects a dedicated
   strategy block that instructs the model to structure slides, activities,
   and questions according to the chosen pedagogical approach.
   Backward-compatible: defaults to "none" so existing generation paths
   are unaffected. ─────────────────────────────────────────────────── */
export type EducationalStrategy =
  | "none"
  | "active_learning"
  | "cooperative_learning"
  | "flipped_classroom"
  | "brainstorming"
  | "think_pair_share"
  | "problem_based"
  | "project_based"
  | "inquiry"
  | "scamper"
  | "six_thinking_hats"
  | "21st_century_skills"
  | "gamification"
  | "differentiated"
  | "concept_maps"
  | "kwl"
  | "5e_model";

export const STRATEGY_LABELS_AR: Record<EducationalStrategy, string> = {
  none:                  "بدون استراتيجية محددة",
  active_learning:       "التعلم النشط",
  cooperative_learning:  "التعلم التعاوني",
  flipped_classroom:     "الصف المقلوب",
  brainstorming:         "العصف الذهني",
  think_pair_share:      "فكر - زاوج - شارك",
  problem_based:         "التعلم القائم على المشكلات",
  project_based:         "التعلم القائم على المشاريع",
  inquiry:               "الاستقصاء",
  scamper:               "سكامبر SCAMPER",
  six_thinking_hats:     "قبعات التفكير الست",
  "21st_century_skills": "مهارات القرن 21",
  gamification:          "التلعيب",
  differentiated:        "التعليم المتمايز",
  concept_maps:          "خرائط المفاهيم",
  kwl:                   "KWL",
  "5e_model":            "نموذج 5E",
};

export const STRATEGY_LABELS_EN: Record<EducationalStrategy, string> = {
  none:                  "No specific strategy",
  active_learning:       "Active Learning",
  cooperative_learning:  "Cooperative Learning",
  flipped_classroom:     "Flipped Classroom",
  brainstorming:         "Brainstorming",
  think_pair_share:      "Think-Pair-Share",
  problem_based:         "Problem-Based Learning",
  project_based:         "Project-Based Learning",
  inquiry:               "Inquiry-Based Learning",
  scamper:               "SCAMPER",
  six_thinking_hats:     "Six Thinking Hats",
  "21st_century_skills": "21st Century Skills",
  gamification:          "Gamification",
  differentiated:        "Differentiated Instruction",
  concept_maps:          "Concept Mapping",
  kwl:                   "KWL Chart",
  "5e_model":            "5E Instructional Model",
};

/* Per-strategy slide-structure instructions injected into the prompt.
   Each value is plain text (no JSON) appended after the main rules block.
   "none" is intentionally absent — no injection needed. */
const STRATEGY_INSTRUCTIONS_AR: Partial<Record<EducationalStrategy, string>> = {
  active_learning: `التعلم النشط — إشراك الطلاب بشكل مستمر:
- بعد كل شريحتين من المحتوى، أضف شريحة تفاعلية (kind: interactive).
- نوّع interactionHint: activity، poll، quiz، discussion.
- ≥ 35% من الشرائح يجب أن تكون تفاعلية (interactionHint != null).
- كل شريحة تفاعلية: حقل purpose يوضّح هدف النشاط بوضوح.`,

  cooperative_learning: `التعلم التعاوني — مبني على العمل الجماعي:
- أضف 2-3 شرائح نقاش جماعي (kind: interactive, interactionHint: "discussion").
- كل شريحة نشاط: purpose يتضمن تعليمة للمعلم "اطلب من كل مجموعة ...".
- أنهِ بتقييم جماعي (kind: interactive, interactionHint: "quiz") مع gameQuestions.`,

  flipped_classroom: `الصف المقلوب — التطبيق في الفصل بدلاً من الشرح:
- الشرائح الأولى: مقدمة موجزة + سؤال استكشافي (kind: interactive, interactionHint: "poll").
- الجزء الأكبر: أنشطة تطبيقية (kind: interactive, interactionHint: "quiz" أو "activity") مع gameQuestions.
- قلّل شرائح الشرح النظري — ≥ 50% من الشرائح تفاعلية.`,

  brainstorming: `العصف الذهني — توليد الأفكار الإبداعية:
- ابدأ بسؤال مفتوح استفزازي (kind: interactive, interactionHint: "activity"). talkingPoints[0] = نص السؤال الاستفزازي. لا gameQuestions.
- أضف شريحة callout لقواعد العصف الذهني.
- استخدم discussion لمشاركة الأفكار.
- الختام: شريحة تصنيف الأفكار أو تقييمها (kind: interactive, interactionHint: "poll") مع gameQuestions.`,

  think_pair_share: `فكر - زاوج - شارك — ثلاث مراحل متكررة:
كرّر هذه الدورة 1-2 مرة خلال العرض بين شرائح المحتوى:
  [فكر] kind: interactive, interactionHint: "activity" — سؤال للتفكير الفردي. talkingPoints[0] = "فكّر بمفردك: ...". لا gameQuestions.
  [زاوج] kind: interactive, interactionHint: "discussion" — نشاط ثنائي. talkingPoints[0] = "ناقش إجابتك مع زميلك ...". لا gameQuestions.
  [شارك] kind: interactive, interactionHint: "poll" أو "quiz" — مشاركة جماعية. gameQuestions مطلوبة (5 أسئلة على الأقل).`,

  problem_based: `التعلم القائم على المشكلات — التعلم عبر حل مشكلة واقعية:
[1] المشكلة: kind: callout أو visual-hero — عرض مشكلة أو سيناريو واقعي مثير. لا تبدأ بشرح نظري.
[2] تحليل المشكلة: kind: concept-card أو steps — عناصر المشكلة وأبعادها.
[3] الفرضيات: kind: interactive, interactionHint: "discussion" — الطلاب يقترحون حلولاً. لا gameQuestions.
[4] المحتوى: شرائح تعليمية تبني المعرفة اللازمة للحل.
[5] الحل: kind: steps أو concept-card — تقديم الحل المنطقي.
[6] التقييم: kind: interactive, interactionHint: "quiz" مع gameQuestions (5-8 أسئلة).`,

  project_based: `التعلم القائم على المشاريع:
[1] تعريف المشروع: kind: visual-hero أو concept-card — وصف المشروع وهدفه.
[2] خطة المشروع: kind: steps — خطوات التنفيذ الواضحة.
[3] المحتوى والبحث: 2-3 شرائح تعليمية متنوعة.
[4] النشاط الإبداعي: kind: interactive, interactionHint: "discussion". لا gameQuestions.
[5] التقييم والعرض: kind: interactive, interactionHint: "quiz" مع gameQuestions.`,

  inquiry: `الاستقصاء — بناء المعرفة عبر التساؤل:
- ابدأ بسؤال استفزازي (kind: interactive, interactionHint: "activity") يثير التساؤل. لا gameQuestions.
- أضف شريحة أدلة وملاحظات (kind: concept-card أو stat).
- أضف شريحة فرضيات (kind: interactive, interactionHint: "discussion"). لا gameQuestions.
- الختام: شريحة استنتاجات (kind: interactive, interactionHint: "quiz") مع gameQuestions.`,

  scamper: `سكامبر SCAMPER — الإبداع عبر 7 محاور (الترتيب إلزامي):
أضف 7 شرائح تفاعلية بهذا الترتيب بعد شريحة المقدمة:
[S استبدل] kind: interactive, interactionHint: "activity" — talkingPoints[0] = "استبدل ... بـ ..."
[C اجمع]   kind: interactive, interactionHint: "discussion" — talkingPoints[0] = "اجمع بين ... و..."
[A عدّل]   kind: interactive, interactionHint: "activity" — talkingPoints[0] = "عدّل ... لتصبح ..."
[M استخدم] kind: interactive, interactionHint: "discussion" — talkingPoints[0] = "كيف تستخدم ... بطريقة مختلفة؟"
[P احذف]   kind: interactive, interactionHint: "activity" — talkingPoints[0] = "ماذا يحدث لو حذفنا ...؟"
[E وسّع]   kind: interactive, interactionHint: "discussion" — talkingPoints[0] = "كيف يمكن توسيع فكرة ...؟"
[R اعكس]   kind: interactive, interactionHint: "activity" — talkingPoints[0] = "اعكس ترتيب ..."
لا gameQuestions على شرائح SCAMPER — هي أنشطة مفتوحة.`,

  six_thinking_hats: `قبعات التفكير الست — ست زوايا تفكير مختلفة:
أضف 6 شرائح تفاعلية (kind: interactive, interactionHint: "discussion") بهذا الترتيب:
[⬜ أبيض] "ما الحقائق والمعلومات المتاحة عن ...؟"
[❤️ أحمر] "كيف تشعر تجاه ...؟ ما انطباعك الأول؟"
[⬛ أسود] "ما مخاطر وسلبيات ...؟"
[💛 أصفر] "ما فوائد وإيجابيات ...؟"
[💚 أخضر] "ما الأفكار الإبداعية البديلة حول ...؟"
[💙 أزرق]  "ما خلاصة تفكيرنا؟ ما القرار المناسب؟"
لا gameQuestions على هذه الشرائح.`,

  "21st_century_skills": `مهارات القرن 21 — التفكير النقدي والإبداع والتعاون:
- ضمّن أنشطة تطوّر: التفكير النقدي، الإبداع، التواصل، التعاون.
- أضف شريحة تحليل نقدي (kind: callout أو concept-card) بوجهات نظر متعددة.
- أضف شريحة نشاط إبداعي (kind: interactive, interactionHint: "discussion"). لا gameQuestions.
- أضف شريحة تقييم (kind: interactive, interactionHint: "quiz") مع gameQuestions تقيس مهارات التفكير العليا (تحليل، تقييم، إبداع — لا حفظًا فقط).`,

  gamification: `التلعيب — تحويل التعلم إلى تجربة تنافسية:
- ≥ 40% من الشرائح تفاعلية.
- ابدأ بتحدٍّ سريع (kind: interactive, interactionHint: "quiz") مع gameQuestions.
- استخدم callout للإعلان عن قواعد التحدي والمكافآت.
- وزّع 2-3 جولات اختبار سريع خلال العرض.
- أنهِ بجولة نهائية تنافسية (kind: interactive, interactionHint: "quiz") مع 8 أسئلة متدرجة الصعوبة.`,

  differentiated: `التعليم المتمايز — مراعاة الفروق الفردية:
- افتح بتشخيص مسبق (kind: interactive, interactionHint: "poll") بسؤال يقيس المستوى الحالي.
- قدّم المحتوى بمستويات في callout: "للمبتدئين: ..." و"للمتقدمين: ...".
- أضف تطبيقاً بسيطاً وآخر متقدماً (شريحتا interactive).
- أنهِ بتقييم ختامي (kind: interactive, interactionHint: "quiz") بأسئلة متنوعة الصعوبة.`,

  concept_maps: `خرائط المفاهيم — تنظيم المعرفة بصريًا:
- ابدأ بالمفهوم الرئيسي (kind: visual-hero أو concept-card).
- استخدم comparison لعرض العلاقات والمقارنات بين المفاهيم.
- استخدم steps للمفاهيم المترابطة تسلسليًا.
- استخدم callout للمفاهيم الجوهرية الأساسية.
- أنهِ بتقييم (kind: interactive, interactionHint: "quiz") يختبر فهم العلاقات بين المفاهيم، مع gameQuestions.`,

  kwl: `استراتيجية KWL — ثلاث مراحل للتعلم (الترتيب إلزامي):
[K — ماذا أعرف؟] شريحة أولى بعد title: kind: interactive, interactionHint: "activity". talkingPoints[0] = "اكتب كل ما تعرفه عن [الموضوع]". لا gameQuestions.
[W — ماذا أريد أن أعرف؟] شريحة ثانية: kind: interactive, interactionHint: "discussion". talkingPoints[0] = "ما الأسئلة التي تريد إجابتها؟". لا gameQuestions.
[المحتوى] شرائح تعليمية متنوعة تجيب على أسئلة [W] بشكل مباشر.
[L — ماذا تعلمت؟] شريحة ختامية: kind: interactive, interactionHint: "quiz" مع gameQuestions (5-8 أسئلة تعكس ما تعلموه فعليًا).
احرص على ترتيب K → W → محتوى → L بشكل واضح لا يُخلّ.`,

  "5e_model": `نموذج 5E — دورة التعلم الاستكشافي (الترتيب إلزامي):
[E1 الإثارة Engage] أول شريحة بعد title: kind: interactive, interactionHint: "activity" أو "poll". سؤال أو موقف يثير فضول الطلاب. لا gameQuestions.
[E2 الاستكشاف Explore] شريحة نشاط استكشافي: kind: interactive, interactionHint: "discussion". لا gameQuestions.
[E3 الشرح Explain] 2-4 شرائح محتوى تعليمي (concept-card, steps, formula, visual-hero, stat…).
[E4 التعمق Elaborate] شريحة تطبيق وتوسيع: kind: interactive, interactionHint: "quiz" مع gameQuestions (5+ أسئلة).
[E5 التقييم Evaluate] شريحة تقييم ختامية: kind: interactive, interactionHint: "poll" مع gameQuestions.
الترتيب الإلزامي: E1 → E2 → E3 → E4 → E5.`,
};

const STRATEGY_INSTRUCTIONS_EN: Partial<Record<EducationalStrategy, string>> = {
  active_learning: `Active Learning — continuous student engagement:
- After every 2 content slides, add an interactive slide (kind: interactive).
- Vary interactionHint: activity, poll, quiz, discussion.
- ≥ 35% of slides must be interactive (interactionHint != null).
- Every interactive slide: purpose field explains the activity goal clearly.`,

  cooperative_learning: `Cooperative Learning — group-work centered:
- Add 2-3 group discussion slides (kind: interactive, interactionHint: "discussion").
- Each activity slide: purpose includes teacher instruction "Ask each group to …".
- End with group assessment (kind: interactive, interactionHint: "quiz") with gameQuestions.`,

  flipped_classroom: `Flipped Classroom — application in class, content at home:
- First slides: brief intro + exploratory poll (kind: interactive, interactionHint: "poll").
- Majority: application activities (kind: interactive, interactionHint: "quiz" or "activity") with gameQuestions.
- Minimize lecture slides — ≥ 50% interactive.`,

  brainstorming: `Brainstorming — creative idea generation:
- Open with a provocative open question (kind: interactive, interactionHint: "activity"). No gameQuestions.
- Add a callout slide with brainstorming rules.
- Use discussion slides for idea sharing.
- Close with evaluation (kind: interactive, interactionHint: "poll") with gameQuestions.`,

  think_pair_share: `Think-Pair-Share — three-phase repeated cycle:
Repeat this cycle 1-2 times amid content slides:
  [Think] kind: interactive, interactionHint: "activity" — individual thinking question. No gameQuestions.
  [Pair]  kind: interactive, interactionHint: "discussion" — pair discussion. No gameQuestions.
  [Share] kind: interactive, interactionHint: "poll" or "quiz" — whole-class sharing. gameQuestions required (≥5).`,

  problem_based: `Problem-Based Learning — learning by solving a real problem:
[1] Problem: kind: callout or visual-hero — present a compelling real-world problem. Don't start with theory.
[2] Analysis: kind: concept-card or steps — break down the problem.
[3] Hypotheses: kind: interactive, interactionHint: "discussion". No gameQuestions.
[4] Content: educational slides building needed knowledge.
[5] Solution: kind: steps or concept-card.
[6] Assessment: kind: interactive, interactionHint: "quiz" with gameQuestions.`,

  project_based: `Project-Based Learning:
[1] Project intro: kind: visual-hero or concept-card.
[2] Project plan: kind: steps.
[3] Research content: 2-3 varied educational slides.
[4] Creative activity: kind: interactive, interactionHint: "discussion". No gameQuestions.
[5] Assessment: kind: interactive, interactionHint: "quiz" with gameQuestions.`,

  inquiry: `Inquiry-Based Learning — building knowledge through questioning:
- Open with a provocative question (kind: interactive, interactionHint: "activity"). No gameQuestions.
- Add evidence/observation slide (kind: concept-card or stat).
- Add hypothesis slide (kind: interactive, interactionHint: "discussion"). No gameQuestions.
- Close with conclusions (kind: interactive, interactionHint: "quiz") with gameQuestions.`,

  scamper: `SCAMPER — creativity via 7 lenses (order is mandatory):
Add 7 interactive slides after the intro slide:
[S Substitute] kind: interactive, interactionHint: "activity" — "Substitute ... with ..."
[C Combine]    kind: interactive, interactionHint: "discussion" — "Combine ... and ..."
[A Adapt]      kind: interactive, interactionHint: "activity" — "Adapt ... to become ..."
[M Modify]     kind: interactive, interactionHint: "discussion" — "How can you modify ...?"
[P Put to use] kind: interactive, interactionHint: "activity" — "Put ... to a different use"
[E Eliminate]  kind: interactive, interactionHint: "discussion" — "What if we remove ...?"
[R Reverse]    kind: interactive, interactionHint: "activity" — "Reverse the order of ..."
No gameQuestions on SCAMPER slides — they are open activities.`,

  six_thinking_hats: `Six Thinking Hats — six distinct thinking perspectives:
Add 6 discussion slides (kind: interactive, interactionHint: "discussion") in order:
[⬜ White] "What facts and data do we have about ...?"
[❤️ Red]   "How do you feel about ...? What is your gut reaction?"
[⬛ Black] "What are the risks and downsides of ...?"
[💛 Yellow] "What are the benefits and advantages of ...?"
[💚 Green] "What creative alternatives exist for ...?"
[💙 Blue]  "What is our conclusion? What decision do we make?"
No gameQuestions on these slides.`,

  "21st_century_skills": `21st Century Skills — critical thinking, creativity, communication, collaboration:
- Include activities developing all 4 Cs.
- Add a critical analysis slide (kind: callout or concept-card) with multiple perspectives.
- Add a creative activity (kind: interactive, interactionHint: "discussion"). No gameQuestions.
- Add an assessment (kind: interactive, interactionHint: "quiz") with gameQuestions that test higher-order thinking (analyze, evaluate, create — not just recall).`,

  gamification: `Gamification — turning learning into a competitive experience:
- ≥ 40% of slides must be interactive.
- Open with a quick challenge (kind: interactive, interactionHint: "quiz") with gameQuestions.
- Use callout to announce challenge rules and rewards.
- Distribute 2-3 quick quiz rounds across the deck.
- End with a final competitive round (kind: interactive, interactionHint: "quiz") with 8 difficulty-graded questions.`,

  differentiated: `Differentiated Instruction — addressing individual differences:
- Open with a diagnostic poll (kind: interactive, interactionHint: "poll").
- Present content at two levels using callout: "For beginners: ..." and "For advanced: ...".
- Add both a simple and an advanced activity (two interactive slides).
- End with a varied-difficulty assessment (kind: interactive, interactionHint: "quiz") with gameQuestions.`,

  concept_maps: `Concept Mapping — visual knowledge organization:
- Start with the central concept (kind: visual-hero or concept-card).
- Use comparison for relationships and contrasts between concepts.
- Use steps for sequentially linked concepts.
- Use callout for core foundational concepts.
- End with assessment (kind: interactive, interactionHint: "quiz") testing understanding of concept relationships, with gameQuestions.`,

  kwl: `KWL Chart — three learning phases (order is mandatory):
[K — What I Know] First slide after title: kind: interactive, interactionHint: "activity". No gameQuestions.
[W — What I Want to Know] Second slide: kind: interactive, interactionHint: "discussion". No gameQuestions.
[Content] Educational slides that directly answer the [W] questions.
[L — What I Learned] Final slide: kind: interactive, interactionHint: "quiz" with gameQuestions (5-8 questions reflecting what was learned).
Strict order: K → W → content → L.`,

  "5e_model": `5E Instructional Model — inquiry learning cycle (order is mandatory):
[E1 Engage] First slide after title: kind: interactive, interactionHint: "activity" or "poll". Sparks curiosity. No gameQuestions.
[E2 Explore] Exploratory activity: kind: interactive, interactionHint: "discussion". No gameQuestions.
[E3 Explain] 2-4 content slides (concept-card, steps, formula, visual-hero, stat…).
[E4 Elaborate] Application slide: kind: interactive, interactionHint: "quiz" with gameQuestions (≥5).
[E5 Evaluate] Final assessment: kind: interactive, interactionHint: "poll" with gameQuestions.
Mandatory order: E1 → E2 → E3 → E4 → E5.`,
};

/* ────────────────────────────────────────────────────────────────────────
   HASAD ACTIVITY VOCABULARY
   Each interactive slide may carry activityType + gameSuggestion + strategyStage.
   Use ONLY the values listed here — do NOT invent new types.
   ──────────────────────────────────────────────────────────────────────── */
const HASAD_ACTIVITY_VOCAB_AR = `جدول أنواع أنشطة حصاد (استخدم القيم كما هي بالضبط):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
activityType           │ gameSuggestion │ interactionHint │ الوصف
─────────────────────────────────────────────────────────────────
"word_cloud"           │ null           │ "activity"      │ سحابة كلمات — الطلاب يكتبون كلمة واحدة
"discussion_wall"      │ null           │ "discussion"    │ جدار نقاش — ردود مفتوحة
"live_poll"            │ null           │ "poll"          │ تصويت مباشر بخيارات محدودة
"quick_quiz"           │ null           │ "quiz"          │ اختبار MCQ بدون لعبة خاصة
"tug_war"              │ "tug"          │ "quiz"          │ شد الحبل — منافسة فريقين
"wheel_spin"           │ "wheel"        │ "activity"      │ عجلة عشوائية للتنشيط
"rocket_race"          │ "rocket"       │ "quiz"          │ سباق صواريخ — MCQ تنافسي سريع
"millionaire_quiz"     │ "millionaire"  │ "quiz"          │ من سيربح المليون — مراجعة عميقة
"hack_challenge"       │ "hack"         │ "quiz"          │ تحدي الاختراق — MCQ خاطف
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ استثناء حصري: لهذا العرض يُسمح بتعيين gameSuggestion من القائمة أعلاه — هذا يتجاوز قاعدة "gameSuggestion: null دائمًا" لهذا العرض فقط.`;

const HASAD_ACTIVITY_VOCAB_EN = `Hasad Activity Types — use ONLY these exact values:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
activityType           │ gameSuggestion │ interactionHint │ Description
─────────────────────────────────────────────────────────────────
"word_cloud"           │ null           │ "activity"      │ Word cloud — students each submit one word
"discussion_wall"      │ null           │ "discussion"    │ Discussion wall — open-ended responses
"live_poll"            │ null           │ "poll"          │ Live poll — limited choice vote
"quick_quiz"           │ null           │ "quiz"          │ Plain MCQ, no special game launcher
"tug_war"              │ "tug"          │ "quiz"          │ Tug of war — two-team competition
"wheel_spin"           │ "wheel"        │ "activity"      │ Spin wheel — random selection/activation
"rocket_race"          │ "rocket"       │ "quiz"          │ Rocket race — fast competitive MCQ
"millionaire_quiz"     │ "millionaire"  │ "quiz"          │ Millionaire — deep review quiz
"hack_challenge"       │ "hack"         │ "quiz"          │ Hack challenge — rapid-fire MCQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Special exception: gameSuggestion MAY be set from the list above for this deck — overrides the "gameSuggestion: null always" rule for this deck only.`;

/* Per-strategy activity maps — compact assignment tables for each interactive slide. */
const STRATEGY_ACTIVITY_MAPS_AR: Partial<Record<EducationalStrategy, string>> = {
  active_learning:
`خريطة أنشطة التعلم النشط:
  [تنشيط أولي]   activityType: "word_cloud",   gameSuggestion: null,     strategyStage: "activation"
  [تحقق منتصف]  activityType: "tug_war",       gameSuggestion: "tug",    strategyStage: "check"
  [ختام تنافسي]  activityType: "rocket_race",   gameSuggestion: "rocket", strategyStage: "closure"`,

  cooperative_learning:
`خريطة أنشطة التعلم التعاوني:
  [نشاط مجموعات]   activityType: "discussion_wall", gameSuggestion: null,  strategyStage: "group_work"
  [تحدي جماعي]     activityType: "tug_war",         gameSuggestion: "tug", strategyStage: "challenge"`,

  flipped_classroom:
`خريطة أنشطة الصف المقلوب:
  [تشخيص مسبق]   activityType: "live_poll",   gameSuggestion: null,     strategyStage: "diagnosis"
  [تطبيق صفي]    activityType: "tug_war",     gameSuggestion: "tug",    strategyStage: "application"
  [ختام]         activityType: "rocket_race", gameSuggestion: "rocket", strategyStage: "closure"`,

  brainstorming:
`خريطة أنشطة العصف الذهني:
  [توليد الأفكار]  activityType: "word_cloud",      gameSuggestion: null, strategyStage: "generate"
  [مشاركة الأفكار] activityType: "discussion_wall", gameSuggestion: null, strategyStage: "discuss"
  [تقييم الأفكار]  activityType: "live_poll",        gameSuggestion: null, strategyStage: "evaluate"`,

  think_pair_share:
`خريطة أنشطة فكر-زاوج-شارك (الترتيب إلزامي في كل دورة):
  [فكر]  activityType: "word_cloud",      gameSuggestion: null,  interactionHint: "activity",   strategyStage: "think"
  [زاوج] activityType: "discussion_wall", gameSuggestion: null,  interactionHint: "discussion", strategyStage: "pair"
  [شارك] activityType: "tug_war",         gameSuggestion: "tug", interactionHint: "quiz",       strategyStage: "share"`,

  problem_based:
`خريطة أنشطة التعلم بالمشكلات:
  [فرضيات]       activityType: "discussion_wall", gameSuggestion: null,   strategyStage: "hypothesis"
  [حل مقترح]     activityType: "live_poll",        gameSuggestion: null,   strategyStage: "solution"
  [تقييم ختامي]  activityType: "hack_challenge",   gameSuggestion: "hack", strategyStage: "evaluation"`,

  project_based:
`خريطة أنشطة التعلم بالمشاريع:
  [نشاط إبداعي]   activityType: "discussion_wall", gameSuggestion: null, strategyStage: "creative"
  [تقييم المشروع] activityType: "quick_quiz",       gameSuggestion: null, strategyStage: "evaluation"`,

  inquiry:
`خريطة أنشطة التعلم الاستقصائي:
  [سؤال استفزازي]  activityType: "word_cloud",      gameSuggestion: null, strategyStage: "question"
  [فرضيات]        activityType: "discussion_wall",  gameSuggestion: null, strategyStage: "hypothesis"
  [استنتاجات]     activityType: "quick_quiz",        gameSuggestion: null, strategyStage: "conclusion"`,

  scamper:
`خريطة أنشطة SCAMPER:
  [S استبدل][A عدّل][P استخدم][R اعكس]  activityType: "word_cloud",      gameSuggestion: null
  [C اجمع][M عدّل][E احذف]              activityType: "discussion_wall", gameSuggestion: null
  ضع strategyStage = رمز الخطوة الحرفي: "S"|"C"|"A"|"M"|"P"|"E"|"R"`,

  six_thinking_hats:
`خريطة أنشطة قبعات التفكير الست:
  [⬜أبيض][💛صفراء][💚خضراء][💙زرقاء][⬛سوداء]  activityType: "discussion_wall", gameSuggestion: null
  [❤️حمراء]                                     activityType: "word_cloud",      gameSuggestion: null
  ضع strategyStage = لون القبعة: "white"|"yellow"|"green"|"blue"|"black"|"red"`,

  "21st_century_skills":
`خريطة أنشطة مهارات القرن 21:
  [تفكير نقدي]   activityType: "discussion_wall", gameSuggestion: null,  strategyStage: "critical_thinking"
  [إبداع]        activityType: "word_cloud",      gameSuggestion: null,  strategyStage: "creativity"
  [تقييم تنافسي] activityType: "tug_war",         gameSuggestion: "tug", strategyStage: "evaluation"`,

  gamification:
`خريطة أنشطة التلعيب (≥40% شرائح تفاعلية مع ألعاب حصاد — إلزامي):
  [تحدي افتتاحي]  activityType: "tug_war",         gameSuggestion: "tug",         strategyStage: "opening_challenge"
  [جولة منتصف]    activityType: "rocket_race",      gameSuggestion: "rocket",      strategyStage: "mid_round"
  [دوامة التنشيط] activityType: "wheel_spin",       gameSuggestion: "wheel",       strategyStage: "wheel_challenge"
  [جولة ختامية]   activityType: "millionaire_quiz", gameSuggestion: "millionaire", strategyStage: "final_round"`,

  differentiated:
`خريطة أنشطة التعليم المتمايز:
  [تشخيص مستوى] activityType: "live_poll",  gameSuggestion: null, strategyStage: "diagnosis"
  [تقييم ختامي]  activityType: "quick_quiz", gameSuggestion: null, strategyStage: "assessment"`,

  concept_maps:
`خريطة أنشطة خرائط المفاهيم:
  [ربط المفاهيم]    activityType: "live_poll",  gameSuggestion: null, strategyStage: "connect"
  [تقييم العلاقات]  activityType: "quick_quiz", gameSuggestion: null, strategyStage: "evaluate"`,

  kwl:
`خريطة أنشطة KWL (الترتيب إلزامي):
  [K — ماذا أعرف؟]     activityType: "word_cloud",      gameSuggestion: null,  strategyStage: "know"
  [W — ماذا أريد؟]     activityType: "discussion_wall", gameSuggestion: null,  strategyStage: "want"
  [L — ماذا تعلمت؟]    activityType: "tug_war",         gameSuggestion: "tug", strategyStage: "learned"`,

  "5e_model":
`خريطة أنشطة نموذج 5E (الترتيب إلزامي):
  [E1 إثارة]   activityType: "word_cloud",      gameSuggestion: null,     strategyStage: "engage"
  [E2 استكشاف] activityType: "discussion_wall", gameSuggestion: null,     strategyStage: "explore"
  [E4 تعمق]    activityType: "tug_war",         gameSuggestion: "tug",    strategyStage: "elaborate"
  [E5 تقييم]   activityType: "rocket_race",     gameSuggestion: "rocket", strategyStage: "evaluate"`,
};

const STRATEGY_ACTIVITY_MAPS_EN: Partial<Record<EducationalStrategy, string>> = {
  active_learning:
`Active Learning Activity Map:
  [Activation]  activityType: "word_cloud",   gameSuggestion: null,     strategyStage: "activation"
  [Mid-check]   activityType: "tug_war",       gameSuggestion: "tug",    strategyStage: "check"
  [Closure]     activityType: "rocket_race",   gameSuggestion: "rocket", strategyStage: "closure"`,

  cooperative_learning:
`Cooperative Learning Activity Map:
  [Group work]      activityType: "discussion_wall", gameSuggestion: null,  strategyStage: "group_work"
  [Team challenge]  activityType: "tug_war",         gameSuggestion: "tug", strategyStage: "challenge"`,

  flipped_classroom:
`Flipped Classroom Activity Map:
  [Pre-diagnosis]  activityType: "live_poll",   gameSuggestion: null,     strategyStage: "diagnosis"
  [Application]    activityType: "tug_war",     gameSuggestion: "tug",    strategyStage: "application"
  [Closure]        activityType: "rocket_race", gameSuggestion: "rocket", strategyStage: "closure"`,

  brainstorming:
`Brainstorming Activity Map:
  [Generate ideas]  activityType: "word_cloud",      gameSuggestion: null, strategyStage: "generate"
  [Share ideas]     activityType: "discussion_wall", gameSuggestion: null, strategyStage: "discuss"
  [Evaluate ideas]  activityType: "live_poll",        gameSuggestion: null, strategyStage: "evaluate"`,

  think_pair_share:
`Think-Pair-Share Activity Map (mandatory order per cycle):
  [Think] activityType: "word_cloud",      gameSuggestion: null,  interactionHint: "activity",   strategyStage: "think"
  [Pair]  activityType: "discussion_wall", gameSuggestion: null,  interactionHint: "discussion", strategyStage: "pair"
  [Share] activityType: "tug_war",         gameSuggestion: "tug", interactionHint: "quiz",       strategyStage: "share"`,

  problem_based:
`Problem-Based Learning Activity Map:
  [Hypotheses]   activityType: "discussion_wall", gameSuggestion: null,   strategyStage: "hypothesis"
  [Solution]     activityType: "live_poll",        gameSuggestion: null,   strategyStage: "solution"
  [Evaluation]   activityType: "hack_challenge",   gameSuggestion: "hack", strategyStage: "evaluation"`,

  project_based:
`Project-Based Learning Activity Map:
  [Creative activity]  activityType: "discussion_wall", gameSuggestion: null, strategyStage: "creative"
  [Project evaluation] activityType: "quick_quiz",      gameSuggestion: null, strategyStage: "evaluation"`,

  inquiry:
`Inquiry-Based Learning Activity Map:
  [Provocative question]  activityType: "word_cloud",      gameSuggestion: null, strategyStage: "question"
  [Hypotheses]            activityType: "discussion_wall", gameSuggestion: null, strategyStage: "hypothesis"
  [Conclusions]           activityType: "quick_quiz",       gameSuggestion: null, strategyStage: "conclusion"`,

  scamper:
`SCAMPER Activity Map:
  [S Substitute][A Adapt][P Put to use][R Reverse]  activityType: "word_cloud",      gameSuggestion: null
  [C Combine][M Modify][E Eliminate]                activityType: "discussion_wall", gameSuggestion: null
  Set strategyStage = the step letter: "S"|"C"|"A"|"M"|"P"|"E"|"R"`,

  six_thinking_hats:
`Six Thinking Hats Activity Map:
  [⬜White][💛Yellow][💚Green][💙Blue][⬛Black]  activityType: "discussion_wall", gameSuggestion: null
  [❤️Red]                                       activityType: "word_cloud",      gameSuggestion: null
  Set strategyStage = hat color: "white"|"yellow"|"green"|"blue"|"black"|"red"`,

  "21st_century_skills":
`21st Century Skills Activity Map:
  [Critical thinking]  activityType: "discussion_wall", gameSuggestion: null,  strategyStage: "critical_thinking"
  [Creativity]         activityType: "word_cloud",      gameSuggestion: null,  strategyStage: "creativity"
  [Competitive eval]   activityType: "tug_war",         gameSuggestion: "tug", strategyStage: "evaluation"`,

  gamification:
`Gamification Activity Map (≥40% interactive slides with Hasad games — MANDATORY):
  [Opening challenge]  activityType: "tug_war",         gameSuggestion: "tug",         strategyStage: "opening_challenge"
  [Mid round]          activityType: "rocket_race",      gameSuggestion: "rocket",      strategyStage: "mid_round"
  [Wheel challenge]    activityType: "wheel_spin",       gameSuggestion: "wheel",       strategyStage: "wheel_challenge"
  [Final round]        activityType: "millionaire_quiz", gameSuggestion: "millionaire", strategyStage: "final_round"`,

  differentiated:
`Differentiated Instruction Activity Map:
  [Level diagnosis]  activityType: "live_poll",  gameSuggestion: null, strategyStage: "diagnosis"
  [Final assessment] activityType: "quick_quiz", gameSuggestion: null, strategyStage: "assessment"`,

  concept_maps:
`Concept Maps Activity Map:
  [Connect concepts]   activityType: "live_poll",  gameSuggestion: null, strategyStage: "connect"
  [Evaluate relations] activityType: "quick_quiz", gameSuggestion: null, strategyStage: "evaluate"`,

  kwl:
`KWL Activity Map (mandatory order):
  [K — What I Know]     activityType: "word_cloud",      gameSuggestion: null,  strategyStage: "know"
  [W — What I Want]     activityType: "discussion_wall", gameSuggestion: null,  strategyStage: "want"
  [L — What I Learned]  activityType: "tug_war",         gameSuggestion: "tug", strategyStage: "learned"`,

  "5e_model":
`5E Model Activity Map (mandatory order):
  [E1 Engage]    activityType: "word_cloud",      gameSuggestion: null,     strategyStage: "engage"
  [E2 Explore]   activityType: "discussion_wall", gameSuggestion: null,     strategyStage: "explore"
  [E4 Elaborate] activityType: "tug_war",         gameSuggestion: "tug",    strategyStage: "elaborate"
  [E5 Evaluate]  activityType: "rocket_race",     gameSuggestion: "rocket", strategyStage: "evaluate"`,
};

export function strategyBlockFor(strategy: EducationalStrategy | undefined, lang: OutlineLanguage): string | null {
  if (!strategy || strategy === "none") return null;
  const label = lang === "ar" ? STRATEGY_LABELS_AR[strategy] : STRATEGY_LABELS_EN[strategy];
  const instructions = lang === "ar"
    ? STRATEGY_INSTRUCTIONS_AR[strategy]
    : STRATEGY_INSTRUCTIONS_EN[strategy];
  if (!instructions) return null;

  const vocab = lang === "ar" ? HASAD_ACTIVITY_VOCAB_AR : HASAD_ACTIVITY_VOCAB_EN;
  const activityMap = lang === "ar"
    ? STRATEGY_ACTIVITY_MAPS_AR[strategy]
    : STRATEGY_ACTIVITY_MAPS_EN[strategy];

  const mandatory = lang === "ar"
    ? `⚠️ إلزامي: عيّن activityType وgameSuggestion وstrategyStage على كل شريحة تفاعلية (kind: interactive) في هذا العرض بالضبط كما هو محدد في خريطة الأنشطة أعلاه. لا تتركها null إذا حددت الخريطة قيمة.`
    : `⚠️ MANDATORY: Set activityType, gameSuggestion, and strategyStage on every interactive slide (kind: interactive) exactly as specified in the activity map above. Do NOT leave them null if the map specifies a value.`;

  const parts = [
    lang === "ar" ? `🎯 الاستراتيجية التعليمية: ${label}` : `🎯 Educational Strategy: ${label}`,
    vocab,
    instructions,
    ...(activityMap ? [activityMap] : []),
    mandatory,
  ];
  return parts.join("\n\n");
}

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
  /* Optional — defaults to "none" (no change to existing behaviour). */
  educationalStrategy?: EducationalStrategy;
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

⚠️ قبل توليد الشرائح، حلِّل تصنيف الموضوع (ديني، علمي، تاريخي، أدبي/لغوي، رياضي، أو غير ذلك). ثم اختر أنواع الشرائح (kind) الأنسب لهذا التصنيف بالذات. لا تستخدم قالباً عاماً واحداً لكل المواضيع — درس قرآني يجب أن يبدو مختلفاً عن درس فيزياء.

لديك مكتبة تخطيطات جاهزة (سيتم رسمها لاحقًا)، أنت تختار النوع المناسب لكل شريحة.

أعد رداً بصيغة JSON صارم فقط — بدون شرح، بدون code fences، بدون أي نص خارج كائن JSON.`;

export const OUTLINE_SYSTEM_PROMPT_EN = `You are an "AI Presentation Director" — not a text generator.
Your job is to think like an innovative slide designer who crafts a distinct structure for every deck:
- Choose the right visual layout for each slide based on what the content is.
- Compress each idea into a headline readable from across a room, never a paragraph.
- One idea per slide. Split different ideas onto different slides.
- Every deck you produce should have its own structural personality: choose slide kinds and ordering that feel fresh, not a repeated template.

⚠️ Before generating slides, analyze the topic category (religious, scientific, historical, literary/language, mathematical, or other). Then select slide types (kinds) that are most suitable for THIS specific category. Do NOT use a generic template for all topics — a Quran lesson must look different from a physics lesson.

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
- objectives    → سرد أهداف الدرس (2-4 أهداف فقط) — يُرسم كشبكة بطاقات.
- concept-card  → فكرة محورية واحدة تحتاج شرحاً سريعاً بعدة نقاط مرتبطة (تخطيط مقسوم: نص ⇄ بصري).
- comparison    → عند ذكر طرفين/فكرتين/خيارين/قبل-بعد، يُرسم عمودين متقابلين. ممنوع استخدامه لقائمة عادية.
- steps         → عملية أو إجراء من 2-4 خطوات متتالية (تخطيط أفقي بترقيم).
- timeline      → تطوّر زمني/تاريخي من 3-5 أحداث على محور أفقي.
- visual-hero   → تعريف مفهوم جديد بصورة بصرية كبيرة تملأ الخلفية + نص فوقها (تخطيط Full-Background).
- formula       → قاعدة/معادلة رياضية أو علمية بارزة في الوسط مع شرح صغير حولها.
- stat          → إبراز رقم/إحصائية صادمة (1-3 أرقام بأحجام مختلفة، تخطيط لا متماثل). كل نقطة بصيغة "92% — رضا المعلمين".
- quote         → اقتباس أو حكمة قصيرة كعبارة كبيرة في المنتصف. talkingPoints[0] = نص الاقتباس، talkingPoints[1] = القائل.
- callout       → ملاحظة مهمة جداً يجب لفت الانتباه إليها (تنبيه، نصيحة، خطر شائع).
- interactive   → سؤال/استطلاع/نشاط. talkingPoints[0] = نص السؤال.
- closure       → الشريحة الأخيرة فقط. ملخص نهائي مختصر.

أنماط التخطيط المرئية المتاحة (كل kind يستخدم نمطاً مختلفاً، فاختر بتنوّع):
1. تخطيط مقسوم (Split): نص جانب + بصري جانب — لـ concept-card.
2. شبكة 2×2 (Grid): أربع بطاقات متساوية — لـ objectives.
3. خلفية كاملة (Full-Background): صورة/شكل يغطي معظم الشريحة + نص فوقه — لـ visual-hero و title.
4. لا متماثل (Asymmetric): أحجام ومواقع متباينة — لـ stat و callout.
5. تركيز/اقتباس (Quote/Focus): عبارة واحدة كبيرة في المنتصف بحد أدنى من النص الداعم — لـ quote.
6. عمودان متقابلان (Comparison): بطاقتان جنباً إلى جنب — لـ comparison.

قواعد التنوّع الإلزامية (مهمة جداً):
- ممنوع تكرار نفس kind أكثر من مرتين متتاليتين على الإطلاق.
- لعرض من 6 شرائح: استخدم ≥ 4 أنواع مختلفة. لعرض من 8 شرائح: ≥ 5 أنواع. لعرض من 10+ شرائح: ≥ 6 أنواع.
- يجب أن يحتوي كل عرض على عينة من 3 على الأقل من أنماط التخطيط الستة أعلاه (Split/Grid/Full-Background/Asymmetric/Quote/Comparison).
- إذا كان المحتوى يقبل comparison أو steps أو timeline أو stat أو quote، استخدمها بدلاً من concept-card.
- concept-card هي الخيار الأخير، لا الافتراضي. لا تستخدمها أكثر من مرتين في عرض كامل.

اختيار الأنواع حسب تصنيف الموضوع (إلزامي — حلِّل الموضوع أولاً ثم اختَر):
- ديني / قرآني / حديث / سيرة / فقه:
  استخدم بكثرة: quote (للآيات والأحاديث) ، callout (للتدبّر والوقفات) ، concept-card (لشرح المعاني).
  تجنّب: stat ، comparison (إلا لمقارنة فقهية واضحة) ، formula.
- علوم (فيزياء/كيمياء/أحياء/علوم عامة):
  استخدم بكثرة: visual-hero (للظواهر) ، formula (للقوانين) ، steps (للتجارب) ، stat (للأرقام والحقائق) ، concept-card (للمفاهيم).
  أضف interactive لتجارب أو تنبؤات.
- تاريخ / سيرة / حضارة:
  استخدم بكثرة: timeline (للأحداث) ، quote (لأقوال الشخصيات) ، concept-card (للشخصيات والمواقع) ، comparison (سبب/نتيجة، قبل/بعد).
  تجنّب: formula.
- لغة / أدب / نحو / بلاغة:
  استخدم بكثرة: concept-card (للقواعد والمفردات) ، quote (للأمثلة الأدبية والشواهد) ، comparison (الفروق اللغوية) ، callout (للاستثناءات) ، interactive (للتطبيق).
- رياضيات:
  استخدم بكثرة: formula (للقواعد) ، steps (لحل المسائل خطوة بخطوة) ، concept-card (للمفاهيم) ، interactive (للتمارين) ، callout (للأخطاء الشائعة).
  تجنّب: quote ، timeline.
- مواد أخرى (فنون، تربية، اجتماعيات، …): اختَر الأنواع الأقرب لطبيعة الفكرة في كل شريحة، مع الالتزام بقواعد التنوّع أعلاه.`;

const LAYOUT_RULES_EN = `Layout-selection rules (pick ONE kind per slide):
- title         → Only the opening slide. Big title + short subtitle.
- objectives    → Listing 2-4 lesson objectives — rendered as a card grid.
- concept-card  → One central idea explained in a few related points (split layout: text ⇄ visual).
- comparison    → Two sides/ideas/options/before-after, rendered as opposing columns. NOT for plain lists.
- steps         → A 2-4 step process or procedure (numbered horizontal layout).
- timeline      → A 3-5 event chronological progression on a horizontal axis.
- visual-hero   → Introducing a new concept with a large visual filling the background + text overlay (full-background layout).
- formula       → A math/science formula prominently centered with brief context around it.
- stat          → Highlighting striking numbers (1-3 stats at varied sizes, asymmetric layout). Format: "92% — teacher satisfaction".
- quote         → Short quote/wisdom as one large centered statement with minimal supporting text. talkingPoints[0] = quote, talkingPoints[1] = attribution.
- callout       → A high-importance note (warning, key tip, common pitfall).
- interactive   → Question/poll/activity. talkingPoints[0] = the question text.
- closure       → Only the final slide. Concise final recap.

Available visual layout patterns (each kind uses a DIFFERENT pattern — vary your picks):
1. Split layout: text on one side, visual on the other — for concept-card.
2. 2×2 Grid: four equal cards — for objectives.
3. Full-Background: large image/shape covering most of the slide with text overlay — for visual-hero and title.
4. Asymmetric: varied element sizes and positions — for stat and callout.
5. Quote/Focus: one large centered statement with minimal supporting text — for quote.
6. Comparison: two opposing columns/cards — for comparison.

MANDATORY variety rules (critical):
- NEVER repeat the same kind more than twice in a row.
- 6-slide deck: use ≥ 4 different kinds. 8-slide deck: ≥ 5 kinds. 10+ slide deck: ≥ 6 kinds.
- Every deck must contain at least 3 of the 6 visual layout patterns above (Split/Grid/Full-Background/Asymmetric/Quote/Comparison).
- If the content fits comparison, steps, timeline, stat, or quote — use those INSTEAD of concept-card.
- concept-card is the fallback, NOT the default. Do not use it more than twice in any single deck.

Kind selection by topic category (MANDATORY — analyze the topic first, then choose):
- Religious / Quran / Hadith / Islamic studies:
  Favor: quote (for verses & hadith), callout (for reflection points), concept-card (for explanations).
  Avoid: stat, comparison (unless a clear jurisprudential contrast), formula.
- Science (physics/chemistry/biology/general science):
  Favor: visual-hero (for phenomena), formula (for laws), steps (for experiments), stat (for facts/figures), concept-card (for concepts).
  Add interactive for predictions or labs.
- History / biography / civilization:
  Favor: timeline (for events), quote (for figures' sayings), concept-card (for figures & places), comparison (cause/effect, before/after).
  Avoid: formula.
- Language / literature / grammar / rhetoric:
  Favor: concept-card (for rules and vocabulary), quote (for literary examples), comparison (for linguistic distinctions), callout (for exceptions), interactive (for practice).
- Mathematics:
  Favor: formula (for rules), steps (for step-by-step problem solving), concept-card (for concepts), interactive (for practice), callout (for common mistakes).
  Avoid: quote, timeline.
- Other subjects (arts, PE, social studies, …): pick the kinds that best match each slide's idea, while still respecting the variety quotas above.`;

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

/* ── Quick Mode: mandatory interactive structure injected when
   presentationKind === "quick". Forces the model to distribute
   interactive slides (warm-up poll → MCQ quiz → closing poll)
   across the deck instead of clustering all content slides
   together. Arabic and English variants kept in sync with the
   rest of the prompt style. ────────────────────────────────── */
const QUICK_MODE_RULES_AR = `⚡ وضع الإنشاء السريع — بنية الشرائح الإلزامية (التزام حرفي):
هذا العرض يجب أن يكون حصةً تفاعليةً كاملة جاهزة في أقل من دقيقة.
اتبع هذه البنية بالترتيب المحدد تماماً:

المرحلة أ — المقدمة:
  [1] شريحة عنوان (kind: title) — اسم الموضوع مباشرةً.
  [2] شريحة سحابة كلمات (kind: interactive, interactionHint: "activity") — اسأل الطلاب عن كلمة/فكرة واحدة لتفعيل المعرفة السابقة. talkingPoints[0] = نص الطلب ("أكتب كلمة واحدة تصف …"). لا gameQuestions على هذه الشريحة.

المرحلة ب — المحتوى:
  [3..N-3] شرائح محتوى تعليمي متنوعة (concept-card, visual-hero, steps, stat, comparison, …)
  منها 2-3 شرائح تقييمية (kind: interactive, interactionHint: "quiz") كل منها يحتوي على 5-8 أسئلة MCQ جاهزة (gameQuestions مطلوبة).

المرحلة ج — الختام:
  [N-2] شريحة تصويت ختامي (kind: interactive, interactionHint: "poll") — سؤال واحد متعدد الخيارات يقيس الفهم. gameQuestions مطلوبة (5 أسئلة).
  [N-1] شريحة جدار الردود (kind: interactive, interactionHint: "discussion") — سؤال مفتوح يدعو الطلاب لمشاركة تأملاتهم. talkingPoints[0] = نص السؤال المفتوح. لا gameQuestions على هذه الشريحة.
  [N]   شريحة ختام (kind: closure) — 3-4 نقاط رئيسية.

⚠️ القواعد الإضافية الإلزامية:
- كل شريحة interactionHint="quiz" أو interactionHint="poll" يجب أن تحتوي على gameQuestions (5-8 أسئلة).
- شرائح interactionHint="activity" و"discussion" لا تحتوي على gameQuestions.
- إجمالي الشرائح التفاعلية يجب أن يكون ≥ 4 من إجمالي الشرائح.
- لا تضع أكثر من 2 شريحة interactive متتالية — وزّع بينها شرائح محتوى.`;

const QUICK_MODE_RULES_EN = `⚡ Quick Mode — MANDATORY slide structure (strict compliance):
This deck must be a complete interactive lesson ready to launch in under a minute.
Follow this structure in exact order:

Phase A — Opener:
  [1] title slide (kind: title) — named directly after the topic.
  [2] Word cloud slide (kind: interactive, interactionHint: "activity") — ask students for one word/idea to activate prior knowledge. talkingPoints[0] = the prompt ("Write one word that describes …"). No gameQuestions on this slide.

Phase B — Content:
  [3..N-3] Varied educational content slides (concept-card, visual-hero, steps, stat, comparison, …)
  Among them 2-3 assessment slides (kind: interactive, interactionHint: "quiz"), each with 5-8 ready MCQ questions (gameQuestions required).

Phase C — Closure:
  [N-2] Closing vote slide (kind: interactive, interactionHint: "poll") — one multiple-choice question measuring understanding. gameQuestions required (5 questions).
  [N-1] Open wall slide (kind: interactive, interactionHint: "discussion") — open-ended question inviting students to share reflections. talkingPoints[0] = the open question text. No gameQuestions on this slide.
  [N]   closure slide (kind: closure) — 3-4 key takeaways.

⚠️ Additional mandatory rules:
- Every slide with interactionHint="quiz" or interactionHint="poll" MUST include gameQuestions (5-8 questions).
- Slides with interactionHint="activity" or "discussion" do NOT include gameQuestions.
- Total interactive slides must be ≥ 4 out of the full deck.
- Never place more than 2 interactive slides in a row — intersperse content slides between activities.`;

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
  const quickModeRules = brief.presentationKind === "quick"
    ? (ar ? QUICK_MODE_RULES_AR : QUICK_MODE_RULES_EN)
    : null;
  const strategyBlock = strategyBlockFor(brief.educationalStrategy, brief.language);

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
      "gameSuggestion": "tug|rocket|wheel|millionaire|hack|kahoot|null",
      "activityType": "word_cloud|discussion_wall|live_poll|quick_quiz|tug_war|wheel_spin|rocket_race|millionaire_quiz|hack_challenge|null",
      "strategyStage": "...|null",
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
        `نوّع الـ kind: على عرض من 6 شرائح ≥ 4 أنواع مختلفة، 8 شرائح ≥ 5 أنواع، 10+ شرائح ≥ 6 أنواع.`,
        `ابدأ بـ title، أنهِ بـ closure. ضع stat أو quote عند وجود رقم لافت أو حكمة لإضفاء إيقاع بصري.`,
        `استخدم visualDirection.icon من المفردات: lightbulb, target, chart, brain, atom, leaf, globe, clock, check, info, alert, sparkles, trophy, users, book, compass, layers, zap, heart, flask. اختر ما يناسب فكرة الشريحة بدقة.`,
        `لا تكرر نفس العنوان أو نفس الأيقونة في شرائح متتالية.`,
        `اجعل لكل عرض شخصيته الهيكلية الخاصة: نوّع ترتيب الأنواع (kind) واختر إيقاعاً مختلفاً عن العروض النمطية.`,
      ]
    : [
        `One idea per slide. Never mix two ideas on the same slide.`,
        `talkingPoints are short headlines — NOT full sentences. Imagine they appear on a big screen, readable from the back row.`,
        `Vary kind: 6-slide deck ≥ 4 different kinds, 8-slide ≥ 5 kinds, 10+ slide ≥ 6 kinds.`,
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
    ...(quickModeRules
      ? ["", ar ? "⚡ وضع الإنشاء السريع" : "⚡ QUICK MODE", quickModeRules]
      : []),
    ...(strategyBlock
      ? ["", ar ? "الاستراتيجية التعليمية" : "EDUCATIONAL STRATEGY", strategyBlock]
      : []),
    "",
    ar ? "القواعد" : "RULES",
    ...rules.map((r) => `- ${r}`),
    "",
    ar ? "صيغة الرد (JSON صارم فقط)" : "REPLY SHAPE (strict JSON only)",
    schema,
  ].join("\n");
}
