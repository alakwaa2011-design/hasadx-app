/* ─────────────────────────────────────────────────────────────────────────────
 * Acceptance tests — رابط لعب مباشر (direct-play.ts)
 *
 * AC-1  GET /api/play/:token/info  +  POST /start (وميض) بلا تسجيل دخول
 * AC-2  POST /start (rocket_race) → startRocketGameFromRest يُستدعى قبل اللاعب
 * AC-3  جلستان مستقلتان — نفس الـ token ينتج PINين مختلفين
 * AC-4  token خاطئ / نشاط غير موجود / معلم غير مالك → 404/401 بلا تسريب
 * AC-5  إنشاء الرابط idempotent — يُعيد نفس الـ token لنفس (نشاط + نوع)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Queue-based DB mock (overrides global setup-db-mock.ts) ────────────────
const dbState = vi.hoisted(() => {
  const queue: unknown[] = [];
  function makeChain(result: unknown): unknown {
    const p = Promise.resolve(result);
    return new Proxy(p as object, {
      get(t: any, prop: string | symbol) {
        if (["then", "catch", "finally"].includes(prop as string))
          return t[prop].bind(t);
        return () => makeChain(result);
      },
    });
  }
  return { queue, makeChain };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: (_t, p) => (typeof p === "string" ? p : undefined) });
  return {
    db: {
      select: () => dbState.makeChain(dbState.queue.shift()),
      insert: () => dbState.makeChain(dbState.queue.shift()),
      update: () => dbState.makeChain(dbState.queue.shift()),
      delete: () => dbState.makeChain(dbState.queue.shift()),
    },
    assignmentsTable:    stub,
    questionsTable:      stub,
    directPlayLinksTable: stub,
  };
});

// ── Game engine spies ──────────────────────────────────────────────────────
const gameMocks = vi.hoisted(() => ({
  createGame:              vi.fn(),
  startGameFromRest:       vi.fn(),
  createRocketGameDirectly: vi.fn(),
  startRocketGameFromRest:  vi.fn(),
}));

vi.mock("../game/manager",        () => ({ createGame:              gameMocks.createGame }));
vi.mock("../game/socket-handlers", () => ({ startGameFromRest:       gameMocks.startGameFromRest }));
vi.mock("../game/rocket-handlers", () => ({
  createRocketGameDirectly: gameMocks.createRocketGameDirectly,
  startRocketGameFromRest:  gameMocks.startRocketGameFromRest,
}));

// ── App builder ────────────────────────────────────────────────────────────
import express from "express";
import request from "supertest";
import directPlayRouter from "../routes/direct-play";

function makeApp(session: { teacherId?: number } | null = null) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.session = session ?? {};
    req.log = { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use("/api", directPlayRouter);
  return app;
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const VALID_TOKEN = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"; // 32 hex chars

const ASSIGNMENT_ROW     = { id: 1, title: "نشاط تجريبي", teacherId: 42 };
const LINK_ROW_WAMEETH   = { assignmentId: 1, gameType: "wameeth",     title: "نشاط تجريبي" };
const LINK_ROW_ROCKET    = { assignmentId: 1, gameType: "rocket_race", title: "نشاط تجريبي" };
const Q_COUNT            = [{ count: 5 }];
const WAMEETH_QS         = [
  { id: 1, text: "Q1", questionType: "mcq",
    optionA: "A1", optionB: "B1", optionC: "C1", optionD: "D1",
    correctAnswer: "B", imageUrl: null, readAloud: false, difficulty: null },
];
const ROCKET_QS = [
  { id: 2, text: "Q2", questionType: "mcq",
    optionA: "X", optionB: "Y", optionC: "Z", optionD: "W",
    correctAnswer: "A", imageUrl: null },
];

function push(...items: unknown[]) { dbState.queue.push(...items); }

beforeEach(() => {
  dbState.queue.length = 0;
  vi.clearAllMocks();
  gameMocks.createGame.mockReturnValue({ pin: "111111" });
  gameMocks.createRocketGameDirectly.mockReturnValue({ pin: "222222", creatorToken: "tok" });
  gameMocks.startRocketGameFromRest.mockReturnValue({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-1  وميض — رابط علني، بلا تسجيل دخول
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-1  GET /info  +  POST /start (وميض) — بلا مصادقة", () => {

  it("GET /api/play/:token/info يُعيد title + questionCount + gameType", async () => {
    push([LINK_ROW_WAMEETH], Q_COUNT);
    const res = await request(makeApp(/* no session */))
      .get(`/api/play/${VALID_TOKEN}/info`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("نشاط تجريبي");
    expect(res.body.questionCount).toBe(5);
    expect(res.body.gameType).toBe("wameeth");
  });

  it("POST /api/play/:token/start (وميض) ينشئ جلسة ويُعيد /game/play/:pin", async () => {
    push([LINK_ROW_WAMEETH], WAMEETH_QS);
    const res = await request(makeApp(/* no session */))
      .post(`/api/play/${VALID_TOKEN}/start`);
    expect(res.status).toBe(200);
    expect(res.body.gameType).toBe("wameeth");
    expect(res.body.pin).toBe("111111");
    expect(res.body.playRoute).toBe("/game/play/111111");
    expect(gameMocks.createGame).toHaveBeenCalledOnce();
    expect(gameMocks.startGameFromRest).toHaveBeenCalledWith("111111");
  });

  it("startGameFromRest يتلقى PIN الصحيح — بلا خلط مع صواريخ", async () => {
    gameMocks.createGame.mockReturnValue({ pin: "WMPIN1" });
    push([LINK_ROW_WAMEETH], WAMEETH_QS);
    const res = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);
    expect(res.status).toBe(200);
    expect(gameMocks.startGameFromRest).toHaveBeenCalledWith("WMPIN1");
    expect(gameMocks.startRocketGameFromRest).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-2  سباق الصواريخ — late-join: اللعبة تبدأ قبل وصول اللاعب
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-2  rocket_race — startRocketGameFromRest يُستدعى قبل اتصال اللاعب", () => {

  it("POST /start (rocket_race) يُعيد /game/rocket/play/:pin", async () => {
    push([LINK_ROW_ROCKET], ROCKET_QS);
    const res = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);
    expect(res.status).toBe(200);
    expect(res.body.gameType).toBe("rocket_race");
    expect(res.body.pin).toBe("222222");
    expect(res.body.playRoute).toBe("/game/rocket/play/222222");
  });

  it("createRocketGameDirectly يُستدعى أوّلاً ثم startRocketGameFromRest (late-join pattern)", async () => {
    push([LINK_ROW_ROCKET], ROCKET_QS);
    await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);
    expect(gameMocks.createRocketGameDirectly).toHaveBeenCalledOnce();
    expect(gameMocks.startRocketGameFromRest).toHaveBeenCalledOnce();
    // ترتيب الاستدعاء: إنشاء ← ثم بدء (اللاعب يُلحق لاحقاً)
    const createOrder = gameMocks.createRocketGameDirectly.mock.invocationCallOrder[0];
    const startOrder  = gameMocks.startRocketGameFromRest.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(startOrder);
  });

  it("startRocketGameFromRest يتلقى PIN اللعبة المنشأة للتو", async () => {
    gameMocks.createRocketGameDirectly.mockReturnValue({ pin: "RKTX99", creatorToken: "x" });
    push([LINK_ROW_ROCKET], ROCKET_QS);
    await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);
    expect(gameMocks.startRocketGameFromRest).toHaveBeenCalledWith("RKTX99");
  });

  it("startGameFromRest (وميض) لا يُستدعى لرابط صواريخ", async () => {
    push([LINK_ROW_ROCKET], ROCKET_QS);
    await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);
    expect(gameMocks.startGameFromRest).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-3  استقلالية الجلسات — نفس الرابط = جلستان لا تتشاركان PIN
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-3  استقلالية الجلسات", () => {

  it("وميض: جلستان على نفس token → PINان مختلفان (لعبتان منفصلتان)", async () => {
    gameMocks.createGame
      .mockReturnValueOnce({ pin: "GAME_A" })
      .mockReturnValueOnce({ pin: "GAME_B" });

    push([LINK_ROW_WAMEETH], WAMEETH_QS); // for first call
    const r1 = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);

    push([LINK_ROW_WAMEETH], WAMEETH_QS); // for second call
    const r2 = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.pin).toBe("GAME_A");
    expect(r2.body.pin).toBe("GAME_B");
    expect(r1.body.pin).not.toBe(r2.body.pin);
    expect(gameMocks.createGame).toHaveBeenCalledTimes(2);
  });

  it("صواريخ: جلستان على نفس token → PINان مختلفان", async () => {
    gameMocks.createRocketGameDirectly
      .mockReturnValueOnce({ pin: "RKT_A", creatorToken: "a" })
      .mockReturnValueOnce({ pin: "RKT_B", creatorToken: "b" });

    push([LINK_ROW_ROCKET], ROCKET_QS);
    const r1 = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);

    push([LINK_ROW_ROCKET], ROCKET_QS);
    const r2 = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);

    expect(r1.body.pin).toBe("RKT_A");
    expect(r2.body.pin).toBe("RKT_B");
    expect(r1.body.pin).not.toBe(r2.body.pin);
    expect(gameMocks.createRocketGameDirectly).toHaveBeenCalledTimes(2);
    expect(gameMocks.startRocketGameFromRest).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-4  الأمان — لا تسريب معلومات، لا إنشاء جلسة
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-4  الأمان والخصوصية", () => {

  it("token بطول خاطئ (31 حرفاً) → 404 بدون DB", async () => {
    const res = await request(makeApp()).get(`/api/play/${"a".repeat(31)}/info`);
    expect(res.status).toBe(404);
    expect(dbState.queue.length).toBe(0); // لا استعلام DB
  });

  it("token بطول خاطئ (33 حرفاً) → 404 بدون DB", async () => {
    const res = await request(makeApp()).get(`/api/play/${"a".repeat(33)}/info`);
    expect(res.status).toBe(404);
    expect(dbState.queue.length).toBe(0);
  });

  it("token بحروف غير hex ('z') → 404 بدون DB", async () => {
    const res = await request(makeApp()).get(`/api/play/${"z".repeat(32)}/info`);
    expect(res.status).toBe(404);
    expect(dbState.queue.length).toBe(0);
  });

  it("token صالح التنسيق لكن غير موجود في DB → 404 بلا كشف assignmentId", async () => {
    push([]); // join returns empty
    const res = await request(makeApp()).get(`/api/play/${VALID_TOKEN}/info`);
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("assignmentId");
    expect(res.body).not.toHaveProperty("title");
    expect(res.body).not.toHaveProperty("questions");
  });

  it("POST /start على token غير موجود → 404، لا تُنشأ لعبة", async () => {
    push([]);
    const res = await request(makeApp()).post(`/api/play/${VALID_TOKEN}/start`);
    expect(res.status).toBe(404);
    expect(gameMocks.createGame).not.toHaveBeenCalled();
    expect(gameMocks.createRocketGameDirectly).not.toHaveBeenCalled();
  });

  it("POST /play-links بلا جلسة معلم → 401، لا DB", async () => {
    const res = await request(makeApp(null))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth" });
    expect(res.status).toBe(401);
    expect(dbState.queue.length).toBe(0);
  });

  it("POST /play-links لنشاط معلم آخر → 404 (لا يكشف وجود النشاط)", async () => {
    push([]); // teacher filter returns nothing
    const res = await request(makeApp({ teacherId: 999 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth" });
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("assignmentId");
    expect(res.body).not.toHaveProperty("title");
  });

  it("gameType غير مدعوم (escape_room) → 400 بلا DB", async () => {
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "escape_room" });
    expect(res.status).toBe(400);
    expect(dbState.queue.length).toBe(0);
  });

  it("gameType غير مدعوم (tug_of_war) → 400 بلا DB", async () => {
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "tug_of_war" });
    expect(res.status).toBe(400);
    expect(dbState.queue.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5  إنشاء الرابط — idempotent (نفس الـ token لنفس الزوج)
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-5  إنشاء الرابط — idempotent", () => {

  it("token موجود مسبقاً → يُعاد بدون INSERT", async () => {
    const existingToken = "existing32chartoken0000000000000";
    push(
      [ASSIGNMENT_ROW],          // getTeacherAssignment
      Q_COUNT,                    // countPlayableQuestions
      [{ token: existingToken }], // existing link found
    );
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe(existingToken);
    // no INSERT consumed from queue
    expect(dbState.queue.length).toBe(0);
  });

  it("token جديد → يُنشأ token بـ 32 حرفاً hex ويُدرج في DB", async () => {
    push(
      [ASSIGNMENT_ROW], // getTeacherAssignment
      Q_COUNT,           // countPlayableQuestions
      [],                // no existing link
      [],                // insert
    );
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "rocket_race" });
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);
    expect(dbState.queue.length).toBe(0);
  });

  it("نشاط بلا أسئلة → 400", async () => {
    push(
      [ASSIGNMENT_ROW],    // getTeacherAssignment
      [{ count: 0 }],      // no questions
    );
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth" });
    expect(res.status).toBe(400);
  });
});
