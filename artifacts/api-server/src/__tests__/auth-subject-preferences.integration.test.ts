import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import authRouter from "../routes/auth";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

describe.skipIf(!RUN_INTEGRATION)("library subjects and brief preferences", () => {
  let teacherId = 0;
  const app = express();

  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = { teacherId, cookie: {} };
    req.sessionID = "subject-preferences-test";
    req.log = { info: () => {}, warn: () => {}, error: () => {} };
    next();
  });
  app.use("/api", authRouter);

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash("subject-test-password", 4);
    const inserted = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, preferences, created_at)
      VALUES (
        'Subject preferences test',
        ${`subject_preferences_${Date.now()}@test.local`},
        ${passwordHash},
        '{}'::jsonb,
        NOW()
      )
      RETURNING id
    `);
    teacherId = Number((inserted.rows[0] as { id: number }).id);
  });

  afterAll(async () => {
    if (teacherId) {
      await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    }
  });

  it("preserves subjects when brief preferences are saved afterward", async () => {
    const subjects = ["الرياضيات", "العلوم"];
    expect((await request(app).patch("/api/auth/profile").send({ subjects })).status).toBe(200);
    expect((await request(app).put("/api/auth/preferences").send({ language: "ar", slideCount: 10 })).status).toBe(200);

    const me = await request(app).get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.subjects).toEqual(subjects);
  });

  it("preserves brief preferences when subjects are saved afterward", async () => {
    expect((await request(app).put("/api/auth/preferences").send({ density: "detailed", activities: true })).status).toBe(200);
    expect((await request(app).patch("/api/auth/profile").send({ subjects: ["اللغة العربية", "التربية الإسلامية"] })).status).toBe(200);

    const stored = await db.execute(sql`SELECT preferences FROM teachers WHERE id = ${teacherId}`);
    expect((stored.rows[0] as any).preferences).toMatchObject({
      density: "detailed",
      activities: true,
      subjects: ["اللغة العربية", "التربية الإسلامية"],
    });
  });

  it("clears brief defaults without clearing library subjects", async () => {
    const subjects = ["الرياضيات", "العلوم"];
    expect((await request(app).patch("/api/auth/profile").send({ subjects })).status).toBe(200);
    expect((await request(app).put("/api/auth/preferences").send({
      language: "en",
      presentationKind: "review",
      slideCount: 15,
      notes: "temporary",
    })).status).toBe(200);
    expect((await request(app).put("/api/auth/preferences").send({})).status).toBe(200);

    const stored = await db.execute(sql`SELECT preferences FROM teachers WHERE id = ${teacherId}`);
    expect((stored.rows[0] as any).preferences).toEqual({
      primarySubject: subjects[0],
      subjects,
    });
  });
});