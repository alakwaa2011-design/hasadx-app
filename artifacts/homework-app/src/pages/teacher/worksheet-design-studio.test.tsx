// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { worksheetSettingsSchema } from "@workspace/api-zod";
import { WorksheetDesignStudio } from "./worksheet-design-studio";
import { worksheetDesignCss } from "./worksheet-design-styles";
import { THEMES, selectTheme, type ThemeCssParams } from "./worksheet-themes";
import { readFileSync } from "node:fs";

afterEach(cleanup);
const settings = worksheetSettingsSchema.parse({
  template: "space_journey", design: { secondaryColor: "#123456", printMode: "mono" },
});
const params: ThemeCssParams = {
  TC: "#225739", GOLD: "#ABCDEF", BG: "white", fontFamily: "Cairo",
  headingFont: "Cairo", fontSizePt: 12, isAr: true, startSide: "right", endSide: "left",
};

describe("worksheet design studio", () => {
  it("keeps all existing templates and offers the five new templates", () => {
    const { getByTestId } = render(<WorksheetDesignStudio settings={settings} onPatch={vi.fn()} ar />);
    for (const id of Object.keys(THEMES)) expect(getByTestId(`theme-${id}`)).toBeTruthy();
    expect(Object.keys(THEMES)).toHaveLength(12);
  });
  it("filters child themes without removing the selected worksheet content", () => {
    const onPatch = vi.fn();
    const { getByTestId, queryByTestId } = render(<WorksheetDesignStudio settings={settings} onPatch={onPatch} ar />);
    fireEvent.click(getByTestId("design-filter-kids"));
    expect(getByTestId("theme-pastel_garden")).toBeTruthy();
    expect(queryByTestId("theme-studio_pro")).toBeNull();
    expect(onPatch).not.toHaveBeenCalled();
  });
  it("honors manual theme choice and preserves unrelated design overrides", () => {
    const onPatch = vi.fn();
    const { getByTestId } = render(<WorksheetDesignStudio settings={settings} onPatch={onPatch} ar />);
    fireEvent.click(getByTestId("theme-storybook"));
    expect(onPatch).toHaveBeenLastCalledWith({
      template: "storybook", themeColor: undefined,
      design: { secondaryColor: "#123456", printMode: "mono", themeSelection: "manual" },
    });
    fireEvent.click(getByTestId("theme-classic"));
    expect(onPatch.mock.lastCall?.[0].template).toBeUndefined();
    expect(onPatch.mock.lastCall?.[0].design.themeSelection).toBe("manual");
  });
  it("merges answer and border changes without destroying the secondary color", () => {
    const onPatch = vi.fn();
    const { getByTestId } = render(<WorksheetDesignStudio settings={settings} onPatch={onPatch} ar={false} />);
    fireEvent.click(getByTestId("design-answer-grid"));
    expect(onPatch).toHaveBeenCalledWith({ design: { ...settings.design, answerPattern: "grid" } });
    fireEvent.click(getByTestId("design-page-double"));
    expect(onPatch).toHaveBeenLastCalledWith({ design: { ...settings.design, pageFrame: "double" } });
  });
  it("offers actual child/pro presets and blocks mutations while disabled", () => {
    const onPatch = vi.fn();
    const { getByTestId, rerender } = render(<WorksheetDesignStudio settings={settings} onPatch={onPatch} ar />);
    fireEvent.click(getByTestId("design-preset-kids"));
    expect(onPatch.mock.lastCall?.[0].template).toBe("pastel_garden");
    expect(onPatch.mock.lastCall?.[0].design.numbering).toBe("circle");
    rerender(<WorksheetDesignStudio settings={settings} onPatch={onPatch} ar disabled />);
    onPatch.mockClear();
    fireEvent.click(getByTestId("design-preset-pro"));
    expect(onPatch).not.toHaveBeenCalled();
  });
  it("resets only overrides, never identity or questions", () => {
    const onPatch = vi.fn();
    const { getByTestId } = render(<WorksheetDesignStudio settings={settings} onPatch={onPatch} ar />);
    fireEvent.click(getByTestId("design-reset"));
    expect(onPatch).toHaveBeenCalledWith({ design: undefined });
  });
});

describe("printable design contract", () => {
  it("keeps page background illustrations visible instead of resetting them with an inline shorthand", () => {
    const source = readFileSync("src/pages/teacher/worksheet-print.tsx", "utf8");
    expect(source).not.toContain("style={{ background: themeBg }}");
    expect(source.match(/style=\{\{ backgroundColor: themeBg \}\}/g)).toHaveLength(2);
    const css = worksheetDesignCss({ ...settings, design: { decoration: "botanical" } }, "#225739");
    expect(css).toContain("bottom: 16mm");
    expect(css).not.toContain("top: 3mm");
  });
  it("persists new templates and all safe design fields through a JSON roundtrip", () => {
    const design = { themeSelection: "manual", printMode: "color", secondaryColor: "#ABCDEF", pageFrame: "double", questionFrame: "soft", numbering: "circle", answerPattern: "grid", decoration: "botanical", density: "comfortable" };
    const saved = worksheetSettingsSchema.parse({ template: "pastel_garden", design });
    expect(worksheetSettingsSchema.parse(JSON.parse(JSON.stringify(saved))).design).toEqual(design);
    expect(worksheetSettingsSchema.safeParse({ design: { secondaryColor: "url(evil)" } }).success).toBe(false);
    expect(worksheetSettingsSchema.safeParse({ design: { printMode: "invalid" } }).success).toBe(false);
  });
  it("supports every extra theme from any import order without circular initialization", () => {
    for (const id of ["studio_pro", "pastel_garden", "space_journey", "storybook", "math_grid"] as const) {
      const css = THEMES[id].css(params);
      expect(css).toContain(`.ws-theme-${id}`);
      expect(css).toContain("data:image/svg+xml");
      expect(css).toMatch(/--ws-frame: [2-6]px/);
      expect(css).toContain("ABCDEF");
    }
  });
  it("applies height-changing inner styles equally to measured and visible content", () => {
    const css = worksheetDesignCss({ ...settings, design: { density: "comfortable", questionFrame: "soft", answerPattern: "grid", numbering: "square" } }, "#225739");
    expect(css).toContain(".ws-designed .ws-q");
    expect(css).toContain(".ws-designed .ws-line");
    expect(css).toContain("5mm 5mm");
    expect(css).not.toContain(".ws-page.ws-designed .ws-line");
  });
  it("explicit plain lines and ink-saver override decorated theme defaults", () => {
    const css = worksheetDesignCss({ ...settings, design: { answerPattern: "lines", printMode: "ink_saver", decoration: "none" } }, "#225739");
    expect(css).toContain("border-bottom: 1px solid");
    expect(css).toContain("background: #fff !important");
    expect(css).toContain("color: #225739 !important");
    expect(css).toContain("background-image: none !important");
  });
  it("does not classify secondary first grade as kindergarten", () => {
    expect(["kids_play", "pastel_garden", "storybook", "space_journey"]).not.toContain(selectTheme("التاريخ", "الأول الثانوي", "ar", 3));
  });
});