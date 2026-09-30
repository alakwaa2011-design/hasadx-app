import express from "express";
import { PassThrough } from "node:stream";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFile: vi.fn(),
  inspect: vi.fn(),
  canAccess: vi.fn(),
  reference: vi.fn(),
  parentReference: vi.fn(),
  schoolLogoReference: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    getObjectEntityFile = mocks.getFile;
    inspectUploadedObject = mocks.inspect;
    canAccessObjectEntity = mocks.canAccess;
  },
}));

vi.mock("../lib/legacy-object-access", () => ({
  hasLegacySchoolLogoReference: mocks.schoolLogoReference,
  teacherHasLegacyObjectReference: mocks.reference,
  teacherHasParentAttachmentReference: mocks.parentReference,
}));

vi.mock("../lib/ai-video-access", () => ({
  hasAiVideoAdminAccess: vi.fn().mockResolvedValue(false),
}));

vi.mock("@workspace/billing", () => ({
  featureAccess: { getSubscription: vi.fn() },
}));

import storageRouter from "../routes/storage";

function makeApp(teacherId?: number) {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = teacherId ? { teacherId } : {};
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  app.use(storageRouter);
  return app;
}

describe("legacy object reference authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccess.mockResolvedValue(false);
    mocks.reference.mockResolvedValue(false);
    mocks.parentReference.mockResolvedValue(false);
    mocks.schoolLogoReference.mockResolvedValue(false);
    mocks.inspect.mockResolvedValue({ size: 8, contentType: "image/png" });
    mocks.stream.mockImplementation(() => {
      const stream = new PassThrough();
      stream.end("png-data");
      return stream;
    });
    mocks.getFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{
        contentType: "image/png",
        size: 8,
        generation: "legacy",
      }]),
      createReadStream: mocks.stream,
    });
  });

  it("allows cross-origin playback only for reviewed Abu Bakr chapter audio", async () => {
    mocks.getFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{ contentType: "audio/mpeg", size: 8, generation: "audio" }]),
      createReadStream: mocks.stream,
    });
    const publicAudio = await request(makeApp()).get("/storage/objects/uploads/quran-recitation/abu-bakr-al-dhabi/001.mp3");
    expect(publicAudio.status).toBe(200);
    expect(publicAudio.headers["cross-origin-resource-policy"]).toBe("cross-origin");

    const otherQuran = await request(makeApp()).get("/storage/objects/uploads/quran-recitation/abu-bakr-al-dhabi/115.mp3");
    expect(otherQuran.headers["cross-origin-resource-policy"]).not.toBe("cross-origin");
    const privateAudio = await request(makeApp()).get("/storage/objects/uploads/quran-recitation/private/001.mp3");
    expect(privateAudio.headers["cross-origin-resource-policy"]).not.toBe("cross-origin");
  });

  it("allows a teacher to open an exact legacy object referenced by their records", async () => {
    mocks.reference.mockImplementation(async (teacherId, objectPath) =>
      teacherId === 42 && objectPath === "/objects/uploads/legacy-uuid");

    const res = await request(makeApp(42)).get("/objects/uploads/legacy-uuid");

    expect(res.status).toBe(200);
    expect(mocks.reference).toHaveBeenCalledWith(42, "/objects/uploads/legacy-uuid");
    expect(mocks.inspect).toHaveBeenCalledWith(
      "/objects/uploads/legacy-uuid",
      "image/png",
      10 * 1024 * 1024,
    );
  });

  it("does not allow another teacher to open that legacy object", async () => {
    mocks.reference.mockResolvedValue(false);

    const res = await request(makeApp(7)).get("/objects/uploads/legacy-uuid");

    expect(res.status).toBe(404);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("denies an unreferenced legacy object", async () => {
    const res = await request(makeApp(42)).get("/objects/uploads/orphan-uuid");

    expect(res.status).toBe(404);
    expect(mocks.inspect).not.toHaveBeenCalled();
  });

  it("preserves explicitly public legacy generated objects", async () => {
    mocks.canAccess.mockResolvedValue(true);

    const res = await request(makeApp()).get("/objects/uploads/public-image.png");

    expect(res.status).toBe(200);
    expect(mocks.reference).not.toHaveBeenCalled();
    expect(mocks.inspect).toHaveBeenCalledTimes(1);
  });

  it("preserves a legacy school logo referenced by the teacher profile", async () => {
    mocks.schoolLogoReference.mockResolvedValue(true);

    const res = await request(makeApp()).get("/objects/uploads/legacy-school-logo");

    expect(res.status).toBe(200);
    expect(mocks.reference).not.toHaveBeenCalled();
    expect(mocks.inspect).toHaveBeenCalledTimes(1);
  });

  it("does not expose a non-image object referenced as a legacy school logo", async () => {
    mocks.schoolLogoReference.mockResolvedValue(true);
    mocks.getFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{
        contentType: "application/pdf",
        size: 8,
        generation: "legacy",
      }]),
      createReadStream: mocks.stream,
    });

    const res = await request(makeApp()).get("/objects/uploads/not-a-logo");

    expect(res.status).toBe(404);
    expect(mocks.inspect).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("keeps new verified teacher uploads on the existing path", async () => {
    mocks.getFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{
        contentType: "image/png",
        size: 8,
        generation: "9",
        metadata: { verifiedUpload: "true", verifiedGeneration: "9" },
      }]),
      createReadStream: mocks.stream,
    });

    const res = await request(makeApp(42)).get("/objects/uploads/42/new-file");

    expect(res.status).toBe(200);
    expect(mocks.reference).not.toHaveBeenCalled();
    expect(mocks.inspect).not.toHaveBeenCalled();
  });

  it("does not treat a referenced modern upload as finalized", async () => {
    mocks.reference.mockResolvedValue(true);

    const res = await request(makeApp(42)).get("/objects/uploads/42/unfinalized-file");

    expect(res.status).toBe(404);
    expect(mocks.reference).not.toHaveBeenCalled();
    expect(mocks.inspect).not.toHaveBeenCalled();
  });

  it("denies generic access to another thread's parent-owned object", async () => {
    mocks.reference.mockResolvedValue(false);
    mocks.getFile.mockResolvedValue({
      getMetadata: vi.fn().mockResolvedValue([{
        contentType: "image/png",
        size: 8,
        generation: "11",
        metadata: {
          verifiedUpload: "true",
          verifiedGeneration: "11",
          parentOwner: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }]),
      createReadStream: mocks.stream,
    });

    const res = await request(makeApp(42))
      .get("/objects/uploads/parent/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/file");

    expect(res.status).toBe(404);
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.parentReference).toHaveBeenCalledWith(
      42,
      "/objects/uploads/parent/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/file",
    );
  });
});