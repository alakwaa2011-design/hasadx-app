export interface AiToolLabel {
  ar: string;
  en: string;
}

/**
 * Canonical labels for tool keys emitted to ai_usage_ledger.
 * Pricing settings may override these labels in reports when a matching
 * credit_tool_prices row exists.
 */
export const AI_TOOL_LABELS: Readonly<Record<string, AiToolLabel>> = {
  "ai-chat": {
    ar: "مرشد حصاد (محادثة)",
    en: "Hasaad Guide Chat",
  },
  "ai-questions": {
    ar: "توليد أسئلة بالذكاء الاصطناعي",
    en: "AI Question Generation",
  },
  "ai-questions-images": {
    ar: "توليد أسئلة مع صور",
    en: "Generate Questions with Images",
  },
  "arena-generate": {
    ar: "توليد أسئلة الميدان",
    en: "Arena Question Generation",
  },
  "assignment-ai-grading": {
    ar: "تصحيح الواجب بالذكاء الاصطناعي",
    en: "AI Assignment Grading",
  },
  "extract_questions_from_source": {
    ar: "استخراج أسئلة من مصدر",
    en: "Extract Questions from Source",
  },
  "lesson-plan": {
    ar: "خطة الدرس",
    en: "Lesson Plan",
  },
  mindmap: {
    ar: "الخريطة الذهنية",
    en: "Mind Map",
  },
  "presentation-build": {
    ar: "بناء العرض من ملف",
    en: "Build Presentation from File",
  },
  "presentation-outline": {
    ar: "إنشاء مخطط العرض",
    en: "Generate Presentation Outline",
  },
  "presentation-slide": {
    ar: "توليد شريحة واحدة",
    en: "Generate One Slide",
  },
  "quick-challenge": {
    ar: "التحدي السريع بالذكاء الاصطناعي",
    en: "AI Quick Challenge",
  },
  "quick-challenge-guest": {
    ar: "التحدي السريع للزائر",
    en: "Guest Quick Challenge",
  },
  tts: {
    ar: "تحويل النص إلى صوت",
    en: "Text to Speech",
  },
  wheel: {
    ar: "توليد عجلة الأسئلة",
    en: "Question Wheel Generation",
  },
  whiteboard: {
    ar: "السبورة الذكية",
    en: "Smart Whiteboard",
  },
  worksheet: {
    ar: "ورقة العمل",
    en: "Worksheet",
  },
  "worksheet-tic-tac-toe-cell": {
    ar: "إعادة توليد مربع تيك تاك توك",
    en: "Regenerate Tic-Tac-Toe Square",
  },
};

function humanizeToolKey(toolKey: string): string {
  return toolKey
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (["AI", "PDF", "TTS"].includes(upper)) return upper;
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

export function getAiToolLabel(toolKey: string): AiToolLabel {
  return AI_TOOL_LABELS[toolKey] ?? {
    ar: `أداة ذكاء: ${humanizeToolKey(toolKey)}`,
    en: humanizeToolKey(toolKey),
  };
}