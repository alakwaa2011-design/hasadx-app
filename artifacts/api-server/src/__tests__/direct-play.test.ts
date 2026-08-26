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
  const insertPayloads: unknown[] = [];
  function makeChain(result: unknown): unknown {
    return new Proxy({}, {
      get(_target, prop: string | symbol) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
            if (result instanceof Error) reject(result);
            else resolve(result);
          };
        }
        return () => makeChain(result);
      },
    });
  }
  return { queue, insertPayloads, makeChain };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: (_t, p) => (typeof p === "string" ? p : undefined) });
  return {
    db: {
      select: () => dbState.makeChain(dbState.queue.shift()),
      insert: () => ({
        values: (payload: unknown) => {
          dbState.insertPayloads.push(payload);
          return dbState.makeChain(dbState.queue.shift());
        },
      }),
      update: () => dbState.makeChain(dbState.queue.shift()),
      delete: () => dbState.makeChain(dbState.queue.shift()),
    },
    assignmentsTable:    stub,
    questionsTable:      stub,
    directPlayLinksTable: stub,
    wheelTemplatesTable: stub,
  };
});

// ── Game engine spies ──────────────────────────────────────────────────────
const gameMocks = vi.hoisted(() => ({
  createGame:              vi.fn(),
  getGame:                 vi.fn(),
  deleteGame:              vi.fn(),
  startGameFromRest:       vi.fn(),
  createRocketGameDirectly: vi.fn(),
  startRocketGameFromRest:  vi.fn(),
}));

vi.mock("../game/manager",        () => ({
  createGame: gameMocks.createGame,
  getGame: gameMocks.getGame,
  deleteGame: gameMocks.deleteGame,
}));
vi.mock("../game/socket-handlers", () => ({ startGameFromRest:       gameMocks.startGameFromRest }));
vi.mock("../game/rocket-handlers", () => ({
  createRocketGameDirectly: gameMocks.createRocketGameDirectly,
  startRocketGameFromRest:  gameMocks.startRocketGameFromRest,
}));

// ── App builder ────────────────────────────────────────────────────────────
import express from "express";
import request from "supertest";
import directPlayRouter, { canCreateDirectPlayLink } from "../routes/direct-play";

function makeApp(session: { teacherId?: number } | null = null) {
  const app = express();
  app.set("trust proxy", 1);
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
const SHARED_LIBRARY_ASSIGNMENT = {
  id: 1,
  title: "نشاط منشور في المكتبة",
  teacherId: 77,
  isShared: true,
  hiddenByAdmin: false,
  accessMode: "public",
};
const LINK_ROW_WAMEETH   = { assignmentId: 1, gameType: "wameeth", title: "نشاط تجريبي", assignmentTitle: "نشاط تجريبي" };
const LINK_ROW_CLASS     = { assignmentId: 1, gameType: "wameeth_class", title: "نشاط تجريبي" };
const LINK_ROW_ROCKET    = { assignmentId: 1, gameType: "rocket_race", title: "نشاط تجريبي" };
const WHEEL_TEMPLATE_ROW = {
  id: 9,
  teacherId: 42,
  title: "عجلة العلوم",
  language: "ar",
  segments: [
    { id: "q1", text: "ما الماء؟", answer: "سائل", points: 100, kind: "question" },
    { id: "q2", text: "ما الشمس؟", answer: "نجم", points: 200, kind: "question" },
  ],
  config: { teamCount: 2, teamNames: ["الفريق الأول", "الفريق الثاني"], spinSeconds: 5, soundOn: true },
};
const LINK_ROW_WHEEL = {
  wheelTemplateId: 9,
  gameType: "wheel",
  wheelTitle: "عجلة العلوم",
  wheelSegments: WHEEL_TEMPLATE_ROW.segments,
};
const Q_COUNT            = [{ count: 5 }];
const WAMEETH_QS         = [
  { id: 1, text: "Q1", questionType: "mcq",
    optionA: "A1", optionB: "B1", optionC: "C1", optionD: "D1",
    correctAnswer: "B", imageUrl: null, readAloud: false, difficulty: null },
];
const WAMEETH_CLASS_QS = [
  ...WAMEETH_QS,
  { id: 3, text: "Q3", questionType: "true_false",
    optionA: "صح", optionB: "خطأ", optionC: null, optionD: null,
    correctAnswer: "true", imageUrl: null, readAloud: false, difficulty: null },
];
const ROCKET_QS = [
  { id: 2, text: "Q2", questionType: "mcq",
    optionA: "X", optionB: "Y", optionC: "Z", optionD: "W",
    correctAnswer: "A", imageUrl: null },
];

function push(...items: unknown[]) { dbState.queue.push(...items); }

beforeEach(() => {
  dbState.queue.length = 0;
  dbState.insertPayloads.length = 0;
  vi.clearAllMocks();
  gameMocks.createGame.mockReturnValue({ pin: "111111" });
  gameMocks.getGame.mockReturnValue(undefined);
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
    expect(res.body.controlToken).toMatch(/^[a-f0-9]{64}$/);
    expect(gameMocks.createGame).toHaveBeenCalledOnce();
    expect(gameMocks.startGameFromRest).toHaveBeenCalledWith("111111");
    // A direct link creates one independent player, so no unusable gift round
    // should interrupt the session. Live individual Wameeth games keep gifts.
    expect(gameMocks.createGame.mock.results[0]?.value.giftsEnabled).toBe(false);
    expect(gameMocks.createGame.mock.results[0]?.value.independentSession).toBe(true);
    expect(gameMocks.createGame.mock.results[0]?.value.independentControllerToken)
      .toBe(res.body.controlToken);
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

describe("وميض الصف — إعداد عام مباشر بلا مصادقة", () => {
  it("يعيد إعداد شاشتي اللاعبين فقط لرابط wameeth_class", async () => {
    push([LINK_ROW_CLASS], WAMEETH_CLASS_QS);
    const res = await request(makeApp())
      .get(`/api/play/${VALID_TOKEN}/wameeth-class`);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("نشاط تجريبي");
    expect(res.body.duration).toBe(20);
    expect(res.body.questions).toEqual([
      {
        text: "Q1",
        options: ["A1", "B1", "C1", "D1"],
        correct: 1,
        imageUrl: null,
      },
      {
        text: "Q3",
        options: ["صح", "خطأ"],
        correct: 0,
        imageUrl: null,
      },
    ]);
    expect(res.body).not.toHaveProperty("assignmentId");
  });

  it("يرفض استخدام token لعبة مستقلة لقراءة إعداد وميض الصف", async () => {
    push([LINK_ROW_WAMEETH]);
    const res = await request(makeApp())
      .get(`/api/play/${VALID_TOKEN}/wameeth-class`);

    expect(res.status).toBe(404);
    expect(dbState.queue.length).toBe(0);
  });

  it("يرفض token غير صالح قبل أي استعلام", async () => {
    const res = await request(makeApp())
      .get(`/api/play/${"z".repeat(32)}/wameeth-class`);

    expect(res.status).toBe(404);
    expect(dbState.queue.length).toBe(0);
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

  it("rate limit مربوط بالرابط نفسه ولا يمكن تجاوزه بتدوير X-Forwarded-For", async () => {
    const app = makeApp();
    const rateToken = "c".repeat(32);

    for (let i = 0; i < 120; i++) {
      push([LINK_ROW_WAMEETH], WAMEETH_QS);
      const res = await request(app)
        .post(`/api/play/${rateToken}/start`)
        .set("X-Forwarded-For", `203.0.113.${(i % 250) + 1}, 198.51.100.${(i % 250) + 1}`);
      expect(res.status).toBe(200);
    }

    push([LINK_ROW_WAMEETH]);
    const blocked = await request(app)
      .post(`/api/play/${rateToken}/start`)
      .set("X-Forwarded-For", "192.0.2.99, 198.51.100.250");

    expect(blocked.status).toBe(429);
    expect(dbState.queue.length).toBe(0);
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
// AC-4b  نشاط المكتبة → وميض الصف / المستقل بلا استيراد
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-4b نشاط المكتبة المنشور في وميض", () => {
  it("يسمح فقط بنشاط مكتبة ظاهر لوميض الصف والمستقل، مع بقاء الأنماط الأخرى للمالك", () => {
    expect(canCreateDirectPlayLink(SHARED_LIBRARY_ASSIGNMENT, 999, "wameeth")).toBe(true);
    expect(canCreateDirectPlayLink(SHARED_LIBRARY_ASSIGNMENT, 999, "wameeth_class")).toBe(true);
    expect(canCreateDirectPlayLink(SHARED_LIBRARY_ASSIGNMENT, 999, "rocket_race")).toBe(false);

    expect(canCreateDirectPlayLink({
      ...SHARED_LIBRARY_ASSIGNMENT,
      isShared: false,
    }, 999, "wameeth")).toBe(false);
    expect(canCreateDirectPlayLink({
      ...SHARED_LIBRARY_ASSIGNMENT,
      hiddenByAdmin: true,
    }, 999, "wameeth_class")).toBe(false);
    expect(canCreateDirectPlayLink({
      ...SHARED_LIBRARY_ASSIGNMENT,
      accessMode: "private",
    }, 999, "wameeth")).toBe(false);
  });

  it("ينشئ رابط وميض الصف للنشاط المنشور باسم المعلم الذي بدأه، بلا استيراد", async () => {
    push(
      [SHARED_LIBRARY_ASSIGNMENT],
      Q_COUNT,
      [],
      [],
    );

    const res = await request(makeApp({ teacherId: 999 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth_class" });

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);
    expect(dbState.insertPayloads).toHaveLength(1);
    expect(dbState.insertPayloads[0]).toMatchObject({
      assignmentId: 1,
      gameType: "wameeth_class",
      teacherId: 999,
    });
    expect(dbState.queue.length).toBe(0);
  });

  it("ينشئ رابط اللعبة المستقلة للنشاط المنشور بلا استيراد ثم يبدأ الجلسة", async () => {
    push(
      [SHARED_LIBRARY_ASSIGNMENT],
      Q_COUNT,
      [],
      [],
    );

    const linkResponse = await request(makeApp({ teacherId: 999 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth" });

    expect(linkResponse.status).toBe(200);
    expect(dbState.insertPayloads).toHaveLength(1);
    expect(dbState.insertPayloads[0]).toMatchObject({
      assignmentId: 1,
      gameType: "wameeth",
      teacherId: 999,
    });

    push([LINK_ROW_WAMEETH], WAMEETH_QS);
    const startResponse = await request(makeApp())
      .post(`/api/play/${VALID_TOKEN}/start`);

    expect(startResponse.status).toBe(200);
    expect(startResponse.body.playRoute).toBe("/game/play/111111");
    expect(gameMocks.createGame.mock.results[0]?.value.independentSession).toBe(true);
    expect(gameMocks.createGame.mock.results[0]?.value.giftsEnabled).toBe(false);
  });

  it("يرفض إنشاء رابط وميض عندما لا تعيد قاعدة البيانات نشاطاً ظاهراً للمعلم", async () => {
    push([]);

    const res = await request(makeApp({ teacherId: 999 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("النشاط غير موجود");
    expect(dbState.insertPayloads).toEqual([]);
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

  it("سباق إنشاء متزامن → يستعيد token الموجود بعد unique violation بدلاً من 500", async () => {
    const racedToken = "b".repeat(32);
    const uniqueViolation = Object.assign(new Error("duplicate key"), { code: "23505" });
    push(
      [ASSIGNMENT_ROW],
      Q_COUNT,
      [],
      uniqueViolation,
      [{ token: racedToken }],
    );

    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/assignments/1/play-links")
      .send({ gameType: "wameeth_class" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe(racedToken);
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

// ═══════════════════════════════════════════════════════════════════════════
// AC-6  عجلة التحدي — رابط عرض معلّم مباشر
// ═══════════════════════════════════════════════════════════════════════════
describe("AC-6  رابط عرض عجلة التحدي", () => {
  it("ينشئ المالك token عشوائياً ثابتاً للقالب المحفوظ", async () => {
    push(
      [WHEEL_TEMPLATE_ROW],
      [],
      [],
    );
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/wheel-templates/9/play-links");

    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);
    expect(dbState.insertPayloads[0]).toMatchObject({
      wheelTemplateId: 9,
      gameType: "wheel",
      teacherId: 42,
    });
  });

  it("يرفض إنشاء الرابط لمعلّم ليس مالك القالب بلا تسريب", async () => {
    push([{ ...WHEEL_TEMPLATE_ROW, teacherId: 77 }]);
    const res = await request(makeApp({ teacherId: 42 }))
      .post("/api/wheel-templates/9/play-links");

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty("teacherId");
    expect(dbState.insertPayloads).toEqual([]);
  });

  it("يفتح العرض العام بأقل بيانات ضرورية ودون معرف القالب", async () => {
    push([LINK_ROW_WHEEL]);
    const info = await request(makeApp()).get(`/api/play/${VALID_TOKEN}/info`);
    expect(info.status).toBe(200);
    expect(info.body).toEqual({
      title: "عجلة العلوم",
      questionCount: 2,
      gameType: "wheel",
    });
    expect(info.body).not.toHaveProperty("wheelTemplateId");

    push([{
      gameType: "wheel",
      title: WHEEL_TEMPLATE_ROW.title,
      language: WHEEL_TEMPLATE_ROW.language,
      segments: WHEEL_TEMPLATE_ROW.segments,
      config: WHEEL_TEMPLATE_ROW.config,
    }]);
    const display = await request(makeApp()).get(`/api/play/${VALID_TOKEN}/wheel`);
    expect(display.status).toBe(200);
    expect(display.body).toMatchObject({
      title: "عجلة العلوم",
      language: "ar",
      segments: WHEEL_TEMPLATE_ROW.segments,
      config: WHEEL_TEMPLATE_ROW.config,
    });
    expect(display.body).not.toHaveProperty("id");
    expect(display.body).not.toHaveProperty("teacherId");
  });

  it("إلغاء الرابط يجعله غير متاح ويقتصر على المالك", async () => {
    push([{ teacherId: 42 }], []);
    const cancelled = await request(makeApp({ teacherId: 42 }))
      .delete("/api/wheel-templates/9/play-links");
    expect(cancelled.status).toBe(200);

    push([]);
    const unavailable = await request(makeApp()).get(`/api/play/${VALID_TOKEN}/wheel`);
    expect(unavailable.status).toBe(404);
    expect(unavailable.body.message).toContain("لم يعد متاحاً");

    push([{ teacherId: 77 }]);
    const forbidden = await request(makeApp({ teacherId: 42 }))
      .delete("/api/wheel-templates/9/play-links");
    expect(forbidden.status).toBe(404);
  });
});
