/**
 * Ready-made structural templates for the activity creation wizard.
 * Templates are EMPTY structures (question count/types/points/timer) —
 * the teacher fills them manually or with AI afterwards.
 */

export type TemplateSubmissionMode = "electronic" | "paper" | "both";

export interface AssignmentTemplate {
  id: string;
  emoji: string;
  title: string;
  titleEn: string;
  desc: string;
  descEn: string;
  color: string;
  bgColor: string;
  tags: string[];
  tagsEn: string[];
  defaults: {
    submissionMode: TemplateSubmissionMode;
    questionCount: number;
    pointsPerQuestion: number;
    questionType: "mcq" | "true_false" | "fill_blank" | "whiteboard";
    /** Optional per-question type override — when provided, each slot gets its own type. */
    questionTypes?: Array<"mcq" | "true_false" | "fill_blank" | "whiteboard">;
    hasDeadline: boolean;
    examMode: boolean;
    examDurationMinutes: number;
  };
}

export const TEMPLATES: AssignmentTemplate[] = [
  {
    id: "scratch",
    emoji: "✏️",
    title: "إنشاء نشاط مخصص",
    titleEn: "Custom Activity",
    desc: "أنشئ نشاطك بالطريقة التي تناسبك وحدد الأسئلة بنفسك",
    descEn: "Build your activity your way and choose questions yourself",
    color: "#2d6a4f",
    bgColor: "#e8f5e9",
    tags: ["حر"],
    tagsEn: ["Free"],
    defaults: { submissionMode: "electronic", questionCount: 1, pointsPerQuestion: 1, questionType: "mcq", hasDeadline: false, examMode: false, examDurationMinutes: 30 },
  },
  {
    id: "quiz",
    emoji: "📝",
    title: "اختبار قصير",
    titleEn: "Quick Quiz",
    desc: "10 أسئلة اختيار متعدد، درجة لكل سؤال",
    descEn: "10 multiple choice questions, 1 point each",
    color: "#0369a1",
    bgColor: "#e0f2fe",
    tags: ["10 أسئلة", "10 درجات"],
    tagsEn: ["10 questions", "10 pts"],
    defaults: { submissionMode: "electronic", questionCount: 10, pointsPerQuestion: 1, questionType: "mcq", hasDeadline: false, examMode: false, examDurationMinutes: 30 },
  },
  {
    id: "homework",
    emoji: "🏠",
    title: "واجب منزلي",
    titleEn: "Homework",
    desc: "5 أسئلة متنوعة مع موعد تسليم",
    descEn: "5 varied questions with a deadline",
    color: "#d97706",
    bgColor: "#fef3c7",
    tags: ["5 أسئلة", "موعد تسليم"],
    tagsEn: ["5 questions", "Deadline"],
    defaults: {
      submissionMode: "electronic", questionCount: 5, pointsPerQuestion: 2, questionType: "mcq",
      /* Mixed types: 3 اختيار متعدد + 1 صح/خطأ + 1 إكمال — fully editable after applying */
      questionTypes: ["mcq", "mcq", "true_false", "mcq", "fill_blank"],
      hasDeadline: true, examMode: false, examDurationMinutes: 30,
    },
  },
  {
    id: "shorttest",
    emoji: "⏱️",
    /* Renamed from the duplicate «اختبار قصير» — this is the TIMED variant */
    title: "اختبار مؤقت",
    titleEn: "Timed Test",
    desc: "10 أسئلة بوقت محدد — مثالي للتقييم السريع",
    descEn: "10 questions with timer — perfect for quick assessment",
    color: "#7c3aed",
    bgColor: "#ede9fe",
    tags: ["10 أسئلة", "وقت محدد"],
    tagsEn: ["10 questions", "Timed"],
    defaults: { submissionMode: "electronic", questionCount: 10, pointsPerQuestion: 1, questionType: "mcq", hasDeadline: true, examMode: true, examDurationMinutes: 20 },
  },
  {
    id: "truefalse",
    emoji: "✅",
    title: "صح وخطأ",
    titleEn: "True & False",
    desc: "10 أسئلة صح/خطأ بسيطة وسريعة",
    descEn: "10 simple true/false questions",
    color: "#2f684d",
    bgColor: "#e0ede5",
    tags: ["10 أسئلة", "صح/خطأ"],
    tagsEn: ["10 questions", "True/False"],
    defaults: { submissionMode: "electronic", questionCount: 10, pointsPerQuestion: 1, questionType: "true_false", hasDeadline: false, examMode: false, examDurationMinutes: 15 },
  },
];
// Note: "paper" preset removed — use the standalone "تصحيح ورقي ذكي" tool at /teacher/new/paper-grading
