import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  listUploadObjects: vi.fn(),
  toNormalizedObjectPath: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    listUploadObjects = storageMocks.listUploadObjects;
    toNormalizedObjectPath = storageMocks.toNormalizedObjectPath;
  },
}));

vi.mock("@workspace/db", () => ({
  db: {},
  teacherLibraryFilesTable: {},
  teacherLibraryPendingUploadsTable: {},
}));

import {
  isLibraryOwnedUpload,
  sweepOrphanLibraryUploads,
} from "../lib/library-orphan-sweep";
import { libraryUploadOwnerPrefix } from "../lib/library-constants";

describe("library orphan sweep ownership scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognizes only uploads created in the teacher library namespace", () => {
    expect(libraryUploadOwnerPrefix(42)).toBe("teacher-library/42");
    expect(
      isLibraryOwnedUpload(
        "/objects/uploads/teacher-library/42/lesson-plan.pdf",
      ),
    ).toBe(true);

    for (const path of [
      "/objects/uploads/quran-recitation/reader/001.mp3",
      "/objects/uploads/ai-video/42/render.mp4",
      "/objects/uploads/submission-images/42/page.jpg",
      "/objects/uploads/42/voice-note.mp3",
      "/objects/uploads/teacher-library-archive/42/file.pdf",
    ]) {
      expect(isLibraryOwnedUpload(path)).toBe(false);
    }
  });

  it("lists only the library namespace and never deletes non-library media", async () => {
    const deleteObject = vi.fn();
    const nonLibraryFile = {
      metadata: { timeCreated: "2020-01-01T00:00:00.000Z" },
      delete: deleteObject,
    };
    storageMocks.listUploadObjects.mockResolvedValue([nonLibraryFile]);
    storageMocks.toNormalizedObjectPath.mockReturnValue(
      "/objects/uploads/quran-recitation/reader/001.mp3",
    );

    const result = await sweepOrphanLibraryUploads();

    expect(storageMocks.listUploadObjects).toHaveBeenCalledWith(
      "teacher-library",
    );
    expect(deleteObject).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 1,
      ageEligible: 0,
      deleted: 0,
      errors: 0,
    });
  });
});