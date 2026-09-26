// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuranTajweedRuleCard } from "./quran-tajweed-rule-card";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar", dir: "rtl" }),
}));

vi.mock("./use-quran-word-audio", () => ({
  useQuranWordAudio: () => ({ activeWordKey: null, loadingWordKey: null, playWord: vi.fn() }),
}));

afterEach(cleanup);

const rules = [
  {
    class: "madda_normal",
    letters: "ـٰ",
    nameAr: "المد الطبيعي",
    descriptionAr: "مدّ بمقدار حركتين بلا همز ولا سكون بعد حرف المد.",
    color: "#b50000",
    colorNameAr: "أحمر",
  },
  {
    class: "laam_shamsiyah",
    letters: "ل",
    nameAr: "اللام الشمسية",
    descriptionAr: "لام «أل» التعريف تُدغم في الحرف الشمسي الذي يليها، فلا تُنطق اللام نفسها.",
    color: "#a5a5a5",
    colorNameAr: "رمادي",
  },
];

describe("QuranTajweedRuleCard", () => {
  it("renders every verified rule with its name, explanation, and matching color swatch", () => {
    render(
      <QuranTajweedRuleCard
        open
        wordText="ٱلرَّحۡمَـٰنِ"
        surahNumber={1}
        ayahNumber={1}
        wordPosition={3}
        rules={rules}
        sourceName="أحكام التجويد المعتمدة (مجمع الملك فهد)"
        onClose={vi.fn()}
      />,
    );

    const entries = screen.getAllByTestId("tajweed-rule-entry");
    expect(entries).toHaveLength(2);
    expect(screen.getByText("المد الطبيعي")).toBeTruthy();
    expect(screen.getByText(rules[0].descriptionAr)).toBeTruthy();
    expect(screen.getByText("اللام الشمسية")).toBeTruthy();
    expect(screen.getByText(rules[1].descriptionAr)).toBeTruthy();

    const swatches = screen.getAllByTestId("tajweed-rule-color-swatch");
    expect(swatches[0].style.backgroundColor).toBe("rgb(181, 0, 0)");
    expect(swatches[1].style.backgroundColor).toBe("rgb(165, 165, 165)");
    expect(screen.getByText(/أحكام التجويد المعتمدة/)).toBeTruthy();
  });

  it("never renders when there are no verified rules, even if open", () => {
    render(
      <QuranTajweedRuleCard
        open
        wordText="بِسْمِ"
        surahNumber={1}
        ayahNumber={1}
        wordPosition={1}
        rules={[]}
        sourceName="مصدر"
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("quran-tajweed-rule-card")).toBeNull();
  });

  it("closes via the close button, the backdrop, and the Escape key", () => {
    const onClose = vi.fn();
    render(
      <QuranTajweedRuleCard
        open
        wordText="ٱلرَّحۡمَـٰنِ"
        surahNumber={1}
        ayahNumber={1}
        wordPosition={3}
        rules={rules}
        sourceName="مصدر"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId("tajweed-card-close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("exposes an accessible dialog role and label naming the word", () => {
    render(
      <QuranTajweedRuleCard
        open
        wordText="ٱلرَّحۡمَـٰنِ"
        surahNumber={1}
        ayahNumber={1}
        wordPosition={3}
        rules={rules}
        sourceName="مصدر"
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toContain("ٱلرَّحۡمَـٰنِ");
  });

  it("offers a listen action reusing the trusted word audio pipeline", () => {
    render(
      <QuranTajweedRuleCard
        open
        wordText="ٱلرَّحۡمَـٰنِ"
        surahNumber={1}
        ayahNumber={1}
        wordPosition={3}
        rules={rules}
        sourceName="مصدر"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tajweed-card-listen")).toBeTruthy();
  });
});
