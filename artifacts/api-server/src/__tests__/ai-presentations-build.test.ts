import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  const setCalls: Array<Record<string, unknown>> = [];
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
        if (prop === "set") {
          return (val: Record<string, unknown>) => {
            setCalls.push(val);
            return makeChain(result);
          };
        }
        if (prop === "values") {
          return (val: Record<string, unknown>) => {
            setCalls.push(val);
            return makeChain(result);
          };
        }
        return () => makeChain(result);
      },
    };
    return new Proxy(p, handler);
  }
  return { queue, setCalls, makeChain };
});

vi.mock("@workspace/db", () => {
  const stub = new Proxy({}, { get: () => "stub" });
  return {
    db: {
      select: () => mockState.makeChain(mockState.queue.shift()),
      insert: () => mockState.makeChain(mockState.queue.shift()),
      update: () => mockState.makeChain(mockState.queue.shift()),
      delete: () => mockState.makeChain(mockState.queue.shift()),
    },
    presentationsTable: stub,
    presentationAssetsTable: stub,
    presentationDraftsTable: stub,
    teachersTable: stub,
    assignmentsTable: stub,
    questionBankTable: stub,
    platformSettingsTable: stub,
    aiCache: stub,
    aiUsageDaily: stub,
    DEFAULT_PRESENTATION_LIMITS: { maxDecks: 1000, maxAssetMb: 100 },
  };
});

vi.mock("../lib/materialize-slide", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../lib/materialize-slide")>();
  return {
    ...orig,
    buildOneSlide: vi.fn((input: Parameters<typeof orig.buildOneSlide>[0]) => {
      if (input.card.index === 3) {
        // Intentionally invalid: id exceeds slideSchema's max(64), so the
        // per-slide safeParse on the route will fail and the slide will be
        // skipped with a warning.
        return {
          slide: {
            id: "x".repeat(80),
            layout: input.card.kind,
            elements: [],
          },
          warnings: ["intentional bad card"],
        };
      }
      return orig.buildOneSlide(input);
    }),
  };
});

import express from "express";
import request from "supertest";
import router from "../routes/ai-presentations";
import { buildOneSlide } from "../lib/materialize-slide";
import type { OutlineCard } from "@workspace/slide-templates";

type Session = { teacherId?: number };

function makeApp(session: Session | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: Session }).session = session ?? {};
    (req as unknown as { log: { info: () => void; warn: () => void; error: () => void } }).log = {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
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
  mockState.setCalls.length = 0;
  vi.mocked(buildOneSlide).mockClear();
});

const fixedOutline = {
  language: "en" as const,
  density: "balanced" as const,
  slides: [
    {
      index: 1,
      kind: "title",
      title: "Intro",
      purpose: "Open the lesson",
      talkingPoints: [],
      interactionHint: null,
      visualDirection: {},
    },
    {
      index: 2,
      kind: "concept-card",
      title: "Key Idea",
      purpose: "Explain the core concept",
      talkingPoints: ["Point A", "Point B"],
      interactionHint: null,
      visualDirection: {},
    },
    {
      index: 3,
      kind: "concept-card",
      title: "Bad",
      purpose: "Will be intentionally invalid",
      talkingPoints: [],
      interactionHint: null,
      visualDirection: {},
    },
  ] satisfies OutlineCard[],
};

describe("ai-presentations.ts — POST /presentations/ai/build/:draftId", () => {
  it("returns 401 when no teacher session is present", async () => {
    const res = await request(makeApp(null))
      .post("/api/presentations/ai/build/5")
      .send({});
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric draftId", async () => {
    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/ai/build/notanumber")
      .send({});
    expect(res.status).toBe(400);
  });

  it("builds the deck from a fixed outline, persists slides, and surfaces per-slide warnings", async () => {
    const draftRow = {
      id: 42,
      teacherId: 1,
      status: "outline_ready",
      outline: fixedOutline,
      brief: {
        language: "en",
        subject: "Math",
        gradeLevel: "5",
        topic: "Fractions",
      },
      buildProgress: { current: 0, total: 0, warnings: [] },
      presentationId: null,
    };

    pushQueue(
      [draftRow], // 1. atomic lock update.returning()
      [{ id: 999 }], // 2. insert deck.returning()
      [], // 3. update draft.set({ presentationId: deck.id })
      [], // 4. slide 1 — update presentations.set({ slides })
      [], // 5. slide 1 — update draft.set({ buildProgress })
      [], // 6. slide 2 — update presentations.set({ slides })
      [], // 7. slide 2 — update draft.set({ buildProgress })
      [], // 8. slide 3 — update draft.set({ buildProgress }) (skipped, no presentations write)
      [], // 9. final update draft.set({ status: "built" })
    );

    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/ai/build/42")
      .send({ theme: "harvest" });

    expect(res.status).toBe(201);
    expect(res.body.presentationId).toBe(999);
    expect(res.body.alreadyBuilt).toBe(false);
    expect(res.body.cancelled).toBe(false);

    // The materializer should have been invoked once per outline card.
    expect(buildOneSlide).toHaveBeenCalledTimes(3);

    // The bad card is reported in skipped[] and produces both the
    // forwarded materializer warning AND the route-level skip warning.
    expect(res.body.skipped).toEqual([3]);
    expect(Array.isArray(res.body.warnings)).toBe(true);
    expect(
      res.body.warnings.some(
        (w: string) => w.includes("#3") && w.includes("intentional bad card"),
      ),
    ).toBe(true);
    expect(
      res.body.warnings.some((w: string) =>
        /Slide 3 could not be created/.test(w),
      ),
    ).toBe(true);

    // The final mark-built update should set status to "built".
    const finalUpdate = mockState.setCalls[mockState.setCalls.length - 1];
    expect(finalUpdate.status).toBe("built");
    expect(finalUpdate.presentationId).toBe(999);

    // The last persisted slides[] payload should contain exactly the two
    // valid slides — slide 3 was skipped before any presentations write.
    // Slide-bearing payloads: 1 from the empty-deck insert (slides: []),
    // then 2 incremental updates (one per valid slide). Slide 3 is skipped
    // before any presentations write.
    const slidePayloads = mockState.setCalls.filter(
      (c): c is { slides: unknown[] } => Array.isArray((c as { slides?: unknown }).slides),
    );
    expect(slidePayloads.length).toBe(3);
    const lastSlides = slidePayloads[slidePayloads.length - 1].slides;
    expect(lastSlides).toHaveLength(2);

    // Those persisted slides should each conform to slideSchema (the same
    // schema the editor PUT enforces).
    const { slideSchema } = await import("../routes/presentations");
    for (const s of lastSlides) {
      expect(slideSchema.safeParse(s).success).toBe(true);
    }

    // The empty deck-shell insert should have used the requested theme.
    const insertPayload = mockState.setCalls.find(
      (c) => (c as { theme?: unknown }).theme !== undefined,
    ) as { theme: string; pattern: string; slides: unknown[] } | undefined;
    expect(insertPayload?.theme).toBe("harvest");
    expect(insertPayload?.slides).toEqual([]);
  });

  it("returns 409 when the draft cannot be locked (e.g. wrong status)", async () => {
    pushQueue(
      [], // lock update returns no rows (status not in [outline_ready, failed])
      [
        {
          id: 42,
          teacherId: 1,
          status: "draft", // some non-buildable state
          presentationId: null,
        },
      ], // followup select
    );

    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/ai/build/42")
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.status).toBe("draft");
  });

  it("returns the existing presentationId when the draft is already built", async () => {
    pushQueue(
      [], // lock update returns no rows
      [
        {
          id: 42,
          teacherId: 1,
          status: "built",
          presentationId: 555,
        },
      ],
    );

    const res = await request(makeApp({ teacherId: 1 }))
      .post("/api/presentations/ai/build/42")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.presentationId).toBe(555);
    expect(res.body.alreadyBuilt).toBe(true);
  });
});
