import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const navigation = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/create", navigation],
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, element: string) => {
      const MotionElement = ({ children, ...props }: any) => {
        const Tag = element as keyof React.JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      };
      return MotionElement;
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => vi.fn(),
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/ui/sonner", () => ({ toast }));

vi.mock("@/pages/teacher/worksheet-print", () => ({
  WorksheetPrintView: () => null,
}));
vi.mock("@/pages/teacher/worksheet-canvas-editor", () => ({
  default: () => null,
}));
vi.mock("@/lib/print-export", () => ({
  downloadAsWord: vi.fn(),
  printToPdf: vi.fn(),
}));

import WorksheetCreate from "./worksheet-create";
import LessonPlanCreate from "./lesson-plan-create";
import SmartBoardNew from "./smart-board-new";

const ENGLISH_TOPIC = "Photosynthesis in plant cells";

const QUESTION = {
  id: "question-1",
  type: "mcq",
  prompt: "Which pigment absorbs light for photosynthesis?",
  options: ["Chlorophyll", "Oxygen", "Water", "Carbon dioxide"],
  correctIndex: 0,
};

const SECTIONS = {
  objectives: ["Explain photosynthesis"],
  materials: ["Plant diagram"],
  vocabulary: [],
  warmUp: { description: "Ask what plants need to grow.", durationMinutes: 5 },
  introduction: { description: "Introduce how plants make food.", durationMinutes: 10 },
  activities: [{ title: "Label the process", description: "Label a plant cell diagram.", durationMinutes: 15 }],
  assessment: { description: "Exit question" },
  closure: { description: "Recap the key inputs and outputs." },
};

const BOARD_PLAN = {
  title: ENGLISH_TOPIC,
  topic: ENGLISH_TOPIC,
  intro: { voiceText: "Today we will learn how plants make food.", boardActions: [] },
  steps: [{
    id: "step-1",
    title: "Light energy",
    voiceText: "Chlorophyll captures light energy.",
    boardActions: [],
  }],
  summary: { voiceText: "Plants use light, water, and carbon dioxide.", boardActions: [] },
  keyPoints: ["Chlorophyll captures light"],
};

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function bodyOf(call: unknown[]) {
  const init = call[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

function findCall(mock: ReturnType<typeof vi.fn>, path: string, method?: string) {
  const call = mock.mock.calls.find(([url, init]) => {
    const endpoint = String(url).split("?")[0];
    return (endpoint === path || endpoint.endsWith(path))
      && (!method || (init as RequestInit | undefined)?.method === method);
  });
  expect(call, `Expected a ${method ?? "request"} to ${path}`).toBeTruthy();
  return call!;
}

function buttonContaining(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.includes(label));
  expect(button, `Expected button containing "${label}"`).toBeTruthy();
  return button!;
}

function setTextValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  navigation.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  toast.warning.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("لغة المحتوى المولّد من واجهة عربية", () => {
  it("يحفظ ورقة عمل إنجليزية باللغة التي حلّها الخادم", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/worksheets/ai/generate")) {
        return response({ questions: [QUESTION], language: "en" });
      }
      if (url.endsWith("/api/worksheets") && init?.method === "POST") {
        return response({ id: 101 }, 201);
      }
      if (url.includes("/api/teacher/grade-levels")) return response([]);
      if (url.includes("/api/auth/me")) return response({ isAdmin: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => { root.render(<WorksheetCreate />); });
    const topicInput = container.querySelector('input[placeholder*="عن ماذا"]') as HTMLInputElement;
    setTextValue(topicInput, ENGLISH_TOPIC);
    await act(async () => { buttonContaining(container, "توليد الأسئلة").click(); });
    await settle();

    const generation = bodyOf(findCall(fetchMock, "/api/worksheets/ai/generate", "POST"));
    const saved = bodyOf(findCall(fetchMock, "/api/worksheets", "POST"));
    expect(generation).toMatchObject({ language: "ar", topic: ENGLISH_TOPIC });
    expect(saved).toMatchObject({
      title: ENGLISH_TOPIC,
      language: "en",
      questions: [expect.objectContaining({ prompt: QUESTION.prompt })],
    });
  });

  it("يحفظ خطة درس إنجليزية باللغة التي حلّها الخادم", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/lesson-plans/ai/generate")) {
        return response({ sections: SECTIONS, language: "en" });
      }
      if (url.endsWith("/api/lesson-plans") && init?.method === "POST") {
        return response({ id: 202 }, 201);
      }
      if (url.includes("/api/auth/me")) return response({ isAdmin: false });
      return response([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => { root.render(<LessonPlanCreate />); });
    setTextValue(
      container.querySelector('[data-testid="input-ai-topic"]') as HTMLInputElement,
      ENGLISH_TOPIC,
    );
    await act(async () => {
      (container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement).click();
    });
    await settle();

    const generation = bodyOf(findCall(fetchMock, "/api/lesson-plans/ai/generate", "POST"));
    const saved = bodyOf(findCall(fetchMock, "/api/lesson-plans", "POST"));
    expect(generation).toMatchObject({ language: "ar", topic: ENGLISH_TOPIC });
    expect(saved).toMatchObject({
      title: ENGLISH_TOPIC,
      language: "en",
      sections: expect.objectContaining({ objectives: SECTIONS.objectives }),
    });
  });

  it("يبقي لغة السبورة الإنجليزية عند الحفظ وعند بدء العرض", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/whiteboard/generate")) {
        return response({ plan: BOARD_PLAN, language: "en" });
      }
      if (url.endsWith("/api/whiteboard/lessons") && init?.method === "POST") {
        return response({ id: 303, createdAt: "2026-08-24T00:00:00.000Z" });
      }
      if (url.endsWith("/api/whiteboard/lessons/303") && init?.method === "PUT") {
        return response({ ok: true });
      }
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => { root.render(<SmartBoardNew />); });
    setTextValue(container.querySelector("textarea") as HTMLTextAreaElement, ENGLISH_TOPIC);
    await act(async () => { buttonContaining(container, "أنشئ خطة الدرس").click(); });
    await settle();

    const generation = bodyOf(findCall(fetchMock, "/api/whiteboard/generate", "POST"));
    const firstSave = bodyOf(findCall(fetchMock, "/api/whiteboard/lessons", "POST"));
    expect(generation).toMatchObject({ language: "ar", topic: ENGLISH_TOPIC });
    expect(firstSave).toMatchObject({ language: "en", topic: ENGLISH_TOPIC });

    await act(async () => {
      (container.querySelector('[data-testid="button-start-smart-board-presentation"]') as HTMLButtonElement).click();
    });
    await settle();

    const presentSave = bodyOf(findCall(fetchMock, "/api/whiteboard/lessons/303", "PUT"));
    expect(presentSave).toMatchObject({ language: "en", topic: ENGLISH_TOPIC });
    expect(navigation).toHaveBeenCalledWith("/teacher/smart-board/present/303");
  });
});