import { describe, expect, it } from "vitest";
import {
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
});