import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  evaluateClassroomRewardEvidence,
  hasActiveAutomaticAssignmentGrant,
  lockAssignmentRewardEvidence,
} from "../lib/classroom-reward-evaluator";
import { resolveWameethStudentIdentity } from "../lib/wameeth-game-history";
import { persistWameethGameHistory } from "../lib/wameeth-game-history";
import { saveFullWameethGame } from "../lib/wameeth-full-save";
import { addPlayer, createGame, deleteGame, resetGameToLobby, type GameQuestion } from "../game/manager";
import submissionsRouter from "../routes/submissions";
import classroomRewardsRouter from "../routes/classroom-rewards";
import studentAuthRouter from "../routes/student-auth";
import teacherClassesRouter from "../routes/teacher-classes";
import gameHistoryRouter from "../routes/game-history";
import { setupGameSocket } from "../game/socket-handlers";

const RUN = Boolean(process.env.TEST_DATABASE_URL) && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const suite = RUN ? describe : describe.skip;
const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
let teacherId=0, otherTeacherId=0, accountId=0, studentId=0, otherStudentId=0;
let rewardTypeId=0, ruleId=0, submissionId=0;
let assignmentId=0;
let gameRuleId=0;

function teacherApp(sessionTeacherId = teacherId) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { teacherId: sessionTeacherId };
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", submissionsRouter);
  app.use("/api", classroomRewardsRouter);
  app.use("/api", teacherClassesRouter);
  return app;
}
function gameHistoryApp(){
  const app=express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={teacherId};req.log={error:()=>{},warn:()=>{},info:()=>{}};next();});
  app.use("/api",gameHistoryRouter);
  return app;
}

function studentRewardApp(studentAccountId: number) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { studentAccountId };
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", studentAuthRouter);
  return app;
}

suite("classroom reward PostgreSQL concurrency safety",()=>{
  beforeAll(async()=>{
    const migration = readFileSync(
      new URL("../../../../scripts/migrations/2026-06-13-classroom-rewards.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(migration));
    const avatarMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-06-14-student-roster-avatar.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(avatarMigration));
    const rewardGroupsMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-09-09-classroom-reward-groups.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(rewardGroupsMigration));
    const goalsAndReversalsMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-09-11-classroom-reward-goals-reversal-receipts.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(goalsAndReversalsMigration));
    const academicGoalsMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-09-09-classroom-reward-goals.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(academicGoalsMigration));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS kids_profiles (
        id SERIAL PRIMARY KEY,
        student_account_id INTEGER NOT NULL UNIQUE REFERENCES student_accounts(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        avatar_key TEXT
      );
      CREATE TABLE IF NOT EXISTS motivation_badge_definitions (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        icon_key TEXT
      );
      CREATE TABLE IF NOT EXISTS motivation_badge_grants (
        id SERIAL PRIMARY KEY,
        badge_definition_id INTEGER NOT NULL REFERENCES motivation_badge_definitions(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES kids_profiles(id) ON DELETE CASCADE,
        granted_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `));
    teacherId=Number((await db.execute(sql`INSERT INTO teachers(name,email,password_hash) VALUES (${"Reward "+nonce},${`reward_${nonce}@test.invalid`},'x') RETURNING id`)).rows[0].id);
    otherTeacherId=Number((await db.execute(sql`INSERT INTO teachers(name,email,password_hash) VALUES (${"Other "+nonce},${`other_${nonce}@test.invalid`},'x') RETURNING id`)).rows[0].id);
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},'A'),(${teacherId},'B')`);
    accountId=Number((await db.execute(sql`INSERT INTO student_accounts(username,display_name,password_hash) VALUES (${`reward_${nonce}`},'طالب','x') RETURNING id`)).rows[0].id);
    studentId=Number((await db.execute(sql`INSERT INTO students(name,teacher_id,student_account_id,student_class) VALUES ('طالب',${teacherId},${accountId},'A') RETURNING id`)).rows[0].id);
    otherStudentId=Number((await db.execute(sql`INSERT INTO students(name,teacher_id,student_class) VALUES ('آخر',${teacherId},'B') RETURNING id`)).rows[0].id);
    rewardTypeId=Number((await db.execute(sql`INSERT INTO classroom_reward_types(teacher_id,name,category,default_amount) VALUES (${teacherId},${"نوع "+nonce},'test',1) RETURNING id`)).rows[0].id);
    ruleId=Number((await db.execute(sql`INSERT INTO classroom_reward_rules(teacher_id,name,source_type,condition,reward_type_id,amount,category_snapshot) VALUES (${teacherId},'قاعدة','assignment_submission','completion',${rewardTypeId},2,'test') RETURNING id`)).rows[0].id);
    gameRuleId=Number((await db.execute(sql`INSERT INTO classroom_reward_rules(teacher_id,name,source_type,condition,reward_type_id,amount,category_snapshot) VALUES (${teacherId},'قاعدة لعبة','game_history','completion',${rewardTypeId},3,'test') RETURNING id`)).rows[0].id);
    assignmentId=Number((await db.execute(sql`INSERT INTO assignments(title,teacher_id,source) VALUES ('اختبار',${teacherId},'worksheet') RETURNING id`)).rows[0].id);
    submissionId=Number((await db.execute(sql`INSERT INTO submissions(assignment_id,student_name,student_id,student_identity_verified,score,total_questions,correct_answers,earned_points,total_points) VALUES (${assignmentId},'طالب',${studentId},TRUE,1,1,1,1,1) RETURNING id`)).rows[0].id);
  });

  afterAll(async()=>{
    if(teacherId)await db.execute(sql`DELETE FROM game_history WHERE teacher_id=${teacherId}`);
    if(teacherId)await db.execute(sql`DELETE FROM teachers WHERE id IN (${teacherId},${otherTeacherId})`);
    if(accountId)await db.execute(sql`DELETE FROM student_accounts WHERE id=${accountId}`);
  });

  it("grants exactly once under concurrent calls and retries a failed receipt",async()=>{
    const evidence={teacherId,ruleId,sourceType:"assignment_submission" as const,sourceResultId:submissionId,studentId,completed:true,score:1,evidenceSummary:{effectivePoints:1}};
    await Promise.all([db.transaction(tx=>evaluateClassroomRewardEvidence(tx,evidence)),db.transaction(tx=>evaluateClassroomRewardEvidence(tx,evidence))]);
    expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE rule_id=${ruleId} AND source_result_id=${submissionId} AND kind='grant'`)).rows[0].n)).toBe(1);
    const retrySource=submissionId+1_000_000;
    await db.execute(sql`INSERT INTO classroom_reward_rule_evaluations(teacher_id,rule_id,source_type,source_result_id,student_id,outcome,detail,evidence_summary,rule_name_snapshot) VALUES (${teacherId},${ruleId},'assignment_submission',${retrySource},${studentId},'failed','forced','{}','قاعدة')`);
    const retried=await db.transaction(tx=>evaluateClassroomRewardEvidence(tx,{...evidence,sourceResultId:retrySource}));
    expect(retried[0].outcome).toBe("granted");
  });

  it("approves an academic suggestion once when the same request is replayed", async () => {
    const freshSubmission = Number((await db.execute(sql`
      INSERT INTO submissions
        (assignment_id,student_name,student_id,student_identity_verified,score,total_questions,correct_answers,earned_points,total_points)
      VALUES (${assignmentId},'طالب',${studentId},TRUE,1,1,1,1,1) RETURNING id
    `)).rows[0].id);
    const payload = {};
    const path = `/api/classroom-rewards/classes/A/suggestions/${freshSubmission}/approve`;

    const first = await request(teacherApp()).post(path).send(payload);
    const replay = await request(teacherApp()).post(path).send(payload);

    expect(first.status).toBe(201);
    expect(first.body.idempotent).toBe(false);
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND source_type='reward_suggestion_submission'
        AND source_result_id=${freshSubmission} AND kind='grant'
    `)).rows[0].n)).toBe(1);
  });

  it("serializes concurrent approvals even when callers use different request keys", async () => {
    const freshSubmission = Number((await db.execute(sql`
      INSERT INTO submissions
        (assignment_id,student_name,student_id,student_identity_verified,score,total_questions,correct_answers,earned_points,total_points)
      VALUES (${assignmentId},'طالب',${studentId},TRUE,1,1,1,1,1) RETURNING id
    `)).rows[0].id);
    const path = `/api/classroom-rewards/classes/A/suggestions/${freshSubmission}/approve`;
    const [left, right] = await Promise.all([
      request(teacherApp()).post(path).set("Idempotency-Key", `suggestion-left:${nonce}`).send({ requestKey: "left" }),
      request(teacherApp()).post(path).set("Idempotency-Key", `suggestion-right:${nonce}`).send({ requestKey: "right" }),
    ]);

    expect([left.status, right.status].sort()).toEqual([200, 201]);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND source_type='reward_suggestion_submission'
        AND source_result_id=${freshSubmission} AND kind='grant'
    `)).rows[0].n)).toBe(1);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_audit_logs
      WHERE teacher_id=${teacherId} AND action='approve_reward_suggestion'
        AND entity_id=${freshSubmission}
    `)).rows[0].n)).toBe(1);
  });

  it("rejects the same submission outside its owning class or teacher", async () => {
    const freshSubmission = Number((await db.execute(sql`
      INSERT INTO submissions
        (assignment_id,student_name,student_id,student_identity_verified,score,total_questions,correct_answers,earned_points,total_points)
      VALUES (${assignmentId},'طالب',${studentId},TRUE,1,1,1,1,1) RETURNING id
    `)).rows[0].id);
    const wrongClass = await request(teacherApp())
      .post(`/api/classroom-rewards/classes/B/suggestions/${freshSubmission}/approve`).send({});
    const wrongTeacher = await request(teacherApp(otherTeacherId))
      .post(`/api/classroom-rewards/classes/A/suggestions/${freshSubmission}/approve`).send({});

    expect(wrongClass.status).toBe(409);
    expect(wrongTeacher.status).toBe(409);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions
      WHERE source_type='reward_suggestion_submission' AND source_result_id=${freshSubmission}
    `)).rows[0].n)).toBe(0);
  });

  it("updates the balance exactly once for an approved suggestion", async () => {
    const freshSubmission = Number((await db.execute(sql`
      INSERT INTO submissions
        (assignment_id,student_name,student_id,student_identity_verified,score,total_questions,correct_answers,earned_points,total_points)
      VALUES (${assignmentId},'طالب',${studentId},TRUE,1,1,1,1,1) RETURNING id
    `)).rows[0].id);
    const before = Number((await db.execute(sql`
      SELECT COALESCE(SUM(balance),0)::int balance FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id=${studentId}
    `)).rows[0].balance);
    const response = await request(teacherApp())
      .post(`/api/classroom-rewards/classes/A/suggestions/${freshSubmission}/approve`).send({});
    expect(response.status).toBe(201);
    const amount = Number(response.body.grant.amount);
    expect(Number((await db.execute(sql`
      SELECT COALESCE(SUM(balance),0)::int balance FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id=${studentId}
    `)).rows[0].balance)).toBe(before + amount);
    expect(Number((await db.execute(sql`
      SELECT COALESCE(SUM(amount),0)::int amount FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND student_id=${studentId}
        AND source_type='reward_suggestion_submission' AND source_result_id=${freshSubmission}
        AND kind='grant'
    `)).rows[0].amount)).toBe(amount);
  });

  it("blocks correction while an automatic grant is active and permits it after reversal",async()=>{
    const renamed=await request(teacherApp()).patch(`/api/submissions/${submissionId}/student-name`).send({studentName:"اسم غير موجود"});
    expect(renamed.status).toBe(409);
    expect((await db.execute(sql`SELECT student_id,student_identity_verified FROM submissions WHERE id=${submissionId}`)).rows[0]).toMatchObject({student_id:studentId,student_identity_verified:true});
    await db.execute(sql`UPDATE submissions SET student_identity_verified=FALSE WHERE id=${submissionId}`);
    expect(await db.transaction(async tx=>{await lockAssignmentRewardEvidence(tx,teacherId,submissionId); return hasActiveAutomaticAssignmentGrant(tx,teacherId,submissionId);})).toBe(true);
    const blocked = await request(teacherApp()).patch(`/api/submissions/${submissionId}/student-link`).send({ studentId });
    expect(blocked.status).toBe(409);
    expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE source_type='assignment_submission' AND source_result_id=${submissionId} AND kind='grant'`)).rows[0].n)).toBe(1);
    const grant=(await db.execute(sql`SELECT * FROM classroom_reward_transactions WHERE rule_id=${ruleId} AND source_result_id=${submissionId} AND kind='grant'`)).rows[0] as any;
    await db.execute(sql`INSERT INTO classroom_reward_transactions(teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,reversal_of_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${studentId},${grant.student_name_snapshot},${rewardTypeId},${-Number(grant.amount)},'reversal',${"reverse:"+nonce},${grant.id},${grant.reward_type_name_snapshot},${grant.category_snapshot})`);
    expect(await db.transaction(async tx=>{await lockAssignmentRewardEvidence(tx,teacherId,submissionId); return hasActiveAutomaticAssignmentGrant(tx,teacherId,submissionId);})).toBe(false);
    const corrected = await request(teacherApp()).patch(`/api/submissions/${submissionId}/student-link`).send({ studentId: otherStudentId });
    expect(corrected.status).toBe(200);
  });

  it("keeps student control data owner-scoped, saves safe avatars, and never returns credentials", async () => {
    const fullBlankOptionalPayload = await request(teacherApp())
      .patch(`/api/classroom-rewards/students/${otherStudentId}/profile`)
      .send({
        name: "آخر",
        gradeLevel: "",
        studentClass: "B",
        parentName: "",
        parentPhone: "",
        parentEmail: "",
        notes: "",
        avatar: "",
      });
    expect(fullBlankOptionalPayload.status).toBe(200);
    expect(fullBlankOptionalPayload.body.student).toMatchObject({ avatar: null, parent_email: null });

    const avatar = "🦁";
    const updated = await request(teacherApp())
      .patch(`/api/classroom-rewards/students/${otherStudentId}/profile`)
      .send({ avatar, notes: "ملاحظة خاصة" });
    expect(updated.status).toBe(200);
    expect(updated.body.student.avatar).toBe(avatar);
    expect((await db.execute(sql`SELECT avatar FROM students WHERE id=${otherStudentId}`)).rows[0].avatar).toBe(avatar);

    const invalidAvatar = await request(teacherApp())
      .patch(`/api/classroom-rewards/students/${otherStudentId}/profile`)
      .send({ avatar: "data:image/svg+xml,<svg onload=alert(1) />" });
    expect(invalidAvatar.status).toBe(400);

    const detail = await request(teacherApp()).get(`/api/classroom-rewards/students/${otherStudentId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.student.avatar).toBe(avatar);
    expect(detail.body.student.notes).toBe("ملاحظة خاصة");

    const linkedDetail = await request(teacherApp()).get(`/api/classroom-rewards/students/${studentId}`);
    expect(linkedDetail.status).toBe(200);
    expect(linkedDetail.body.student.account).toMatchObject({ linked: true, username: `reward_${nonce}` });
    const serializedDetails = JSON.stringify([detail.body, linkedDetail.body]);
    expect(serializedDetails).not.toMatch(/password|accessCode|access_code|token/i);

    const deniedRead = await request(teacherApp(otherTeacherId))
      .get(`/api/classroom-rewards/students/${otherStudentId}`);
    expect(deniedRead.status).toBe(404);
    const deniedUpdate = await request(teacherApp(otherTeacherId))
      .patch(`/api/classroom-rewards/students/${otherStudentId}/profile`)
      .send({ name: "اسم مسروق" });
    expect(deniedUpdate.status).toBe(404);
    const deniedReset = await request(teacherApp(otherTeacherId))
      .post(`/api/classroom-rewards/students/${studentId}/reset-password`)
      .send({ newPassword: "other-secret" });
    expect(deniedReset.status).toBe(404);

    const oldHash = String((await db.execute(sql`SELECT password_hash FROM student_accounts WHERE id=${accountId}`)).rows[0].password_hash);
    const reset = await request(teacherApp())
      .post(`/api/classroom-rewards/students/${studentId}/reset-password`)
      .send({ newPassword: "owner-secret" });
    expect(reset.status).toBe(200);
    expect(JSON.stringify(reset.body)).not.toMatch(/owner-secret|password|token/i);
    const newHash = String((await db.execute(sql`SELECT password_hash FROM student_accounts WHERE id=${accountId}`)).rows[0].password_hash);
    expect(newHash).not.toBe(oldHash);
    expect(await bcrypt.compare("owner-secret", newHash)).toBe(true);
  });

  it("adjusts a balance once, blocks overdrafts, and keeps the action owner-scoped", async () => {
    const grantId = Number((await db.execute(sql`
      INSERT INTO classroom_reward_transactions
        (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,reward_type_name_snapshot,category_snapshot)
      VALUES
        (${teacherId},${otherStudentId},'آخر',${rewardTypeId},10,'grant',${`adjust-grant:${nonce}`},'رصيد اختبار','test')
      RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO classroom_reward_balances (teacher_id,student_id,reward_type_id,balance)
      VALUES (${teacherId},${otherStudentId},${rewardTypeId},10)
      ON CONFLICT (teacher_id,student_id,reward_type_id)
      DO UPDATE SET balance=classroom_reward_balances.balance+10
    `);
    const before = Number((await db.execute(sql`
      SELECT COALESCE(SUM(balance),0)::int points
      FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id=${otherStudentId}
    `)).rows[0].points);
    const key = `adjust:${nonce}`;
    const payload = { points: 4, reason: "تصحيح رصيد", idempotencyKey: key };

    const adjusted = await request(teacherApp())
      .post(`/api/classroom-rewards/students/${otherStudentId}/balance-adjustments`)
      .send(payload);
    expect(adjusted.status).toBe(201);
    expect(adjusted.body).toMatchObject({ balance: before - 4, idempotent: false });

    const replay = await request(teacherApp())
      .post(`/api/classroom-rewards/students/${otherStudentId}/balance-adjustments`)
      .send(payload);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ balance: before - 4, idempotent: true });
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND student_id=${otherStudentId}
        AND idempotency_key=${key} AND kind='adjustment'
    `)).rows[0].n)).toBe(1);

    const overdraft = await request(teacherApp())
      .post(`/api/classroom-rewards/students/${otherStudentId}/balance-adjustments`)
      .send({ points: before, reason: "تعديل أكبر من الرصيد", idempotencyKey: `overdraft:${nonce}` });
    expect(overdraft.status).toBe(409);

    const unsafeReversal = await request(teacherApp())
      .post(`/api/classroom-rewards/ledger/${grantId}/reverse`)
      .send({ idempotencyKey: `reverse-after-adjust:${nonce}` });
    expect(unsafeReversal.status).toBe(409);

    const denied = await request(teacherApp(otherTeacherId))
      .post(`/api/classroom-rewards/students/${otherStudentId}/balance-adjustments`)
      .send({ points: 1, reason: "غير مصرح", idempotencyKey: `denied:${nonce}` });
    expect(denied.status).toBe(404);
  });

  it("adjusts eligible students as one idempotent batch and excludes insufficient balances", async () => {
    await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},'A')
      ON CONFLICT DO NOTHING
    `);
    const eligibleId = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('مؤهل',${teacherId},'A') RETURNING id
    `)).rows[0].id);
    const insufficientId = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('غير مؤهل',${teacherId},'A') RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO classroom_reward_balances(teacher_id,student_id,reward_type_id,balance)
      VALUES (${teacherId},${eligibleId},${rewardTypeId},8),(${teacherId},${insufficientId},${rewardTypeId},2)
    `);
    const key = `bulk-adjust:${nonce}`;
    const payload = {
      className: "A",
      studentIds: [eligibleId, insufficientId],
      points: 5,
      reason: "تصحيح جماعي",
      idempotencyKey: key,
    };

    const [adjusted, replay] = await Promise.all([
      request(teacherApp()).post("/api/classroom-rewards/balance-adjustments").send(payload),
      request(teacherApp()).post("/api/classroom-rewards/balance-adjustments").send(payload),
    ]);
    expect([adjusted.status, replay.status].sort()).toEqual([200, 201]);
    const created = adjusted.status === 201 ? adjusted : replay;
    expect(created.body).toMatchObject({
      adjusted: [{ studentId: eligibleId, studentName: "مؤهل", balance: 3 }],
      excluded: [{ studentId: insufficientId, studentName: "غير مؤهل", balance: 2, reason: "الرصيد الحالي لا يكفي" }],
      idempotent: false,
    });
    const retried = await request(teacherApp()).post("/api/classroom-rewards/balance-adjustments").send(payload);
    expect(retried.status).toBe(200);
    expect(retried.body.idempotent).toBe(true);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND idempotency_key=${key} AND kind='adjustment'
    `)).rows[0].n)).toBe(1);
    expect(Number((await db.execute(sql`
      SELECT COALESCE(SUM(balance),0)::int balance FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id=${eligibleId}
    `)).rows[0].balance)).toBe(3);
    expect(Number((await db.execute(sql`
      SELECT COALESCE(SUM(balance),0)::int balance FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id=${insufficientId}
    `)).rows[0].balance)).toBe(2);
    expect((await db.execute(sql`
      SELECT reward_type_name_snapshot FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND idempotency_key=${key}
    `)).rows[0].reward_type_name_snapshot).toBe("تصحيح جماعي");
  });

  it("reverses a multi-student grant atomically and excludes it from summary metrics", async () => {
    const className = `UNDO-${nonce}`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${className})`);
    const rows = (await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class)
      VALUES ('أول',${teacherId},${className}),('ثان',${teacherId},${className})
      RETURNING id
    `)).rows;
    const studentIds = rows.map((row: any) => Number(row.id));
    const grant = await request(teacherApp())
      .post("/api/classroom-rewards/grants")
      .send({ className, studentIds, typeId: rewardTypeId, idempotencyKey: `grant-batch:${nonce}` });
    expect(grant.status).toBe(201);
    const batchId = Number(grant.body.grants[0].batch_id);

    const before = await request(teacherApp()).get(`/api/classroom-rewards/summary?className=${encodeURIComponent(className)}&period=week`);
    expect(before.body.metrics).toMatchObject({ totalGrantedPoints: 2, recognizedStudentCount: 2 });

    const undoPayload = { idempotencyKey: `undo-batch:${nonce}` };
    const [first, replay] = await Promise.all([
      request(teacherApp()).post(`/api/classroom-rewards/batches/${batchId}/reverse`).send(undoPayload),
      request(teacherApp()).post(`/api/classroom-rewards/batches/${batchId}/reverse`).send(undoPayload),
    ]);
    expect([first.status, replay.status].sort()).toEqual([200, 201]);
    expect(Number((await db.execute(sql`
      SELECT COALESCE(SUM(balance),0)::int balance
      FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id IN (${sql.join(studentIds.map((id) => sql`${id}`), sql`,`)})
    `)).rows[0].balance)).toBe(0);

    const after = await request(teacherApp()).get(`/api/classroom-rewards/summary?className=${encodeURIComponent(className)}&period=week`);
    expect(after.body.metrics).toMatchObject({ totalGrantedPoints: 0, recognizedStudentIds: [], recognizedStudentCount: 0 });
    expect(after.body.typeSummaries).toEqual([]);
  });

  it("replays a batch reversal receipt and rejects the same key for another batch", async () => {
    const className = `REPLAY-${nonce}`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${className})`);
    const ids = (await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('إعادة 1',${teacherId},${className}),('إعادة 2',${teacherId},${className}) RETURNING id
    `)).rows.map((r:any) => Number(r.id));
    const grant = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({ className, studentIds: ids, typeId: rewardTypeId, idempotencyKey: `replay-grant:${nonce}` });
    const batchId = Number(grant.body.grants[0].batch_id);
    const payload = { idempotencyKey: `replay-reverse:${nonce}` };
    const first = await request(teacherApp()).post(`/api/classroom-rewards/batches/${batchId}/reverse`).send(payload);
    const replay = await request(teacherApp()).post(`/api/classroom-rewards/batches/${batchId}/reverse`).send(payload);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.entries).toHaveLength(2);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions WHERE batch_id=${batchId} AND kind='reversal'
    `)).rows[0].n)).toBe(2);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_batch_reversals WHERE teacher_id=${teacherId} AND batch_id=${batchId}
    `)).rows[0].n)).toBe(1);

    const secondClass = `${className}-2`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${secondClass})`);
    const secondStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('إعادة 3',${teacherId},${secondClass}) RETURNING id
    `)).rows[0].id);
    const secondGrant = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({ className: secondClass, studentIds: [secondStudent], typeId: rewardTypeId, idempotencyKey: `replay-grant-2:${nonce}` });
    const conflict = await request(teacherApp())
      .post(`/api/classroom-rewards/batches/${Number(secondGrant.body.grants[0].batch_id)}/reverse`).send(payload);
    expect(conflict.status).toBe(409);
  });

  it("concurrently reverses every grant once and preserves atomic failure on partial or insufficient batches", async () => {
    const className = `CONCURRENT-${nonce}`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${className})`);
    const ids = (await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('تزامن 1',${teacherId},${className}),('تزامن 2',${teacherId},${className}) RETURNING id
    `)).rows.map((r:any) => Number(r.id));
    const grant = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({ className, studentIds: ids, typeId: rewardTypeId, idempotencyKey: `concurrent-grant:${nonce}` });
    const batchId = Number(grant.body.grants[0].batch_id), key = `concurrent-reverse:${nonce}`;
    const [a,b] = await Promise.all([
      request(teacherApp()).post(`/api/classroom-rewards/batches/${batchId}/reverse`).send({ idempotencyKey:key }),
      request(teacherApp()).post(`/api/classroom-rewards/batches/${batchId}/reverse`).send({ idempotencyKey:key }),
    ]);
    expect([a.status,b.status].sort()).toEqual([200,201]);
    expect(Number((await db.execute(sql`
      SELECT count(*) n FROM classroom_reward_transactions WHERE batch_id=${batchId} AND kind='reversal'
    `)).rows[0].n)).toBe(2);
    const balances = (await db.execute(sql`
      SELECT student_id,COALESCE(SUM(balance),0)::int balance FROM classroom_reward_balances
      WHERE teacher_id=${teacherId} AND student_id IN (${sql.join(ids.map(id=>sql`${id}`),sql`,`)}) GROUP BY student_id ORDER BY student_id
    `)).rows;
    expect(balances.map((r:any)=>Number(r.balance))).toEqual([0,0]);

    const partialClass = `PARTIAL-${nonce}`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${partialClass})`);
    const partialIds = (await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('جزئي 1',${teacherId},${partialClass}),('جزئي 2',${teacherId},${partialClass}) RETURNING id
    `)).rows.map((r:any) => Number(r.id));
    const partialGrant = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({ className:partialClass,studentIds:partialIds,typeId:rewardTypeId,idempotencyKey:`partial-grant:${nonce}` });
    const partialBatch = Number(partialGrant.body.grants[0].batch_id);
    const oneGrant = Number(partialGrant.body.grants[0].id);
    expect((await request(teacherApp()).post(`/api/classroom-rewards/ledger/${oneGrant}/reverse`).send({idempotencyKey:`partial-one:${nonce}`})).status).toBe(201);
    const partialBefore = Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE batch_id=${partialBatch} AND kind='reversal'`)).rows[0].n);
    expect((await request(teacherApp()).post(`/api/classroom-rewards/batches/${partialBatch}/reverse`).send({idempotencyKey:`partial-batch:${nonce}`})).status).toBe(409);
    expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE batch_id=${partialBatch} AND kind='reversal'`)).rows[0].n)).toBe(partialBefore);

    const poorClass = `POOR-${nonce}`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${poorClass})`);
    const poorStudent = Number((await db.execute(sql`INSERT INTO students(name,teacher_id,student_class) VALUES ('ناقص',${teacherId},${poorClass}) RETURNING id`)).rows[0].id);
    const poorGrant = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({className:poorClass,studentIds:[poorStudent],typeId:rewardTypeId,idempotencyKey:`poor-grant:${nonce}`});
    const poorBatch = Number(poorGrant.body.grants[0].batch_id);
    await db.execute(sql`UPDATE classroom_reward_balances SET balance=0 WHERE teacher_id=${teacherId} AND student_id=${poorStudent}`);
    expect((await request(teacherApp()).post(`/api/classroom-rewards/batches/${poorBatch}/reverse`).send({idempotencyKey:`poor-batch:${nonce}`})).status).toBe(409);
    expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE batch_id=${poorBatch} AND kind='reversal'`)).rows[0].n)).toBe(0);
  });

  it("keeps goals owner-scoped, counts only unreversed grants, and strips private board fields", async () => {
    const className = `GOALS-${nonce}`;
    await db.execute(sql`INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${className})`);
    const goalStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class,parent_name,parent_phone,parent_email,notes) VALUES ('هدف',${teacherId},${className},'ولي','555','private@example.invalid','private') RETURNING id
    `)).rows[0].id);
    const outsider = Number((await db.execute(sql`INSERT INTO students(name,teacher_id,student_class) VALUES ('خارج',${teacherId},'B') RETURNING id`)).rows[0].id);
    const created = await request(teacherApp()).post(`/api/classroom-rewards/classes/${className}/goals`)
      .send({title:"هدف أسبوعي",targetPoints:5,studentId:goalStudent});
    expect(created.status).toBe(201);
    const denied = await request(teacherApp()).post(`/api/classroom-rewards/classes/${className}/goals`)
      .send({title:"هدف خاطئ",targetPoints:5,studentId:outsider});
    expect(denied.status).toBe(403);
    const otherClassId=Number((await db.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name='B'`)).rows[0].id);
    await db.execute(sql`INSERT INTO classroom_reward_transactions(teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${goalStudent},'هدف',${rewardTypeId},9,'grant',${`goal-other-class:${nonce}`},'B',${otherClassId},'نوع آخر','test')`);
    expect((await request(teacherApp()).get(`/api/classroom-rewards/classes/${className}/goals`)).body.goals[0].currentPoints).toBe(0);
    const validGrant = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({className,studentIds:[goalStudent],typeId:rewardTypeId,idempotencyKey:`goal-grant-valid:${nonce}`});
    expect(validGrant.status).toBe(201);
    const goal = await request(teacherApp()).get(`/api/classroom-rewards/classes/${className}/goals`);
    expect(goal.body.goals[0]).toMatchObject({studentId:goalStudent,currentPoints:1,completed:false});
    await request(teacherApp()).post(`/api/classroom-rewards/ledger/${validGrant.body.grants[0].id}/reverse`).send({idempotencyKey:`goal-reverse:${nonce}`});
    expect((await request(teacherApp()).get(`/api/classroom-rewards/classes/${className}/goals`)).body.goals[0].currentPoints).toBe(0);
    const board = await request(teacherApp()).get(`/api/classroom-rewards/classes/${className}/board`);
    expect(board.status).toBe(200);
    expect(JSON.stringify(board.body)).not.toMatch(/parent|phone|email|notes|account|username|password/i);
  });

  it("keeps student and teacher goal progress identical for legacy class-name transactions", async () => {
    const className = `GOAL-PARITY-${nonce}`;
    const classRow = (await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${className})
      RETURNING id,created_at
    `)).rows[0];
    const goalAccount = Number((await db.execute(sql`
      INSERT INTO student_accounts(username,display_name,password_hash)
      VALUES (${`goal_parity_${nonce}`},'طالب الاتساق','x') RETURNING id
    `)).rows[0].id);
    const goalStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_account_id,student_class)
      VALUES ('طالب الاتساق',${teacherId},${goalAccount},${className}) RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO classroom_reward_goals(
        teacher_id,teacher_class_id,student_id,title,skill,target_points,
        starts_at,status,is_active
      ) VALUES (
        ${teacherId},${Number(classRow.id)},${goalStudent},'هدف الاتساق','مهارة الاتساق',10,
        ${new Date(new Date(classRow.created_at as string).getTime() - 172_800_000).toISOString()},
        'active',TRUE
      )
    `);
    await db.execute(sql`
      INSERT INTO classroom_reward_transactions(
        teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,
        idempotency_key,class_name_snapshot,reward_type_name_snapshot,category_snapshot,created_at
      ) VALUES
        (${teacherId},${goalStudent},'طالب الاتساق',${rewardTypeId},8,'grant',
         ${`goal-parity-stale:${nonce}`},${className},'نوع قديم','test',
         ${new Date(new Date(classRow.created_at as string).getTime() - 86_400_000).toISOString()}),
        (${teacherId},${goalStudent},'طالب الاتساق',${rewardTypeId},2,'grant',
         ${`goal-parity-current:${nonce}`},${className},'نوع حالي','test',NOW())
    `);

    const teacherView = await request(teacherApp()).get(`/api/classroom-rewards/classes/${encodeURIComponent(className)}`);
    const studentView = await request(studentRewardApp(goalAccount)).get("/api/student-auth/me/reward-goal");

    expect(teacherView.status).toBe(200);
    expect(studentView.status).toBe(200);
    expect(teacherView.body.students[0].goal.progress).toBe(2);
    expect(studentView.body.goal.currentPoints).toBe(2);
  });

  it("keeps manual, automatic, and legacy reward history attached after a class rename", async () => {
    const oldName = `RENAME-OLD-${nonce}`;
    const newName = `RENAME-NEW-${nonce}`;
    const classId = Number((await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${oldName}) RETURNING id
    `)).rows[0].id);
    const renameStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class,grade_level)
      VALUES ('إعادة تسمية',${teacherId},${oldName},${oldName}) RETURNING id
    `)).rows[0].id);
    const legacyStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class,grade_level)
      VALUES ('سجل قديم',${teacherId},${oldName},NULL) RETURNING id
    `)).rows[0].id);
    const otherClassStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class,grade_level)
      VALUES ('صف مختلف',${teacherId},'صف آخر','صف آخر') RETURNING id
    `)).rows[0].id);
    const manual = await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({className:oldName,studentIds:[renameStudent],typeId:rewardTypeId,idempotencyKey:`rename-manual:${nonce}`});
    expect(manual.status).toBe(201);
    await db.transaction((tx) => evaluateClassroomRewardEvidence(tx, {
      teacherId, ruleId, sourceType:"assignment_submission", sourceResultId:submissionId+2_000_000,
      studentId:renameStudent, completed:true, score:1, evidenceSummary:{effectivePoints:1},
    }));
    await db.execute(sql`
      INSERT INTO classroom_reward_transactions
        (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,
         class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot)
      VALUES
        (${teacherId},${renameStudent},'إعادة تسمية',${rewardTypeId},4,'grant',${`rename-legacy:${nonce}`},
         ${oldName},NULL,'قديم','test')
    `);
    const goal = await request(teacherApp()).post(`/api/classroom-rewards/classes/${encodeURIComponent(oldName)}/goals`)
      .send({
        title:"هدف إعادة التسمية",
        targetPoints:20,
        studentId:renameStudent,
        startsAt:new Date(Date.now()-60_000).toISOString(),
      });
    expect(goal.status).toBe(201);

    const renamed = await request(teacherApp()).patch("/api/teacher/classes/rename").send({oldName,newName});
    expect(renamed.status).toBe(200);
    const summary = await request(teacherApp()).get(`/api/classroom-rewards/summary?className=${encodeURIComponent(newName)}`);
    expect(summary.body.metrics).toMatchObject({totalGrantedPoints:7,recognizedStudentIds:[renameStudent]});
    const goals = await request(teacherApp()).get(`/api/classroom-rewards/classes/${encodeURIComponent(newName)}/goals`);
    expect(goals.body.goals[0]).toMatchObject({id:goal.body.id,currentPoints:7});
    const classDetail = await request(teacherApp()).get(`/api/classroom-rewards/classes/${encodeURIComponent(newName)}`);
    expect(classDetail.body.students).toEqual(expect.arrayContaining([
      expect.objectContaining({id:renameStudent}),
      expect.objectContaining({id:legacyStudent}),
    ]));
    expect(classDetail.body.students.find((student: any) => student.id === renameStudent).lastRewardAt).not.toBeNull();
    expect((await db.execute(sql`
      SELECT student_class,grade_level FROM students WHERE id=${legacyStudent}
    `)).rows[0]).toMatchObject({student_class:newName,grade_level:newName});
    expect((await db.execute(sql`
      SELECT student_class,grade_level FROM students WHERE id=${otherClassStudent}
    `)).rows[0]).toMatchObject({student_class:"صف آخر",grade_level:"صف آخر"});
    expect((await db.execute(sql`
      SELECT class_name_snapshot FROM classroom_reward_transactions
      WHERE teacher_id=${teacherId} AND idempotency_key=${`rename-legacy:${nonce}`} AND teacher_class_id IS NULL
    `)).rows[0].class_name_snapshot).toBe(newName);
    expect(Number((await db.execute(sql`SELECT id FROM teacher_classes WHERE id=${classId}`)).rows[0].id)).toBe(classId);
  });

  it("does not rename another teacher's matching class or students", async () => {
    const sharedName = `SHARED-RENAME-${nonce}`;
    const renamedName = `OWNER-RENAMED-${nonce}`;
    await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name)
      VALUES (${teacherId},${sharedName}),(${otherTeacherId},${sharedName})
    `);
    const otherTeacherStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class,grade_level,notes)
      VALUES ('طالب المعلم الآخر',${otherTeacherId},${sharedName},${sharedName},'بيانات ثابتة')
      RETURNING id
    `)).rows[0].id);

    const renamed = await request(teacherApp()).patch("/api/teacher/classes/rename")
      .send({oldName:sharedName,newName:renamedName});
    expect(renamed.status).toBe(200);

    expect((await db.execute(sql`
      SELECT name FROM teacher_classes
      WHERE teacher_id=${otherTeacherId} AND name=${sharedName}
    `)).rows).toHaveLength(1);
    expect((await db.execute(sql`
      SELECT name,teacher_id,student_class,grade_level,notes
      FROM students WHERE id=${otherTeacherStudent}
    `)).rows[0]).toMatchObject({
      name:"طالب المعلم الآخر",
      teacher_id:otherTeacherId,
      student_class:sharedName,
      grade_level:sharedName,
      notes:"بيانات ثابتة",
    });
  });

  it("does not rename another teacher's matching legacy reward snapshot", async () => {
    const sharedName = `SHARED-LEGACY-${nonce}`;
    const renamedName = `OWNER-LEGACY-RENAMED-${nonce}`;
    await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name)
      VALUES (${teacherId},${sharedName}),(${otherTeacherId},${sharedName})
    `);
    const ownerStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class)
      VALUES ('سجل المالك',${teacherId},${sharedName})
      RETURNING id
    `)).rows[0].id);
    const otherOwnerStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class)
      VALUES ('سجل المعلم الآخر',${otherTeacherId},${sharedName})
      RETURNING id
    `)).rows[0].id);
    const ownerKey = `rename-owner-legacy:${nonce}`;
    const otherOwnerKey = `rename-other-owner-legacy:${nonce}`;
    await db.execute(sql`
      INSERT INTO classroom_reward_transactions
        (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,
         class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot)
      VALUES
        (${teacherId},${ownerStudent},'سجل المالك',${rewardTypeId},1,'grant',${ownerKey},
         ${sharedName},NULL,'قديم','test'),
        (${otherTeacherId},${otherOwnerStudent},'سجل المعلم الآخر',${rewardTypeId},1,'grant',${otherOwnerKey},
         ${sharedName},NULL,'قديم','test')
    `);

    const renamed = await request(teacherApp()).patch("/api/teacher/classes/rename")
      .send({oldName:sharedName,newName:renamedName});
    expect(renamed.status).toBe(200);

    const snapshots = (await db.execute(sql`
      SELECT teacher_id,class_name_snapshot
      FROM classroom_reward_transactions
      WHERE idempotency_key IN (${ownerKey},${otherOwnerKey})
      ORDER BY teacher_id
    `)).rows;
    expect(snapshots).toEqual(expect.arrayContaining([
      expect.objectContaining({teacher_id:teacherId,class_name_snapshot:renamedName}),
      expect.objectContaining({teacher_id:otherTeacherId,class_name_snapshot:sharedName}),
    ]));
  });

  it("does not leak old identity or legacy name history into a recreated class", async () => {
    const className = `RECREATE-${nonce}`;
    const oldClassId = Number((await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name,created_at) VALUES (${teacherId},${className},NOW()-INTERVAL '2 hours') RETURNING id
    `)).rows[0].id);
    const oldStudent = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class) VALUES ('قديم',${teacherId},${className}) RETURNING id
    `)).rows[0].id);
    await request(teacherApp()).post("/api/classroom-rewards/grants")
      .send({className,studentIds:[oldStudent],typeId:rewardTypeId,idempotencyKey:`recreate-manual:${nonce}`});
    await db.transaction((tx) => evaluateClassroomRewardEvidence(tx, {
      teacherId, ruleId, sourceType:"assignment_submission", sourceResultId:submissionId+3_000_000,
      studentId:oldStudent, completed:true, score:1, evidenceSummary:{effectivePoints:1},
    }));
    await db.execute(sql`
      INSERT INTO classroom_reward_transactions
        (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,
         class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot,created_at)
      VALUES
        (${teacherId},${oldStudent},'قديم',${rewardTypeId},4,'grant',${`recreate-legacy:${nonce}`},
         ${className},NULL,'قديم','test',NOW()-INTERVAL '1 hour')
    `);
    await db.execute(sql`DELETE FROM teacher_classes WHERE id=${oldClassId}`);
    const newClassId = Number((await db.execute(sql`
      INSERT INTO teacher_classes(teacher_id,name) VALUES (${teacherId},${className}) RETURNING id
    `)).rows[0].id);
    await db.execute(sql`UPDATE students SET student_class=${className} WHERE id=${oldStudent}`);
    const newGoal = await request(teacherApp()).post(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/goals`)
      .send({title:"هدف الهوية الجديدة",targetPoints:10,studentId:oldStudent});
    expect(newGoal.status).toBe(201);

    const summary = await request(teacherApp()).get(`/api/classroom-rewards/summary?className=${encodeURIComponent(className)}`);
    expect(summary.body.metrics).toMatchObject({totalGrantedPoints:0,recognizedStudentIds:[]});
    const goals = await request(teacherApp()).get(`/api/classroom-rewards/classes/${encodeURIComponent(className)}/goals`);
    expect(goals.body.goals[0]).toMatchObject({id:newGoal.body.id,currentPoints:0});
    const classDetail = await request(teacherApp()).get(`/api/classroom-rewards/classes/${encodeURIComponent(className)}`);
    expect(classDetail.body.students[0]).toMatchObject({id:oldStudent,lastRewardAt:null});
    expect(newClassId).not.toBe(oldClassId);
  });

  it("creates teacher-owned reward groups and replaces only same-class members", async () => {
    const created = await request(teacherApp())
      .post("/api/classroom-rewards/classes/A/groups")
      .send({ name: "رواد القراءة", description: "تحديات القراءة", color: "#3b82f6", sortOrder: 0, studentIds: [studentId] });
    expect(created.status).toBe(201);
    const groupId = Number(created.body.id);

    const savedMembers = await request(teacherApp())
      .put(`/api/classroom-rewards/classes/A/groups/${groupId}/members`)
      .send({ studentIds: [studentId] });
    expect(savedMembers.status).toBe(200);
    expect(savedMembers.body.members).toEqual([{ studentId, name: "طالب" }]);

    const wrongClass = await request(teacherApp())
      .patch(`/api/classroom-rewards/classes/A/groups/${groupId}`)
      .send({ name: "اسم يجب ألا يحفظ", studentIds: [studentId, otherStudentId] });
    expect(wrongClass.status).toBe(403);

    const listed = await request(teacherApp()).get("/api/classroom-rewards/classes/A/groups");
    expect(listed.status).toBe(200);
    expect(listed.body.groups[0]).toMatchObject({
      id: groupId,
      name: "رواد القراءة",
      color: "#3b82f6",
      members: [{ studentId, name: "طالب" }],
    });

    const denied = await request(teacherApp(otherTeacherId))
      .patch(`/api/classroom-rewards/classes/A/groups/${groupId}`)
      .send({ name: "مجموعة مسروقة" });
    expect(denied.status).toBe(404);

    const deleted = await request(teacherApp())
      .delete(`/api/classroom-rewards/classes/A/groups/${groupId}`);
    expect(deleted.status).toBe(200);
    expect((await request(teacherApp()).get("/api/classroom-rewards/classes/A/groups")).body.groups).toEqual([]);
  });

  it("maps question-bank sessions by teacher/account and rejects spoofed or wrong-teacher identities",async()=>{
    expect(await resolveWameethStudentIdentity(db,{teacherId,studentAccountId:accountId,targetClasses:[]})).toEqual({studentId,studentAccountId:accountId});
    expect(await resolveWameethStudentIdentity(db,{teacherId:otherTeacherId,studentAccountId:accountId,targetClasses:[]})).toBeNull();
    expect(await resolveWameethStudentIdentity(db,{teacherId,studentAccountId:null,targetClasses:[]})).toBeNull();
    expect(await resolveWameethStudentIdentity(db,{teacherId,studentAccountId:accountId,targetClasses:["B"]})).toBeNull();
    expect(otherStudentId).toBeGreaterThan(0);
  });

  it("persists reused PINs as distinct runs while concurrent saves of one run converge",async()=>{
    const question={id:1,text:"س",questionType:"mcq",optionA:"أ",optionB:"ب",correctAnswer:"أ"} as GameQuestion;
    const first=createGame(assignmentId,"أ","socket",teacherId,[question]);
    const second=createGame(assignmentId,"ب","socket",teacherId,[question]);
    const firstRegistryPin=first.pin, secondRegistryPin=second.pin;
    try {
      (first as any).pin="445566";
      (second as any).pin="445566";
      const [sameA,sameB]=await Promise.all([persistWameethGameHistory(first),persistWameethGameHistory(first)]);
      const other=await persistWameethGameHistory(second);
      expect(sameA.id).toBe(sameB.id);
      expect(other.id).not.toBe(sameA.id);
      const rows=(await db.execute(sql`SELECT id,game_run_id FROM game_history WHERE teacher_id=${teacherId} AND pin='445566'`)).rows;
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row:any)=>row.game_run_id)).size).toBe(2);
      const migration=readFileSync(new URL("../../../../scripts/migrations/2026-06-13-classroom-rewards.sql",import.meta.url),"utf8");
      await expect(db.execute(sql.raw(migration))).resolves.toBeDefined();
    } finally {
      deleteGame(firstRegistryPin);
      deleteGame(secondRegistryPin);
    }
  });

  it("renews a replay run and persists each question-bank execution exactly once",async()=>{
    const question={id:2,text:"بنك",questionType:"mcq",optionA:"أ",optionB:"ب",correctAnswer:"أ"} as GameQuestion;
    const game=createGame(0,"بنك الأسئلة","socket",teacherId,[question]);
    const registryPin=game.pin;
    try {
      const player=addPlayer(game.pin,"student-socket","طالب","🦁",studentId,accountId)!;
      player.score=5;
      player.totalCorrect=1;
      game.currentQuestionIndex=0;
      game.state="finished";
      const initialRunId=game.gameRunId;
      const [first,httpReplay]=await Promise.all([
        saveFullWameethGame(game),
        request(gameHistoryApp()).post(`/api/game-history/save/${game.pin}`).send({}),
      ]);
      expect(httpReplay.status).toBe(200);
      expect(first.id).toBe(httpReplay.body.id);
      const history=(await db.execute(sql`SELECT assignment_id FROM game_history WHERE id=${first.id}`)).rows[0] as any;
      expect(history.assignment_id).toBeNull();
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE rule_id=${gameRuleId} AND source_type='game_history' AND source_result_id=${first.id} AND kind='grant'`)).rows[0].n)).toBe(1);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_rule_evaluations WHERE rule_id=${gameRuleId} AND source_type='game_history' AND source_result_id=${first.id} AND outcome='granted'`)).rows[0].n)).toBe(1);
      resetGameToLobby(game);
      expect(game.gameRunId).not.toBe(initialRunId);
      player.score=7;
      player.totalCorrect=1;
      game.currentQuestionIndex=0;
      game.state="finished";
      const second=await saveFullWameethGame(game);
      expect(second.id).not.toBe(first.id);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM game_history WHERE teacher_id=${teacherId} AND pin=${game.pin} AND assignment_id IS NULL`)).rows[0].n)).toBe(2);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE rule_id=${gameRuleId} AND source_type='game_history' AND source_result_id IN (${first.id},${second.id}) AND kind='grant'`)).rows[0].n)).toBe(2);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM wameeth_scores WHERE student_account_id=${accountId} AND assignment_title='بنك الأسئلة'`)).rows[0].n)).toBe(2);
      expect(Number((await db.execute(sql`SELECT games_played FROM student_accounts WHERE id=${accountId}`)).rows[0].games_played)).toBe(2);
    } finally {
      deleteGame(registryPin);
    }
  });

  it("persists authenticated account results without inventing a roster reward identity",async()=>{
    const orphanAccountId=Number((await db.execute(sql`
      INSERT INTO student_accounts(username,display_name,password_hash)
      VALUES (${`unrostered_${nonce}`},'غير مسجل','x') RETURNING id
    `)).rows[0].id);
    const question={id:5,text:"حساب فقط",questionType:"mcq",optionA:"أ",optionB:"ب",correctAnswer:"أ"} as GameQuestion;
    const game=createGame(0,`NO-ROSTER-${nonce}`,"socket",teacherId,[question]);
    const pin=game.pin;
    try {
      const player=addPlayer(pin,"account-only","غير مسجل","🦁",null,orphanAccountId)!;
      player.score=11;
      player.totalCorrect=1;
      game.currentQuestionIndex=0;
      game.state="finished";
      const first=await saveFullWameethGame(game);
      const replay=await saveFullWameethGame(game);
      expect(replay.id).toBe(first.id);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM wameeth_scores WHERE student_account_id=${orphanAccountId} AND assignment_title=${game.assignmentTitle}`)).rows[0].n)).toBe(1);
      expect((await db.execute(sql`SELECT total_score,games_played FROM student_accounts WHERE id=${orphanAccountId}`)).rows[0]).toMatchObject({total_score:11,games_played:1});
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_rule_evaluations WHERE source_type='game_history' AND source_result_id=${first.id}`)).rows[0].n)).toBe(0);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE source_type='game_history' AND source_result_id=${first.id}`)).rows[0].n)).toBe(0);
      const details=(await db.execute(sql`SELECT detailed_results FROM game_history WHERE id=${first.id}`)).rows[0].detailed_results as any[];
      expect(details[0]).not.toHaveProperty("studentId");
    } finally {
      deleteGame(pin);
      await db.execute(sql`DELETE FROM wameeth_scores WHERE student_account_id=${orphanAccountId}`);
      await db.execute(sql`DELETE FROM student_accounts WHERE id=${orphanAccountId}`);
    }
  });

  it("coordinates concurrent started independent termination into one durable result",async()=>{
    const question={id:6,text:"مستقل",questionType:"mcq",optionA:"أ",optionB:"ب",correctAnswer:"أ"} as GameQuestion;
    const game=createGame(0,`INDEPENDENT-${nonce}`,"socket",teacherId,[question]);
    const pin=game.pin;
    const socketId=`independent-${nonce}`;
    let connection:((socket:any)=>void)|undefined;
    const io={
      on:(event:string,handler:(socket:any)=>void)=>{if(event==="connection")connection=handler;return io;},
      to:()=>({emit:vi.fn()}),
    };
    setupGameSocket(io as any);
    const handlers=new Map<string,(...args:any[])=>any>();
    const socket={
      id:socketId,request:{},data:{},join:vi.fn(),emit:vi.fn(),
      on:(event:string,handler:(...args:any[])=>any)=>{handlers.set(event,handler);return socket;},
    };
    try {
      const player=addPlayer(pin,socketId,"طالب","🦁",studentId,accountId)!;
      player.score=13;
      player.totalCorrect=1;
      game.independentSession=true;
      game.independentPlayerSocketId=socketId;
      game.state="question";
      game.currentQuestionIndex=0;
      const gamesBefore=Number((await db.execute(sql`SELECT games_played FROM student_accounts WHERE id=${accountId}`)).rows[0].games_played);
      connection!(socket);
      const end=handlers.get("independent:end-game")!;
      const firstAck=vi.fn(),secondAck=vi.fn();
      await Promise.all([end({pin},firstAck),end({pin},secondAck)]);
      expect(firstAck).toHaveBeenCalledWith({ok:true,saved:true});
      expect(secondAck).toHaveBeenCalledWith({ok:true,saved:true});
      const history=(await db.execute(sql`SELECT id FROM game_history WHERE game_run_id=${game.gameRunId}`)).rows;
      expect(history).toHaveLength(1);
      const historyId=Number((history[0] as any).id);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_rule_evaluations WHERE rule_id=${gameRuleId} AND source_result_id=${historyId} AND outcome='granted'`)).rows[0].n)).toBe(1);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE rule_id=${gameRuleId} AND source_result_id=${historyId} AND kind='grant'`)).rows[0].n)).toBe(1);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM wameeth_scores WHERE student_account_id=${accountId} AND assignment_title=${game.assignmentTitle}`)).rows[0].n)).toBe(1);
      expect(Number((await db.execute(sql`SELECT games_played FROM student_accounts WHERE id=${accountId}`)).rows[0].games_played)).toBe(gamesBefore+1);
    } finally { deleteGame(pin); }
  });

  it("rejects premature active HTTP persistence without durable evidence",async()=>{
    const question={id:3,text:"مبكر",questionType:"mcq",optionA:"أ",optionB:"ب",correctAnswer:"أ"} as GameQuestion;
    const game=createGame(0,"مبكر","socket",teacherId,[question]);
    const pin=game.pin;
    try {
      addPlayer(pin,"early-player","طالب","🦁",studentId,accountId);
      const evaluationsBefore=Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_rule_evaluations`)).rows[0].n);
      const response=await request(gameHistoryApp()).post(`/api/game-history/save/${pin}`).send({});
      expect(response.status).toBe(409);
      let connection:((socket:any)=>void)|undefined;
      const io={on:(event:string,handler:(socket:any)=>void)=>{if(event==="connection")connection=handler;return io;},to:()=>({emit:vi.fn()})};
      setupGameSocket(io as any);
      const handlers=new Map<string,(...args:any[])=>any>();
      const teacherSocket={
        id:"socket",request:{session:{teacherId}},data:{},join:vi.fn(),emit:vi.fn(),
        on:(event:string,handler:(...args:any[])=>any)=>{handlers.set(event,handler);return teacherSocket;},
      };
      connection!(teacherSocket);
      const ended=vi.fn();
      await handlers.get("teacher:end-game")!({pin},ended);
      expect(ended).toHaveBeenCalledWith({success:true,saved:false,reason:"no_play"});
      expect(game.state).toBe("finished");
      await expect(saveFullWameethGame(game)).rejects.toThrow("game_not_started");
      expect(Number((await db.execute(sql`SELECT count(*) n FROM game_history WHERE game_run_id=${game.gameRunId}`)).rows[0].n)).toBe(0);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE source_type='game_history' AND idempotency_key LIKE ${"%"+game.gameRunId+"%"}`)).rows[0].n)).toBe(0);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_rule_evaluations`)).rows[0].n)).toBe(evaluationsBefore);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM wameeth_scores WHERE student_account_id=${accountId} AND assignment_title=${game.assignmentTitle}`)).rows[0].n)).toBe(0);
    } finally { deleteGame(pin); }
  });

  it("rolls back the full durable unit after a legacy write failure and retries once",async()=>{
    const question={id:4,text:"فشل",questionType:"mcq",optionA:"أ",optionB:"ب",correctAnswer:"أ"} as GameQuestion;
    const game=createGame(0,`FAIL-${nonce}`,"socket",teacherId,[question]);
    const pin=game.pin;
    const functionName=`fail_wameeth_${nonce}`.replace(/[^a-zA-Z0-9_]/g,"_");
    const triggerName=`trigger_${functionName}`;
    try {
      const player=addPlayer(pin,"failure-player","طالب","🦁",studentId,accountId)!;
      player.score=9;
      game.currentQuestionIndex=0;
      game.state="finished";
      const grantsBefore=Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE source_type='game_history' AND student_id=${studentId} AND amount=3`)).rows[0].n);
      await db.execute(sql.raw(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.assignment_title='FAIL-${nonce}' THEN RAISE EXCEPTION 'forced legacy failure'; END IF; RETURN NEW; END $$`));
      await db.execute(sql.raw(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON wameeth_scores FOR EACH ROW EXECUTE FUNCTION ${functionName}()`));
      await expect(saveFullWameethGame(game)).rejects.toThrow();
      expect(Number((await db.execute(sql`SELECT count(*) n FROM game_history WHERE game_run_id=${game.gameRunId}`)).rows[0].n)).toBe(0);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM classroom_reward_transactions WHERE source_type='game_history' AND student_id=${studentId} AND amount=3`)).rows[0].n)).toBe(grantsBefore);
      await db.execute(sql.raw(`DROP TRIGGER ${triggerName} ON wameeth_scores`));
      await db.execute(sql.raw(`DROP FUNCTION ${functionName}()`));
      const result=await saveFullWameethGame(game);
      expect(Number((await db.execute(sql`SELECT count(*) n FROM game_history WHERE id=${result.id}`)).rows[0].n)).toBe(1);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON wameeth_scores`));
      await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${functionName}()`));
      deleteGame(pin);
    }
  });
});