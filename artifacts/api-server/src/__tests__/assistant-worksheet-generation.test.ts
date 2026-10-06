import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { generateWorksheetQuestions } from "../routes/worksheets";
import { missingWorksheetFields, prepareWorksheetRequest } from "../lib/assistant-worksheet";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "../lib/anthropic-client";
import { generateAssistantQuestionSet } from "../routes/ai-questions";

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));
vi.mock("../lib/anthropic-client", () => ({
  anthropic: { messages: { create: vi.fn() } }, SONNET_MODEL: "test",
}));
vi.mock("../lib/ai-tier", () => ({
  resolveTier: async () => "standard", isClaudeTier: () => false, modelForTier: () => "test",
}));
vi.mock("../lib/ai-usage-ledger", () => ({
  trackAiUsageCall: (_req: unknown, _options: unknown, invoke: () => unknown) => invoke(),
}));
const req = { session: { teacherId: 1 }, headers: {}, log: { warn: vi.fn() }, __assistantJob: true } as unknown as Request;
const types = ["mcq", "true_false", "short_answer", "fill_blank", "matching", "worked_problem", "extended_response", "error_correction", "word_bank", "compare", "tic_tac_toe"];
const body = { topic: "Water cycle", subject: "Science", gradeLevel: "5", language: "en", pages: 1, questionSelection: "manual", counts: { ...Object.fromEntries(types.map(type => [type, 0])), short_answer: 2 } };
const question = (prompt: string) => ({ type: "short_answer", prompt, answer: "Water evaporates.", lines: 3 });
const completion = (...questions: ReturnType<typeof question>[]) => ({ choices: [{ message: { content: JSON.stringify({ questions }) } }] }) as any;
const prepareResponse = (data: object) => ({ content: [{ type: "text", text: JSON.stringify(data) }], usage: { input_tokens: 1, output_tokens: 1 } }) as any;
describe("assistant worksheet generation contract", () => {
  beforeEach(() => vi.resetAllMocks());
  it("repairs underfilled manual output once and returns exactly the confirmed counts", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce(completion(question("First?"))).mockResolvedValueOnce(completion(question("First?"), question("Second?")));
    const result = await generateWorksheetQuestions(req, 1, body);
    expect(result.questions).toHaveLength(2);
    expect(result.questions.every(q => q.type === "short_answer")).toBe(true);
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(2);
  });
  it("rejects a persistently underfilled result instead of saving and billing it", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValue(completion(question("Only one?")));
    await expect(generateWorksheetQuestions(req, 1, body)).rejects.toThrow();
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(2);
  });
  it("keeps the existing builder's permissive legacy behavior unchanged", async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValue(completion(question("Only one?")));
    const result = await generateWorksheetQuestions({ ...req, __assistantJob: false } as unknown as Request, 1, body);
    expect(result.questions).toHaveLength(1);
    expect(openai.chat.completions.create).toHaveBeenCalledTimes(1);
  });
  it("attaches long pasted source verbatim without asking the model to repeat it", async () => {
    const source = "Water evaporates. ".repeat(400);
    vi.mocked(anthropic.messages.create).mockResolvedValue(prepareResponse({ supported: true, title: "Water", reply: "Review", sourceFromRequest: true, parameters: { topic: "Water", subject: "Science", gradeLevel: "5" } }));
    expect((await prepareWorksheetRequest(req, source, "en")).parameters.sourceText).toBe(source);
  });
  it("marks ambiguous zero-count manual requests incomplete", () => {
    expect(missingWorksheetFields({ topic: "Water", subject: "Science", gradeLevel: "5", questionSelection: "manual", counts: { short_answer: 0 } })).toContain("counts");
  });
  it("normalizes equivalent flat count keys without losing the teacher's requested number", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue(prepareResponse({ supported: true, title: "Water", reply: "Review", parameters: { topic: "Water", subject: "Science", gradeLevel: "5", questionSelection: "manual", short_answer: 2, mcq: 0 } }));
    const result = await prepareWorksheetRequest(req, "Two short-answer questions", "en");
    expect(result.parameters.counts).toMatchObject({ short_answer: 2, mcq: 0 });
    expect(missingWorksheetFields(result.parameters)).toEqual([]);
  });
  it("lets an explicit Arabic request override both an English UI and an incorrect model language", async () => {
    vi.mocked(anthropic.messages.create).mockResolvedValue(prepareResponse({
      supported: true, title: "الكسور", reply: "راجع الطلب",
      parameters: { topic: "الكسور", subject: "الرياضيات", gradeLevel: "الرابع", language: "en", gameType: "rocket", questionCount: 5 },
    }));
    const prepared = await prepareWorksheetRequest(req, "أريد سباق الصواريخ عن الكسور للصف الرابع باللغة العربية", "en", undefined, "game", "rocket");
    expect(prepared.parameters.language).toBe("ar");
  });
  it.each(["ar", "en"] as const)("uses confirmed %s for generation despite English internal game notes", async language => {
    vi.mocked(openai.chat.completions.create).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify([
        { text: "ما نتيجة ٢ + ٢؟", optionA: "٤", optionB: "٥", optionC: "٦", optionD: "٧", correctAnswer: "A", points: 1 },
      ]) } }],
    } as any);
    const generated = await generateAssistantQuestionSet(req, {
      topic: "الرياضيات", subject: "Mathematics", gradeLevel: "4", count: 1, questionTypes: ["mcq"],
      language, notes: "These questions are for an educational rocket race. Write clear independently answerable questions.",
    });
    expect(generated.questions).toHaveLength(1);
    const call = vi.mocked(openai.chat.completions.create).mock.calls[0][0];
    const prompt = JSON.stringify(call);
    expect(prompt).toContain(language === "ar" ? "باللغة العربية" : "Write every question");
  });
});
