import { describe, expect, it } from "vitest";
import { THEMES, type ThemeCssParams } from "./worksheet-themes";

describe("Modern Band worksheet page bounds", () => {
  it.each([true, false])("keeps the band inside its unpadded A4 content box (Arabic: %s)", isAr => {
    const params: ThemeCssParams = {
      TC: "#1D4ED8",
      GOLD: "#B99545",
      BG: "#ffffff",
      fontFamily: "Cairo",
      headingFont: "Cairo",
      fontSizePt: 12,
      isAr,
      startSide: isAr ? "right" : "left",
      endSide: isAr ? "left" : "right",
    };
    const css = THEMES.modern_band.css(params);
    const band = css.match(/\.ws-band-top\s*\{([^}]+)\}/)?.[1];

    expect(css).toMatch(/\.ws-theme-modern_band\s+\.ws-content\s*\{\s*padding:\s*0\s+0\s+13mm/);
    expect(band).toMatch(/margin:\s*0\s+0\s+5mm\s*;/);
    expect(band).toMatch(/width:\s*100%\s*;/);
    expect(band).toMatch(/box-sizing:\s*border-box\s*;/);
  });
});