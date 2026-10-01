// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { MouseEvent, ReactNode } from "react";
import WorksheetCreate from "./worksheet-create";

vi.mock("wouter", () => ({ useLocation: () => ["/teacher/worksheets/create", vi.fn()] }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en", dir: "ltr" }) }));
vi.mock("@/lib/nav-history", () => ({ useSmartBack: () => vi.fn() }));
vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui-elements", () => ({
  Card: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => <section {...props}>{children}</section>,
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, ...props }: { children: ReactNode; initial?: unknown; animate?: unknown; exit?: unknown; [key: string]: unknown }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/credits-chip", () => ({ useRefreshCreditsBalance: () => vi.fn() }));
vi.mock("@/lib/client-request-id", () => ({ createClientRequestId: () => "worksheet-test-request" }));
vi.mock("@/lib/credit-aware-fetch", () => ({
  creditAwareFetch: vi.fn(),
  isInsufficientCreditsResponse: () => false,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/pages/teacher/worksheet-print", () => ({ WorksheetPrintView: () => <div data-testid="print-preview-stub" /> }));
vi.mock("@/pages/teacher/worksheet-canvas-editor", () => ({ default: () => null }));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children, onSelect, onClick, disabled, ...props
  }: { children: ReactNode; onSelect?: (event: MouseEvent) => void; onClick?: (event: MouseEvent) => void; disabled?: boolean; [key: string]: unknown }) => (
    <button type="button" disabled={disabled} onClick={event => { onSelect?.(event); onClick?.(event); }} {...props}>{children}</button>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => [],
  } as Response)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("worksheet creator format overlay", () => {
  it("keeps controlled title and design edits after closing the preview overlay", () => {
    render(<WorksheetCreate />);

    expect(screen.queryByTestId("input-ws-title")).toBeNull();
    fireEvent.click(screen.getByTestId("tab-format-info"));
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "Overlay worksheet" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Question" }));
    fireEvent.click(screen.getByRole("button", { name: "Short Answer" }));
    fireEvent.change(screen.getByPlaceholderText("Question text"), { target: { value: "Explain your answer" } });

    fireEvent.click(screen.getByTestId("button-enlarge-paper"));
    const closeButton = screen.getByTestId("button-close-preview");
    const overlay = closeButton.closest(".fixed");
    if (!overlay) throw new Error("Expected the creator preview overlay");

    const overlayPanel = within(overlay);
    fireEvent.click(overlayPanel.getByTestId("tab-format-info"));
    fireEvent.change(overlayPanel.getByTestId("input-ws-title"), { target: { value: "Edited in preview" } });
    fireEvent.click(overlayPanel.getByTestId("tab-format-design"));
    fireEvent.change(overlayPanel.getByTestId("select-ws-font"), { target: { value: "georgia" } });
    fireEvent.click(closeButton);

    expect(document.querySelectorAll("#ws-printable-root").length).toBeLessThanOrEqual(1);
    expect((screen.getByTestId("input-ws-title") as HTMLInputElement).value).toBe("Edited in preview");
    fireEvent.click(screen.getByTestId("tab-format-design"));
    expect((screen.getByTestId("select-ws-font") as HTMLSelectElement).value).toBe("georgia");
  });
});