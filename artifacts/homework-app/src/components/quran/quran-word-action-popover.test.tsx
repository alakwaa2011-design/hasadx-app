// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuranWordActionPopover } from "./quran-word-action-popover";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar", dir: "rtl" }),
}));

afterEach(cleanup);

const anchorRect = { top: 100, left: 100, right: 150, bottom: 120, width: 50, height: 20 };

describe("QuranWordActionPopover", () => {
  it("shows only the three base actions when no verified Tajweed rule is provided", () => {
    render(
      <QuranWordActionPopover
        open
        wordText="بِسْمِ"
        anchorRect={anchorRect}
        onOpenChange={vi.fn()}
        onPronounce={vi.fn()}
        onMeaning={vi.fn()}
        onTranslation={vi.fn()}
      />,
    );

    expect(screen.getByTestId("word-action-pronounce")).toBeTruthy();
    expect(screen.getByTestId("word-action-meaning")).toBeTruthy();
    expect(screen.getByTestId("word-action-translation")).toBeTruthy();
    expect(screen.queryByTestId("word-action-tajweed")).toBeNull();
  });

  it("also does not show the Tajweed action when showTajweedAction is explicitly false", () => {
    render(
      <QuranWordActionPopover
        open
        wordText="بِسْمِ"
        anchorRect={anchorRect}
        onOpenChange={vi.fn()}
        onPronounce={vi.fn()}
        onMeaning={vi.fn()}
        onTranslation={vi.fn()}
        showTajweedAction={false}
        onTajweed={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("word-action-tajweed")).toBeNull();
  });

  it("shows a fourth Tajweed action once a verified rule is confirmed, and invokes its callback", () => {
    const onTajweed = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <QuranWordActionPopover
        open
        wordText="ٱللَّهِ"
        anchorRect={anchorRect}
        onOpenChange={onOpenChange}
        onPronounce={vi.fn()}
        onMeaning={vi.fn()}
        onTranslation={vi.fn()}
        showTajweedAction
        onTajweed={onTajweed}
      />,
    );

    const tajweedButton = screen.getByTestId("word-action-tajweed");
    expect(tajweedButton.textContent).toContain("الحكم");
    fireEvent.click(tajweedButton);
    expect(onTajweed).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render anything while closed", () => {
    render(
      <QuranWordActionPopover
        open={false}
        wordText="بِسْمِ"
        anchorRect={anchorRect}
        onOpenChange={vi.fn()}
        onPronounce={vi.fn()}
        onMeaning={vi.fn()}
        onTranslation={vi.fn()}
        showTajweedAction
        onTajweed={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("quran-word-action-popover")).toBeNull();
  });
});
