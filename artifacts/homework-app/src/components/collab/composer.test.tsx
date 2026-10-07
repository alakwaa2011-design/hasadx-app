import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CollaborationView } from "@workspace/api-client-react";
import { Composer } from "./composer";
import { draftKey } from "@/lib/collab-draft";

vi.mock("@workspace/api-client-react", () => ({
  useUploadCollaborationImage: () => ({ isPending: false, mutateAsync: vi.fn() }),
  uploadCollaborationImage: vi.fn(),
}));
vi.mock("@/lib/collab", () => ({
  authHeaders: () => ({}), COLORS: { mint: { bg: "#eee", bar: "#333", label: "نعناعي" } },
  errMessage: (e: Error) => e.message, mediaUrl: (u: string) => u,
  newId: () => "stable-composer-request", safeLink: (u: string) => u.startsWith("https://") ? u : null,
  useOnline: () => navigator.onLine,
}));

let sequence = 0;
const board = (): CollaborationView => ({
  id: `composer-test-${++sequence}`, selfId: "student", owner: false,
  settings: { allowImages: true }, columns: [{ id: "main", title: "أفكار" }],
} as CollaborationView);
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function Harness({ b, run }: { b: CollaborationView; run: () => Promise<boolean> }) {
  const [open, setOpen] = useState(true);
  return open ? <Composer id={b.id} b={b} onClose={() => setOpen(false)} run={run} />
    : <button onClick={() => setOpen(true)}>فتح المشاركة</button>;
}

describe("composer draft lifecycle", () => {
  it("clears the draft after confirmed success before opening a blank composer", async () => {
    const b = board();
    const run = vi.fn(async () => true);
    render(<Harness b={b} run={run} />);
    fireEvent.change(screen.getByTestId("input-post-text"), { target: { value: "فكرة محفوظة" } });
    expect(localStorage.getItem(draftKey(b.id, b.selfId))).not.toBeNull();
    fireEvent.click(screen.getByTestId("button-submit-post"));
    await screen.findByRole("button", { name: "فتح المشاركة" });
    expect(localStorage.getItem(draftKey(b.id, b.selfId))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "فتح المشاركة" }));
    expect((screen.getByTestId("input-post-text") as HTMLTextAreaElement).value).toBe("");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("retains the same draft and receipt ID after failed submission and accidental dismissal", async () => {
    const b = board();
    const run = vi.fn(async () => false);
    render(<Harness b={b} run={run} />);
    fireEvent.change(screen.getByTestId("input-post-text"), { target: { value: "لم تُرسل" } });
    fireEvent.click(screen.getByTestId("button-submit-post"));
    await screen.findByRole("alert");
    await waitFor(() => expect((screen.getByTestId("button-submit-post") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "فتح المشاركة" }));
    expect((screen.getByTestId("input-post-text") as HTMLTextAreaElement).value).toBe("لم تُرسل");
    expect(JSON.parse(localStorage.getItem(draftKey(b.id, b.selfId))!).clientId).toBe("stable-composer-request");
  });
  it("does not publish or queue while offline and describes manual retry", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const b = board();
    const run = vi.fn(async () => true);
    render(<Harness b={b} run={run} />);
    fireEvent.change(screen.getByTestId("input-post-text"), { target: { value: "مسودة دون اتصال" } });
    expect((screen.getByTestId("button-submit-post") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("text-composer-offline").textContent).toContain("لن تُرسل المشاركة تلقائياً");
    expect(run).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(draftKey(b.id, b.selfId))!).text).toBe("مسودة دون اتصال");
  });
  it("keeps advanced fields behind options and labels moderated student submit", () => {
    const b = { ...board(), settings: { allowImages: true, moderation: true } } as CollaborationView;
    render(<Harness b={b} run={async () => true} />);
    expect(screen.getByTestId("button-submit-post").textContent).toContain("إرسال للمعلم");
    expect(screen.getByTestId("button-composer-options").getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByPlaceholderText("https://").closest("#composer-advanced")?.hasAttribute("hidden")).toBe(true);
    fireEvent.click(screen.getByTestId("button-composer-options"));
    expect(screen.getByTestId("button-composer-options").getAttribute("aria-expanded")).toBe("true");
  });
  it("uses plain send label when not moderated", () => {
    const b = { ...board(), settings: { allowImages: true, moderation: false } } as CollaborationView;
    render(<Harness b={b} run={async () => true} />);
    expect(screen.getByTestId("button-submit-post").textContent).toContain("إرسال");
    expect(screen.getByTestId("button-submit-post").textContent).not.toContain("للمعلم");
  });
});
