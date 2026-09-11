import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => {
  function chain(result: unknown): unknown {
    const promise = Promise.resolve(result);
    return new Proxy(promise, {
      get(target, property) {
        if (property === "then" || property === "catch" || property === "finally") {
          return (target as any)[property].bind(target);
        }
        return () => chain(result);
      },
    });
  }
  return {
    db: { select: () => chain([{ isAdmin: false }]) },
    teachersTable: { id: "id", isAdmin: "is_admin" },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: () => ({}),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {},
}));

vi.mock("../lib/anthropic-client", () => ({
  anthropic: {},
  SONNET_MODEL: "test",
}));

vi.mock("../lib/ai-usage-ledger", () => ({
  trackAiUsageCall: vi.fn(),
}));

import { createUploadFilesMiddleware } from "../lib/file-upload";

function makeApp() {
  const app = express();
  app.use((req, _res, next) => {
    (req as any).session = { teacherId: 1 };
    (req as any).log = { error: vi.fn() };
    next();
  });
  app.post(
    "/upload",
    createUploadFilesMiddleware({ maxFiles: 1, maxBytes: 1024 }),
    (req, res) => res.json({ files: ((req.files as Express.Multer.File[]) || []).length }),
  );
  return app;
}

describe("createUploadFilesMiddleware overrides", () => {
  it("rejects a second file before the route handler", async () => {
    const response = await request(makeApp())
      .post("/upload")
      .attach("files", Buffer.from("one"), { filename: "one.png", contentType: "image/png" })
      .attach("files", Buffer.from("two"), { filename: "two.png", contentType: "image/png" });

    expect(response.status).toBe(413);
    expect(response.body.message).toContain("1");
  });

  it("rejects a file exceeding the caller's byte limit", async () => {
    const response = await request(makeApp())
      .post("/upload")
      .attach("files", Buffer.alloc(1025), { filename: "large.png", contentType: "image/png" });

    expect(response.status).toBe(413);
  });

  it("accepts one file within the caller's limits", async () => {
    const response = await request(makeApp())
      .post("/upload")
      .attach("files", Buffer.alloc(1023), { filename: "ok.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(response.body.files).toBe(1);
  });
});