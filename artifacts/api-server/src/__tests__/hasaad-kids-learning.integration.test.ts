import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import router, { setKidsReady } from "../routes/kids";
import { migrateKidsSchema } from "../kids-catalog";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const suite = RUN_INTEGRATION ? describe : describe.skip;
const RUN_ID = `kids${Date.now()}`;

type Session = { teacherId?: number; studentAccountId?: number; kidsBoardId?: number };
type Engine = {
  type: "matching" | "tracing" | "media_choice" | "counting" | "ordering_puzzle";
  content: Record<string, unknown>;
  attempts: Array<{ itemKey: string; answer: string; tracePoints?: Array<{ x: number; y: number }> }>;
  expectedScore: number;
};

const engines: Engine[] = [
  {
    type: "matching",
    content: { pairs: [{ id: "pair-a", left: "A", right: "a" }, { id: "pair-b", left: "B", right: "b" }] },
    attempts: [{ itemKey: "pair-a", answer: "a" }, { itemKey: "pair-b", answer: "wrong" }],
    expectedScore: 50,
  },
  {
    type: "tracing",
    content: { strokes: [{ id: "stroke", points: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }] }] },
    attempts: [{
      itemKey: "stroke",
      answer: "client-claims-wrong",
      tracePoints: Array.from({ length: 21 }, (_, index) => ({ x: 0.5, y: 0.1 + index * 0.04 })),
    }],
    expectedScore: 100,
  },
  {
    type: "media_choice",
    content: { choices: [{ id: "a", label: "A", isCorrect: true }, { id: "b", label: "B", isCorrect: false }] },
    attempts: [{ itemKey: "a", answer: "a" }],
    expectedScore: 100,
  },
  {
    type: "counting",
    content: { items: [{ id: "star-1" }, { id: "star-2" }], correctCount: 2, choices: [1, 2] },
    attempts: [{ itemKey: "star-1", answer: "2" }],
    expectedScore: 100,
  },
  {
    type: "ordering_puzzle",
    content: { pieces: [{ id: "first", label: "First", correctPosition: 0 }, { id: "last", label: "Last", correctPosition: 1 }] },
    attempts: [{ itemKey: "first", answer: "0" }, { itemKey: "last", answer: "1" }],
    expectedScore: 100,
  },
];

const created = {
  teacherIds: [] as number[],
  studentAccountIds: [] as number[],
  worldIds: [] as number[],
};

function appFor(session: Session) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = session;
    next();
  });
  app.use("/api", router);
  return app;
}

async function createFixture(label: string, engine: Engine) {
  const teacher = await db.execute(sql`
    INSERT INTO teachers(name,email,password_hash,created_at)
    VALUES (${`Kids ${label}`},${`${RUN_ID}-${label}@test.local`},'x',NOW()) RETURNING id
  `);
  const teacherId = Number((teacher.rows[0] as any).id);
  created.teacherIds.push(teacherId);

  const account = await db.execute(sql`
    INSERT INTO student_accounts(username,display_name,password_hash,created_at)
    VALUES (${`${RUN_ID}-${label}`},${`Child ${label}`},'x',NOW()) RETURNING id
  `);
  const studentAccountId = Number((account.rows[0] as any).id);
  created.studentAccountIds.push(studentAccountId);
  await db.execute(sql`
    INSERT INTO students(name,student_account_id,teacher_id,created_at)
    VALUES (${`Child ${label}`},${studentAccountId},${teacherId},NOW())
  `);
  const profile = await db.execute(sql`
    INSERT INTO kids_profiles(student_account_id,display_name,avatar_key,age_band,locale)
    VALUES (${studentAccountId},${`Child ${label}`},'kids/avatars/star','4-5','ar') RETURNING id
  `);
  const profileId = Number((profile.rows[0] as any).id);

  const world = await db.execute(sql`
    INSERT INTO kids_worlds(slug,title_ar,title_en,description_ar,icon_key,sort_order)
    VALUES (${`${RUN_ID}-${label}`},'عالم اختبار','Test world','Test','kids/worlds/test',999) RETURNING id
  `);
  const worldId = Number((world.rows[0] as any).id);
  created.worldIds.push(worldId);
  const skill = await db.execute(sql`
    INSERT INTO kids_skills(world_id,slug,title_ar,title_en,sort_order)
    VALUES (${worldId},${`${RUN_ID}-${label}-skill`},'مهارة','Skill',1) RETURNING id
  `);
  const skillId = Number((skill.rows[0] as any).id);
  const exampleId = `${label}-example`;
  const content = {
    id: `${label}-activity`,
    type: engine.type,
    skillId: String(skillId),
    title: label,
    instructions: "Complete",
    exampleId,
    ...engine.content,
  };
  const activity = await db.execute(sql`
    INSERT INTO kids_activities(skill_id,slug,title_ar,activity_type,content,asset_key,sort_order)
    VALUES (${skillId},${`${RUN_ID}-${label}-activity`},${label},${engine.type},${JSON.stringify(content)}::jsonb,'kids/activities/test',1)
    RETURNING id
  `);
  const activityId = Number((activity.rows[0] as any).id);
  await db.execute(sql`
    INSERT INTO kids_teacher_assignments(teacher_id,profile_id,activity_id)
    VALUES (${teacherId},${profileId},${activityId})
  `);
  return { teacherId, studentAccountId, profileId, activityId, exampleId };
}

beforeAll(async () => {
  await migrateKidsSchema();
  setKidsReady(true);
});

afterAll(async () => {
  for (const teacherId of created.teacherIds) {
    await db.execute(sql`DELETE FROM teachers WHERE id=${teacherId}`);
  }
  for (const studentAccountId of created.studentAccountIds) {
    await db.execute(sql`DELETE FROM student_accounts WHERE id=${studentAccountId}`);
  }
  for (const worldId of created.worldIds) {
    await db.execute(sql`DELETE FROM kids_worlds WHERE id=${worldId}`);
  }
  setKidsReady(false);
});

suite("Hasaad Kids learning integration", () => {
  for (const engine of engines) {
    it(`${engine.type}: trusts server evidence and grants one reward on completion replay`, async () => {
      const fixture = await createFixture(engine.type, engine);
      const student = request(appFor({ studentAccountId: fixture.studentAccountId }));
      const started = await student
        .post("/api/kids/sessions")
        .set("Idempotency-Key", `${engine.type}-session-key`)
        .send({ activityId: fixture.activityId, score: 100, isCorrect: true })
        .expect(201);
      const sessionId = Number(started.body.session.id);

      for (const [index, attempt] of engine.attempts.entries()) {
        await student
          .post(`/api/kids/sessions/${sessionId}/attempts`)
          .set("Idempotency-Key", `${engine.type}-attempt-${index}`)
          .send({
            ...attempt,
            exampleId: fixture.exampleId,
            isCorrect: index !== 0,
            score: index === 0 ? 0 : 100,
          })
          .expect(201);
      }

      const first = await student
        .post(`/api/kids/sessions/${sessionId}/complete`)
        .send({ score: engine.expectedScore === 100 ? 0 : 100, isCorrect: false })
        .expect(200);
      expect(first.body.score).toBe(engine.expectedScore);
      expect(first.body.reward).toBe(engine.expectedScore >= 70 ? "kids/stickers/completion-star" : null);

      const replay = await student
        .post(`/api/kids/sessions/${sessionId}/complete`)
        .send({ score: 100, isCorrect: true })
        .expect(200);
      expect(replay.body).toMatchObject({ score: engine.expectedScore, replayed: true });

      const stored = await db.execute(sql`
        SELECT s.score,
          (SELECT COUNT(*)::int FROM kids_reward_grants WHERE session_id=s.id) reward_count,
          COALESCE((SELECT stars FROM kids_adventure_states WHERE profile_id=s.profile_id),0)::int stars
        FROM kids_activity_sessions s WHERE s.id=${sessionId}
      `);
      expect(stored.rows[0]).toMatchObject({
        score: engine.expectedScore,
        reward_count: engine.expectedScore >= 70 ? 1 : 0,
        stars: engine.expectedScore >= 70 ? 1 : 0,
      });
      const attempts = await db.execute(sql`
        SELECT item_key,is_correct FROM kids_attempts WHERE session_id=${sessionId} ORDER BY id
      `);
      expect(attempts.rows.map((row: any) => row.is_correct))
        .toEqual(engine.expectedScore === 50 ? [true, false] : engine.attempts.map(() => true));
    });
  }

  it("keeps the adult gate and teacher roster, assignments, and board isolated", async () => {
    const first = await createFixture("isolation-a", engines[2]!);
    const second = await createFixture("isolation-b", engines[2]!);
    const student = request(appFor({ studentAccountId: first.studentAccountId }));

    for (const path of ["/api/teacher/kids/profiles", "/api/teacher/kids/assignments", "/api/teacher/kids/board"]) {
      await student.get(path).expect(401);
    }
    await student.post("/api/teacher/kids/board").send({ title: "Not allowed" }).expect(401);

    const teacher = request(appFor({ teacherId: first.teacherId }));
    const profiles = await teacher.get("/api/teacher/kids/profiles").expect(200);
    expect(profiles.body.profiles.map((profile: any) => profile.id)).toEqual([first.profileId]);
    const assignments = await teacher.get("/api/teacher/kids/assignments").expect(200);
    expect(assignments.body.assignments).toHaveLength(1);
    expect(assignments.body.assignments[0].profile_id).toBe(first.profileId);
    expect(assignments.body.assignments[0].profile_id).not.toBe(second.profileId);
    const board = await teacher.get("/api/teacher/kids/board").expect(200);
    expect(board.body.board.map((profile: any) => profile.id)).toEqual([first.profileId]);

    await teacher
      .post("/api/teacher/kids/assignments")
      .send({ profileId: second.profileId, activityId: second.activityId })
      .expect(403);
    await teacher
      .post("/api/teacher/kids/board/999999/events")
      .send({ profileId: second.profileId, eventType: "completed" })
      .expect(403);
  });
});