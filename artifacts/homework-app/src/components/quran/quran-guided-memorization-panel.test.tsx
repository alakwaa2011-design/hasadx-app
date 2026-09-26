import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuranGuidedMemorizationPanel } from "./quran-guided-memorization-panel";

function renderPanel(overrides: Partial<React.ComponentProps<typeof QuranGuidedMemorizationPanel>> = {}) {
  const props: React.ComponentProps<typeof QuranGuidedMemorizationPanel> = {
    open: true,
    stage: 0,
    surahName: "الفاتحة",
    ayahNumber: 1,
    isPlaying: false,
    repeatCount: 3,
    recitationRevealed: false,
    onClose: vi.fn(),
    onStageChange: vi.fn(),
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

afterEach(cleanup);

describe("QuranGuidedMemorizationPanel", () => {
  it("lets the learner choose the ayah repeat count without showing a range control", () => {
    const props = renderPanel();

    expect(screen.queryByRole("button", { name: /تكرار النطاق/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "5" }));

    expect(props.onRepeatCountChange).toHaveBeenCalledWith(5);
  });

  it("uses the stage icons for direct navigation", () => {
    const props = renderPanel({ stage: 5 });

    fireEvent.click(screen.getByRole("button", { name: "الانتقال إلى خطوة اربط" }));

    expect(props.onStageChange).toHaveBeenCalledWith(4);
  });

  it("leaves the audio dock uncovered and limits its height when the dock is visible", () => {
    renderPanel({ dockHeight: 180 });
    const panel = screen.getByTestId("quran-guided-memorization-panel");

    expect(panel.style.bottom).toBe("calc(180px + 0.75rem)");
    expect(panel.style.maxHeight).toContain("100dvh - 180px");
  });
});