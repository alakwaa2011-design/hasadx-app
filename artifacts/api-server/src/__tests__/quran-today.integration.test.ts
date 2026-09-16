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
let studentId = 0;

function teacherApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { teacherId };
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", quranRouter);
  return app;
}

suite("GET /api/quran/today", () => {
  beforeAll(async () => {
    teacherId = Number((await db.execute(sql`
      INSERT INTO teachers(name,email,password_hash)
      VALUES (${"Quran today " + nonce}, ${`quran_today_${nonce}@test.invalid`}, 'x')
      RETURNING id
    `)).rows[0].id);
    studentId = Number((await db.execute(sql`
      INSERT INTO students(name,teacher_id,student_class)
      VALUES ('طالب اليوم', ${teacherId}, 'A')
      RETURNING id
    `)).rows[0].id);
  });

  afterAll(async () => {
    if (teacherId) {
      await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    }
  });

  it("returns empty dashboard collections when the teacher has no wards", async () => {
    const response = await request(teacherApp()).get("/api/quran/today");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      dueWards: [],
      todayRecitations: [],
    });
  });

  it("returns every required ward contract field, including assignmentRequestId", async () => {
    const assignmentRequestId = `request_${nonce}`;
    await db.execute(sql`
      INSERT INTO quran_wards(
        teacher_id, student_id, mode, surah_number, surah_name,
        start_ayah, end_ayah, assigned_date, due_date, notes, status,
        assignment_request_id
      )
      VALUES (
        ${teacherId}, ${studentId}, 'memorization', 1, 'الفاتحة',
        1, 7, CURRENT_DATE, CURRENT_DATE, 'مراجعة يومية', 'assigned',
        ${assignmentRequestId}
      )
    `);

    const response = await request(teacherApp()).get("/api/quran/today");

    expect(response.status).toBe(200);
    expect(response.body.dueWards).toHaveLength(1);
    expect(response.body.dueWards[0]).toEqual({
      id: expect.any(Number),
      assignmentRequestId,
      studentId,
      mode: "memorization",
      surahNumber: 1,
      surahName: "الفاتحة",
      startAyah: 1,
      endAyah: 7,
      assignedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      notes: "مراجعة يومية",
      status: "assigned",
      studentName: "طالب اليوم",
    });
    expect(response.body.todayRecitations).toEqual([]);
  });
});