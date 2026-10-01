// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import WorksheetPrint, { type WorksheetData } from "./worksheet-print";

const mocks = vi.hoisted(() => ({
  setLocation: vi.fn(),
  downloadVisual: vi.fn(),
  downloadEditable: vi.fn(),
  pdf: vi.fn(),
}));

vi.mock("wouter", () => ({
  useParams: () => ({ id: "42" }),
  useLocation: () => ["/teacher/worksheets/42/print", mocks.setLocation],
}));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en", dir: "ltr" }) }));
vi.mock("@/lib/nav-history", () => ({ useSmartBack: () => mocks.setLocation }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/print-export", () => ({
  downloadAsWord: mocks.downloadEditable,
  printToPdf: mocks.pdf,
}));
vi.mock("@/lib/worksheet-word-visual", () => ({
  downloadVisualWorksheetWord: mocks.downloadVisual,
  VisualWordExportError: class VisualWordExportError extends Error {},
}));
vi.mock("@/lib/use-worksheet-preview", () => ({
  useWorksheetPreview: () => ({ current: null }),
}));
vi.mock("@/pages/teacher/worksheet-canvas-types", () => ({
  CanvasLayerRenderer: () => null,
}));
vi.mock("react-qr-code", () => ({ default: () => null }));
vi.mock("@/components/math-text", () => ({
  MathText: ({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) => (
    <span className={className} style={style}>{text}</span>
  ),
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children, onSelect, disabled, ...props
  }: { children: ReactNode; onSelect?: (event: MouseEvent) => void; disabled?: boolean; [key: string]: unknown }) => (
    <button type="button" disabled={disabled} onClick={event => onSelect?.(event)} {...props}>{children}</button>
  ),
}));

const originalWorksheet: WorksheetData = {
  id: 42,
  title: "Fractions",
  language: "en",
  gradeLevel: "5",
  subject: "Math",
  isOwner: true,
  questions: [{
    id: "q1",
    type: "mcq",
    prompt: "Choose the correct fraction",
    options: ["One half", "One third"],
    correctIndex: 0,
  }],
  settings: {
    columns: 1,
    fontFamily: "default",
    fontSizePt: 12,
    showWatermark: false,
    includeName: true,
    includeDate: true,
    includeClass: true,
    includeAnswerKey: false,
    customFields: [],
  },
};

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function setupRoute(
  worksheet: WorksheetData = originalWorksheet,
  put: (url: RequestInfo | URL, init?: RequestInit) => Promise<Response> = async () => response(worksheet),
) {
  const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PUT") return put(url, init);
    return Promise.resolve(response(worksheet));
  });
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<WorksheetPrint />);
  return { ...view, fetchMock };
}

function openInfoSection() {
  if (!screen.queryByTestId("input-ws-title")) fireEvent.click(screen.getByTestId("tab-format-info"));
}

async function openHeaderPanel() {
  await waitFor(() => expect(screen.getByTestId("tab-format-info")).toBeTruthy());
  expect(screen.queryByText("Header & format")).toBeNull();
}

function editablePrompt(container: HTMLElement) {
  const prompt = container.querySelector<HTMLElement>("#ws-printable-root [contenteditable='true']");
  if (!prompt) throw new Error("Expected an inline-editable worksheet prompt");
  return prompt;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false, media: "", onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  mocks.setLocation.mockClear();
  mocks.downloadVisual.mockReset().mockResolvedValue(undefined);
  mocks.downloadEditable.mockReset().mockResolvedValue(undefined);
  mocks.pdf.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("saved worksheet unified print editor", () => {
  it("holds one export lock and freezes modes, navigation and live edits until PDF or Word finishes", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();
    let finishPdf!: () => void;
    let finishWord!: () => void;
    mocks.pdf.mockImplementation(() => new Promise<void>(resolve => { finishPdf = resolve; }));
    mocks.downloadVisual.mockImplementation(() => new Promise<void>(resolve => { finishWord = resolve; }));

    fireEvent.click(screen.getByTestId("btn-pdf-export"));
    expect(mocks.pdf).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId("btn-word-export") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-worksheet-mode-preview") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("#ws-printable-root")?.closest("[inert]")).not.toBeNull();
    expect(screen.getByTestId("panel-worksheet-format").closest("[inert]")).not.toBeNull();
    fireEvent.click(screen.getByTestId("word-export-visual"));
    fireEvent.click(screen.getByTestId("button-worksheet-mode-preview"));
    expect(mocks.downloadVisual).not.toHaveBeenCalled();
    expect(screen.getByTestId("button-worksheet-mode-edit").getAttribute("aria-pressed")).toBe("true");

    await act(async () => { finishPdf(); });
    fireEvent.click(screen.getByTestId("word-export-visual"));
    expect(mocks.downloadVisual).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId("btn-pdf-export") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("button-worksheet-mode-edit") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("btn-pdf-export"));
    expect(mocks.pdf).toHaveBeenCalledTimes(1);
    await act(async () => { finishWord(); });
    expect((screen.getByTestId("btn-pdf-export") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("button-worksheet-mode-preview") as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector("#ws-printable-root")?.closest("[inert]")).toBeNull();
  });
  it("opens directly in editing and switches to a clean preview without losing an uncommitted draft", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();
    expect(screen.getByTestId("button-worksheet-mode-edit").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByTestId("panel-worksheet-format")).toHaveLength(1);
    expect(screen.queryByTestId("button-toggle-edit-mode")).toBeNull();

    const prompt = editablePrompt(container);
    act(() => prompt.focus());
    prompt.textContent = "Draft preserved across preview";
    fireEvent.input(prompt);
    fireEvent.click(screen.getByTestId("button-worksheet-mode-preview"));
    expect(screen.getByTestId("button-worksheet-mode-preview").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("#ws-printable-root [contenteditable='true']")).toBeNull();
    expect(screen.queryByTestId("toolbar-question-formatting")).toBeNull();
    expect(screen.queryByTestId("hint-edit-first-use")).toBeNull();
    expect(screen.queryAllByTestId(/button-edit-question-/)).toHaveLength(0);
    expect(screen.getByTestId("panel-worksheet-format").closest("[hidden]")).not.toBeNull();
    expect(container.querySelector("#ws-printable-root")?.textContent).toContain("Draft preserved across preview");

    fireEvent.click(container.querySelector("#ws-printable-root .ws-q-prompt")!);
    expect(container.querySelector("#ws-printable-root [contenteditable='true']")).toBeNull();
    expect(screen.getByTestId("button-worksheet-mode-preview").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("button-worksheet-mode-edit"));
    expect(editablePrompt(container).textContent).toBe("Draft preserved across preview");
    expect(document.querySelectorAll("#ws-printable-root")).toHaveLength(1);
  });
  it("updates the live preview from header and design controls without navigating away", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();

    fireEvent.click(screen.getByTestId("tab-format-header"));
    fireEvent.change(screen.getByTestId("input-ws-school"), { target: { value: "Northside Academy" } });
    expect(container.querySelector("#ws-printable-root")?.textContent).toContain("Northside Academy");

    fireEvent.click(screen.getByTestId("tab-format-design"));
    fireEvent.change(screen.getByTestId("select-ws-font"), { target: { value: "georgia" } });
    expect(Array.from(document.querySelectorAll("style")).some(style => style.textContent?.includes("Georgia"))).toBe(true);
    expect(mocks.setLocation).not.toHaveBeenCalled();
  });

  it("saves the latest header, inline question text, and formatting change on the immediate final Save", async () => {
    let putBody: Record<string, any> | undefined;
    const { container } = setupRoute(originalWorksheet, async (_url, init) => {
      putBody = JSON.parse(String(init?.body));
      return response(originalWorksheet);
    });
    await openHeaderPanel();

    fireEvent.click(screen.getByTestId("tab-format-design"));
    fireEvent.change(screen.getByTestId("select-ws-font"), { target: { value: "georgia" } });
    openInfoSection();
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "Fractions — latest" } });

    expect(screen.getByTestId("button-worksheet-mode-edit").getAttribute("aria-pressed")).toBe("true");
    const prompt = editablePrompt(container);
    fireEvent.focus(prompt);
    prompt.textContent = "Latest inline question";
    fireEvent.input(prompt);
    fireEvent.blur(prompt);
    fireEvent.click(await screen.findByTestId("button-toggle-bold"));

    fireEvent.click(screen.getByTestId("btn-save-worksheet"));
    await waitFor(() => expect(putBody).toBeDefined());
    expect(putBody).toMatchObject({
      title: "Fractions — latest",
      questions: [{ id: "q1", prompt: "Latest inline question" }],
      settings: {
        fontFamily: "georgia",
        questionStyles: [{ questionId: "q1", fields: [{ key: "prompt", bold: true }] }],
      },
    });
  });

  it("keeps a draft after PUT failure and retries with the same current settings", async () => {
    const bodies: Record<string, any>[] = [];
    const { container } = setupRoute(originalWorksheet, async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return bodies.length === 1
        ? response({ message: "Temporary save failure" }, false)
        : response(originalWorksheet);
    });
    await openHeaderPanel();
    fireEvent.click(screen.getByTestId("tab-format-header"));
    fireEvent.change(screen.getByTestId("input-ws-school"), { target: { value: "Draft Academy" } });

    fireEvent.click(screen.getByTestId("btn-save-worksheet"));
    expect((await screen.findByRole("alert")).textContent).toContain("Temporary save failure");
    expect(container.querySelector("#ws-printable-root")?.textContent).toContain("Draft Academy");

    fireEvent.click(screen.getByTestId("btn-retry-save"));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1].settings.schoolName).toBe("Draft Academy");
    expect(container.querySelector("#ws-printable-root")?.textContent).toContain("Draft Academy");
  });

  it("preserves in-progress inline question text when a header setting rerenders the editor", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();

    expect(screen.getByTestId("button-worksheet-mode-edit").getAttribute("aria-pressed")).toBe("true");
    const prompt = editablePrompt(container);
    fireEvent.focus(prompt);
    prompt.textContent = "Uncommitted question text";
    fireEvent.input(prompt);

    fireEvent.click(screen.getByTestId("tab-format-header"));
    fireEvent.change(screen.getByTestId("input-ws-school"), { target: { value: "Updated header" } });
    expect(prompt.textContent).toBe("Uncommitted question text");
    expect(container.querySelector("#ws-printable-root")?.textContent).toContain("Updated header");
  });

  it("exports the current title and inline draft rather than the loaded worksheet values", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();
    openInfoSection();
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "Current export title" } });

    expect(screen.getByTestId("button-worksheet-mode-edit").getAttribute("aria-pressed")).toBe("true");
    const prompt = editablePrompt(container);
    fireEvent.focus(prompt);
    prompt.textContent = "Question changed for export";
    fireEvent.input(prompt);
    fireEvent.click(screen.getByTestId("word-export-visual"));

    await waitFor(() => expect(mocks.downloadVisual).toHaveBeenCalledTimes(1));
    const exportArgs = mocks.downloadVisual.mock.calls[0][0];
    expect(exportArgs.title).toBe("Current export title");
    expect(exportArgs.element.textContent).toContain("Question changed for export");
  });

  it("does not expose editing controls to a non-owner", async () => {
    setupRoute({ ...originalWorksheet, isOwner: false });

    await waitFor(() => expect(document.getElementById("ws-printable-root")).toBeTruthy());
    expect(screen.queryByTestId("btn-toggle-format-panel")).toBeNull();
    expect(screen.queryByTestId("btn-save-worksheet")).toBeNull();
    expect(screen.queryByText("Edit worksheet")).toBeNull();
    expect(screen.queryByTestId("button-worksheet-mode-edit")).toBeNull();
    expect(document.querySelector("#ws-printable-root [contenteditable='true']")).toBeNull();
  });

  it.each(["Auto layout", "Question type conversion", "Question-style reset"])(
    "makes %s a saved draft and routes its edit-strip Save through PUT",
    async action => {
      const initial: WorksheetData = action === "Auto layout"
        ? { ...originalWorksheet, settings: { ...originalWorksheet.settings, pageBreaks: ["q1"] } }
        : action === "Question-style reset"
          ? {
            ...originalWorksheet,
            settings: {
              ...originalWorksheet.settings,
              questionStyles: [{ questionId: "q1", choiceColumns: 1, fields: [{ key: "prompt", bold: true }] }],
            },
          }
          : originalWorksheet;
      let putBody: Record<string, any> | undefined;
      const { container } = setupRoute(initial, async (_url, init) => {
        putBody = JSON.parse(String(init?.body));
        return response(initial);
      });
      await openHeaderPanel();

      if (action === "Auto layout") {
        fireEvent.click(screen.getByText("Auto layout"));
      } else {
        const prompt = editablePrompt(container);
        fireEvent.focus(prompt);
        expect(screen.queryByRole("combobox", { name: "Change question type" })).toBeNull();
        fireEvent.click(screen.getByTestId("button-toggle-question-details"));
        if (action === "Question type conversion") {
          fireEvent.change(screen.getByRole("combobox", { name: "Change question type" }), {
            target: { value: "short_answer" },
          });
        } else {
          fireEvent.click(screen.getByTestId("button-reset-question-formatting"));
        }
      }

      const parentSave = screen.getByTestId("btn-save-worksheet") as HTMLButtonElement;
      await waitFor(() => expect(parentSave.disabled).toBe(false));
      expect(screen.queryByTestId("button-strip-save")).toBeNull();
      fireEvent.click(parentSave);
      await waitFor(() => expect(putBody).toBeDefined());

      if (action === "Auto layout") expect(putBody?.settings.pageBreaks).toEqual([]);
      if (action === "Question type conversion") expect(putBody?.questions[0].type).toBe("short_answer");
      if (action === "Question-style reset") expect(putBody?.settings.questionStyles).toEqual([]);
    },
  );

  it("discards floating-editor changes back to the last saved worksheet baseline", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();
    openInfoSection();
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "Unsaved title" } });
    expect(screen.getByTestId("button-worksheet-mode-edit").getAttribute("aria-pressed")).toBe("true");
    const prompt = editablePrompt(container);
    fireEvent.focus(prompt);
    prompt.textContent = "Unsaved question text";
    fireEvent.input(prompt);
    fireEvent.blur(prompt);

    fireEvent.click(screen.getByText("Discard"));
    await waitFor(() => {
      expect(container.querySelector("#ws-printable-root")?.textContent).toContain("Choose the correct fraction");
      expect(container.querySelector("#ws-printable-root")?.textContent).not.toContain("Unsaved question text");
    });
    expect((screen.getByTestId("input-ws-title") as HTMLInputElement).value).toBe("Fractions");
    expect((screen.getByTestId("btn-save-worksheet") as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not navigate after a delayed Save & leave if another draft edit arrives meanwhile", async () => {
    let resolvePut: ((value: Response) => void) | undefined;
    const pendingPut = new Promise<Response>(resolve => { resolvePut = resolve; });
    const { fetchMock } = setupRoute(originalWorksheet, async () => pendingPut);
    await openHeaderPanel();
    openInfoSection();
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "First draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByTestId("btn-save-leave"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    openInfoSection();
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "Newer draft" } });
    resolvePut?.(response(originalWorksheet));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((screen.getByTestId("input-ws-title") as HTMLInputElement).value).toBe("Newer draft");
    expect(mocks.setLocation).not.toHaveBeenCalled();
  });

  it("does not honor a canceled leave intent when an in-flight Save & leave later resolves", async () => {
    let resolvePut: ((value: Response) => void) | undefined;
    const pendingPut = new Promise<Response>(resolve => { resolvePut = resolve; });
    const { fetchMock } = setupRoute(originalWorksheet, async () => pendingPut);
    await openHeaderPanel();
    openInfoSection();
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: "Draft to save" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("alertdialog");

    fireEvent.click(screen.getByTestId("btn-save-leave"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    const stay = screen.getByRole("button", { name: "Stay" }) as HTMLButtonElement;
    const cancellationAvailable = !stay.disabled;
    if (cancellationAvailable) fireEvent.click(stay);
    resolvePut?.(response(originalWorksheet));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(cancellationAvailable).toBe(true);
    expect(mocks.setLocation).not.toHaveBeenCalled();
  });
});
describe("worksheet editor chrome", () => {
  it("has no floating edit pill and offers a dismissible first-use hint plus per-question pencil", async () => {
    localStorage.removeItem("hasad:ws:edit-hint-seen");
    const { container } = setupRoute();
    await openHeaderPanel();
    expect(container.querySelector(".ws-edit-tools")).toBeNull();
    expect(screen.getByTestId("hint-edit-first-use")).toBeTruthy();
    expect(screen.getAllByTestId(/button-edit-question-/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("button-dismiss-edit-hint"));
    expect(screen.queryByTestId("hint-edit-first-use")).toBeNull();
    expect(localStorage.getItem("hasad:ws:edit-hint-seen")).toBe("1");
    fireEvent.click(screen.getAllByTestId(/button-edit-question-/)[0]);
    expect(screen.getByTestId("toolbar-question-formatting")).toBeTruthy();
  });

  it("enters edit mode by tapping a question's text directly, and keeps a single Save", async () => {
    const { container } = setupRoute();
    await openHeaderPanel();
    const block = container.querySelector<HTMLElement>("#ws-printable-root .ws-q-prompt");
    if (!block) throw new Error("Expected a question prompt");
    expect(screen.queryByTestId("toolbar-question-formatting")).toBeNull();
    fireEvent.click(block);
    expect(screen.getByTestId("toolbar-question-formatting")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: "Save", exact: true })).toHaveLength(0);
  });
});

describe("classic header layout", () => {
  const withSettings = (patch: Record<string, unknown>): WorksheetData => ({
    ...originalWorksheet,
    settings: { ...originalWorksheet.settings, schoolName: "", section: "", teacherName: "", ...patch },
  });

  it("gives a long title the full width when there is no identity, logo or custom field", async () => {
    const { container } = setupRoute(withSettings({}));
    await openHeaderPanel();
    expect(container.querySelector("#ws-printable-root .ws-headrow-title-only")).not.toBeNull();
  });

  it("keeps the identity columns when a school name is set", async () => {
    const { container } = setupRoute(withSettings({ schoolName: "Al Noor School" }));
    await openHeaderPanel();
    expect(container.querySelector("#ws-printable-root .ws-headrow")).not.toBeNull();
    expect(container.querySelector("#ws-printable-root .ws-headrow-title-only")).toBeNull();
  });

  it("re-evaluates the header when the title changes through the canonical draft", async () => {
    const { container } = setupRoute(withSettings({}));
    await openHeaderPanel();
    if (!screen.queryByTestId("input-ws-title")) fireEvent.click(screen.getByTestId("tab-format-info"));
    const longTitle = "A very long worksheet title about adding and comparing unlike fractions in everyday life";
    fireEvent.change(screen.getByTestId("input-ws-title"), { target: { value: longTitle } });
    await waitFor(() => expect(container.querySelector("#ws-printable-root")?.textContent).toContain(longTitle));
    expect(container.querySelector("#ws-printable-root .ws-headrow-title-only")).not.toBeNull();
  });
});
