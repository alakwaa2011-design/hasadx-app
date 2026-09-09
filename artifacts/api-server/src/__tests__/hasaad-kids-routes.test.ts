import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: mocks.execute,
    transaction: mocks.transaction,
  },
}));

import express from "express";
import request from "supertest";
import { defaultKidsAvatarByAgeBand, kidsAvatarKeysByAgeBand } from "@workspace/api-zod";
import router, { setKidsReady } from "../routes/kids";

function makeStudentApp() {
  const app = express();
  const session: { studentAccountId: number; kidsBoardId?: number } = {
    studentAccountId: 77,
  };
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: typeof session }).session = session;
    next();
  });
  app.use("/api", router);
  return app;
}

function makeTeacherApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: { teacherId: number } }).session = { teacherId: 5 };
    next();
  });
  app.use("/api", router);
  return app;
}

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.transaction.mockReset();
  setKidsReady(true);
});

describe("Hasaad Kids guarded routes", () => {
  it("returns an explicit retryable response before schema and catalog readiness", async () => {
    setKidsReady(false);
    const response = await request(makeStudentApp()).get("/api/kids/home");
    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("2");
    expect(response.body.code).toBe("KIDS_NOT_READY");
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rejects late attempts once the owned session is completed", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({
        rows: [{
          status: "completed",
          activity_type: "matching",
          content: {
            id: "arabic-match",
            type: "matching",
            exampleId: "arabic-example",
            pairs: [{ id: "pair-1", left: "ا", right: "ا" }],
          },
        }],
      });

    const response = await request(makeStudentApp())
      .post("/api/kids/sessions/12/attempts")
      .set("Idempotency-Key", "late-attempt-123")
      .send({ itemKey: "pair-1", answer: "ا", exampleId: "arabic-example" });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("مكتملة");
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it("returns assigned activities in the student home payload", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title_ar: "نشاط يومي" }] })
      .mockResolvedValueOnce({ rows: [{ stars: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31, activity_id: 8, title_ar: "مهمة المعلمة", due_at: null }] });

    const response = await request(makeStudentApp()).get("/api/kids/home");

    expect(response.status).toBe(200);
    expect(response.body.assignments).toEqual([
      expect.objectContaining({ activity_id: 8, title_ar: "مهمة المعلمة" }),
    ]);
  });

  it("lets a rostered student join by code and submit a board event", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 45, title: "لوحة الصف", join_code: "123456" }] })
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 81, board_session_id: 45, profile_id: 9, event_type: "ready" }] });
    const student = request.agent(makeStudentApp());

    const joined = await student.post("/api/kids/board/join").send({ joinCode: "123456" });
    const event = await student.post("/api/kids/board/45/events").send({ eventType: "ready" });

    expect(joined.status).toBe(200);
    expect(joined.body.board.id).toBe(45);
    expect(event.status).toBe(201);
    expect(event.body.event.event_type).toBe("ready");
  });

  it("rejects a second active session for the same profile and activity", async () => {
    const uniqueViolation = Object.assign(new Error("duplicate active session"), { code: "23505" });
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockRejectedValueOnce(uniqueViolation);

    const response = await request(makeStudentApp())
      .post("/api/kids/sessions")
      .set("Idempotency-Key", "second-session-123")
      .send({ activityId: 8 });

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("جلسة نشطة");
  });

  it("reopens a completed assignment so it appears, starts, and completes again", async () => {
    mocks.execute
      // Teacher ownership, then the assignment upsert returns the reopened row.
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31, profile_id: 9, activity_id: 8, completed_at: null }] })
      // Student home payload.
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, title_ar: "نشاط يومي" }] })
      .mockResolvedValueOnce({ rows: [{ stars: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31, activity_id: 8, title_ar: "تدريب جديد", due_at: null }] })
      // New session eligibility and creation.
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 72, profile_id: 9, activity_id: 8, status: "started" }] })
      // Profile lookup before completion transaction.
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] });

    const txExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [{
        activity_id: 8, status: "started", score: null, skill_id: 3,
        activity_type: "media_choice",
        content: { type: "media_choice", choices: [{ id: "zero" }, { id: "one" }] },
        item_key: "zero", example_id: "zero-example", created_at: new Date(),
        correct_weight: 1, possible_weight: 1, errors: [],
      }] })
      .mockResolvedValueOnce({ rows: [{ id: 31 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ activity_id: 8, status: "completed" }] })
      .mockResolvedValueOnce({ rows: [{
        activity_id: 8, activity_type: "media_choice", skill_id: 3,
        example_id: "zero-example", session_id: 72, created_at: new Date(),
        correct_weight: 1, possible_weight: 1, errors: [],
      }] })
      .mockResolvedValueOnce({ rows: [{ profile_id: 9, skill_id: 3, mastery_percent: 100 }] })
      .mockResolvedValueOnce({ rows: [{ id: 90 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 31, completed_at: new Date() }] });
    mocks.transaction.mockImplementation(async (callback: any) => callback({ execute: txExecute }));

    const reassigned = await request(makeTeacherApp())
      .post("/api/teacher/kids/assignments")
      .send({ profileId: 9, activityId: 8 });
    expect(reassigned.status).toBe(201);
    expect(reassigned.body.assignment.completed_at).toBeNull();

    const home = await request(makeStudentApp()).get("/api/kids/home");
    expect(home.status).toBe(200);
    expect(home.body.assignments).toEqual([expect.objectContaining({ id: 31, activity_id: 8 })]);

    const started = await request(makeStudentApp())
      .post("/api/kids/sessions")
      .set("Idempotency-Key", "reassigned-session-123")
      .send({ activityId: 8 });
    expect(started.status).toBe(201);
    expect(started.body.session.id).toBe(72);

    const completed = await request(makeStudentApp()).post("/api/kids/sessions/72/complete");
    expect(completed.status).toBe(200);
    expect(completed.body.score).toBe(100);
    // Final persisted completion checks explicit classroom-student linkage.
    expect(txExecute).toHaveBeenCalledTimes(10);
  });

  it("denies student sessions access to teacher reports and returns only owned live progress", async () => {
    const denied = await request(makeStudentApp()).get("/api/teacher/kids/progress/9");
    expect(denied.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();

    mocks.execute
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] })
      .mockResolvedValueOnce({ rows: [{
        id: 44, title_ar: "الحروف العربية", world_title: "عالم الحروف",
        attempt_count: 7, mastery_percent: 86,
      }] });
    const allowed = await request(makeTeacherApp()).get("/api/teacher/kids/progress/9");
    expect(allowed.status).toBe(200);
    expect(allowed.body.progress).toEqual([expect.objectContaining({
      title_ar: "الحروف العربية",
      attempt_count: 7,
      mastery_percent: 86,
    })]);
  });

  it("returns only the authenticated student's motivation ledger and badges", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 4, profile_id: 9, balance: 13 }] })
      .mockResolvedValueOnce({ rows: [{ id: 12, amount: 13, category: "teacher_award" }] })
      .mockResolvedValueOnce({ rows: [{ id: 3, title: "شارة خاصة" }] });
    const response = await request(makeStudentApp()).get("/api/kids/motivation");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ balance: 13, history: [{ id: 12 }], badges: [{ id: 3 }] });
  });

  it("replays a matching redemption request but rejects the same key for another reward", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31, profile_id: 9, reward_id: 8, request_key: "redemption-key-123" }] });
    const replay = await request(makeStudentApp()).post("/api/kids/motivation/redemptions")
      .set("Idempotency-Key", "redemption-key-123").send({ rewardId: 8 });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);

    mocks.execute.mockReset()
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 31, profile_id: 9, reward_id: 8 }] });
    const conflict = await request(makeStudentApp()).post("/api/kids/motivation/redemptions")
      .set("Idempotency-Key", "redemption-key-123").send({ rewardId: 99 });
    expect(conflict.status).toBe(409);
  });

  it("rejects an avatar from another age band", async () => {
    const response = await request(makeStudentApp()).post("/api/kids/profile").send({
      displayName: "طالب", ageBand: "secondary", avatarKey: "icon:rocket",
    });
    expect(response.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("accepts every avatar and default from the shared age-band catalog", async () => {
    mocks.execute.mockImplementation(async () => ({ rows: [{ id: 9, student_account_id: 77 }] }));
    for (const [ageBand, avatars] of Object.entries(kidsAvatarKeysByAgeBand)) {
      for (const avatarKey of avatars) {
        const response = await request(makeStudentApp()).post("/api/kids/profile").send({
          displayName: "طالب", ageBand, avatarKey,
        });
        expect(response.status).toBe(201);
      }
      const defaultResponse = await request(makeStudentApp()).post("/api/kids/profile").send({
        displayName: "طالب", ageBand, avatarKey: defaultKidsAvatarByAgeBand[ageBand as keyof typeof defaultKidsAvatarByAgeBand],
      });
      expect(defaultResponse.status).toBe(201);
    }
  });

  it("accepts snake_case badge fields at the API boundary", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ id: 7, rule_category: "motivation_balance", icon_key: "icon:award" }] });
    const response = await request(makeTeacherApp()).post("/api/teacher/kids/motivation/badges").send({
      title: "مثابرة", icon_key: "icon:award", rule_category: "motivation_balance", threshold: 5,
    });
    expect(response.status).toBe(201);
    expect(response.body.badge.rule_category).toBe("motivation_balance");
  });

  it("returns active reward contract status and permits its redemption", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [{ id: 8, title: "وقت إضافي", cost: 5, availability: 2, status: "active" }] });
    const rewards = await request(makeStudentApp()).get("/api/kids/motivation/rewards");
    expect(rewards.status).toBe(200);
    expect(rewards.body.rewards).toEqual([expect.objectContaining({ id: 8, status: "active" })]);

    mocks.execute.mockReset()
      .mockResolvedValueOnce({ rows: [{ id: 9, student_account_id: 77 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 41, profile_id: 9, reward_id: 8, status: "requested" }] });
    const redemption = await request(makeStudentApp()).post("/api/kids/motivation/redemptions")
      .set("Idempotency-Key", "reward-redemption-123").send({ rewardId: 8 });
    expect(redemption.status).toBe(201);
    expect(redemption.body.redemption.reward_id).toBe(8);
  });

  it("includes age_band in teacher board aggregates", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ id: 9, display_name: "طالب", age_band: "secondary", stars: 2 }] });
    const response = await request(makeTeacherApp()).get("/api/teacher/kids/board");
    expect(response.status).toBe(200);
    expect(response.body.board).toEqual([expect.objectContaining({ age_band: "secondary" })]);
  });

  it("makes duplicate eligible badge grants idempotent", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ "?column?": 1 }] });
    const txExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 7, rule_category: "motivation_balance", threshold: 5 }] })
      .mockResolvedValueOnce({ rows: [{ balance: 10 }] })
      .mockResolvedValueOnce({ rows: [] });
    mocks.transaction.mockImplementation(async (callback: any) => callback({ execute: txExecute }));
    const response = await request(makeTeacherApp()).post("/api/teacher/kids/motivation/badges/7/grants").send({ profileId: 9 });
    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(txExecute).toHaveBeenCalledTimes(4);
  });

  it("replays approved and cancelled redemption actions without another ledger mutation", async () => {
    for (const [action, status] of [["approve", "approved"], ["cancel", "cancelled"]] as const) {
      const txExecute = vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 20, profile_id: 9, status, cost: 5, availability: 1, reward_status: "active" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 2, balance: status === "approved" ? 5 : 10 }] });
      mocks.transaction.mockImplementation(async (callback: any) => callback({ execute: txExecute }));
      const response = await request(makeTeacherApp()).post(`/api/teacher/kids/motivation/redemptions/20/${action}`);
      expect(response.status).toBe(200);
      expect(response.body.replayed).toBe(true);
      expect(txExecute).toHaveBeenCalledTimes(3);
    }
  });
});