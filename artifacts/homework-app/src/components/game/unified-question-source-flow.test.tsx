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

const credits = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

const savedGames = vi.hoisted(() => ({
  getSavedGameActivity: vi.fn(),
  listSavedGameActivities: vi.fn(),
  normalizeSavedGameQuestions: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => apiClient);
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => credits.refresh,
}));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "en" }),
}));
vi.mock("@/lib/saved-game-activities", () => savedGames);
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
let currentTeacher: { id: number } | null;

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
    currentTeacher = { id: 1 };
    apiClient.useGetCurrentTeacher.mockImplementation(() => ({ data: currentTeacher }));
    apiClient.useListAssignments.mockReturnValue({ data: ASSIGNMENTS, isLoading: false });
    toast.error.mockReset();
    toast.success.mockReset();
    credits.refresh.mockReset();
    savedGames.getSavedGameActivity.mockReset();
    savedGames.listSavedGameActivities.mockReset();
    savedGames.normalizeSavedGameQuestions.mockReset();
    window.history.replaceState({}, "", "/");

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

  it("returns saved-game metadata and settings for a saved deep link", async () => {
    const activity = {
      id: 44,
      title: "Saved Rocket",
      gameType: "rocket",
      settings: { duration: 30, totalDurationSecs: 600 },
      questions: [],
    };
    savedGames.getSavedGameActivity.mockResolvedValue(activity);
    savedGames.normalizeSavedGameQuestions.mockReturnValue([
      { text: "Question", options: ["A", "B", "C", "D"], correct: 0 },
    ]);
    window.history.replaceState({}, "", "/game/rocket/create?savedGameId=44");
    const onComplete = vi.fn();

    await act(async () => {
      root.render(
        <UnifiedQuestionSourceFlow
          gameTitle="Rocket"
          gameDescription="Test description"
          gameIcon={null}
          minQuestions={1}
          maxQuestions={20}
          onComplete={onComplete}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onComplete).toHaveBeenCalledWith({
      questions: [{ text: "Question", options: ["A", "B", "C", "D"], correct: 0 }],
      sourceTitle: "Saved Rocket",
      source: "saved",
      savedActivity: activity,
    });
  });

  it("extracts supported questions from the selected library file without dropping images or short option lists", async () => {
    const onComplete = vi.fn();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/library/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 7, name: "Science.pdf", fileType: "application/pdf", source: "upload", objectPath: "/objects/science.pdf" },
            { id: 8, name: "Website", fileType: "link", source: "link", objectPath: null },
          ],
        });
      }
      if (url.endsWith("/api/library/files/7/extract-questions")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            questions: [
              {
                questionType: "mcq",
                text: "Which planet is red?",
                optionA: "Mars",
                optionB: "Venus",
                optionC: "",
                optionD: "",
                correctAnswer: "A",
                imageUrl: "/objects/mars.png",
              },
              {
                questionType: "true_false",
                text: "Earth is a planet.",
                correctAnswer: "true",
                imageUrl: null,
              },
            ],
          }),
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => {
      root.render(
        <UnifiedQuestionSourceFlow
          gameTitle="XO"
          gameDescription="Test description"
          gameIcon={null}
          minQuestions={2}
          maxQuestions={20}
          onComplete={onComplete}
        />,
      );
    });

    await click(buttonContaining("From a file"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await click(buttonContaining("Science.pdf"));
    await click(buttonContaining("Extract and continue"));

    expect(onComplete).toHaveBeenCalledWith({
      questions: [
        {
          text: "Which planet is red?",
          options: ["Mars", "Venus"],
          correct: 0,
          imageUrl: "/objects/mars.png",
        },
        {
          text: "Earth is a planet.",
          options: ["True", "False"],
          correct: 0,
          type: "true_false",
          imageUrl: null,
        },
      ],
      sourceTitle: "Science.pdf",
      source: "file",
    });
    expect(credits.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected file and settings available when extraction fails", async () => {
    const onComplete = vi.fn();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/library/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 7, name: "Science.pdf", fileType: "application/pdf", source: "upload", objectPath: "/objects/science.pdf" },
          ],
        });
      }
      if (url.endsWith("/api/library/files/7/extract-questions")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: "Readable extraction error" }),
          clone() { return this; },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => {
      root.render(
        <UnifiedQuestionSourceFlow
          gameTitle="XO"
          gameDescription="Test description"
          gameIcon={null}
          minQuestions={2}
          maxQuestions={20}
          onComplete={onComplete}
        />,
      );
    });

    await click(buttonContaining("From a file"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await click(buttonContaining("Science.pdf"));
    await click(buttonContaining("Extract and continue"));

    expect(onComplete).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Readable extraction error");
    expect(buttonContaining("Science.pdf")).toBeTruthy();
    expect(buttonContaining("Extract and continue").disabled).toBe(false);
    expect(credits.refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores an extraction response after the teacher leaves the file source", async () => {
    const onComplete = vi.fn();
    let resolveExtraction: ((response: unknown) => void) | undefined;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/library/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 7, name: "Science.pdf", fileType: "application/pdf", source: "upload", objectPath: "/objects/science.pdf" },
          ],
        });
      }
      if (url.endsWith("/api/library/files/7/extract-questions")) {
        return new Promise((resolve) => {
          resolveExtraction = resolve;
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await act(async () => {
      root.render(
        <UnifiedQuestionSourceFlow
          gameTitle="XO"
          gameDescription="Test description"
          gameIcon={null}
          minQuestions={2}
          maxQuestions={20}
          onComplete={onComplete}
        />,
      );
    });
    await click(buttonContaining("From a file"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await click(buttonContaining("Science.pdf"));
    await click(buttonContaining("Extract and continue"));
    await click(container.querySelector('[data-testid="button-back-question-source"]') as HTMLButtonElement);

    await act(async () => {
      resolveExtraction?.({
        ok: true,
        json: async () => ({
          questions: [
            { questionType: "mcq", text: "Q1", optionA: "A", optionB: "B", correctAnswer: "A" },
            { questionType: "mcq", text: "Q2", optionA: "A", optionB: "B", correctAnswer: "A" },
          ],
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(buttonContaining("From a file")).toBeTruthy();
  });

  it("clears a previous teacher's files when the authenticated teacher changes", async () => {
    const onComplete = vi.fn();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/library/files")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: currentTeacher?.id === 1 ? 7 : 9,
              name: currentTeacher?.id === 1 ? "Teacher A.pdf" : "Teacher B.pdf",
              fileType: "application/pdf",
              source: "upload",
              objectPath: "/objects/file.pdf",
            },
          ],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const renderFlow = () => (
      <UnifiedQuestionSourceFlow
        gameTitle="XO"
        gameDescription="Test description"
        gameIcon={null}
        minQuestions={2}
        maxQuestions={20}
        onComplete={onComplete}
      />
    );
    await act(async () => {
      root.render(renderFlow());
    });
    await click(buttonContaining("From a file"));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Teacher A.pdf");

    currentTeacher = { id: 2 };
    await act(async () => {
      root.render(renderFlow());
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Teacher A.pdf");
    expect(container.textContent).toContain("Teacher B.pdf");
  });
});