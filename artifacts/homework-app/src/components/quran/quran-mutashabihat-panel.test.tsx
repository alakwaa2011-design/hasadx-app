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
    fireEvent.click(screen.getByTestId("mutashabihat-navigate-3:2"));
    expect(onNavigate).toHaveBeenCalledWith({ verseKey: "3:2", pageId: expect.any(Number) });
  });

  it("explains that an empty selection does not imply no other similarities", async () => {
    render(
      <I18nProvider>
        <QuranMutashabihatPanel verseKey="1:1" onNavigate={vi.fn()} onClose={vi.fn()} />
      </I18nProvider>,
    );
    expect(await screen.findByText(/لا توجد لهذه الآية علاقات منتقاة/)).toBeTruthy();
  });
});