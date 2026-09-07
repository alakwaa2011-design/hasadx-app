import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listUploadObjects: vi.fn(),
  toNormalizedObjectPath: vi.fn(),
  select: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class ObjectStorageService {
    listUploadObjects = mocks.listUploadObjects;
    toNormalizedObjectPath = mocks.toNormalizedObjectPath;
  },
}));

vi.mock("@workspace/db", () => ({
  aiVideoProjectsTable: { id: "id", brief: "brief" },
  db: { select: mocks.select },
}));

import {
  AI_VIDEO_PENDING_UPLOAD_TTL_MS,
  deleteStaleUnclaimedAiVideoSourceImages,
} from "../lib/ai-video-source-images";

function databaseReference(result: Array<{ id: number }>) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  mocks.select.mockReturnValue({ from });
}

function pendingFile(uploadedAt: string) {
  return {
    getMetadata: vi.fn().mockResolvedValue([{
      metadata: {
        aiVideoUploadState: "pending",
        aiVideoUploadedAt: uploadedAt,
      },
    }]),
    setMetadata: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AI video source image cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toNormalizedObjectPath.mockReturnValue(
      "/objects/uploads/ai-video/42/sources/orphan.png",
    );
  });

  it("deletes an expired pending upload that no project references", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const file = pendingFile(
      new Date(now.getTime() - AI_VIDEO_PENDING_UPLOAD_TTL_MS - 1).toISOString(),
    );
    mocks.listUploadObjects.mockResolvedValue([file]);
    databaseReference([]);

    await expect(deleteStaleUnclaimedAiVideoSourceImages(now)).resolves.toBe(1);
    expect(file.delete).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(file.setMetadata).not.toHaveBeenCalled();
  });

  it("retains and marks an expired pending upload referenced by a project", async () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const file = pendingFile(
      new Date(now.getTime() - AI_VIDEO_PENDING_UPLOAD_TTL_MS - 1).toISOString(),
    );
    mocks.listUploadObjects.mockResolvedValue([file]);
    databaseReference([{ id: 9 }]);

    await expect(deleteStaleUnclaimedAiVideoSourceImages(now)).resolves.toBe(0);
    expect(file.delete).not.toHaveBeenCalled();
    expect(file.setMetadata).toHaveBeenCalledWith({
      metadata: expect.objectContaining({ aiVideoUploadState: "claimed" }),
    });
  });
});