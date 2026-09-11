import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const state = vi.hoisted(() => ({
  files: [{ mimetype: "image/png", originalname: "schedule.png" }] as any[],
  prepared: {
    text: "",
    images: [{ base64: "image-data", mimeType: "image/png" }],
    filenames: ["schedule.png"],
  } as { text: string; images: Array<{ base64: string; mimeType: string }>; filenames: string[] } | null,
  visionResult: JSON.stringify({
    daySchedules: [{
      dayOfWeek: 0,
      lessons: [{
        lessonNumber: 1,
        title: "",
        subject: "رياضيات",
        className: "الخامس",
        startTime: "08:00",
        endTime: "08:45",
        confidence: "high",
      }],
    }],
    warnings: [],
  }),
  captured: vi.fn(),
  refunded: vi.fn(),
  uploadOptions: null as { maxFiles?: number; maxBytes?: number } | null,
}));

vi.mock("@workspace/db", () => ({
  db: {},
  teacherScheduleTable: {},
}));

vi.mock("../lib/check-credits", () => ({
  checkCredits: (toolKey: string) => (req: any, _res: any, next: any) => {
    req.__creditRequestId = "held";
    req.__creditToolKey = toolKey;
    next();
  },
  captureCreditsOrThrow: async (_req: any, result: unknown) => state.captured(result),
  refundCredits: async (_req: any, reason: string) => state.refunded(reason),
}));

vi.mock("../lib/ai-tier", () => ({
  resolveTier: async () => "standard",
}));

vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: (options?: { maxFiles?: number; maxBytes?: number }) => {
    state.uploadOptions = options || null;
    return (req: any, _res: any, next: any) => {
      req.files = state.files;
      next();
    };
  },
  processUploadedFiles: async () => state.prepared,
  runVisionCompletionMulti: async () => state.visionResult,
}));

import teacherScheduleRouter from "../routes/teacher-schedule";

function makeApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, _res, next) => {
    (req as any).session = authenticated ? { teacherId: 7 } : {};
    (req as any).log = { warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use("/api", teacherScheduleRouter);
  return app;
}

describe("POST /api/teacher/schedule/ai/extract", () => {
  beforeEach(() => {
    state.files = [{ mimetype: "image/png", originalname: "schedule.png" }];
    state.prepared = {
      text: "",
      images: [{ base64: "image-data", mimeType: "image/png" }],
      filenames: ["schedule.png"],
    };
    state.visionResult = JSON.stringify({
      daySchedules: [{
        dayOfWeek: 0,
        lessons: [{
          lessonNumber: 1,
          title: "",
          subject: "رياضيات",
          className: "الخامس",
          startTime: "08:00",
          endTime: "08:45",
          confidence: "high",
        }],
      }],
      warnings: [],
    });
    state.captured.mockReset();
    state.refunded.mockReset();
  });

  it("returns a reviewed draft and captures only after valid structure", async () => {
    const response = await request(makeApp())
      .post("/api/teacher/schedule/ai/extract")
      .type("form")
      .send({ language: "ar" });

    expect(response.status).toBe(200);
    expect(response.body.daySchedules[0].lessons[0].subject).toBe("رياضيات");
    expect(state.captured).toHaveBeenCalledOnce();
    expect(state.refunded).not.toHaveBeenCalled();
    expect(state.uploadOptions).toEqual({ maxFiles: 1, maxBytes: 10 * 1024 * 1024 });
  });

  it("refunds when the model returns malformed schedule data", async () => {
    state.visionResult = "{\"daySchedules\":[]}";
    const response = await request(makeApp())
      .post("/api/teacher/schedule/ai/extract")
      .type("form")
      .send({ language: "ar" });

    expect(response.status).toBe(422);
    expect(state.captured).not.toHaveBeenCalled();
    expect(state.refunded).toHaveBeenCalledOnce();
  });

  it("refunds when no single supported image is attached", async () => {
    state.files = [];
    const response = await request(makeApp())
      .post("/api/teacher/schedule/ai/extract")
      .type("form")
      .send({ language: "ar" });

    expect(response.status).toBe(400);
    expect(state.refunded).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated requests before extraction", async () => {
    const response = await request(makeApp(false))
      .post("/api/teacher/schedule/ai/extract")
      .type("form")
      .send({ language: "ar" });

    expect(response.status).toBe(401);
    expect(state.captured).not.toHaveBeenCalled();
    expect(state.refunded).not.toHaveBeenCalled();
  });

  it("refunds and returns no result when credit capture fails", async () => {
    state.captured.mockRejectedValueOnce(new Error("capture failed"));
    const response = await request(makeApp())
      .post("/api/teacher/schedule/ai/extract")
      .type("form")
      .send({ language: "ar" });

    expect(response.status).toBe(500);
    expect(state.refunded).toHaveBeenCalledOnce();
    expect(response.body.daySchedules).toBeUndefined();
  });
});