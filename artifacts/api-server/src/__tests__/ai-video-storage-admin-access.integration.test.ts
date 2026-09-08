import express from "express";
import { PassThrough } from "node:stream";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  getFile: vi.fn(),
  sign: vi.fn(),
  metadata: vi.fn(),
  createReadStream: vi.fn(),
}));

vi.mock("../lib/ai-video-access", () => ({
  hasAiVideoAdminAccess: mocks.access,
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    getObjectEntityFile = mocks.getFile;
    signFileDownloadUrl = mocks.sign;
  },
}));

vi.mock("@workspace/billing", () => ({
  featureAccess: { getSubscription: vi.fn() },
}));

import storageRouter from "../routes/storage";

function app(teacherId?: number) {
  const instance = express();
  instance.use((req, _res, next) => {
    (req as any).session = teacherId ? { teacherId } : {};
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  instance.use(storageRouter);
  return instance;
}

describe("AI video owned object admin access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue(true);
    mocks.metadata.mockResolvedValue([{ contentType: "video/mp4", size: 100 }]);
    mocks.createReadStream.mockImplementation(() => {
      const stream = new PassThrough();
      stream.end("file");
      return stream;
    });
    mocks.getFile.mockResolvedValue({
      getMetadata: mocks.metadata,
      createReadStream: mocks.createReadStream,
    });
    mocks.sign.mockResolvedValue("https://storage.example/signed");
  });

  it.each([
    "/objects/uploads/ai-video/42/files/render.mp4",
    "/storage/objects/uploads/ai-video/42/files/render.mp4",
  ])("allows an authenticated admin owner through both aliases: %s", async (path) => {
    const response = await request(app(42)).get(path);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://storage.example/signed");
    expect(mocks.access).toHaveBeenCalledWith(42);
    expect(mocks.getFile).toHaveBeenCalledWith("/objects/uploads/ai-video/42/files/render.mp4");
    expect(mocks.sign).toHaveBeenCalledTimes(1);
  });

  it("denies a non-admin owner before signing or downloading", async () => {
    mocks.access.mockResolvedValue(false);

    const response = await request(app(42))
      .get("/objects/uploads/ai-video/42/files/render.mp4");

    expect(response.status).toBe(403);
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.createReadStream).not.toHaveBeenCalled();
  });

  it("allows a non-admin owner to download an economical narrated-image video", async () => {
    mocks.access.mockResolvedValue(false);

    const response = await request(app(42))
      .get("/objects/uploads/ai-video-economy/42/projects/9/render.mp4");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://storage.example/signed");
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.getFile).toHaveBeenCalledWith(
      "/objects/uploads/ai-video-economy/42/projects/9/render.mp4",
    );
  });

  it("hides another teacher's economical video", async () => {
    const response = await request(app(7))
      .get("/objects/uploads/ai-video-economy/42/projects/9/render.mp4");

    expect(response.status).toBe(404);
    expect(mocks.getFile).not.toHaveBeenCalled();
  });

  it("preserves owner-hiding 404 for a different admin", async () => {
    const response = await request(app(7))
      .get("/objects/uploads/ai-video/42/files/render.mp4");

    expect(response.status).toBe(404);
    expect(mocks.getFile).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("does not apply the AI-video admin rule to unrelated objects", async () => {
    mocks.access.mockResolvedValue(false);
    mocks.metadata.mockResolvedValue([{ contentType: "text/plain", size: 4 }]);

    const response = await request(app(42)).get("/objects/uploads/other/file.txt");

    expect(response.status).toBe(200);
    expect(response.text).toBe("file");
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.createReadStream).toHaveBeenCalledTimes(1);
  });
});