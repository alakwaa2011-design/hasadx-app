import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuranInstall, useQuranInstallCooldown } from "@/components/quran/use-quran-install";

describe("useQuranInstallCooldown", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("should be initially not dismissed if no localStorage entry", () => {
    const { result } = renderHook(() => useQuranInstallCooldown());
    expect(result.current.isDismissed).toBe(false);
  });

  it("should mark as dismissed when dismiss() is called", () => {
    const { result } = renderHook(() => useQuranInstallCooldown());
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isDismissed).toBe(true);
    
    const saved = localStorage.getItem("quran_install_dismissed_until");
    expect(saved).not.toBeNull();
    expect(parseInt(saved!, 10)).toBeGreaterThan(Date.now());
  });

  it("should restore dismissed state if within 30 days", () => {
    localStorage.setItem("quran_install_dismissed_until", (Date.now() + 86400000).toString());
    const { result } = renderHook(() => useQuranInstallCooldown());
    expect(result.current.isDismissed).toBe(true);
  });

  it("should ignore dismissed state if expired", () => {
    localStorage.setItem("quran_install_dismissed_until", (Date.now() - 86400000).toString());
    const { result } = renderHook(() => useQuranInstallCooldown());
    expect(result.current.isDismissed).toBe(false);
  });
});

describe("useQuranInstall", () => {
  let originalUa: string;
  let originalMatchMedia: any;

  beforeEach(() => {
    originalUa = window.navigator.userAgent;
    originalMatchMedia = window.matchMedia;
    window.history.replaceState(null, "", "/quran");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, "userAgent", { value: originalUa, configurable: true });
    window.matchMedia = originalMatchMedia;
    window.history.replaceState(null, "", "/");
  });

  it("detects installed standalone mode via matchMedia", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("standalone") }));
    const { result } = renderHook(() => useQuranInstall());
    expect(result.current.platform).toBe("installed");
    expect(result.current.isInstallable).toBe(false);
  });

  it("treats a Quran install link opened inside the installed platform as a separate app request", () => {
    window.history.replaceState(null, "", "/quran?install=1");
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("standalone") }));
    const { result } = renderHook(() => useQuranInstall());
    expect(result.current.platform).toBe("app-window");
    expect(result.current.isInstallable).toBe(true);
  });

  it("offers desktop installation guidance when no native prompt is available", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36",
      configurable: true,
    });
    const { result } = renderHook(() => useQuranInstall());
    expect(result.current.platform).toBe("desktop");
    expect(result.current.isInstallable).toBe(true);
  });

  it("detects iOS Safari", () => {
    Object.defineProperty(window.navigator, "userAgent", { 
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1", 
      configurable: true 
    });
    const { result } = renderHook(() => useQuranInstall());
    expect(result.current.platform).toBe("ios-safari");
    expect(result.current.isInstallable).toBe(true);
  });

  it("detects iOS In-App", () => {
    Object.defineProperty(window.navigator, "userAgent", { 
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 123.0.0", 
      configurable: true 
    });
    const { result } = renderHook(() => useQuranInstall());
    expect(result.current.platform).toBe("ios-inapp");
    expect(result.current.isInstallable).toBe(true);
  });

  it("treats an unnamed iOS webview as in-app browsing", () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      configurable: true,
    });
    const { result } = renderHook(() => useQuranInstall());
    expect(result.current.platform).toBe("ios-inapp");
    expect(result.current.isInstallable).toBe(true);
  });
});
