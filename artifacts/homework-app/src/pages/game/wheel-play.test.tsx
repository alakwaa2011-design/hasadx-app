import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("wouter", () => ({
  useParams: () => ({ id: "77" }),
  useLocation: () => ["/game/wheel/play/77", vi.fn()],
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, {
    get: () => ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  }),
}));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en" }) }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("@/lib/game-sounds", () => ({
  playVictoryFanfare: vi.fn(),
  playCorrectSound: vi.fn(),
  playGiftSound: vi.fn(),
  playNotificationSound: vi.fn(),
}));
vi.mock("@/lib/image-url", () => ({ resolveImageUrl: (url: string | null) => url }));

import WheelPlay from "./wheel-play";

const segments = [
  { id: "q1", text: "First question", answer: "Correct", points: 50, kind: "question" as const, color: "#225739" },
  { id: "q2", text: "Second question", answer: "Correct", points: 300, kind: "question" as const, color: "#D9A521" },
];

function makeTemplate(config: Record<string, unknown>) {
  return {
    id: 77,
    title: "Wheel test",
    language: "en" as const,
    segments,
    config: {
      teamCount: 3,
      teamNames: ["Alpha", "Beta", "Gamma"],
      spinSeconds: 3,
      soundOn: false,
      ...config,
    },
  };
}

let container: HTMLDivElement;
let root: Root;

function createRecordingCanvasContext() {
  const labels: { value: string; x: number; y: number }[] = [];
  const stack: { x: number; y: number; rotation: number }[] = [];
  let x = 0;
  let y = 0;
  let rotation = 0;

  const context = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    save: vi.fn(() => stack.push({ x, y, rotation })),
    restore: vi.fn(() => {
      const previous = stack.pop();
      if (previous) ({ x, y, rotation } = previous);
    }),
    translate: vi.fn((nextX: number, nextY: number) => {
      x += nextX * Math.cos(rotation) - nextY * Math.sin(rotation);
      y += nextX * Math.sin(rotation) + nextY * Math.cos(rotation);
    }),
    rotate: vi.fn((nextRotation: number) => { rotation += nextRotation; }),
    fillText: vi.fn((value: string, textX: number, textY: number) => {
      labels.push({
        value,
        x: x + textX * Math.cos(rotation) - textY * Math.sin(rotation),
        y: y + textX * Math.sin(rotation) + textY * Math.cos(rotation),
      });
    }),
    measureText: vi.fn((value: string) => ({ width: value.length * 8 })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  };

  return { context: context as unknown as CanvasRenderingContext2D, labels };
}

function buttonContaining(text: string) {
  return Array.from(document.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

async function renderTemplate(template: ReturnType<typeof makeTemplate>) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => template,
  }));
  await act(async () => {
    root.render(<WheelPlay />);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(3000);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  toast.error.mockReset();
  toast.success.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("WheelPlay turn modes", () => {
  it("keeps a new team-first game's correct-question award restricted to the active team", async () => {
    await renderTemplate(makeTemplate({
      turnMode: "team_first",
      pointsMode: "uniform",
      uniformPoints: 100,
    }));

    expect(container.textContent).toContain("TURN NOW:");
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Additional teams");
    expect(buttonContaining("+50")).toBeFalsy();
    expect(buttonContaining("+100")).toBeFalsy();
    const activeCard = Array.from(container.querySelectorAll('[role="button"]')).find((element) =>
      element.textContent?.includes("Alpha"),
    ) as HTMLElement | undefined;
    expect(activeCard?.textContent).toContain("TURN NOW");
    expect(activeCard?.style.borderWidth).toBe("3px");

    await act(async () => {
      buttonContaining("Spin the Wheel")!.click();
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(container.textContent).toMatch(/(First|Second) question/);
    expect(buttonContaining("Reveal Answer")).toBeTruthy();
    expect(buttonContaining("+100 · Alpha")).toBeTruthy();
    expect(buttonContaining("+100 · Beta")).toBeFalsy();
    await act(async () => buttonContaining("+100 · Alpha")!.click());

    expect(container.textContent).toContain("Points awarded to Alpha");
    expect(toast.success).toHaveBeenCalledWith("+100 to Alpha");
  });

  it("keeps a legacy template on the wheel-first flow", async () => {
    await renderTemplate(makeTemplate({}));

    expect(container.textContent).toContain("Spin the wheel, then choose the team that answers");
    expect(container.textContent).not.toContain("TURN NOW:");
  });

  it("keeps each canvas label in its own wheel segment when text direction flips", async () => {
    const { context, labels } = createRecordingCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    const fourSegments = [
      { id: "top", text: "Top question", answer: "A", points: 50, kind: "question" as const, color: "#225739" },
      { id: "right", text: "Right question", answer: "A", points: 100, kind: "question" as const, color: "#D9A521" },
      { id: "bottom", text: "Bottom question", answer: "A", points: 200, kind: "question" as const, color: "#c9852a" },
      { id: "left", text: "Left question", answer: "A", points: 300, kind: "question" as const, color: "#387f5f" },
    ];

    await renderTemplate({ ...makeTemplate({ turnMode: "team_first" }), segments: fourSegments });

    const canvasCenterX = (container.querySelector("canvas")?.width ?? 0) / 2;
    const leftTitle = labels.find((label) => label.value === "Left question");
    const leftPoints = labels.find((label) => label.value === "300");
    expect(leftTitle?.x).toBeLessThan(canvasCenterX);
    expect(leftPoints).toBeUndefined();
  });
});