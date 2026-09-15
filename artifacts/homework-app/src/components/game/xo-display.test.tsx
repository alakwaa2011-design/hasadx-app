import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  XoName,
  XoTitle,
  getDefaultXoTeamName,
  normalizeXoTeamName,
  normalizeXoTitle,
} from "./xo-display";

describe("X O display helpers", () => {
  it("uses the same Latin game name and isolates it in RTL markup", () => {
    expect(normalizeXoTitle("إكس أو", "ar")).toBe("X O");
    expect(normalizeXoTitle("XO", "en")).toBe("X O");
    const markup = renderToStaticMarkup(<p dir="rtl">لعبة <XoName /></p>);
    expect(markup).toContain('dir="ltr"');
    expect(markup.indexOf("X O")).toBeLessThan(markup.indexOf("</span>"));
  });

  it("provides localized defaults while preserving custom team names", () => {
    expect(getDefaultXoTeamName("x", "ar")).toBe("فريق X");
    expect(getDefaultXoTeamName("o", "en")).toBe("Team O");
    expect(normalizeXoTeamName("فريق إكس", "x", "ar")).toBe("فريق X");
    expect(normalizeXoTeamName("My team", "x", "en")).toBe("My team");
  });

  it("renders old default class titles with an isolated X O name", () => {
    const markup = renderToStaticMarkup(<XoTitle title="XO Class" lang="en" />);
    expect(markup).toContain("X O");
    expect(markup).toContain('dir="ltr"');
    expect(normalizeXoTitle("Teacher's XO tournament", "en")).toBe("Teacher's XO tournament");
  });
});