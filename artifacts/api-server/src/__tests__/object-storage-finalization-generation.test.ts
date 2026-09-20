import { describe, expect, it, vi } from "vitest";
import {
  ObjectStorageService,
  objectStorageClient,
} from "../lib/objectStorage";

describe("object upload finalization generation safety", () => {
  it("marks only the generation whose bytes were inspected", async () => {
    const getMetadata = vi.fn().mockResolvedValue([{
      size: "8",
      contentType: "image/png",
      generation: "123",
      metadata: { existing: "kept" },
    }]);
    const download = vi.fn().mockResolvedValue([
      Buffer.from("89504e470d0a1a0a", "hex"),
    ]);
    const setMetadata = vi.fn().mockResolvedValue(undefined);
    const file = { getMetadata, download, setMetadata };
    const storage = new ObjectStorageService();
    vi.spyOn(storage, "getObjectEntityFile").mockResolvedValue(file as any);

    const result = await storage.verifyUploadedObject(
      "/objects/uploads/42/file",
      "image/png",
      1024,
    );

    expect(result).toMatchObject({
      size: 8,
      contentType: "image/png",
      generation: "123",
    });
    expect(setMetadata).toHaveBeenCalledWith({
      metadata: {
        existing: "kept",
        verifiedUpload: "true",
        verifiedGeneration: "123",
      },
    }, {
      preconditionOpts: { ifGenerationMatch: 123 },
    });
    expect(getMetadata).toHaveBeenCalledTimes(1);
  });

  it("recreates a missing migration target from the recorded source generation", async () => {
    const copy = vi.fn().mockResolvedValue(undefined);
    const pinnedSource = { copy };
    const sourceBucket = {
      file: vi.fn().mockReturnValue(pinnedSource),
    };
    const source = {
      name: "private/uploads/legacy-source",
      bucket: sourceBucket,
      getMetadata: vi.fn().mockResolvedValue([{ generation: "123" }]),
    };
    const destination = {
      name: "private/uploads/teacher-library/42/legacy-7",
      bucket: { name: "bucket" },
      exists: vi.fn().mockResolvedValue([false]),
    };
    const destinationBucket = {
      file: vi.fn().mockReturnValue(destination),
    };
    vi.spyOn(objectStorageClient, "bucket").mockReturnValue(destinationBucket as any);

    const storage = new ObjectStorageService();
    vi.spyOn(storage, "getPrivateObjectDir").mockReturnValue("/bucket/private");
    vi.spyOn(storage, "getObjectEntityFile").mockResolvedValue(source as any);

    const result = await storage.copyObjectEntityToOwner(
      "/objects/uploads/legacy-source",
      "teacher-library/42",
      "legacy-7",
      "123",
    );

    expect(sourceBucket.file).toHaveBeenCalledWith(
      "private/uploads/legacy-source",
      { generation: "123" },
    );
    expect(copy).toHaveBeenCalledWith(destination, {
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        libraryMigrationSourcePath: "/objects/uploads/legacy-source",
        libraryMigrationSourceGeneration: "123",
      },
    });
    expect(result).toEqual({
      objectPath: "/objects/uploads/teacher-library/42/legacy-7",
      sourceGeneration: "123",
    });
  });
});