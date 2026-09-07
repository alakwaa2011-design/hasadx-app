import express from "express";
import request from "supertest";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadBufferAsPrivate } = vi.hoisted(() => ({
  uploadBufferAsPrivate: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class ObjectStorageService {
    uploadBufferAsPrivate = uploadBufferAsPrivate;
  },
}));

import aiVideoProjectsRouter from "../routes/ai-video-projects";
import { AI_VIDEO_SOURCE_IMAGE_MAX_BYTES } from "../lib/ai-video-source-images";

function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    const mutableReq = req as unknown as {
      session: { teacherId: number };
      log: typeof console;
    };
    mutableReq.session = { teacherId: 42 };
    mutableReq.log = console;
    next();
  });
  app.use(aiVideoProjectsRouter);
  return app;
}

describe("AI video source image upload", () => {
  beforeEach(() => {
    uploadBufferAsPrivate.mockReset();
    uploadBufferAsPrivate.mockResolvedValue(
      "/objects/uploads/ai-video/42/sources/normalized.png",
    );
  });

  it("rejects non-image bytes even when declared as image/png without persisting them", async () => {
    const response = await request(createApp())
      .post("/ai-video/uploads/image")
      .attach("file", Buffer.from("this is not an image"), {
        filename: "lesson.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(uploadBufferAsPrivate).not.toHaveBeenCalled();
  });

  it("rejects image bodies larger than 15MB before persistence", async () => {
    const response = await request(createApp())
      .post("/ai-video/uploads/image")
      .attach("file", Buffer.alloc(AI_VIDEO_SOURCE_IMAGE_MAX_BYTES + 1), {
        filename: "lesson.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(413);
    expect(uploadBufferAsPrivate).not.toHaveBeenCalled();
  });

  it("does not expose the former direct-to-storage upload URL route", async () => {
    const response = await request(createApp())
      .post("/ai-video/uploads/request-image-url")
      .send({
        name: "lesson.png",
        size: 100,
        contentType: "image/png",
      });

    expect(response.status).toBe(404);
    expect(uploadBufferAsPrivate).not.toHaveBeenCalled();
  });

  it("decodes and re-encodes a valid image before private persistence", async () => {
    const source = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: "#225739",
      },
    }).png().toBuffer();

    const response = await request(createApp())
      .post("/ai-video/uploads/image")
      .attach("file", source, {
        filename: "lesson.png",
        contentType: "application/octet-stream",
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.objectPath).toContain("/objects/uploads/ai-video/42/");
    expect(uploadBufferAsPrivate).toHaveBeenCalledWith(expect.objectContaining({
      contentType: "image/png",
      ownerPrefix: "ai-video/42/sources",
    }));
  });
});