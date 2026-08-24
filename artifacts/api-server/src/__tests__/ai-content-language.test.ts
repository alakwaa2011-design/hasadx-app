import { describe, expect, it } from "vitest";
import { resolveAiContentLanguage } from "../lib/ai-content-language";

describe("resolveAiContentLanguage", () => {
  it("uses the interface language when no meaningful details are given", () => {
    expect(resolveAiContentLanguage({ preferredLanguage: "en" })).toBe("en");
    expect(resolveAiContentLanguage({ preferredLanguage: "ar" })).toBe("ar");
  });

  it("uses a clearly English topic from an Arabic interface", () => {
    expect(resolveAiContentLanguage({
      preferredLanguage: "ar",
      primaryText: "Photosynthesis in plant cells",
    })).toBe("en");
  });

  it("keeps an English topic in English with Arabic contextual metadata", () => {
    expect(resolveAiContentLanguage({
      preferredLanguage: "ar",
      primaryText: "Photosynthesis",
      detailTexts: ["مادة العلوم للصف السادس"],
    })).toBe("en");
  });

  it("honors an explicit Arabic request over English details", () => {
    expect(resolveAiContentLanguage({
      preferredLanguage: "en",
      primaryText: "Explain Newton's laws in Arabic",
    })).toBe("ar");
  });

  it("honors an explicit English request over Arabic details", () => {
    expect(resolveAiContentLanguage({
      preferredLanguage: "ar",
      primaryText: "اشرح دورة الماء بالإنجليزية",
    })).toBe("en");
  });
});