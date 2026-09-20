import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuranGuidedMemorizationPanel } from "./quran-guided-memorization-panel";

function renderPanel(overrides: Partial<React.ComponentProps<typeof QuranGuidedMemorizationPanel>> = {}) {
  const props: React.ComponentProps<typeof QuranGuidedMemorizationPanel> = {
    open: true,
    stage: 0,
    surahName: "الفاتحة",
    ayahNumber: 1,
    isPlaying: false,
    repeatScope: "ayah",
    repeatCount: 3,
    rangeStart: 1,
    rangeEnd: 7,
    recitationRevealed: false,
    onClose: vi.fn(),
    onStageChange: vi.fn(),
    onRepeatScopeChange: vi.fn(),
    onRepeatCountChange: vi.fn(),
    onReplay: vi.fn(),
    onRevealRecitation: vi.fn(),
    onAssess: vi.fn(),
    lang: "ar",
    ...overrides,
  };
  render(<QuranGuidedMemorizationPanel {...props} />);
  return props;
}

describe("QuranGuidedMemorizationPanel", () => {
  it("lets the learner choose the repeat scope and count", () => {
    const props = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "تكرار النطاق 1–7" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));

    expect(props.onRepeatScopeChange).toHaveBeenCalledWith("range");
    expect(props.onRepeatCountChange).toHaveBeenCalledWith(5);
  });

  it("supports returning from assessment to the linking step", () => {
    const props = renderPanel({ stage: 5 });

    fireEvent.click(screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }));

    expect(props.onStageChange).toHaveBeenCalledWith(4);
  });
});