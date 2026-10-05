/**
 * Paid, opt-in AI smoke. Never included in the ordinary Vitest suite.
 *
 * From workspace root:
 * RUN_PAID_WORKSHEET_SMOKE=1 pnpm --filter @workspace/api-server exec tsx \
 *   src/__tests__/worksheet-activity-real-smoke.ts
 * Optional WORKSHEET_SMOKE_CASES=concept_map/empty-auto,coloring/explicit
 * selects only named cases for diagnosing failures without repaying all 12.
 *
 * Requires TEST_DATABASE_URL distinct from the normal DATABASE_URL, with the
 * current integration schema and reference prices already installed. Pins the
 * database BEFORE importing the real router; no provider mocks or shared API.
 * Runs 12 generations (the router may retry), real saves/reloads, then the
 * actual frontend workspace/visual renderers. Provider usage costs money.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import express from "express";
import pino from "pino";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { worksheetActivitySchema, type WorksheetGenerationConstraints } from "@workspace/api-zod";

assert.equal(process.env.RUN_PAID_WORKSHEET_SMOKE, "1", "Opt in explicitly: RUN_PAID_WORKSHEET_SMOKE=1 (12 paid generations)");
assert.ok(process.env.TEST_DATABASE_URL, "A dedicated TEST_DATABASE_URL is required");
assert.ok(process.env.DATABASE_URL, "Normal DATABASE_URL is required for the isolation comparison");
const normal = new URL(process.env.DATABASE_URL);
const test = new URL(process.env.TEST_DATABASE_URL);
assert.ok(
  normal.hostname !== test.hostname || (normal.port || "5432") !== (test.port || "5432") || normal.pathname !== test.pathname,
  "Never run against the normal database, even with different credentials/query parameters",
);
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Dynamic imports are intentional: a static db/router import defeats the guard.
const { db, pool, teachersTable, worksheetsTable } = await import("../../../../lib/db/src/index");
const { default: worksheetsRouter, worksheetQuestionsSchema } = await import("../routes/worksheets");
const { worksheetVisualSchema } = await import("../lib/worksheet-auto-selection");
const kinds = ["concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task"] as const;
const allLabels = kinds.flatMap(kind => [`${kind}/explicit`, `${kind}/empty-auto`]);
const selectedLabels = process.env.WORKSHEET_SMOKE_CASES?.split(",") ?? allLabels;
assert.ok(selectedLabels.length > 0 && selectedLabels.every(label => allLabels.includes(label)), "Invalid WORKSHEET_SMOKE_CASES selection");
const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const workspaceRoot = fileURLToPath(new URL("../../../../", import.meta.url));
type SavedQuestions = ReturnType<typeof worksheetQuestionsSchema.parse>;
const renderedCases: Array<{ label: string; questions: SavedQuestions }> = [];
const failures: string[] = [];
let teacherId: number | undefined;
let server: Server | undefined;
let tempDir: string | undefined;

try {
  // Do not change shared pricing/settings/reference seeds to make a smoke pass.
  const price = await pool.query("SELECT credits_cost FROM credit_tool_prices WHERE tool_key = 'worksheet'");
  assert.equal(price.rowCount, 1, "Integration worksheet price must already be seeded");
  const budget = Math.max(100, Number(price.rows[0].credits_cost) * kinds.length * 2);
  const [teacher] = await db.insert(teachersTable).values({
    name: `Activity smoke ${suffix}`, email: `e2e-worksheet-activity-${suffix}@example.com`,
    passwordHash: "unused-test-fixture", emailVerified: true, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  teacherId = teacher.id;
  await pool.query("INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining) VALUES ($1, 'purchased', $2, $2)", [teacherId, budget]);
  await pool.query("INSERT INTO credit_accounts (teacher_id, balance, paid_balance, total_earned) VALUES ($1, $2, $2, $2)", [teacherId, budget]);

  // Only the session is a fixture, as in the integration route tests. Mount the
  // real router (including requireTeacher, credit accounting and AI provider).
  // An in-process ephemeral server cannot accidentally target the shared API.
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    req.session = { teacherId: teacher.id } as typeof req.session;
    req.log = pino({ level: "warn" });
    next();
  });
  app.use("/api", worksheetsRouter);
  server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${origin}/api/worksheets${path}`, {
      method: body ? "POST" : "GET", headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(180_000),
    });
    const data = z.object({
      message: z.string().optional(), questions: z.array(z.unknown()).optional(),
      id: z.number().optional(), settings: z.record(z.unknown()).optional(),
    }).passthrough().parse(await response.json());
    assert.equal(response.status, body && path === "" ? 201 : 200, `${path || "save"} failed: ${data.message ?? response.status}`);
    return data;
  };

  for (const kind of kinds) {
    for (const mode of ["explicit", "empty-auto"] as const) {
      const label = `${kind}/${mode}`;
      if (!selectedLabels.includes(label)) continue;
      try {
        const constraints: WorksheetGenerationConstraints = mode === "explicit"
          ? { difficulty: "easy", itemCount: 1, activityDuration: 5, allowedTypes: ["short_answer"] }
          : {};
        const settings = {
          activityStyle: kind, executionMode: kind === "group_task" ? "group" : "individual",
          ...(kind === "group_task" ? { groupSize: 3 } : {}),
          targetPages: 1, generationConstraints: constraints,
        };
        const result = await request("/ai/generate", {
          questionSelection: "auto", subject: "الرياضيات", gradeLevel: "الصف الأول",
          // Simple supported geometry, meaningful classifications and a natural
          // sequence rather than complex art the visual schema cannot represent.
          topic: kind === "sequencing" ? "خطوات رسم مربع" : "الأشكال الهندسية وخصائصها",
          language: "ar", pages: 1,
          ...settings,
        });
        assert.ok(result.questions, `${label}: missing questions array`);
        const questions = worksheetQuestionsSchema.parse(result.questions.map((q, i) => ({
          ...z.record(z.unknown()).parse(q), id: `${suffix}-${kind}-${mode}-${i}`,
        })));
        assert.ok(questions.length > 0 && questions.length <= 30, `${label}: empty/over-limit output`);
        if (mode === "explicit") {
          assert.equal(questions.length, constraints.itemCount, `${label}: explicit item count ignored`);
          assert.ok(questions.every(q => constraints.allowedTypes?.includes(q.type as "short_answer")), `${label}: forbidden question type`);
        }
        const activities = questions.filter(q => q.type === "short_answer" && q.activity?.kind === kind);
        assert.ok(activities.length, `${label}: selected activity missing`);
        for (const q of activities) {
          assert.equal(q.type, "short_answer");
          if (q.type !== "short_answer") continue;
          const activity = worksheetActivitySchema.parse(q.activity);
          assert.ok(q.prompt.trim(), `${label}: missing student instruction`);
          assert.ok(q.answer && q.answer.trim(), `${label}: missing teacher rubric`);
          assert.ok(activity.spaceHeight && activity.spaceHeight >= 60 && activity.spaceHeight <= 180, `${label}: missing/invalid student space`);
          assert.notEqual(q.prompt.trim(), q.answer.trim(), `${label}: prompt is the answer`);
          if (kind === "group_task") assert.equal(activity.roles?.length, 3, `${label}: group size ignored`);
          if (kind === "sorting" || kind === "sequencing") {
            assert.ok(new Set(activity.items).size > 1, `${label}: identical items cannot be shuffled`);
            if (kind === "sequencing") assert.equal(new Set(activity.items).size, activity.items?.length, `${label}: ambiguous duplicate events`);
          }
          if (kind === "coloring") {
            const visual = worksheetVisualSchema.parse(q.visual);
            assert.ok(visual.shapes.every(s => !s.shaded), `${label}: coloring already filled in`);
            assert.ok(visual.shapes.some(s => s.kind !== "line"), `${label}: no colorable closed shape`);
          }
          if (q.visual) worksheetVisualSchema.parse(q.visual);
        }
        const saved = await request("", {
          title: `Activity smoke ${suffix} ${label}`, subject: "الرياضيات", gradeLevel: "الصف الأول",
          language: "ar", questions, settings, smartGrading: false,
        });
        assert.ok(saved.id && Number.isInteger(saved.id), `${label}: saved ID missing`);
        const persisted = await request(`/${saved.id}`);
        const reopened = worksheetQuestionsSchema.parse(persisted.questions);
        assert.deepEqual(reopened, questions, `${label}: questions/activity/visual/rubric changed on reopen`);
        assert.ok(persisted.settings, `${label}: saved settings missing`);
        for (const [key, value] of Object.entries(settings)) {
          assert.deepEqual(persisted.settings[key], value, `${label}: ${key} lost on reopen`);
        }
        renderedCases.push({ label, questions: reopened });
        console.log(`PASS: ${label} — real generation, save and reopen`);
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`FAIL: ${failures.at(-1)}`);
      }
    }
  }
  // Check all successful real results through the frontend once, including
  // partial runs, before reporting any generation failures.
  if (renderedCases.length) {
    tempDir = await mkdtemp(join(tmpdir(), "worksheet-real-smoke-"));
    const fixturePath = join(tempDir, "reopened.json");
    await writeFile(fixturePath, JSON.stringify(renderedCases));
    execFileSync("pnpm", [
      "--filter", "@workspace/homework-app", "exec", "vitest", "run",
      "src/pages/teacher/worksheet-activity-real-output.test.tsx",
    ], {
      cwd: workspaceRoot, stdio: "inherit", timeout: 120_000,
      env: { ...process.env, WORKSHEET_REAL_SMOKE_OUTPUT: fixturePath },
    });
  }
  assert.equal(failures.length, 0, failures.join("\n"));
  assert.equal(renderedCases.length, new Set(selectedLabels).size, "Every selected case must pass");
  console.log(`PASS: all ${renderedCases.length} selected real AI activity cases and student workspaces`);
} finally {
  try {
    if (server) await new Promise<void>((resolve, reject) => server!.close(err => err ? reject(err) : resolve()));
    if (teacherId !== undefined) {
      const fixtureTeacherId = teacherId;
      // Scope EVERY deletion to this unique fixture, never wipe public/reference
      // rows. Credit tables have no FK cascade; hold items need removal first.
      await db.transaction(async tx => {
        await tx.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${teacherId}) OR batch_id IN (SELECT id FROM credit_batches WHERE teacher_id = ${teacherId})`);
        await tx.execute(sql`DELETE FROM credit_holds WHERE teacher_id = ${teacherId}`);
        await tx.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
        await tx.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
        await tx.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
        await tx.delete(worksheetsTable).where(eq(worksheetsTable.teacherId, fixtureTeacherId));
        // AI daily/ledger rows cascade with the fixture teacher.
        await tx.delete(teachersTable).where(eq(teachersTable.id, fixtureTeacherId));
      });
    }
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    await pool.end();
  }
}