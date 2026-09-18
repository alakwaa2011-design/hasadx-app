import { describe, expect, it, vi } from "vitest";
import { ObjectStorageService } from "../lib/objectStorage";

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
});