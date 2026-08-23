import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const apiClient = vi.hoisted(() => ({
  useGetCurrentTeacher: vi.fn(),
  useListAssignments: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => apiClient);
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "en" }),
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

import { UnifiedQuestionSourceFlow } from "./unified-question-source-flow";

const ASSIGNMENTS = [
  { id: 101, title: "Assignment A", questionCount: 2 },
  { id: 202, title: "Assignment B", questionCount: 2 },
  { id: 303, title: "Assignment C", questionCount: 2 },
];

const assignmentQuestions = (prefix: string) => ({
  questions: [1, 2].map((number) => ({
    id: number,
    questionType: "mcq",
    text: `${prefix} question ${number}`,
    optionA: "A",
    optionB: "B",
    optionC: "C",
    optionD: "D",
    correctAnswer: "A",
  })),
});

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

function buttonContaining(text: string) {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement;
}

async function click(button: HTMLButtonElement) {
  expect(button).toBeTruthy();
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("UnifiedQuestionSourceFlow assignment selection", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    apiClient.useGetCurrentTeacher.mockReturnValue({ data: { id: 1 } });
    apiClient.useListAssignments.mockReturnValue({ data: ASSIGNMENTS, isLoading: false });
    toast.error.mockReset();
    toast.success.mockReset();

    fetchMock = vi.fn((url: string) => {
      if (url.endsWith("/api/assignments/101")) {
        return Promise.resolve({ ok: true, json: async () => assignmentQuestions("A") });
      }
      if (url.endsWith("/api/assignments/202")) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      if (url.endsWith("/api/assignments/303")) {
        return Promise.resolve({ ok: true, json: async () => assignmentQuestions("C") });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("does not reuse a previous assignment after a later selection fails, then recovers for a valid selection", async () => {
    const onComplete = vi.fn();
    await act(async () => {
      root.render(
        <UnifiedQuestionSourceFlow
          gameTitle="Test game"
          gameDescription="Test description"
          gameIcon={null}
          minQuestions={2}
          maxQuestions={20}
          onComplete={onComplete}
        />,
      );
    });

    await click(buttonContaining("From an assignment"));
    await click(buttonContaining("Assignment A"));

    expect(buttonContaining("Continue").disabled).toBe(false);

    await click(buttonContaining("Assignment B"));

    expect(buttonContaining("Continue").disabled).toBe(true);
    await click(buttonContaining("Continue"));
    expect(onComplete).not.toHaveBeenCalled();

    await click(buttonContaining("Assignment C"));

    expect(buttonContaining("Continue").disabled).toBe(false);
    await click(buttonContaining("Continue"));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      questions: [
        { text: "C question 1", options: ["A", "B", "C", "D"], correct: 0, imageUrl: null },
        { text: "C question 2", options: ["A", "B", "C", "D"], correct: 0, imageUrl: null },
      ],
      sourceTitle: "Assignment C",
      source: "assignment",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/assignments/101", { credentials: "include" });
    expect(fetchMock).toHaveBeenCalledWith("/api/assignments/202", { credentials: "include" });
    expect(fetchMock).toHaveBeenCalledWith("/api/assignments/303", { credentials: "include" });
  });

  it("reveals the fixed continue card when an Escape Room assignment is ready", async () => {
    const onComplete = vi.fn();
    await act(async () => {
      root.render(
        <UnifiedQuestionSourceFlow
          gameTitle="Escape Room"
          gameDescription="Test description"
          gameIcon={null}
          minQuestions={2}
          maxQuestions={20}
          floatingAssignmentContinue
          onComplete={onComplete}
        />,
      );
    });

    await click(buttonContaining("From an assignment"));
    await click(buttonContaining("Assignment A"));

    const floatingCard = container.querySelector(".fixed");
    expect(floatingCard).toBeTruthy();
    expect(floatingCard?.textContent).toContain("Assignment A");
    expect(floatingCard?.textContent).toContain("Questions are ready");
    expect(buttonContaining("Continue").disabled).toBe(false);
  });
});