/**
 * Tests for presentation-activities routes (task #980):
 *  - GET /presentation-activities/suggestions — auth, relevance ranking,
 *    playability filter (questionCount >= 1), weak-match exclusion.
 *  - POST /presentation-activities — auth, validation, idempotent create
 *    keyed on (teacherId, slideKey) with reuse on replay.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

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

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  const txMethods = () => ({
    select: () => mockState.makeChain(mockState.queue.shift()),
    insert: () => mockState.makeChain(mockState.queue.shift()),
    update: () => mockState.makeChain(mockState.queue.shift()),
    delete: () => mockState.makeChain(mockState.queue.shift()),
    execute: () => mockState.makeChain(mockState.queue.shift()),
  });
  return {
    db: {
      ...txMethods(),
      select: () => mockState.makeChain(mockState.queue.shift()),
      transaction: async (fn: (tx: unknown) => unknown) => fn(txMethods()),
    },
    assignmentsTable: stub,
    questionsTable: stub,
    teachersTable: stub,
  };
});

import express from "express";
import request from "supertest";
import router from "../routes/presentation-activities";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: { error: () => void } }).log = { error: () => {} };
    next();
  });
  app.use("/api", router);
  return app;
}

function pushQueue(...items: unknown[]) {
  mockState.queue.push(...items);
}

beforeEach(() => {
  mockState.queue.length = 0;
});

const ownRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  title: "مراجعة الكسور العشرية",
  subject: "رياضيات",
  description: "",
  teacherId: 7,
  teacherName: "أنا",
  contentKind: "competition",
  activityType: null,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  questionCount: 6,
  ...over,
});

describe("GET /presentation-activities/suggestions", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null)).get(
      "/api/presentation-activities/suggestions?q=الكسور",
    );
    expect(res.status).toBe(401);
  });

  it("returns empty suggestions for an empty/stopword-only query without querying the DB", async () => {
    const res = await request(makeApp({ teacherId: 7 })).get(
      "/api/presentation-activities/suggestions?q=درس في من",
    );
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
    expect(mockState.queue.length).toBe(0);
  });

  it("ranks own before shared, excludes zero-question rows, and sets ownerName only for shared", async () => {
    pushQueue(
      /* own */ [
        ownRow(),
        ownRow({ id: 2, title: "قواعد اللغة", subject: "لغتي", questionCount: 0 }),
      ],
      /* shared */ [
        ownRow({
          id: 3,
          title: "الكسور للصف الخامس",
          teacherId: 9,
          teacherName: "معلم آخر",
          questionCount: 10,
        }),
      ],
    );
    const res = await request(makeApp({ teacherId: 7 })).get(
      "/api/presentation-activities/suggestions?q=" + encodeURIComponent("الكسور العشرية"),
    );
    expect(res.status).toBe(200);
    const ids = res.body.suggestions.map((s: { id: number }) => s.id);
    expect(ids).toEqual([1, 3]); // own first; id 2 excluded (no questions)
    expect(res.body.suggestions[0].isOwn).toBe(true);
    expect(res.body.suggestions[0].ownerName).toBeNull();
    expect(res.body.suggestions[1].isOwn).toBe(false);
    expect(res.body.suggestions[1].ownerName).toBe("معلم آخر");
  });

  it("excludes rows matching only in the description (weak matches)", async () => {
    pushQueue(
      [ownRow({ id: 4, title: "نشاط عام", subject: "عام", description: "يتناول الكسور" })],
      [],
    );
    const res = await request(makeApp({ teacherId: 7 })).get(
      "/api/presentation-activities/suggestions?q=" + encodeURIComponent("الكسور"),
    );
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });
});

/* slideKey is presentation-scoped ("presId:slideId") because generated
   decks reuse deterministic slide ids (s1, s2, …) across presentations. */
const validCreateBody = {
  slideKey: "123:s1",
  title: "نشاط الكسور",
  activityType: "quick_quiz",
  questions: [
    {
      text: "ما ناتج 1/2 + 1/4؟",
      questionType: "mcq",
      optionA: "3/4",
      optionB: "1/4",
      optionC: "2/6",
      optionD: "1",
      correctAnswer: "A",
      points: 1,
    },
  ],
};

describe("POST /presentation-activities", () => {
  it("returns 401 without a teacher session", async () => {
    const res = await request(makeApp(null))
      .post("/api/presentation-activities")
      .send(validCreateBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 when questions are missing", async () => {
    const res = await request(makeApp({ teacherId: 7 }))
      .post("/api/presentation-activities")
      .send({ ...validCreateBody, questions: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid MCQ correct answer", async () => {
    const res = await request(makeApp({ teacherId: 7 }))
      .post("/api/presentation-activities")
      .send({
        ...validCreateBody,
        questions: [{ ...validCreateBody.questions[0], correctAnswer: "E" }],
      });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid true/false answer", async () => {
    const res = await request(makeApp({ teacherId: 7 }))
      .post("/api/presentation-activities")
      .send({
        ...validCreateBody,
        questions: [
          { text: "١+١=٢", questionType: "true_false", correctAnswer: "yes" },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("creates the assignment + questions and returns 201 with reused:false", async () => {
    pushQueue(
      "advisory-lock-ok",
      /* existing lookup */ [],
      /* insert assignment .returning() */ [
        { id: 42, title: "نشاط الكسور", activityType: "quick_quiz" },
      ],
      /* insert questions */ "questions-ok",
    );
    const res = await request(makeApp({ teacherId: 7 }))
      .post("/api/presentation-activities")
      .send(validCreateBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 42, reused: false });
    expect(mockState.queue.length).toBe(0); // all four steps ran
  });

  it("creates a SEPARATE assignment for the same slide id in a DIFFERENT presentation", async () => {
    /* Same teacher, same deterministic slide id (s1), different deck →
       different composite slideKey → full create path, no reuse. */
    pushQueue(
      "advisory-lock-ok",
      /* existing lookup for key "456:s1" finds nothing */ [],
      /* insert assignment .returning() */ [
        { id: 77, title: "نشاط الكسور", activityType: "quick_quiz" },
      ],
      /* insert questions */ "questions-ok",
    );
    const res = await request(makeApp({ teacherId: 7 }))
      .post("/api/presentation-activities")
      .send({ ...validCreateBody, slideKey: "456:s1" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 77, reused: false });
    expect(mockState.queue.length).toBe(0); // insert path fully ran — no reuse
  });

  it("replays idempotently: same slideKey returns the existing assignment without inserting", async () => {
    pushQueue(
      "advisory-lock-ok",
      /* existing lookup */ [
        { id: 42, title: "نشاط الكسور", activityType: "quick_quiz" },
      ],
      /* would-be insert results — must remain unconsumed */ "unused-1",
      "unused-2",
    );
    const res = await request(makeApp({ teacherId: 7 }))
      .post("/api/presentation-activities")
      .send(validCreateBody);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 42, reused: true });
    expect(mockState.queue.length).toBe(2); // no insert consumed the queue
  });
});
