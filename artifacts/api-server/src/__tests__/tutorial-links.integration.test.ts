import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import adminRouter from "../routes/admin";
import publicContentRouter from "../routes/public-content";

const RUN_INTEGRATION = !!process.env.TEST_DATABASE_URL
  && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const id = `tutorial_${Date.now()}`;
const valid = [{ id: "assignment-guide", title: "شرح إنشاء الواجب", url: "https://www.youtube.com/watch?v=oMaDMEM40l4" }];

function appFor(teacherId?: number) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = teacherId ? { teacherId } : {};
    req.log = { error: () => {} };
    next();
  });
  app.use("/api", publicContentRouter, adminRouter);
  return app;
}

describe.skipIf(!RUN_INTEGRATION)("tutorial links: admin write and public read", () => {
  let adminId: number;
  let teacherId: number;
  let settingsId: number;
  let originalLinks: unknown;
  let createdSettings = false;

  beforeAll(async () => {
    // The shared integration database can lag behind runtime-only additive migrations.
    await db.execute(sql`
      ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS tutorial_links JSONB NOT NULL
      DEFAULT '[{"id":"create-assignment","title":"إنشاء واجب في حصاد","url":"https://www.youtube.com/watch?v=oMaDMEM40l4"}]'::jsonb
    `);
    const result = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('Tutorial admin', ${`${id}_admin@test.local`}, 'x', true, NOW()),
             ('Tutorial teacher', ${`${id}_teacher@test.local`}, 'x', false, NOW())
      RETURNING id, is_admin
    `);
    adminId = Number((result.rows.find((row: any) => row.is_admin) as any).id);
    teacherId = Number((result.rows.find((row: any) => !row.is_admin) as any).id);
    const settings = await db.execute(sql`SELECT id, tutorial_links FROM platform_settings ORDER BY id LIMIT 1`);
    if (settings.rows[0]) {
      settingsId = Number((settings.rows[0] as any).id);
      originalLinks = (settings.rows[0] as any).tutorial_links;
    } else {
      // Keep the existing default row untouched when it exists.
      const inserted = await db.execute(sql`INSERT INTO platform_settings DEFAULT VALUES RETURNING id`);
      settingsId = Number((inserted.rows[0] as any).id);
      createdSettings = true;
    }
  });

  afterAll(async () => {
    if (settingsId) {
      if (createdSettings) await db.execute(sql`DELETE FROM platform_settings WHERE id = ${settingsId}`);
      else await db.execute(sql`UPDATE platform_settings SET tutorial_links = ${JSON.stringify(originalLinks)}::jsonb WHERE id = ${settingsId}`);
    }
    if (adminId && teacherId) await db.execute(sql`DELETE FROM teachers WHERE id IN (${adminId}, ${teacherId})`);
  });

  it("denies anonymous and non-admin writes without changing the public list", async () => {
    const before = (await request(appFor()).get("/api/tutorials").expect(200)).body;
    await request(appFor()).put("/api/admin/tutorials").send({ links: valid }).expect(401);
    await request(appFor(teacherId)).put("/api/admin/tutorials").send({ links: valid }).expect(403);
    expect((await request(appFor(teacherId)).get("/api/tutorials").expect(200)).body).toEqual(before);
  });

  it("persists an admin YouTube link for a different reader and rejects invalid replacements", async () => {
    expect((await request(appFor(adminId)).put("/api/admin/tutorials").send({ links: valid }).expect(200)).body.links).toEqual(valid);
    expect((await request(appFor(teacherId)).get("/api/tutorials").expect(200)).body.links).toEqual(valid);
    for (const url of ["https://youtube.com.evil.example/watch?v=oMaDMEM40l4", "javascript:alert(1)"]) {
      await request(appFor(adminId)).put("/api/admin/tutorials")
        .send({ links: [{ ...valid[0], url }] }).expect(400);
      expect((await request(appFor(teacherId)).get("/api/tutorials").expect(200)).body.links).toEqual(valid);
    }
  });

  it("persists deletion of all links rather than restoring defaults", async () => {
    expect((await request(appFor(adminId)).put("/api/admin/tutorials").send({ links: [] }).expect(200)).body.links).toEqual([]);
    expect((await request(appFor(teacherId)).get("/api/tutorials").expect(200)).body.links).toEqual([]);
  });
});