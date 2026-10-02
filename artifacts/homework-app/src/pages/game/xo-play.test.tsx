import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  search: "name=Student",
  lang: "ar",
  snapshot: {} as Record<string, any>,
  socket: null as any,
  handlers: new Map<string, Set<(...args: any[]) => void>>(),
  emit: vi.fn(),
  error: vi.fn(),
  back: vi.fn(),
}));
vi.mock("wouter", () => ({ useParams: () => ({ pin: "123456" }), useSearch: () => harness.search, useLocation: () => ["/game/xo/play/123456", harness.back] }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: harness.lang }) }));
vi.mock("@/lib/nav-history", () => ({ useSmartBack: () => harness.back }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: harness.error, success: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/confetti-burst", () => ({ ConfettiBurst: () => null }));
vi.mock("@/components/game-qr-code", () => ({
  QRModalButton: ({ url }: { url: string }) => <button data-testid="qr-link" data-url={url}>QR</button>,
}));
vi.mock("@/lib/use-game-share-url", () => ({
  useGameShareUrl: (url: string) => ({ status: "ready", url, retry: vi.fn() }),
}));
vi.mock("@/lib/game-sounds", () => ({
  getIsMuted: () => true, toggleMute: () => true,
  playCorrectSound: vi.fn(), playWrongSound: vi.fn(), playGameStartSound: vi.fn(),
  playNotificationSound: vi.fn(), playTickSound: vi.fn(), playTimeUpSound: vi.fn(),
  playVictoryFanfare: vi.fn(), startBackgroundBeat: vi.fn(), stopBackgroundBeat: vi.fn(),
}));
vi.mock("@/lib/xo-socket", () => {
  const socket = {
    connected: true,
    on: (event: string, handler: (...args: any[]) => void) => {
      if (!harness.handlers.has(event)) harness.handlers.set(event, new Set());
      harness.handlers.get(event)!.add(handler);
      return socket;
    },
    off: (event: string, handler: (...args: any[]) => void) => {
      harness.handlers.get(event)?.delete(handler);
      return socket;
    },
    timeout: () => socket,
    emit: harness.emit,
    connect: () => { socket.connected = true; return socket; },
    disconnect: () => { socket.connected = false; return socket; },
  };
  harness.socket = socket;
  return { getXoSocket: () => socket };
});

import XoPlay from "./xo-play";

function pushState(changes: Record<string, any>) {
  harness.snapshot = { ...harness.snapshot, ...changes };
  act(() => harness.handlers.get("xo:state")?.forEach(h => h(harness.snapshot)));
}
function answerButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /^أ\s*صحيح$/ }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.handlers.clear();
  localStorage.clear();
  sessionStorage.clear();
  harness.socket.connected = true;
  harness.search = "name=Student";
  harness.lang = "ar";
  harness.snapshot = {
    board: Array(9).fill(null), turn: "x", turnId: 1, phase: "question", started: true,
    activePlayerId: "me", placementPlayerId: null, timerExpiresAt: Date.now() + 45_000,
    question: { text: "سؤال", options: ["صحيح", "غير صحيح"], duration: 45 },
    players: [{ id: "me", name: "Student", team: "x", connected: true }, { id: "other", name: "Other", team: "o", connected: true }],
  };
  harness.emit.mockImplementation((event, _data, cb) => {
    if (event === "xo:join") cb(null, { success: true, state: harness.snapshot, player: { id: "me", rejoinToken: "test-only" } });
    if (event === "xo:reclaim-host") cb(null, { success: true, ...harness.snapshot });
  });
});
afterEach(cleanup);

describe("X O online controls", () => {
  it("shares this room through copy and QR even when the host URL has a permanent token", () => {
    harness.search = "creator=1&token=permanent-new-match";
    sessionStorage.setItem("xo-control-123456", "test-control");
    harness.snapshot.started = false;
    harness.snapshot.phase = "waiting";
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } });
    render(<XoPlay />);
    const roomUrl = `${window.location.origin}/game/xo/join/123456`;
    expect(screen.getByTestId("qr-link").getAttribute("data-url")).toBe(roomUrl);
    fireEvent.click(screen.getByRole("button", { name: "نسخ رابط انضمام الطلاب" }));
    expect(copy).toHaveBeenCalledWith(roomUrl);
    expect((screen.getByTestId("xo-start-game") as HTMLButtonElement).disabled).toBe(false);
    pushState({ players: harness.snapshot.players.map((p: any) => ({ ...p, connected: p.team === "x" })) });
    expect((screen.getByTestId("xo-start-game") as HTMLButtonElement).disabled).toBe(true);
  });

  it("locks rival and teammate controls, unlocking only the representative", () => {
    harness.snapshot.activePlayerId = "other";
    render(<XoPlay />);
    expect(answerButton().disabled).toBe(true);
    fireEvent.click(answerButton());
    expect(harness.emit.mock.calls.filter(c => c[0] === "xo:answer")).toHaveLength(0);
    pushState({ activePlayerId: "me" });
    expect(answerButton().disabled).toBe(false);
    fireEvent.click(answerButton());
    expect(harness.emit).toHaveBeenCalledWith("xo:answer", expect.objectContaining({ playerId: "me", turnId: 1, answerIndex: 0 }), expect.any(Function));
  });

  it("surfaces rejected answers and unlocks selection for another attempt", () => {
    render(<XoPlay />);
    fireEvent.click(answerButton());
    expect(answerButton().disabled).toBe(true);
    const callback = harness.emit.mock.calls.find(c => c[0] === "xo:answer")![2];
    act(() => callback(null, { error: "إجابة غير صالحة." }));
    expect(harness.error).toHaveBeenCalledWith("إجابة غير صالحة.");
    expect(answerButton().disabled).toBe(false);
  });

  it("clears selection for a new turn even if question text and options repeat", () => {
    render(<XoPlay />);
    fireEvent.click(answerButton());
    const oldCallback = harness.emit.mock.calls.find(c => c[0] === "xo:answer")![2];
    pushState({ turnId: 3 });
    expect(answerButton().disabled).toBe(false);
    act(() => oldCallback(null, { error: "تغير الدور، انتظر تحديث اللعبة." }));
    expect(harness.error).not.toHaveBeenCalled();
  });

  it("disables participation while disconnected and reclaims the existing identity without duplicates", () => {
    const { rerender } = render(<XoPlay />);
    harness.lang = "en";
    rerender(<XoPlay />);
    expect(harness.emit.mock.calls.filter(c => c[0] === "xo:join")).toHaveLength(1);
    act(() => {
      harness.socket.connected = false;
      harness.handlers.get("disconnect")?.forEach(h => h());
    });
    expect((screen.getByRole("button", { name: /^A\s*صحيح$/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Connecting to the room");
    act(() => {
      harness.socket.connected = true;
      harness.handlers.get("connect")?.forEach(h => h());
    });
    expect(harness.emit).toHaveBeenCalledWith("xo:join", expect.objectContaining({ playerId: "me", rejoinToken: "test-only" }), expect.any(Function));
    expect((screen.getByRole("button", { name: /^A\s*صحيح$/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});