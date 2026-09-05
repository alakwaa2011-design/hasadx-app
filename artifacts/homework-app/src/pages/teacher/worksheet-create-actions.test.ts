import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/teacher/worksheet-create.tsx"),
  "utf8",
);

describe("worksheet builder navigation and destructive actions", () => {
  it("uses safe in-app back navigation", () => {
    expect(source).toContain('useSmartBack("/teacher")');
    expect(source).toContain("onClick={goBack}");
  });

  it("requires confirmation before clearing every question and removes stale layout settings", () => {
    expect(source).toContain("هل تريد حذف جميع الأسئلة؟");
    expect(source).toContain("setQuestions([])");
    expect(source).toContain("pageBreaks: [], questionStyles: []");
  });
});
  it("organizes AI generation between Topic and Source Material via Tabs", () => {
    expect(source).toContain('value={activeAiTab}');
    expect(source).toContain('value="topic"');
    expect(source).toContain('value="source"');
  });

  it("hides advanced AI settings behind a Collapsible", () => {
    expect(source).toContain('<Collapsible>');
    expect(source).toContain('إعدادات التوليد المتقدمة');
    expect(source).toContain('Advanced Generation Settings');
  });

  it("groups Header Data and Design into a compact Tabs area", () => {
    expect(source).toContain('Tabs defaultValue="header"');
    expect(source).toContain('value="header"');
    expect(source).toContain('value="design"');
  });

  it("exposes Add Question actions via a DropdownMenu rather than flat buttons", () => {
    expect(source).toContain('<DropdownMenu dir={dir}>');
    expect(source).toContain('Add Question');
    expect(source).toContain('<DropdownMenuItem');
  });

  it("keeps settings, tabs, and question menus aligned to the active language direction", () => {
    expect(source).toContain('className="w-full text-start" dir={dir}');
    expect(source).toContain('className="w-full text-start" dir={dir}');
    expect(source).toContain('<DropdownMenu dir={dir}>');
    expect(source).toContain('className={cn("block text-start", className)}');
  });

  it("shows Add Question as the primary action and the total as a small secondary badge", () => {
    expect(source).toContain('{ar ? "إضافة سؤال" : "Add Question"}');
    expect(source).toContain('`${totalQs} مضافة`');
    expect(source).not.toContain('{ar ? "الأسئلة" : "Questions"} ({totalQs})');
  });
