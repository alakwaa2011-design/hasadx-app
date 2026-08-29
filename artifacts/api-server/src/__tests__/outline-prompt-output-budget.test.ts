import { describe, expect, it } from "vitest";
import { buildOutlinePrompt, type OutlineBrief } from "../lib/outline-prompt";

const interactiveBrief: OutlineBrief = {
  language: "en",
  subject: "Science",
  gradeLevel: "Grade 5",
  topic: "The water cycle",
  presentationKind: "quick",
  slideCount: 8,
  durationMinutes: 30,
  languageLevel: "medium",
  density: "balanced",
  toggles: { activities: true, questions: true, poll: true, quiz: true },
};

describe("outline prompt output budget", () => {
  it("keeps activity questions small enough to finish the full deck", () => {
    const prompt = buildOutlinePrompt(interactiveBrief);

    expect(prompt).toContain("6–7 questions");
    expect(prompt).toContain("only one may contain gameQuestions");
    expect(prompt).not.toContain("no fewer than 5");
    expect(prompt).not.toContain("5–8 ready-to-display questions");
  });
});