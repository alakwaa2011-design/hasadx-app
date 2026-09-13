import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("service worker notification navigation", () => {
  it("falls back to the Hasaad teacher page for an external action URL", async () => {
    const listeners = new Map<string, (event: any) => void>();
    const openWindow = vi.fn(async () => undefined);
    const serviceWorkerScope = {
      location: { origin: "https://hasaadx.com" },
      clients: {
        matchAll: vi.fn(async () => []),
        openWindow,
        claim: vi.fn(),
      },
      registration: { showNotification: vi.fn() },
      skipWaiting: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (event: any) => void) => {
        listeners.set(type, listener);
      }),
    };
    const caches = {
      open: vi.fn(),
      keys: vi.fn(),
      delete: vi.fn(),
      match: vi.fn(),
    };
    const source = fs.readFileSync("public/sw.js", "utf8");
    new Function("self", "caches", "fetch", source)(
      serviceWorkerScope,
      caches,
      vi.fn(),
    );

    let completion: Promise<void> | undefined;
    listeners.get("notificationclick")?.({
      notification: {
        data: { actionUrl: "https://attacker.example/phishing" },
        close: vi.fn(),
      },
      waitUntil: (promise: Promise<void>) => { completion = promise; },
    });
    await completion;

    expect(openWindow).toHaveBeenCalledWith("https://hasaadx.com/teacher");
    expect(openWindow).not.toHaveBeenCalledWith(expect.stringContaining("attacker.example"));
  });

  it("still displays the notification when an unrelated visible window exists", async () => {
    const listeners = new Map<string, (event: any) => void>();
    const visibleClient = {
      visibilityState: "visible",
      postMessage: vi.fn(),
    };
    const showNotification = vi.fn(async () => undefined);
    const serviceWorkerScope = {
      location: { origin: "https://hasaadx.com" },
      clients: {
        matchAll: vi.fn(async () => [visibleClient]),
        openWindow: vi.fn(),
        claim: vi.fn(),
      },
      registration: { showNotification },
      skipWaiting: vi.fn(),
      addEventListener: vi.fn((type: string, listener: (event: any) => void) => {
        listeners.set(type, listener);
      }),
    };
    const source = fs.readFileSync("public/sw.js", "utf8");
    new Function("self", "caches", "fetch", source)(
      serviceWorkerScope,
      { open: vi.fn(), keys: vi.fn(), delete: vi.fn(), match: vi.fn() },
      vi.fn(),
    );

    let completion: Promise<void> | undefined;
    listeners.get("push")?.({
      data: {
        json: () => ({
          notificationId: 72,
          title: "تنبيه خاص بالمعلم",
          body: "محتوى التنبيه",
          actionUrl: "/teacher",
          silent: false,
        }),
      },
      waitUntil: (promise: Promise<void>) => { completion = promise; },
    });
    await completion;

    expect(visibleClient.postMessage).toHaveBeenCalledWith({
      type: "HASAAD_PUSH_ACTIVE",
      notification: expect.objectContaining({ notificationId: 72 }),
    });
    expect(showNotification).toHaveBeenCalledWith(
      "تنبيه خاص بالمعلم",
      expect.objectContaining({ body: "محتوى التنبيه", silent: true }),
    );
  });
});