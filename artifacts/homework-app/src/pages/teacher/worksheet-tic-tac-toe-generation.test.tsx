import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/worksheets/new", vi.fn()],
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

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

const CELLS = Array.from({ length: 9 }, (_, index) => ({
  text: `مهمة تعليمية ${index + 1}`,
  category: ["ارسم", "فسر", "قارن"][index % 3],
  ...(index === 0 ? { imageSuggested: true } : {}),
}));

const BOARD = {
  id: "tic-tac-toe-1",
  type: "tic_tac_toe",
  prompt: "اختر ثلاثة مربعات متصلة",
  cells: CELLS,
};

const OTHER_QUESTION = {
  id: "short-answer-1",
  type: "short_answer",
  prompt: "اشرح دورة الماء",
  answer: "التبخر ثم التكاثف ثم الهطول",
};

const TOOL_PRICE = {
  effectiveCost: 2,
  baseCost: 2,
  isPro: false,
  creditsEnabled: true,
};

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
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
  localStorage.setItem("hasad:worksheet:prefs", JSON.stringify({
    contentLang: "ar",
    aiDifficulty: "medium",
    aiPages: 1,
    aiCounts: {
      mcq: 0,
      true_false: 0,
      short_answer: 0,
      fill_blank: 0,
      matching: 0,
      tic_tac_toe: 0,
    },
  }));
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

describe("توليد لوحة تيك تاك توك من منشئ ورقة العمل", () => {
  it("يرسل لوحة واحدة ويعرض تسع مهام واقتراح الصورة دون اختيارها أو رفعها تلقائيًا", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/worksheets/ai/generate")) {
        return response({ questions: [BOARD], language: "ar" });
      }
      if (url.endsWith("/api/worksheets") && init?.method === "POST") {
        return response({ id: 1094 }, 201);
      }
      if (url.includes("/api/credits/tool-price/worksheet-tic-tac-toe-cell")) {
        return response(TOOL_PRICE);
      }
      if (url.includes("/api/teacher/grade-levels")) return response([]);
      if (url.includes("/api/auth/me")) return response({ isAdmin: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<WorksheetCreate />));
    setTextValue(
      container.querySelector('input[placeholder*="عن ماذا"]') as HTMLInputElement,
      "دورة الماء",
    );

    await act(async () => buttonContaining(container, "إعدادات التوليد المتقدمة").click());
    const ticTacToeLabel = Array.from(container.querySelectorAll("span"))
      .find((span) => span.textContent === "تيك تاك توك");
    expect(ticTacToeLabel).toBeTruthy();
    const stepper = ticTacToeLabel!.parentElement!;
    await act(async () => {
      (Array.from(stepper.querySelectorAll("button"))
        .find((button) => button.textContent === "+") as HTMLButtonElement).click();
    });

    await act(async () => buttonContaining(container, "توليد الأسئلة").click());
    await settle();

    const generationCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/api/worksheets/ai/generate"));
    expect(generationCall).toBeTruthy();
    const generationBody = JSON.parse(String((generationCall![1] as RequestInit).body));
    expect(generationBody.counts).toEqual({
      mcq: 0,
      true_false: 0,
      short_answer: 0,
      fill_blank: 0,
      matching: 0,
      tic_tac_toe: 1,
    });

    expect(container.textContent).toContain("تُفيدها صورة");
    expect(Array.from(container.querySelectorAll("span"))
      .filter((span) => /^المربع \d+$/.test(span.textContent ?? ""))).toHaveLength(9);
    expect(Array.from(container.querySelectorAll('input[type="file"]'))
      .filter((input) => input.getAttribute("accept")?.includes("image/jpeg"))).toHaveLength(9);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(fetchMock.mock.calls.some(([url]) =>
      /upload|image/i.test(String(url)) && !String(url).includes("/ai/generate"))).toBe(false);
  });

  it("يحدّث المربع المطلوب فقط ويحفظ تعديلات المعلم وترتيبه أثناء انتظار الذكاء", async () => {
    let resolveRegeneration!: (value: Response) => void;
    const regenerationResponse = new Promise<Response>((resolve) => {
      resolveRegeneration = resolve;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/worksheets/ai/generate")) {
        return response({ questions: [OTHER_QUESTION, BOARD], language: "ar" });
      }
      if (url.includes("/api/worksheets/ai/regenerate-tic-tac-toe-cell")) {
        return regenerationResponse;
      }
      if (url.endsWith("/api/worksheets") && init?.method === "POST") {
        return response({ id: 1097 }, 201);
      }
      if (url.endsWith("/api/worksheets/1097") && init?.method === "PUT") {
        return response({ id: 1097 });
      }
      if (url.includes("/api/credits/tool-price/worksheet-tic-tac-toe-cell")) {
        return response(TOOL_PRICE);
      }
      if (url.includes("/api/teacher/grade-levels")) return response([]);
      if (url.includes("/api/auth/me")) return response({ isAdmin: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<WorksheetCreate />));
    setTextValue(
      container.querySelector('input[placeholder*="عن ماذا"]') as HTMLInputElement,
      "دورة الماء",
    );
    await act(async () => buttonContaining(container, "إعدادات التوليد المتقدمة").click());
    const ticTacToeLabel = Array.from(container.querySelectorAll("span"))
      .find((span) => span.textContent === "تيك تاك توك")!;
    await act(async () => {
      (Array.from(ticTacToeLabel.parentElement!.querySelectorAll("button"))
        .find((button) => button.textContent === "+") as HTMLButtonElement).click();
    });
    await act(async () => buttonContaining(container, "توليد الأسئلة").click());
    await settle();

    const regenerateButtons = Array.from(container.querySelectorAll("button"))
      .filter((button) => button.textContent?.includes("إعادة توليد"));
    expect(regenerateButtons[0].textContent).toContain("2 نقطة");
    await act(async () => regenerateButtons[0].click());
    await settle();

    const priceCalls = fetchMock.mock.calls
      .map(([url, init], index) => ({ url: String(url), init: init as RequestInit | undefined, index }))
      .filter(({ url }) => url.includes("/api/credits/tool-price/worksheet-tic-tac-toe-cell"));
    const regenerationCallIndex = fetchMock.mock.calls.findIndex(([url]) =>
      String(url).includes("/api/worksheets/ai/regenerate-tic-tac-toe-cell"));
    expect(priceCalls).toHaveLength(2);
    expect(priceCalls[1].index).toBeLessThan(regenerationCallIndex);
    expect(priceCalls[1].init).toMatchObject({ credentials: "include", cache: "no-store" });

    const taskTextareas = Array.from(container.querySelectorAll("textarea"))
      .filter((textarea) => textarea.placeholder.includes("مهمة متنوعة"));
    setTextValue(taskTextareas[1], "تعديل المعلم أثناء الانتظار");
    await act(async () => {
      (container.querySelector('button[title="أسفل"]') as HTMLButtonElement).click();
    });
    expect(taskTextareas[0].value).toBe(CELLS[0].text);
    expect(taskTextareas[1].value).toBe("تعديل المعلم أثناء الانتظار");

    await act(async () => {
      resolveRegeneration(response({
        cell: { text: "مهمة بديلة من الذكاء", category: "حلل" },
      }));
      await regenerationResponse;
    });
    await settle();

    const updatedTaskTextareas = Array.from(container.querySelectorAll("textarea"))
      .filter((textarea) => textarea.placeholder.includes("مهمة متنوعة"));
    expect(updatedTaskTextareas.map((textarea) => textarea.value)).toEqual([
      "مهمة بديلة من الذكاء",
      "تعديل المعلم أثناء الانتظار",
      ...CELLS.slice(2).map((cell) => cell.text),
    ]);
    expect(Array.from(container.querySelectorAll('select[title="تغيير نوع السؤال"]'))
      .map((select) => (select as HTMLSelectElement).value)).toEqual([
        "tic_tac_toe",
        "short_answer",
      ]);

    const regenerationSave = fetchMock.mock.calls.find(([url, init]) =>
      String(url).endsWith("/api/worksheets/1097") && (init as RequestInit)?.method === "PUT");
    expect(regenerationSave).toBeTruthy();
    const savedQuestions = JSON.parse(String((regenerationSave![1] as RequestInit).body)).questions;
    expect(savedQuestions.map((question: { id: string }) => question.id)).toEqual([
      BOARD.id,
      OTHER_QUESTION.id,
    ]);
    const savedBoard = savedQuestions[0];
    expect(savedBoard.cells.map((cell: { text: string }) => cell.text)).toEqual([
      "مهمة بديلة من الذكاء",
      "تعديل المعلم أثناء الانتظار",
      ...CELLS.slice(2).map((cell) => cell.text),
    ]);
  });

  it("يتجاهل رد إعادة التوليد إذا حذف المعلم اللوحة أثناء الانتظار", async () => {
    let resolveRegeneration!: (value: Response) => void;
    const regenerationResponse = new Promise<Response>((resolve) => {
      resolveRegeneration = resolve;
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/worksheets/ai/generate")) {
        return response({ questions: [BOARD], language: "ar" });
      }
      if (url.includes("/api/worksheets/ai/regenerate-tic-tac-toe-cell")) {
        return regenerationResponse;
      }
      if (url.endsWith("/api/worksheets") && init?.method === "POST") {
        return response({ id: 1099 }, 201);
      }
      if (url.endsWith("/api/worksheets/1099") && init?.method === "PUT") {
        return response({ id: 1099 });
      }
      if (url.includes("/api/credits/tool-price/worksheet-tic-tac-toe-cell")) {
        return response(TOOL_PRICE);
      }
      if (url.includes("/api/teacher/grade-levels")) return response([]);
      if (url.includes("/api/auth/me")) return response({ isAdmin: false });
      return response({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(<WorksheetCreate />));
    setTextValue(
      container.querySelector('input[placeholder*="عن ماذا"]') as HTMLInputElement,
      "دورة الماء",
    );
    await act(async () => buttonContaining(container, "إعدادات التوليد المتقدمة").click());
    const ticTacToeLabel = Array.from(container.querySelectorAll("span"))
      .find((span) => span.textContent === "تيك تاك توك")!;
    await act(async () => {
      (Array.from(ticTacToeLabel.parentElement!.querySelectorAll("button"))
        .find((button) => button.textContent === "+") as HTMLButtonElement).click();
    });
    await act(async () => buttonContaining(container, "توليد الأسئلة").click());
    await settle();

    const regenerateButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("إعادة توليد"))!;
    await act(async () => regenerateButton.click());

    const deleteBoardButton = Array.from(container.querySelectorAll('button[title="حذف"]'))
      .find((button) => button.closest(".border-border\\/60")) as HTMLButtonElement;
    expect(deleteBoardButton).toBeTruthy();
    await act(async () => deleteBoardButton.click());
    expect(container.textContent).not.toContain(BOARD.prompt);

    await act(async () => {
      resolveRegeneration(response({
        cell: { text: "مهمة متأخرة من الذكاء", category: "حلل" },
      }));
      await regenerationResponse;
    });
    await settle();

    expect(container.textContent).not.toContain(BOARD.prompt);
    expect(container.textContent).not.toContain("مهمة متأخرة من الذكاء");
    const regenerationSaves = fetchMock.mock.calls.filter(([url, init]) =>
      String(url).endsWith("/api/worksheets/1099") && (init as RequestInit)?.method === "PUT");
    expect(regenerationSaves).toHaveLength(0);
  });
});
