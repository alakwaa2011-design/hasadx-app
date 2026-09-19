// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageData = {
  pageNumber: 2,
  juzNumber: 1,
  hizbNumber: 1,
  rubElHizbNumber: 1,
  surahStarts: [{ surahNumber: 2, lineNumber: 10 }],
  lines: Array.from({ length: 6 }, (_, index) => ({
    lineNumber: index + 10,
    words: [{
      id: index + 1,
      position: 1,
      verseKey: `2:${index + 1}`,
      glyph: "ﱁ",
      text: "الٓمٓ",
      type: "word",
    }],
  })),
};

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetQuranMadaniPageQueryKey: (pageNumber: number) => ["quran-page", pageNumber],
  useGetQuranMadaniPage: () => ({
    data: pageData,
    isLoading: false,
    isError: false,
  }),
}));

import { QuranMadaniPageRenderer } from "./quran-madani-page";

describe("QuranMadaniPageRenderer", () => {
  beforeEach(() => {
    class MockFontFace {
      load() {
        return Promise.resolve(this);
      }
    }
    vi.stubGlobal("FontFace", MockFontFace);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { add: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the basmala before the first ayah of Al-Baqarah", async () => {
    render(
      <QuranMadaniPageRenderer
        pageNumber={2}
        isLastVerse={() => false}
        fallbackImageUrl="/page-2.png"
      />,
    );

    await waitFor(() => {
      const bismillah = screen.getByLabelText("بسم الله الرحمن الرحيم");
      expect(bismillah).toBeTruthy();
      expect(bismillah.textContent).toBe("ﱁﱂﱃﱄ");
      expect((bismillah.firstElementChild as HTMLElement).style.fontFamily)
        .toContain("qcf-v2-bismillah");
    });
  });
});