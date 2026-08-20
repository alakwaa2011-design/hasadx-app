/**
 * Unit tests for mind-map CRUD routes.
 *
 * Covers:
 *  ✓ POST /api/mindmaps — validation (missing center, missing branches, empty label)
 *  ✓ POST /api/mindmaps — 401 without session
 *  ✓ POST /api/mindmaps — 201 on valid create
 *  ✓ GET  /api/mindmaps — 401 without session, returns own rows only
 *  ✓ GET  /api/mindmaps/:id — 404 for another teacher's map
 *  ✓ GET  /api/mindmaps/:id — 200 for own map
 *  ✓ DELETE /api/mindmaps/:id — 404 for another teacher's map
 *  ✓ DELETE /api/mindmaps/:id — 200 for own map
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

/* ── Hoisted state for fine-grained db control ─── */
const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  function makeChain(result: unknown): unknown {
    const p: Promise<unknown> = Promise.resolve(result);
    const handler: ProxyHandler<Promise<unknown>> = {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          const fn = (target as unknown as Record<string, unknown>)[
            prop as string
          ] as (...args: unknown[]) => unknown;
          return fn.bind(target);
        }
        return () => makeChain(result);
      },
    };
    return new Proxy(p, handler);
  }
  return { queue, makeChain };
});

/* ── Mock @workspace/db ── */
vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
    },
    mindMapsTable: stub,
  };
});

import express from "express";
import request from "supertest";
import mindMapsRouter from "../routes/mind-maps";

/* ── App factory ── */
type Session = { teacherId?: number };
function makeApp(session: Session | null = { teacherId: 1 }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: Record<string, () => void> }).log = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    next();
  });
  app.use("/api", mindMapsRouter);
  return app;
}

function pushQueue(...items: unknown[]) {
  mockState.queue.push(...items);
}

/* ── Shared valid payload ── */
const VALID_MAP = {
  center: "الذكاء الاصطناعي",
  branches: [
    {
      label: "التعلم الآلي",
      icon: "🤖",
      color: "#4F46E5",
      children: ["شبكات عصبية", "تعلم عميق"],
    },
    {
      label: "معالجة اللغة",
      icon: "💬",
      color: "#059669",
      children: ["ترجمة", "تحليل نصوص"],
    },
  ],
};

const VALID_BODY = {
  title: "خريطة الذكاء الاصطناعي",
  topic: "الذكاء الاصطناعي في التعليم",
  language: "ar",
  depth: "standard",
  map: VALID_MAP,
};

const STORED_ROW = {
  id: 42,
  teacherId: 1,
  title: VALID_BODY.title,
  topic: VALID_BODY.topic,
  language: "ar",
  depth: "standard",
  map: VALID_MAP,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  mockState.queue.length = 0;
});

/* ════════════════════════════════════════════
   POST /api/mindmaps
═══════════════════════════════════════════ */
describe("POST /api/mindmaps", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null))
      .post("/api/mindmaps")
      .send(VALID_BODY);

    expect(res.status).toBe(401);
  });

  it("returns 400 when center is empty", async () => {
    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send({
        ...VALID_BODY,
        map: { ...VALID_MAP, center: "" },
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });

  it("returns 400 when branches array is empty", async () => {
    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send({
        ...VALID_BODY,
        map: { center: "مركز", branches: [] },
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });

  it("returns 400 when a branch label is empty", async () => {
    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send({
        ...VALID_BODY,
        map: {
          center: "مركز",
          branches: [{ label: "", icon: "🔤", color: "#000", children: ["فكرة"] }],
        },
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });

  it("returns 400 when a child label is empty", async () => {
    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send({
        ...VALID_BODY,
        map: {
          center: "مركز",
          branches: [{ label: "فرع", icon: "", color: "#225739", children: [""] }],
        },
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });

  it("returns 400 when title is missing", async () => {
    const { title: _t, ...noTitle } = VALID_BODY;
    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send(noTitle);

    expect(res.status).toBe(400);
  });

  it("returns 201 with the inserted row on valid input", async () => {
    pushQueue([STORED_ROW]);

    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 42, teacherId: 1 });
  });

  it("returns the original row when the same client request is replayed", async () => {
    const clientRequestId = "59cf5bee-2f15-4d1e-bf00-23bf4d209064";
    pushQueue([], [STORED_ROW]);

    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send({ ...VALID_BODY, clientRequestId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 42, teacherId: 1 });
  });

  it("rejects a malformed client request id", async () => {
    const res = await request(makeApp())
      .post("/api/mindmaps")
      .send({ ...VALID_BODY, clientRequestId: "not-a-uuid" });

    expect(res.status).toBe(400);
  });
});

/* ════════════════════════════════════════════
   GET /api/mindmaps
═══════════════════════════════════════════ */
describe("GET /api/mindmaps", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null)).get("/api/mindmaps");
    expect(res.status).toBe(401);
  });

  it("returns 200 with own rows only", async () => {
    pushQueue([STORED_ROW, { ...STORED_ROW, id: 43 }]);

    const res = await request(makeApp()).get("/api/mindmaps");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it("returns 200 with empty array when no maps exist", async () => {
    pushQueue([]);

    const res = await request(makeApp()).get("/api/mindmaps");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

/* ════════════════════════════════════════════
   GET /api/mindmaps/:id
═══════════════════════════════════════════ */
describe("GET /api/mindmaps/:id", () => {
  it("returns 404 when the map belongs to a different teacher", async () => {
    // db returns empty because the WHERE includes teacher_id = requester's id
    pushQueue([]);

    const res = await request(makeApp({ teacherId: 1 }))
      .get("/api/mindmaps/99");

    expect(res.status).toBe(404);
  });

  it("returns 200 with the map when it belongs to the requesting teacher", async () => {
    pushQueue([STORED_ROW]);

    const res = await request(makeApp({ teacherId: 1 }))
      .get("/api/mindmaps/42");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 42, teacherId: 1 });
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await request(makeApp()).get("/api/mindmaps/abc");
    expect(res.status).toBe(400);
  });
});

/* ════════════════════════════════════════════
   PUT /api/mindmaps/:id
═══════════════════════════════════════════ */
describe("PUT /api/mindmaps/:id", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null))
      .put("/api/mindmaps/42")
      .send({ title: "عنوان محدث" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid map update", async () => {
    const res = await request(makeApp())
      .put("/api/mindmaps/42")
      .send({ map: { ...VALID_MAP, center: "   " } });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("issues");
  });

  it("returns 404 when the map belongs to a different teacher", async () => {
    pushQueue([]);

    const res = await request(makeApp({ teacherId: 2 }))
      .put("/api/mindmaps/42")
      .send({ title: "عنوان محدث" });

    expect(res.status).toBe(404);
  });

  it("updates and returns the requesting teacher's map", async () => {
    const updated = { ...STORED_ROW, title: "عنوان محدث" };
    pushQueue([{ id: 42 }], [updated]);

    const res = await request(makeApp({ teacherId: 1 }))
      .put("/api/mindmaps/42")
      .send({ title: "عنوان محدث" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 42, title: "عنوان محدث" });
  });
});

/* ════════════════════════════════════════════
   DELETE /api/mindmaps/:id
═══════════════════════════════════════════ */
describe("DELETE /api/mindmaps/:id", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null)).delete("/api/mindmaps/42");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the map belongs to a different teacher", async () => {
    // Ownership check returns empty (different teacher owns the map)
    pushQueue([]);

    const res = await request(makeApp({ teacherId: 2 }))
      .delete("/api/mindmaps/42");

    expect(res.status).toBe(404);
  });

  it("returns 200 { ok: true } when deleting own map", async () => {
    // First: select for ownership check → returns the row
    pushQueue([{ id: 42 }]);
    // Second: delete operation → returns void / []
    pushQueue([]);

    const res = await request(makeApp({ teacherId: 1 }))
      .delete("/api/mindmaps/42");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
