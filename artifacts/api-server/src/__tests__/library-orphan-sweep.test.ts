import { describe, expect, it } from "vitest";
import { isProtectedNonLibraryUpload } from "../lib/library-orphan-sweep";

describe("library orphan sweep protected uploads", () => {
  it("protects Quran recitation audio and timing manifests", () => {
    expect(
      isProtectedNonLibraryUpload(
        "/objects/uploads/quran-recitation/abu-bakr-al-dhabi/001.mp3",
      ),
    ).toBe(true);
    expect(
      isProtectedNonLibraryUpload(
        "/objects/uploads/quran-recitation/abu-bakr-al-dhabi/verse-boundaries.json",
      ),
    ).toBe(true);
    expect(
      isProtectedNonLibraryUpload(
        "/objects/uploads/quran-recitation/sadiq-alnizam/114.mp3",
      ),
    ).toBe(true);
  });

  it("does not protect ordinary library uploads", () => {
    expect(
      isProtectedNonLibraryUpload("/objects/uploads/teacher-file.pdf"),
    ).toBe(false);
  });
});