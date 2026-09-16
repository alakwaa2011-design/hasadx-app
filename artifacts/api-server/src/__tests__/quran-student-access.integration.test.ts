import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import quranRouter from "../routes/quran";

const RUN = Boolean(process.env.TEST_DATABASE_URL) && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const suite = RUN ? describe : describe.skip;
const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

let teacherId = 0;
let accountId = 0;
let otherAccountId = 0;
let unlinkedAccountId = 0;
let studentId = 0;
let otherStudentId = 0;
let wardId = 0;
let otherWardId = 0;

function studentApp(studentAccountId?: number) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = studentAccountId ? { studentAccountId } : {};
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", quranRouter);
  return app;
}

suite("student Quran ward ownership", () => {
  beforeAll(async () => {
    teacherId = Number((await db.execute(sql`
      INSERT INTO teachers(name,email,password_hash)
      VALUES (${"Quran access " + nonce}, ${`quran_access_${nonce}@test.invalid`}, 'x')
      RETURNING id
    `)).rows[0].id);
    accountId = Number((await db.execute(sql`
      INSERT INTO student_accounts(username,display_name,password_hash)
      VALUES (${`quran_${nonce}`}, 'طالب', 'x') RETURNING id
    `)).rows[0].id);
    otherAccountId = Number((await db.execute(sql`
      INSERT INTO student_accounts(username,display_name,password_hash)
      VALUES (${`quran_other_${nonce}`}, 'طالب آخر', 'x') RETURNING id
    `)).rows[0].id);
    unlinkedAccountId = Number((await db.execute(sql`
      INSERT INTO student_accounts(username,display_name,password_hash)
      VALUES (${`quran_unlinked_${nonce}`}, 'طالب غير مرتبط', 'x') RETURNING id
    `)).rows[0].id);
    studentId = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_account_id,student_class)
      VALUES ('طالب', ${teacherId}, ${accountId}, 'A') RETURNING id
    `)).rows[0].id);
    otherStudentId = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_account_id,student_class)
      VALUES ('طالب آخر', ${teacherId}, ${otherAccountId}, 'A') RETURNING id
    `)).rows[0].id);
    wardId = Number((await db.execute(sql`
      INSERT INTO quran_wards(teacher_id,student_id,mode,surah_number,surah_name,start_ayah,end_ayah,assigned_date)
      VALUES (${teacherId}, ${studentId}, 'memorization', 1, 'الفاتحة', 1, 7, CURRENT_DATE)
      RETURNING id
    `)).rows[0].id);
    otherWardId = Number((await db.execute(sql`
      INSERT INTO quran_wards(teacher_id,student_id,mode,surah_number,surah_name,start_ayah,end_ayah,assigned_date)
      VALUES (${teacherId}, ${otherStudentId}, 'review', 2, 'البقرة', 1, 5, CURRENT_DATE)
      RETURNING id
    `)).rows[0].id);
  });

  afterAll(async () => {
    if (teacherId) await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    if (accountId || otherAccountId || unlinkedAccountId) {
      await db.execute(sql`DELETE FROM student_accounts WHERE id IN (${accountId}, ${otherAccountId}, ${unlinkedAccountId})`);
    }
  });

  it("lists only wards linked to the signed-in student account", async () => {
    const response = await request(studentApp(accountId)).get("/api/quran/me/wards");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.map((ward: { id: number }) => ward.id)).toEqual([wardId]);
  });

  it("returns 404 when a student changes the URL to another student's ward", async () => {
    const ownResponse = await request(studentApp(accountId)).get(`/api/quran/me/wards/${wardId}`);
    const otherResponse = await request(studentApp(accountId)).get(`/api/quran/me/wards/${otherWardId}`);
    expect(ownResponse.status).toBe(200);
    expect(otherResponse.status).toBe(404);
  });

  it("requires a student session", async () => {
    const response = await request(studentApp()).get("/api/quran/me/wards");
    expect(response.status).toBe(401);
  });

  it("does not expose Quran access to an account without a student profile", async () => {
    const response = await request(studentApp(unlinkedAccountId)).get("/api/quran/me/wards");
    expect(response.status).toBe(404);
  });

  it("persists independent positions for an unlinked account and supports partial updates", async () => {
    const textResponse = await request(studentApp(unlinkedAccountId))
      .patch("/api/quran/me/independent-position")
      .send({ textSurahNumber: 2, textAyah: 10 });
    expect(textResponse.status).toBe(200);
    expect(textResponse.body.textSurahNumber).toBe(2);

    const pageResponse = await request(studentApp(unlinkedAccountId))
      .patch("/api/quran/me/independent-position")
      .send({ pageNumber: 42 });
    expect(pageResponse.status).toBe(200);
    expect(pageResponse.body.textSurahNumber).toBe(2);
    expect(pageResponse.body.pageNumber).toBe(42);

    const journeyResponse = await request(studentApp(unlinkedAccountId))
      .get("/api/quran/me/journey");
    expect(journeyResponse.status).toBe(200);
    expect(journeyResponse.body.independentPractice.latestPosition).toMatchObject({
      textSurahNumber: 2,
      textAyah: 10,
      pageNumber: 42,
    });
  });

  it("records a same-day independent session idempotently without a roster row", async () => {
    const first = await request(studentApp(unlinkedAccountId))
      .post("/api/quran/me/independent-sessions")
      .send({ practicedDate: "2025-01-15" });
    const replay = await request(studentApp(unlinkedAccountId))
      .post("/api/quran/me/independent-sessions")
      .send({ practicedDate: "2025-01-15" });
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);
  });

  it("keeps account-owned independent data after its roster row is deleted", async () => {
    const saved = await request(studentApp(accountId))
      .patch("/api/quran/me/independent-position")
      .send({ textSurahNumber: 3, textAyah: 4 });
    expect(saved.status).toBe(200);
    await db.execute(sql`DELETE FROM students WHERE id = ${studentId}`);

    const journey = await request(studentApp(accountId)).get("/api/quran/me/journey");
    expect(journey.status).toBe(200);
    expect(journey.body.independentPractice.latestPosition).toMatchObject({
      textSurahNumber: 3,
      textAyah: 4,
    });
  });
});