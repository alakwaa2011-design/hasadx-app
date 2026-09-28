// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuranMadaniPageRenderer } from "./quran-madani-page";

vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "ar" }) }));
vi.mock("@workspace/api-client-react", () => ({
  getGetQuranMadaniPageQueryKey: (page: number) => ["quran-page", page],
  useGetQuranMadaniPage: () => ({
    data: {
      lines: [{ lineNumber: 1, words: [
        { id: 1, verseKey: "1:1", position: 1, type: "word", text: "بسم", glyph: "ﱁ" },
      ] }],
      surahStarts: [],
    },
    isLoading: false,
    isError: false,
  }),
}));

describe("Madani Tajweed ink on reading themes", () => {
  beforeEach(() => {
    class LoadedFontFace {
      load() { return Promise.resolve(this); }
    }
    vi.stubGlobal("FontFace", LoadedFontFace);
    Object.defineProperty(document, "fonts", { configurable: true, value: { add: vi.fn() } });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const renderPage = (tajweedEnabled: boolean, nightTheme: boolean) =>
    render(<QuranMadaniPageRenderer pageNumber={1} fallbackImageUrl=""
      isLastVerse={() => false} tajweedEnabled={tajweedEnabled} nightTheme={nightTheme} />);

  it("brightens only the painted letters when amber night and Tajweed are both selected", async () => {
    const { rerender } = renderPage(true, true);
    const word = await screen.findByRole("button", { name: /بسم/ });
    const glyph = word.querySelector("span");
    expect(glyph?.style.filter).toBe("invert(1) hue-rotate(180deg) brightness(1.4)");
    expect(word.style.filter).toBe("");

    rerender(<QuranMadaniPageRenderer pageNumber={1} fallbackImageUrl=""
      isLastVerse={() => false} tajweedEnabled={true} nightTheme={false} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /بسم/ }).querySelector("span")?.style.filter).toBe(""));

    rerender(<QuranMadaniPageRenderer pageNumber={1} fallbackImageUrl=""
      isLastVerse={() => false} tajweedEnabled={false} nightTheme={true} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /بسم/ }).querySelector("span")?.style.filter).toBe(""));
  });
});