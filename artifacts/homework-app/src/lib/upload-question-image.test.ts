// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QuestionImageUploadError,
  uploadQuestionImage,
} from "./upload-question-image";

describe("uploadQuestionImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a raster image and returns the raw durable object path", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        uploadURL: "https://storage.example/upload",
        objectPath: "/objects/uploads/question.png",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const file = new File(["image"], "question.png", { type: "image/png" });

    await expect(uploadQuestionImage(file))
      .resolves.toBe("/objects/uploads/question.png");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://storage.example/upload",
      expect.objectContaining({ method: "PUT", body: file }),
    );
  });

  it("rejects active image formats before requesting an upload URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const file = new File(["<svg/>"], "question.svg", { type: "image/svg+xml" });

    await expect(uploadQuestionImage(file)).rejects.toMatchObject<QuestionImageUploadError>({
      reason: "unsupported-type",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed upload responses instead of persisting an unusable URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        uploadURL: "https://storage.example/upload",
        objectPath: "missing-prefix.png",
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const file = new File(["image"], "question.png", { type: "image/png" });
    await expect(uploadQuestionImage(file)).rejects.toMatchObject<QuestionImageUploadError>({
      reason: "request-failed",
    });
  });
});