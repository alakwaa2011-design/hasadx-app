import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: () => "column" });
  return {
    db: {
      execute: mockState.execute,
    },
    studentAccountsTable: table,
    flagScoresTable: table,
    colorScoresTable: table,
    memoryScoresTable: table,
    multiplicationScoresTable: table,
    scrambleScoresTable: table,
    capitalScoresTable: table,
    wameethScoresTable: table,
    stroopScoresTable: table,
    studentsTable: table,
  };
});

vi.mock("../lib/rate-limiter", () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  registerLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/activity-logger", () => ({
  logActivity: vi.fn(),
}));

import express from "express";
import request from "supertest";
import router from "../routes/student-auth";

function makeApp(studentAccountId?: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = studentAccountId ? { studentAccountId } : {};
    (req as any).log = { error: vi.fn() };
    next();
  });
  app.use("/api", router);
  return app;
}

describe("student reward goal", () => {
  beforeEach(() => {
    mockState.execute.mockReset();
  });

  it("requires an authenticated student session", async () => {
    const response = await request(makeApp()).get("/api/student-auth/me/reward-goal");

    expect(response.status).toBe(401);
    expect(mockState.execute).not.toHaveBeenCalled();
  });

  it("returns only the current student's goal progress contract", async () => {
    mockState.execute.mockResolvedValue({
      rows: [{
        id: 17,
        title: "إتقان جدول الضرب",
        skill: "الضرب",
        target_points: 100,
        current_points: 74,
        teacher_name: "must not leak",
        class_name: "must not leak",
        student_name: "must not leak",
      }],
    });

    const response = await request(makeApp(42)).get("/api/student-auth/me/reward-goal");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      goal: {
        id: 17,
        title: "إتقان جدول الضرب",
        skill: "الضرب",
        targetPoints: 100,
        currentPoints: 74,
        remainingPoints: 26,
        progressPercent: 74,
        completed: false,
        progressLabel: "74/100",
      },
    });
  });

  it("caps completed progress and reports no remaining points", async () => {
    mockState.execute.mockResolvedValue({
      rows: [{
        id: 18,
        title: "هدف القراءة",
        skill: "القراءة",
        target_points: 40,
        current_points: 55,
      }],
    });

    const response = await request(makeApp(42)).get("/api/student-auth/me/reward-goal");

    expect(response.body.goal).toMatchObject({
      currentPoints: 55,
      remainingPoints: 0,
      progressPercent: 100,
      completed: true,
      progressLabel: "40/40",
    });
  });
});