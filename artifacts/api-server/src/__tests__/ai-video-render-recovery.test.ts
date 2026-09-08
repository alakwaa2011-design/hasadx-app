import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdtemp: vi.fn<() => Promise<string>>(),
  rm: vi.fn(async () => {}),
  executeRows: [] as Array<Array<Record<string, unknown>>>,
  updateSets: [] as Array<Record<string, unknown>>,
  getHoldStatus: vi.fn<() => Promise<string>>(),
  refund: vi.fn<() => Promise<void>>(),
  compensate: vi.fn<() => Promise<{ compensated: boolean }>>(),
}));

vi.mock("node:fs/promises", () => ({
  mkdtemp: mocks.mkdtemp,
  readFile: vi.fn(),
  rm: mocks.rm,
  writeFile: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: (_target, prop) => String(prop) });
  const db = {
    execute: vi.fn(async () => ({ rows: mocks.executeRows.shift() ?? [] })),
    update: vi.fn(() => {
      const chain: any = {
        set(values: Record<string, unknown>) {
          mocks.updateSets.push(values);
          return chain;
        },
        where() {
          return chain;
        },
        returning() {
          return Promise.resolve([{ id: 9 }]);
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve([]).then(resolve, reject);
        },
      };
      return chain;
    }),
    transaction: vi.fn(),
  };
  return new Proxy({
    db,
    aiVideoProjectsTable: table,
    creditHoldsTable: table,
    creditTransactionsTable: table,
  }, {
    has: () => true,
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      return table;
    },
  });
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => conditions,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  };
});

vi.mock("../lib/credit-service", () => ({
  CreditService: {
    heartbeatHold: vi.fn(),
    getHoldStatus: mocks.getHoldStatus,
    refund: mocks.refund,
    compensateCapturedHold: mocks.compensate,
  },
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {},
}));

vi.mock("../lib/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

vi.mock("@workspace/integrations-openai-ai-server/image", () => ({
  generateImageBuffer: vi.fn(),
}));

vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({
  textToSpeech: vi.fn(),
}));

import {
  aiVideoRenderCreditRequestId,
  aiVideoStoryboardCreditRequestId,
  failStaleAiVideoRenders,
  failStaleAiVideoStoryboards,
  runAiVideoRender,
} from "../lib/ai-video-renderer";

const project = {
  id: 9,
  teacherId: 42,
  title: "Water cycle",
  status: "rendering",
  brief: {},
  storyboard: null,
  outputUrl: null,
  errorMessage: null,
  storyboardIdempotencyKey: "storyboard-key",
  storyboardLeaseId: null,
  storyboardLeaseExpiresAt: null,
  renderIdempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
  renderLeaseId: "worker-lease",
  renderLeaseExpiresAt: new Date(Date.now() + 180_000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  mocks.mkdtemp.mockReset();
  mocks.rm.mockClear();
  mocks.executeRows = [];
  mocks.updateSets = [];
  mocks.getHoldStatus.mockReset();
  mocks.refund.mockReset();
  mocks.compensate.mockReset();
});

describe("AI video renderer failure boundary", () => {
  it("refunds and fails the owned lease when temp initialization fails", async () => {
    mocks.mkdtemp.mockRejectedValue(new Error("temp unavailable"));
    mocks.getHoldStatus.mockResolvedValue("pending");
    mocks.refund.mockResolvedValue();

    await runAiVideoRender(project as any);

    expect(mocks.refund).toHaveBeenCalledWith(
      aiVideoRenderCreditRequestId(project.teacherId, project.id, project.renderIdempotencyKey),
      "AI video render failed",
    );
    expect(mocks.updateSets).toContainEqual(expect.objectContaining({
      status: "failed",
      renderLeaseId: null,
      renderLeaseExpiresAt: null,
    }));
    expect(mocks.rm).not.toHaveBeenCalled();
  });
});

describe("AI video expired-lease recovery", () => {
  it("claims an expired lease before refunding and exposing retry", async () => {
    mocks.executeRows = [
      [{
        id: project.id,
        teacher_id: project.teacherId,
        render_idempotency_key: project.renderIdempotencyKey,
        render_lease_id: project.renderLeaseId,
      }],
      [{ id: project.id }],
    ];
    mocks.getHoldStatus.mockResolvedValue("pending");
    mocks.refund.mockResolvedValue();

    await expect(failStaleAiVideoRenders()).resolves.toBe(1);

    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.updateSets).toContainEqual(expect.objectContaining({
      status: "failed",
      renderLeaseId: null,
      renderLeaseExpiresAt: null,
    }));
  });

  it("keeps an unreconciled lease non-retryable when refund fails", async () => {
    mocks.executeRows = [
      [{
        id: project.id,
        teacher_id: project.teacherId,
        render_idempotency_key: project.renderIdempotencyKey,
        render_lease_id: project.renderLeaseId,
      }],
      [{ id: project.id }],
    ];
    mocks.getHoldStatus.mockResolvedValue("pending");
    mocks.refund.mockRejectedValue(new Error("database unavailable"));

    await expect(failStaleAiVideoRenders()).resolves.toBe(0);

    expect(mocks.updateSets).not.toContainEqual(expect.objectContaining({ status: "failed" }));
  });
});

describe("AI video storyboard lease recovery", () => {
  function interruptedStoryboardRow() {
    return {
      id: project.id,
      teacher_id: project.teacherId,
      storyboard_idempotency_key: project.storyboardIdempotencyKey,
      storyboard_lease_id: "storyboard-worker",
    };
  }

  it("fails an expired draft that crashed before creating a hold", async () => {
    mocks.executeRows = [[interruptedStoryboardRow()], [{ id: project.id }]];
    mocks.getHoldStatus.mockResolvedValue("none");

    await expect(failStaleAiVideoStoryboards(project.id)).resolves.toBe(1);

    expect(mocks.getHoldStatus).toHaveBeenCalledWith(
      aiVideoStoryboardCreditRequestId(project.teacherId, project.storyboardIdempotencyKey),
    );
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.updateSets).toContainEqual(expect.objectContaining({
      status: "failed",
      storyboardLeaseId: null,
      storyboardLeaseExpiresAt: null,
    }));
  });

  it("refunds a pending hold before making an interrupted draft retryable", async () => {
    mocks.executeRows = [[interruptedStoryboardRow()], [{ id: project.id }]];
    mocks.getHoldStatus.mockResolvedValue("pending");
    mocks.refund.mockResolvedValue();

    await expect(failStaleAiVideoStoryboards(project.id)).resolves.toBe(1);

    expect(mocks.refund).toHaveBeenCalledWith(
      aiVideoStoryboardCreditRequestId(project.teacherId, project.storyboardIdempotencyKey),
      "AI video storyboard generation stopped before completion",
    );
    expect(mocks.updateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });
});

describe.each([
  {
    stage: "render",
    recover: () => failStaleAiVideoRenders(),
    row: {
      id: project.id,
      teacher_id: project.teacherId,
      render_idempotency_key: project.renderIdempotencyKey,
      render_lease_id: project.renderLeaseId,
    },
    requestId: aiVideoRenderCreditRequestId(project.teacherId, project.id, project.renderIdempotencyKey),
  },
  {
    stage: "storyboard",
    recover: () => failStaleAiVideoStoryboards(project.id),
    row: {
      id: project.id,
      teacher_id: project.teacherId,
      storyboard_idempotency_key: project.storyboardIdempotencyKey,
      storyboard_lease_id: "storyboard-worker",
    },
    requestId: aiVideoStoryboardCreditRequestId(project.teacherId, project.storyboardIdempotencyKey),
  },
])("$stage recovery settlement boundaries", ({ recover, row, requestId }) => {
  it("does not settle credits or change state when another worker owns the claim", async () => {
    mocks.executeRows = [[row], []];

    await expect(recover()).resolves.toBe(0);

    expect(mocks.getHoldStatus).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.compensate).not.toHaveBeenCalled();
    expect(mocks.updateSets).toEqual([]);
  });

  it("uses compensation rather than refund for a captured hold", async () => {
    mocks.executeRows = [[row], [{ id: project.id }]];
    mocks.getHoldStatus.mockResolvedValue("completed");
    mocks.compensate.mockResolvedValue({ compensated: true });

    await expect(recover()).resolves.toBe(1);

    expect(mocks.compensate).toHaveBeenCalledExactlyOnceWith(requestId, expect.any(String));
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.updateSets).toContainEqual(expect.objectContaining({ status: "failed" }));
  });

  it("does not expose retry while captured-credit compensation has failed", async () => {
    mocks.executeRows = [[row], [{ id: project.id }]];
    mocks.getHoldStatus.mockResolvedValue("completed");
    mocks.compensate.mockRejectedValue(new Error("database unavailable"));

    await expect(recover()).resolves.toBe(0);

    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.updateSets).toEqual([]);
  });
});