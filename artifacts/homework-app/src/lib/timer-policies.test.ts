import { describe, it, expect, vi } from "vitest";
import { shouldShowFloatingTimer, shouldAutoMinimizeTimer, handleTimerAuthTransition } from "./timer-policies";

describe("Timer Route Policies", () => {
  it("should block explicitly hidden paths", () => {
    expect(shouldShowFloatingTimer("/solve")).toBe(false);
    expect(shouldShowFloatingTimer("/play")).toBe(false);
    expect(shouldShowFloatingTimer("/p/join")).toBe(false);
    expect(shouldShowFloatingTimer("/student/dashboard")).toBe(false);
    expect(shouldShowFloatingTimer("/login")).toBe(false);
  });

  it("should block timer tool page itself", () => {
    expect(shouldShowFloatingTimer("/teacher/tools/timer")).toBe(false);
  });

  it("should block print and present suffixes on unsupported routes", () => {
    expect(shouldShowFloatingTimer("/teacher/worksheet/123/print")).toBe(false);
    expect(shouldShowFloatingTimer("/some-random/present")).toBe(false);
  });

  it("should allow standard teacher routes", () => {
    expect(shouldShowFloatingTimer("/teacher/dashboard")).toBe(true);
    expect(shouldShowFloatingTimer("/islamic/admin")).toBe(true);
  });

  it("should correctly identify real registered App.tsx teacher-hosted game paths", () => {
    expect(shouldShowFloatingTimer("/game/escape/host/123")).toBe(true);
    expect(shouldShowFloatingTimer("/game/wameeth/class/123")).toBe(true);
    expect(shouldShowFloatingTimer("/game/million/broadcast/123")).toBe(true);
    expect(shouldShowFloatingTimer("/game/million/team-control/123")).toBe(true);
    expect(shouldShowFloatingTimer("/game/million/team-host/123")).toBe(true);
    
    // Non-teacher routes
    expect(shouldShowFloatingTimer("/game/million/join/123")).toBe(false);
    expect(shouldShowFloatingTimer("/game/escape/play/123")).toBe(false);
    expect(shouldShowFloatingTimer("/game/789/solo")).toBe(false);
  });

  it("should correctly flag routes for auto-minimize", () => {
    expect(shouldAutoMinimizeTimer("/teacher/game/123")).toBe(true);
    expect(shouldAutoMinimizeTimer("/teacher/whiteboard/1/2")).toBe(true);
    expect(shouldAutoMinimizeTimer("/teacher/smart-board/present/xyz")).toBe(true);
    expect(shouldAutoMinimizeTimer("/teacher/presentations/123/present")).toBe(true);
    
    expect(shouldAutoMinimizeTimer("/game/escape/host/123")).toBe(true);
    expect(shouldAutoMinimizeTimer("/game/million/team-control/123")).toBe(true);
    expect(shouldAutoMinimizeTimer("/game/million/broadcast/123")).toBe(true);
    
    // Normal dashboard should not auto minimize
    expect(shouldAutoMinimizeTimer("/teacher/dashboard")).toBe(false);
  });
});

describe("Timer Auth Transition", () => {
  it("should clear store when loading, unauthenticated, or indeterminate", () => {
    const initFn = vi.fn();
    const clearFn = vi.fn();

    // Loading
    handleTimerAuthTransition(true, 1, initFn, clearFn);
    expect(clearFn).toHaveBeenCalledTimes(1);
    expect(initFn).not.toHaveBeenCalled();

    clearFn.mockClear();
    
    // Undefined user
    handleTimerAuthTransition(false, undefined, initFn, clearFn);
    expect(clearFn).toHaveBeenCalledTimes(1);
    expect(initFn).not.toHaveBeenCalled();

    clearFn.mockClear();

    // Null user
    handleTimerAuthTransition(false, null, initFn, clearFn);
    expect(clearFn).toHaveBeenCalledTimes(1);
    expect(initFn).not.toHaveBeenCalled();
  });

  it("should init store when loading finishes with valid user", () => {
    const initFn = vi.fn();
    const clearFn = vi.fn();

    handleTimerAuthTransition(false, 42, initFn, clearFn);
    expect(clearFn).not.toHaveBeenCalled();
    expect(initFn).toHaveBeenCalledWith(42);
  });
});