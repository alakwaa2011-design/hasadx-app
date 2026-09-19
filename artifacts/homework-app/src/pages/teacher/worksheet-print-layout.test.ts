import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/teacher/worksheet-print.tsx"),
  "utf8",
);

describe("worksheet PDF page sizing", () => {
  it("includes worksheet padding inside the A4 content height", () => {
    const baseContentRule = source.match(/\.ws-content\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(baseContentRule).toContain("box-sizing: border-box");
    expect(baseContentRule).toContain("min-height: calc(297mm");
  });

  it("keeps border-box sizing in print mode", () => {
    expect(source).toMatch(
      /@media print[\s\S]*?\.ws-content\s*\{[\s\S]*?box-sizing:\s*border-box\s*!important/,
    );
  });

  it("includes theme borders inside the physical A4 page height", () => {
    const pageRule = source.match(/\.ws-page\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(pageRule).toContain("box-sizing: border-box");
    expect(pageRule).toContain("min-height: 297mm");
  });

  it("measures the same section headers that are rendered in the PDF", () => {
    expect(source).toContain("showTypeHeader={firstOfTypeSet.has(q.id)}");
    expect(source).toContain("if (qEls.length !== localQs.length) return");
  });

  it("reserves the rendered continuation header and footer heights", () => {
    expect(source).toContain("data-continuation-measure");
    expect(source).toContain("data-footer-measure");
    expect(source).toContain("footerEl.offsetHeight");
    expect(source).toContain("continuationEl.offsetHeight");
  });

  it("moves questions when a rendered worksheet page still exceeds A4", () => {
    expect(source).toContain("data-worksheet-page");
    expect(source).toContain("page.getBoundingClientRect().height > a4HeightPx + 2");
    expect(source).toContain("next[overflowIndex].pop()");
  });

  it("lets teachers clear stale manual breaks and invalidates them after question edits", () => {
    expect(source).toContain('"توزيع تلقائي"');
    expect(source).toContain("setLocalBreaks(new Set())");
    expect(source).toContain("Remove manual page breaks and repaginate");
  });

  it("lets teachers discard all unsaved print-editor changes", () => {
    expect(source).toContain("discardLayoutChanges");
    expect(source).toContain('"تجاهل التعديلات"');
    expect(source).toContain("setLocalQs(data.questions)");
  });
});

describe("official worksheet question layout", () => {
  it("uses the shared math-direction renderer for printable prompts, options, and answers", () => {
    expect(source).toContain('import { MathText } from "@/components/math-text"');
    expect(source).toContain("<MathText");
    expect(source).toContain('text={text || placeholder}');
    expect(source).toContain('<MathText text={text} fallbackDirection={ar ? "rtl" : "ltr"} />');
    expect(source).toContain('dir={contentDirection(text, "rtl")}');
    expect(source).toContain('unicodeBidi: "plaintext"');
  });

  it("renders the five rich worksheet question types with printable organizers", () => {
    expect(source).toContain('q.type === "worked_problem"');
    expect(source).toContain('className="ws-work-steps"');
    expect(source).toContain('className="ws-final-answer"');
    expect(source).toContain('q.type === "extended_response"');
    expect(source).toContain("Math.max(3, q.lines ?? 6)");
    expect(source).toContain('className="ws-incorrect-box"');
    expect(source).toContain('className="ws-correction-area"');
    expect(source).toContain('className="ws-explanation-area"');
    expect(source).toContain('className="ws-word-bank"');
    expect(source).toContain('className="ws-compare-organizer"');
  });

  it("places one word bank before the question and does not repeat it below", () => {
    const bankBlock = source.indexOf('{q.type === "word_bank" && (');
    const questionBlock = source.indexOf('<div className="ws-q">', bankBlock);
    expect(bankBlock).toBeGreaterThan(-1);
    expect(bankBlock).toBeLessThan(questionBlock);
    expect(source).toContain("new Set(q.items.filter(Boolean))");
    expect(source).not.toContain('className="ws-word-bank-items"');
    expect(source).not.toContain("new Set(q.answers.filter(Boolean))");
  });

  it("lets teachers edit comparison labels and configure error-correction writing areas", () => {
    expect(source).toContain("compareSimilaritiesLabel");
    expect(source).toContain("compareDifferencesLabel");
    expect(source).toContain("leftLabel: value");
    expect(source).toContain("rightLabel: value");
    expect(source).toContain("errorCorrectionCorrectionLines");
    expect(source).toContain("errorCorrectionExplanationLines");
    expect(source).toContain("errorCorrectionShowExplanation");
    expect(source).toContain('data-testid="button-toggle-error-explanation"');
  });

  it("keeps rich response organizers together and direction-neutral", () => {
    const organizerRule = source.match(/\.ws-worked-problem,[\s\S]*?\}/)?.[0] ?? "";
    expect(organizerRule).toContain("break-inside: avoid");
    expect(organizerRule).toContain("page-break-inside: avoid");
    expect(source).toContain("margin-inline-start: 9mm");
    expect(source).toContain("border-inline-end");
    expect(source).toContain("grid-template-columns: minmax(0, 1fr)");
  });

  it("prints model answers for each rich question type", () => {
    expect(source).toContain('q.type === "worked_problem" || q.type === "extended_response"');
    expect(source).toContain('q.type === "error_correction"');
    expect(source).toContain('q.type === "word_bank"');
    expect(source).toContain('q.type === "compare"');
    expect(source).toContain('ar ? "أوجه التشابه:" : "Similarities:"');
    expect(source).toContain('ar ? "أوجه الاختلاف:" : "Differences:"');
  });

  it("uses paper-style marks instead of AI-style answer bubbles", () => {
    expect(source).toContain('className="ws-tf-mark"');
    expect(source).not.toContain('className="ws-match-answer-slot"');
    expect(source).not.toContain("داخل القوس أمام كل عبارة");
    expect(source).not.toContain('<span className="ws-bubble"');
  });

  it("adapts matching-column widths to their content and leaves the first column unboxed", () => {
    const matchingRule = source.match(/\.ws-match\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(matchingRule).toContain("grid-template-columns: minmax(0, 1fr) 6mm minmax(0, 1fr)");
    expect(source).toContain("matchingColumnFractions(q.pairs)");
    expect(source).toContain("data-matching-left-share");
    expect(source).not.toContain("matchingLeftWidth ?? 50");
  });

  it("lets teachers drag the matching divider with safe width limits", () => {
    expect(source).toContain("onMatchingWidthChange");
    expect(source).toContain("setPointerCapture");
    expect(source).toContain('role={em ? "separator"');
    expect(source).toContain("aria-valuemin={em ? 35");
    expect(source).toContain("aria-valuemax={em ? 65");
    expect(source).toContain("ws-match-divider-handle");
  });

  it("places the true/false mark after the statement and offers both MCQ layouts", () => {
    const promptStart = source.indexOf("<EditSpan", source.indexOf('className="ws-q-prompt"'));
    const markStart = source.indexOf('className="ws-tf-mark"', promptStart);
    expect(markStart).toBeGreaterThan(promptStart);
    expect(source).toContain('"ترتيب الخيارات"');
    expect(source).toContain('"عمودي"');
    expect(source).toContain('"خياران في سطر"');
    expect(source).toContain('data-testid="select-choice-columns"');
    expect(source).toContain('role="toolbar"');
  });

  it("keeps spacing and option-layout controls compact and indivisible", () => {
    expect(source).toContain('data-testid="select-question-spacing"');
    expect(source).toContain("مسافة السؤال");
    expect(source).toContain(".ws-format-control { flex: 0 0 auto; white-space: nowrap; }");
  });

  it("makes question selection and the formatting toolbar visually explicit", () => {
    expect(source).toContain("ws-q-selected");
    expect(source).toContain("data-question-selected");
    expect(source).toContain("تعديل السؤال");
    expect(source).toContain("background: linear-gradient(135deg, #edf7f2");
    expect(source).toContain("border: 2px solid ${TC}");
  });

  it("applies spacing to the complete question block rather than only its heading", () => {
    expect(source).toContain('className={`ws-question-block ws-q-spacing-${questionStyle?.spacing ?? "normal"}');
    expect(source).toContain(".ws-question-block.ws-q-spacing-compact");
    expect(source).toContain(".ws-question-block.ws-q-spacing-relaxed");
    expect(source).toContain(".ws-question-block > .ws-q { margin-bottom: 0; }");
    expect(source).not.toContain('className={`ws-q ws-q-spacing-');
  });

  it("offers both true/false answer layouts per question", () => {
    expect(source).toContain('"قوس للعلامة"');
    expect(source).toContain('"خيارا صح وخطأ"');
    expect(source).toContain('(questionStyle?.trueFalseLayout ?? "choices") === "choices"');
    expect(source).toContain('className="ws-tf-box"');
  });

  it("defaults multiple choice to two columns and true/false to explicit choices", () => {
    expect(source).toContain("questionStyle?.choiceColumns ?? 2");
    expect(source).toContain('questionStyle?.trueFalseLayout ?? "choices"');
    expect(source).toContain("اختر «صح» أو «خطأ» لكل عبارة مما يلي:");
    expect(source).toContain("ضع علامة (✓) أمام العبارة الصحيحة");
    expect(source).not.toContain("داخل القوس أمام العبارة");
  });

  it("applies and persists local field and question formatting", () => {
    expect(source).toContain("data.settings.questionStyles ?? []");
    expect(source).toContain("onSelectField={key => setSelectedField");
    expect(source).toContain("questionStyles: QuestionStyle[]");
    expect(source).toContain("JSON.stringify(localQuestionStyles)");
  });

  it("builds the answer key from unsaved local edits", () => {
    expect(source).toContain("buildAnswerItems(localQs, ar, labels)");
    expect(source).toContain("JSON.stringify(localQs)");
    expect(source).not.toContain("buildAnswerItems(data.questions, ar, labels)");
  });

  it("lets the teacher change both question type and its correct answer", () => {
    expect(source).toContain('aria-label={ar ? "تغيير نوع السؤال"');
    expect(source).toContain('aria-label={ar ? "اختيار الإجابة الصحيحة"');
    expect(source).toContain('aria-label={ar ? "الإجابة النموذجية"');
  });

  it("prints the Tic-Tac-Toe strategy as an indivisible 3 by 3 board", () => {
    const boardRule = source.match(/\.ws-tic-board\s*\{[\s\S]*?\}/)?.[0] ?? "";
    expect(boardRule).toContain("grid-template-columns: repeat(3");
    expect(source).toMatch(/\.ws-tic-board\s*\{[\s\S]*?break-inside:\s*avoid/);
    expect(source).toContain('className="ws-tic-cell"');
    expect(source).toContain("resolveImageUrl(cell.imageUrl)");
  });

  it("offers customizable Tic-Tac-Toe strategy and response space", () => {
    expect(source).toContain('data-testid="select-tic-strategy"');
    expect(source).toContain('data-testid="select-tic-response"');
    expect(source).toContain('questionStyle?.ticTacToeStrategy');
    expect(source).toContain('questionStyle?.ticTacToeResponseLines');
    expect(source).toContain('className="ws-short-lines mt-4"');
    expect(source).toContain('className="ws-short-line"');
  });
});
