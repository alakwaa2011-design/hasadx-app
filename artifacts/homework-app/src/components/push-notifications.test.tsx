import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { playTimerSound, setLocation } = vi.hoisted(() => ({
  playTimerSound: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetCurrentTeacher: () => ({ data: { id: 1 } }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/teacher", setLocation] }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "ar" }) }));
vi.mock("@/lib/timer-sounds", () => ({ playTimerSound }));
vi.mock("@/lib/timer-store", () => ({
  timerStore: {
    getState: () => ({ soundMuted: false, soundSelection: "bell", soundVolume: 0.7 }),
    subscribe: () => () => undefined,
  },
}));

import {
  GlobalPushNotificationManager,
  logoutCurrentTeacherDevice,
} from "./push-notifications";

describe("GlobalPushNotificationManager", () => {
  let root: Root;
  let container: HTMLDivElement;
  let messageHandler: ((event: MessageEvent) => void) | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { permission: "default" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: vi.fn((type, handler) => {
          if (type === "message") messageHandler = handler;
        }),
        removeEventListener: vi.fn(),
      },
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <GlobalPushNotificationManager />
        </QueryClientProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("plays the foreground sound only once when the same notification is retried", () => {
    const event = {
      data: { type: "HASAAD_PUSH_ACTIVE", notification: { notificationId: 44 } },
    } as MessageEvent;

    messageHandler?.(event);
    messageHandler?.(event);

    expect(playTimerSound).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem("hasaad_push_seen_v1") || "[]")).toContain(44);
  });

  it("asks the server to remove this device subscription atomically with logout", async () => {
    const unsubscribe = vi.fn(async () => true);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/current-device",
      unsubscribe,
    };
    Object.assign(navigator.serviceWorker, {
      ready: Promise.resolve({
        pushManager: { getSubscription: vi.fn(async () => subscription) },
      }),
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    await logoutCurrentTeacherDevice();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pushEndpoint: subscription.endpoint }),
      }),
    );
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("still logs out when the service worker never becomes ready", async () => {
    vi.useFakeTimers();
    Object.assign(navigator.serviceWorker, { ready: new Promise(() => undefined) });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const logout = logoutCurrentTeacherDevice();
    await vi.advanceTimersByTimeAsync(1_000);
    await logout;

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ body: JSON.stringify({ pushEndpoint: null }) }),
    );
    vi.useRealTimers();
  });

  it("completes logout when browser unsubscription rejects", async () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/current-device",
      unsubscribe: vi.fn(async () => { throw new Error("browser failure"); }),
    };
    Object.assign(navigator.serviceWorker, {
      ready: Promise.resolve({
        pushManager: { getSubscription: vi.fn(async () => subscription) },
      }),
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    await expect(logoutCurrentTeacherDevice()).resolves.toBeUndefined();
  });
});