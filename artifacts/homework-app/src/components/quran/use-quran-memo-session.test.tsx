import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useQuranMemoSession } from "./use-quran-memo-session";

describe("useQuranMemoSession", () => {
  it("partially conceals alternating words in a single-ayah guided session", () => {
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

    expect(result.current.isAyahConcealed(1, 1, null, 1)).toBe(false);
    expect(result.current.isAyahConcealed(1, 1, null, 2)).toBe(true);
    expect(result.current.isAyahConcealed(1, 1, null, 3)).toBe(false);
    expect(result.current.isAyahConcealed(1, 1, null, null)).toBe(false);
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