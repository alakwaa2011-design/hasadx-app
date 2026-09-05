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
});

describe("official worksheet question layout", () => {
  it("uses paper-style marks instead of AI-style answer bubbles", () => {
    expect(source).toContain('className="ws-tf-mark"');
    expect(source).toContain('className="ws-match-answer-slot"');
    expect(source).toContain("اكتب حرف الإجابة المناسبة داخل القوس");
    expect(source).not.toContain('<span className="ws-bubble"');
  });

  it("applies and persists local field and question formatting", () => {
    expect(source).toContain("data.settings.questionStyles ?? []");
    expect(source).toContain("onSelectField={key => setSelectedField");
    expect(source).toContain("questionStyles: QuestionStyle[]");
    expect(source).toContain("JSON.stringify(localQuestionStyles)");
  });
});