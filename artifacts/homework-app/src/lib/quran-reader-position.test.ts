import { describe, expect, it } from "vitest";
import {
  quranNavigationKey,
  reduceQuranReaderPosition,
} from "./quran-reader-position";

describe("Quran reader position", () => {
  it("does not let a stale URL position overwrite a clicked ayah", () => {
    const key = quranNavigationKey(2, 5, null);
    const clicked = reduceQuranReaderPosition(
      { ayah: 5, navigationKey: key },
      { type: "click", ayah: 10 },
    );
    const afterStaleRerender = reduceQuranReaderPosition(clicked, {
      type: "navigation",
      key,
      ayah: 5,
    });
    expect(afterStaleRerender.ayah).toBe(10);
  });

  it("accepts a genuinely new URL navigation", () => {
    const initialKey = quranNavigationKey(2, 5, null);
    const nextKey = quranNavigationKey(2, 12, null);
    const next = reduceQuranReaderPosition(
      { ayah: 10, navigationKey: initialKey },
      { type: "navigation", key: nextKey, ayah: 12 },
    );
    expect(next.ayah).toBe(12);
  });
});