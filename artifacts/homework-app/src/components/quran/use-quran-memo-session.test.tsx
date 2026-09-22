import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useQuranMemoSession } from "./use-quran-memo-session";

describe("useQuranMemoSession", () => {
  it("keeps a randomized partial-hide pattern stable during one guided step", () => {
    const { result } = renderHook(() =>
      useQuranMemoSession(1, 1, null, null, null),
    );

    act(() => {
      result.current.setMemoSession((session) => ({
        ...session,
        isActive: true,
        rangeStart: 1,
        rangeEnd: 1,
      }));
      result.current.setMemoView("progressive");
    });

    const firstPattern = Array.from(
      { length: 12 },
      (_, index) => result.current.isAyahConcealed(1, 1, null, index + 1),
    );
    const secondPattern = Array.from(
      { length: 12 },
      (_, index) => result.current.isAyahConcealed(1, 1, null, index + 1),
    );

    expect(secondPattern).toEqual(firstPattern);
    expect(firstPattern).toContain(true);
    expect(firstPattern).toContain(false);
    expect(result.current.isAyahConcealed(1, 1, null, null)).toBe(false);
    expect(result.current.isAyahConcealed(1, 2, 1, 1)).toBe(false);
    expect(result.current.isAyahConcealed(1, 3, 99, 1)).toBe(false);
  });

  it("creates a fresh partial-hide pattern when the guided step restarts", () => {
    const { result } = renderHook(() =>
      useQuranMemoSession(1, 1, null, null, null),
    );

    act(() => {
      result.current.setMemoSession((session) => ({
        ...session,
        isActive: true,
        rangeStart: 1,
        rangeEnd: 1,
      }));
      result.current.setMemoView("progressive");
    });

    const before = Array.from(
      { length: 24 },
      (_, index) => result.current.isAyahConcealed(1, 1, null, index + 1),
    );
    act(() => result.current.randomizePartialHide());
    const after = Array.from(
      { length: 24 },
      (_, index) => result.current.isAyahConcealed(1, 1, null, index + 1),
    );

    expect(after).not.toEqual(before);
  });

  it("keeps progressive range behavior for multi-ayah sessions", () => {
    const { result } = renderHook(() =>
      useQuranMemoSession(2, 1, null, null, null),
    );

    act(() => {
      result.current.setMemoSession((session) => ({
        ...session,
        isActive: true,
        rangeStart: 1,
        rangeEnd: 3,
      }));
      result.current.setMemoView("progressive");
    });

    expect(result.current.isAyahConcealed(2, 1, null, 2)).toBe(false);
    expect(result.current.isAyahConcealed(2, 2, null, 2)).toBe(true);
  });
});