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
  return app;
}
function gameHistoryApp(){
  const app=express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.session={teacherId};req.log={error:()=>{},warn:()=>{},info:()=>{}};next();});
  app.use("/api",gameHistoryRouter);
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