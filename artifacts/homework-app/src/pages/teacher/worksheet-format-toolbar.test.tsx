// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QuestionFormattingToolbar,
  mobileToolbarScrollOffset,
  type Question,
} from "./worksheet-print";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(() => {
  roots.splice(0).forEach(root => {
    act(() => root.unmount());
  });
  document.body.innerHTML = "";
});

function renderToolbar(ar = false) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  const onFieldChange = vi.fn();
  act(() => {
    root.render(
      <QuestionFormattingToolbar
        ar={ar}
        question={{ id: "q1", type: "mcq", prompt: "Question", options: ["A", "B"], correctIndex: 0 } satisfies Question}
        fieldStyle={{ key: "prompt", bold: true, align: "center" }}
        questionStyle={{ questionId: "q1", spacing: "normal", choiceColumns: 1, fields: [] }}
        onFieldChange={onFieldChange}
        onQuestionChange={vi.fn()}
        onResetField={vi.fn()}
        onResetQuestion={vi.fn()}
      />,
    );
  });
  return { host, onFieldChange };
}

describe("worksheet formatting toolbar accessibility", () => {
  it("moves focus through controls with arrows, Home, and End", () => {
    const { host } = renderToolbar();
    const controls = Array.from(host.querySelectorAll<HTMLElement>("button, select, input"));
    controls[0].focus();

    act(() => controls[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    expect(document.activeElement).toBe(controls[1]);

    const endEvent = new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true });
    act(() => controls[1].dispatchEvent(endEvent));
    expect(endEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).not.toBe(controls[1]);

    const resetButton = host.querySelector<HTMLButtonElement>('[data-testid="button-reset-question-formatting"]');
    resetButton?.focus();
    act(() => resetButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
    expect(document.activeElement).toBe(controls[0]);
  });

  it("announces selected states and activates a focused tool", () => {
    const { host, onFieldChange } = renderToolbar();
    const bold = host.querySelector<HTMLButtonElement>('[data-testid="button-toggle-bold"]');
    const center = host.querySelector<HTMLButtonElement>('[data-testid="button-align-center"]');
    expect(bold?.getAttribute("aria-pressed")).toBe("true");
    expect(center?.getAttribute("aria-pressed")).toBe("true");

    act(() => bold?.click());
    expect(onFieldChange).toHaveBeenCalledWith({ bold: false });
  });

  it("calculates enough mobile scroll clearance to keep the field above the toolbar", () => {
    expect(mobileToolbarScrollOffset(720, 650)).toBe(86);
    expect(mobileToolbarScrollOffset(500, 650)).toBe(0);
  });
});