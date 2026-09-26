// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { QuranMutashabihatPanel } from "./quran-mutashabihat-panel";

afterEach(cleanup);

describe("Quran mutashabihat panel", () => {
  it("loads canonical Quran text and navigates to a curated related ayah", async () => {
    const onNavigate = vi.fn();
    render(
      <I18nProvider>
        <QuranMutashabihatPanel verseKey="2:255" onNavigate={onNavigate} onClose={vi.fn()} />
      </I18nProvider>,
    );

    const match = await screen.findByTestId("mutashabihat-match-3:2");
    expect(match.textContent).toContain("ٱلْحَىُّ ٱلْقَيُّومُ");
    const targetVerseText = screen.getByTestId("mutashabihat-navigate-3:2").querySelector(".quran-word-action-text");
    expect(targetVerseText?.textContent).toContain("ٱلْحَىُّ ٱلْقَيُّومُ");
    fireEvent.click(targetVerseText!);
    expect(onNavigate).toHaveBeenCalledWith({ verseKey: "3:2", pageId: expect.any(Number) });
  });

  it("shows the full set of repeated verses for alif-lam-mim", async () => {
    render(
      <I18nProvider>
        <QuranMutashabihatPanel verseKey="2:1" onNavigate={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(await screen.findByTestId("mutashabihat-match-3:1")).toBeTruthy();
    expect(screen.getByTestId("mutashabihat-match-32:1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutashabihat-filter-exact"));
    expect(screen.getByTestId("mutashabihat-match-32:1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutashabihat-filter-variation"));
    expect(screen.queryByTestId("mutashabihat-match-32:1")).toBeNull();
    expect(screen.getByText(/لا توجد مواضع في هذا التصنيف/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutashabihat-filter-all"));
    expect(screen.getByTestId("mutashabihat-match-32:1")).toBeTruthy();
  });

  it("separates exact repeats from shared phrases and preserves the unfiltered result list", async () => {
    render(
      <I18nProvider>
        <QuranMutashabihatPanel verseKey="10:48" onNavigate={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(await screen.findByTestId("mutashabihat-match-21:38")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutashabihat-filter-phrase"));
    expect(screen.queryByTestId("mutashabihat-match-21:38")).toBeNull();
    expect(screen.getByTestId("mutashabihat-show-more")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutashabihat-filter-exact"));
    expect(screen.getByTestId("mutashabihat-match-21:38")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mutashabihat-filter-all"));
    expect(screen.getByTestId("mutashabihat-match-21:38")).toBeTruthy();
  });

  it("preserves amber shared words, marks local wording differences in blue, and filters wording variations", async () => {
    render(
      <I18nProvider>
        <QuranMutashabihatPanel verseKey="2:48" onNavigate={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>,
    );
    const match = await screen.findByTestId("mutashabihat-match-2:123");
    expect(match.querySelectorAll('[data-word-mark="shared"]').length).toBeGreaterThan(0);
    expect(match.querySelectorAll('[data-word-mark="different"]').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("mutashabihat-filter-variation"));
    expect(screen.getByTestId("mutashabihat-match-2:123")).toBeTruthy();
    expect(screen.getByTestId("mutashabihat-filter-variation").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("mutashabihat-filter-exact"));
    expect(screen.queryByTestId("mutashabihat-match-2:123")).toBeNull();
  });

  it("explains that an empty selection does not imply no other similarities", async () => {
    render(
      <I18nProvider>
        <QuranMutashabihatPanel verseKey="111:1" onNavigate={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(await screen.findByText(/قد توجد اختلافات لفظية أخرى/)).toBeTruthy();
  });
});