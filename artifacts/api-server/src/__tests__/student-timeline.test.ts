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
  const stub = new Proxy(
    {},
    {
      get: () => "stub",
    },
  );
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
    },
    presentationsTable: stub,
    presentationSessionsTable: stub,
    presentationResponsesTable: stub,
    studentsTable: stub,
  };
});

import express from "express";
import request from "supertest";
import router from "../routes/student-timeline";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
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

const STUDENT_OK = {
  id: 1,
  name: "طالب",
  studentClass: "5A",
  teacherId: 1,
};

function row(opts: {
  sessionId: number;
  elementId: string;
  isCorrect: boolean | null;
  createdAt: Date;
  sessionStartedAt?: Date | null;
  presentationId?: number;
  presentationTitle?: string;
  sessionPin?: string;
  sessionStatus?: string;
  sessionEndedAt?: Date | null;
}) {
  return {
    responseId: Math.floor(Math.random() * 1e9),
    sessionId: opts.sessionId,
    elementId: opts.elementId,
    isCorrect: opts.isCorrect,
    createdAt: opts.createdAt,
    sessionStartedAt: opts.sessionStartedAt ?? null,
    sessionEndedAt: opts.sessionEndedAt ?? null,
    sessionPin: opts.sessionPin ?? "0000",
    sessionStatus: opts.sessionStatus ?? "ended",
    presentationId: opts.presentationId ?? 100,
    presentationTitle: opts.presentationTitle ?? "Deck",
  };
}

function deck(id: number, elements: Array<{ id: string; kind: string }>) {
  return {
    id,
    slides: [
      {
        elements: elements.map((e) => ({
          kind: "activity",
          id: e.id,
          activityKind: e.kind,
        })),
      },
    ],
  };
}

function summaryRow(sessionId: number, elementId: string, isCorrect: boolean | null) {
  return { sessionId, elementId, isCorrect };
}

describe("GET /students/:classStudentId/timeline — auth & ownership", () => {
  it("returns 401 when no teacher session", async () => {
    const res = await request(makeApp(null)).get("/api/students/1/timeline");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the student row does not exist", async () => {
    pushQueue([]); // student lookup empty
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when another teacher tries to read the timeline", async () => {
    pushQueue([{ ...STUDENT_OK, teacherId: 99 }]);
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("returns an empty payload when the student has no responses", async () => {
    pushQueue([STUDENT_OK], []); // student found, then no rows
    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.summary.sessionsCount).toBe(0);
    expect(res.body.trend).toEqual({
      direction: null,
      slope: null,
      sample: 0,
      reason: "insufficient_data",
    });
  });
});

describe("GET /students/:classStudentId/timeline — math", () => {
  it("rounds avgScorePct and computes correctPct per kind", async () => {
    // 7 mcq answers, 5 correct → 71.4% → 71
    const t0 = new Date("2025-01-01T10:00:00Z");
    const els = ["e1", "e2", "e3", "e4", "e5", "e6", "e7"];
    const correctness = [true, true, true, true, true, false, false]; // 5 / 7
    const rows = els.map((eid, i) =>
      row({
        sessionId: 10,
        elementId: eid,
        isCorrect: correctness[i]!,
        createdAt: new Date(t0.getTime() + i * 5_000),
        sessionStartedAt: t0,
      }),
    );
    pushQueue(
      [STUDENT_OK],
      rows,
      [deck(100, els.map((id) => ({ id, kind: "mcq" })))],
      els.map((id) => summaryRow(10, id, true)),
    );

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.summary.totalAnswered).toBe(7);
    expect(res.body.summary.totalCorrect).toBe(5);
    expect(res.body.summary.avgScorePct).toBe(71);
    const mcq = res.body.byKind.find((k: { kind: string }) => k.kind === "mcq");
    expect(mcq.correctPct).toBe(71);
    expect(mcq.eligible).toBe(true);
  });

  it("enforces the byKind eligibility threshold (>=5) and suppresses weakest when only one kind is eligible", async () => {
    const t0 = new Date("2025-02-01T10:00:00Z");
    // mcq: 5 answers (3 correct) → eligible at 60%
    // fill: 4 answers (4 correct) → NOT eligible (below threshold)
    const mcqEls = ["m1", "m2", "m3", "m4", "m5"];
    const mcqCorrect = [true, true, true, false, false];
    const fillEls = ["f1", "f2", "f3", "f4"];
    const rows = [
      ...mcqEls.map((eid, i) =>
        row({
          sessionId: 20,
          elementId: eid,
          isCorrect: mcqCorrect[i]!,
          createdAt: new Date(t0.getTime() + i * 1000),
          sessionStartedAt: t0,
        }),
      ),
      ...fillEls.map((eid, i) =>
        row({
          sessionId: 20,
          elementId: eid,
          isCorrect: true,
          createdAt: new Date(t0.getTime() + (i + 10) * 1000),
          sessionStartedAt: t0,
        }),
      ),
    ];
    const elementsForDeck = [
      ...mcqEls.map((id) => ({ id, kind: "mcq" })),
      ...fillEls.map((id) => ({ id, kind: "fill" })),
    ];
    pushQueue(
      [STUDENT_OK],
      rows,
      [deck(100, elementsForDeck)],
      [...mcqEls, ...fillEls].map((id) => summaryRow(20, id, true)),
    );

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    const fill = res.body.byKind.find(
      (k: { kind: string }) => k.kind === "fill",
    );
    expect(fill.answered).toBe(4);
    expect(fill.eligible).toBe(false);
    const mcq = res.body.byKind.find((k: { kind: string }) => k.kind === "mcq");
    expect(mcq.eligible).toBe(true);
    expect(res.body.strongestKind).toEqual({ kind: "mcq", correctPct: 60 });
    expect(res.body.weakestKind).toBeNull();
  });

  it("picks distinct strongest and weakest kinds when multiple kinds are eligible", async () => {
    const t0 = new Date("2025-03-01T10:00:00Z");
    const mcqEls = ["m1", "m2", "m3", "m4", "m5"]; // 3 correct → 60
    const mcqCorrect = [true, true, true, false, false];
    const fillEls = ["f1", "f2", "f3", "f4", "f5"]; // 5 correct → 100
    const rows = [
      ...mcqEls.map((eid, i) =>
        row({
          sessionId: 30,
          elementId: eid,
          isCorrect: mcqCorrect[i]!,
          createdAt: new Date(t0.getTime() + i * 1000),
          sessionStartedAt: t0,
        }),
      ),
      ...fillEls.map((eid, i) =>
        row({
          sessionId: 30,
          elementId: eid,
          isCorrect: true,
          createdAt: new Date(t0.getTime() + (i + 10) * 1000),
          sessionStartedAt: t0,
        }),
      ),
    ];
    pushQueue(
      [STUDENT_OK],
      rows,
      [
        deck(100, [
          ...mcqEls.map((id) => ({ id, kind: "mcq" })),
          ...fillEls.map((id) => ({ id, kind: "fill" })),
        ]),
      ],
      [...mcqEls, ...fillEls].map((id) => summaryRow(30, id, true)),
    );

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.strongestKind).toEqual({ kind: "fill", correctPct: 100 });
    expect(res.body.weakestKind).toEqual({ kind: "mcq", correctPct: 60 });
  });

  it("caps participationPct at 100 when the student answered the same element multiple times", async () => {
    const t0 = new Date("2025-04-01T10:00:00Z");
    // Student answered "e1" three times (counted in `answered`) but the
    // session only has 1 distinct scorable element → raw 300% → capped 100.
    const rows = [
      row({
        sessionId: 40,
        elementId: "e1",
        isCorrect: true,
        createdAt: new Date(t0.getTime() + 1_000),
        sessionStartedAt: t0,
      }),
      row({
        sessionId: 40,
        elementId: "e1",
        isCorrect: true,
        createdAt: new Date(t0.getTime() + 2_000),
        sessionStartedAt: t0,
      }),
      row({
        sessionId: 40,
        elementId: "e1",
        isCorrect: false,
        createdAt: new Date(t0.getTime() + 3_000),
        sessionStartedAt: t0,
      }),
    ];
    pushQueue(
      [STUDENT_OK],
      rows,
      [deck(100, [{ id: "e1", kind: "mcq" }])],
      [summaryRow(40, "e1", true)],
    );

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    // The summary averages per-session participation; with raw 300% it must
    // be capped to 100.
    expect(res.body.summary.participationPct).toBe(100);
  });

  it("excludes per-response gaps greater than 600 seconds when computing avgResponseSec", async () => {
    const t0 = new Date("2025-05-01T10:00:00Z").getTime();
    // sessionStartedAt = t0; responses at t0+10s, t0+30s (gap 20), t0+1000s (gap 970, dropped)
    const rows = [
      row({
        sessionId: 50,
        elementId: "e1",
        isCorrect: true,
        createdAt: new Date(t0 + 10_000),
        sessionStartedAt: new Date(t0),
      }),
      row({
        sessionId: 50,
        elementId: "e2",
        isCorrect: true,
        createdAt: new Date(t0 + 30_000),
        sessionStartedAt: new Date(t0),
      }),
      row({
        sessionId: 50,
        elementId: "e3",
        isCorrect: true,
        createdAt: new Date(t0 + 1_000_000),
        sessionStartedAt: new Date(t0),
      }),
    ];
    pushQueue(
      [STUDENT_OK],
      rows,
      [
        deck(100, [
          { id: "e1", kind: "mcq" },
          { id: "e2", kind: "mcq" },
          { id: "e3", kind: "mcq" },
        ]),
      ],
      [
        summaryRow(50, "e1", true),
        summaryRow(50, "e2", true),
        summaryRow(50, "e3", true),
      ],
    );

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    // Kept gaps: startedAt→10s = 10, 10s→30s = 20. (1000s gap dropped > 600.)
    // avg = (10 + 20) / 2 = 15
    expect(res.body.sessions[0].avgResponseSec).toBe(15);
  });

  it("flags the trend as insufficient_data when fewer than 3 sessions have a score", async () => {
    const base = new Date("2025-06-01T10:00:00Z").getTime();
    // 2 sessions, each with one scored response
    const rows = [
      row({
        sessionId: 61,
        elementId: "e1",
        isCorrect: true,
        createdAt: new Date(base),
        sessionStartedAt: new Date(base),
        presentationId: 100,
      }),
      row({
        sessionId: 62,
        elementId: "e2",
        isCorrect: false,
        createdAt: new Date(base + 86_400_000),
        sessionStartedAt: new Date(base + 86_400_000),
        presentationId: 100,
      }),
    ];
    pushQueue(
      [STUDENT_OK],
      rows,
      [
        deck(100, [
          { id: "e1", kind: "mcq" },
          { id: "e2", kind: "mcq" },
        ]),
      ],
      [summaryRow(61, "e1", true), summaryRow(62, "e2", false)],
    );

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.trend.sample).toBe(2);
    expect(res.body.trend.direction).toBeNull();
    expect(res.body.trend.slope).toBeNull();
    expect(res.body.trend.reason).toBe("insufficient_data");
  });

  it("marks the trend as improving when the slope is >= 0.5", async () => {
    // Session scores: 0, 50, 100, 100, 100 → strictly increasing slope >> 0.5
    const sessionScores: Array<[number, number]> = [
      [71, 0], // 0 / 1 = 0%
      [72, 50], // 1 / 2 = 50%
      [73, 100], // 2 / 2 = 100%
      [74, 100],
      [75, 100],
    ];
    const baseT = new Date("2025-07-01T10:00:00Z").getTime();
    const rows: ReturnType<typeof row>[] = [];
    const summary: ReturnType<typeof summaryRow>[] = [];
    const elements: Array<{ id: string; kind: string }> = [];
    sessionScores.forEach(([sid, score], idx) => {
      const sessionStart = new Date(baseT + idx * 86_400_000);
      // 2 elements per session, except first has 1
      const correctCount = score === 0 ? 0 : score === 50 ? 1 : 2;
      const total = score === 0 ? 1 : 2;
      for (let i = 0; i < total; i++) {
        const eid = `s${sid}-e${i}`;
        rows.push(
          row({
            sessionId: sid,
            elementId: eid,
            isCorrect: i < correctCount,
            createdAt: new Date(sessionStart.getTime() + i * 1000),
            sessionStartedAt: sessionStart,
          }),
        );
        elements.push({ id: eid, kind: "mcq" });
        summary.push(summaryRow(sid, eid, i < correctCount));
      }
    });
    pushQueue([STUDENT_OK], rows, [deck(100, elements)], summary);

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.trend.sample).toBe(5);
    expect(res.body.trend.direction).toBe("improving");
    expect(res.body.trend.slope).toBeGreaterThanOrEqual(0.5);
  });

  it("marks the trend as declining when the slope is <= -0.5", async () => {
    const sessionScores: Array<[number, number]> = [
      [81, 100],
      [82, 100],
      [83, 50],
      [84, 0],
    ];
    const baseT = new Date("2025-08-01T10:00:00Z").getTime();
    const rows: ReturnType<typeof row>[] = [];
    const summary: ReturnType<typeof summaryRow>[] = [];
    const elements: Array<{ id: string; kind: string }> = [];
    sessionScores.forEach(([sid, score], idx) => {
      const sessionStart = new Date(baseT + idx * 86_400_000);
      const correctCount = score === 0 ? 0 : score === 50 ? 1 : 2;
      const total = score === 0 ? 1 : 2;
      for (let i = 0; i < total; i++) {
        const eid = `s${sid}-e${i}`;
        rows.push(
          row({
            sessionId: sid,
            elementId: eid,
            isCorrect: i < correctCount,
            createdAt: new Date(sessionStart.getTime() + i * 1000),
            sessionStartedAt: sessionStart,
          }),
        );
        elements.push({ id: eid, kind: "mcq" });
        summary.push(summaryRow(sid, eid, i < correctCount));
      }
    });
    pushQueue([STUDENT_OK], rows, [deck(100, elements)], summary);

    const res = await request(makeApp({ teacherId: 1 })).get(
      "/api/students/1/timeline",
    );
    expect(res.status).toBe(200);
    expect(res.body.trend.sample).toBe(4);
    expect(res.body.trend.direction).toBe("declining");
    expect(res.body.trend.slope).toBeLessThanOrEqual(-0.5);
  });
});
