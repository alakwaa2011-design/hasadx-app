import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUrl: vi.fn(),
  normalize: vi.fn(),
  issue: vi.fn(),
  verifyTicket: vi.fn(),
  verifyObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    getObjectEntityUploadURL = mocks.getUrl;
    normalizeObjectEntityPath = mocks.normalize;
    issueUploadTicket = mocks.issue;
    verifyUploadTicket = mocks.verifyTicket;
    verifyUploadedObject = mocks.verifyObject;
    tryDeleteObjectEntity = mocks.deleteObject;
  },
}));

vi.mock("../lib/legacy-object-access", () => ({
  hasLegacySchoolLogoReference: vi.fn(),
  teacherHasLegacyObjectReference: vi.fn(),
  teacherHasParentAttachmentReference: vi.fn(),
}));

vi.mock("../lib/ai-video-access", () => ({
  hasAiVideoAdminAccess: vi.fn(),
}));

vi.mock("@workspace/billing", () => ({
  featureAccess: {
    getSubscription: vi.fn().mockResolvedValue({
      planCode: "basic",
      isAdmin: false,
    }),
  },
}));

import storageRouter from "../routes/storage";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    (req as any).session = { teacherId: 42 };
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    next();
  });
  instance.use(storageRouter);
  return instance;
}

describe("direct upload request and finalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUrl.mockResolvedValue("https://storage.example/upload");
    mocks.normalize.mockReturnValue("/objects/uploads/42/file");
    mocks.issue.mockReturnValue("signed-ticket");
    mocks.verifyTicket.mockReturnValue({
      purpose: "image",
      contentType: "image/png",
      maxBytes: 10 * 1024 * 1024,
    });
    mocks.verifyObject.mockResolvedValue({
      size: 8,
      contentType: "image/png",
      generation: "1",
    });
    mocks.deleteObject.mockResolvedValue(true);
  });

  it("issues a ticket for PNG images", async () => {
    const res = await request(app())
      .post("/storage/uploads/request-image-url")
      .send({ name: "image.png", size: 8, contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      objectPath: "/objects/uploads/42/file",
      uploadTicket: "signed-ticket",
      finalizeURL: "/storage/uploads/finalize",
    });
  });

  it("issues a ticket for PDF attachments", async () => {
    const res = await request(app())
      .post("/storage/uploads/request-attachment-url")
      .send({ name: "document.pdf", size: 12, contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(res.body.uploadTicket).toBe("signed-ticket");
  });

  it("continues to reject SVG uploads", async () => {
    const res = await request(app())
      .post("/storage/uploads/request-image-url")
      .send({ name: "active.svg", size: 100, contentType: "image/svg+xml" });

    expect(res.status).toBe(400);
    expect(mocks.getUrl).not.toHaveBeenCalled();
  });

  it("finalizes a ticket-bound upload after byte verification", async () => {
    const res = await request(app())
      .post("/storage/uploads/finalize")
      .send({
        objectPath: "/objects/uploads/42/file",
        uploadTicket: "signed-ticket",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      objectPath: "/objects/uploads/42/file",
      size: 8,
      contentType: "image/png",
      finalized: true,
    });
    expect(mocks.verifyTicket).toHaveBeenCalledWith("signed-ticket", {
      objectPath: "/objects/uploads/42/file",
      teacherId: 42,
    });
  });

  it("quarantines a MIME-mismatched upload", async () => {
    mocks.verifyObject.mockRejectedValueOnce(new Error("UPLOAD_TYPE_MISMATCH"));

    const res = await request(app())
      .post("/storage/uploads/finalize")
      .send({
        objectPath: "/objects/uploads/42/file",
        uploadTicket: "signed-ticket",
      });

    expect(res.status).toBe(400);
    expect(mocks.deleteObject).toHaveBeenCalledWith("/objects/uploads/42/file");
  });
});