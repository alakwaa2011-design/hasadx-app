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
});