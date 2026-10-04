/**
 * Opt-in paid-AI smoke, only against the dedicated integration API.
 * Run with DATABASE_URL pinned to TEST_DATABASE_URL and E2E_DATABASE_ISOLATED=1.
 * Not part of the ordinary Vitest suite.
 */
import assert from "node:assert/strict";
import { db, pool, teachersTable, worksheetsTable } from "../../../../lib/db/src/index";
import { eq } from "drizzle-orm";

assert.equal(process.env.E2E_DATABASE_ISOLATED, "1", "Isolated database confirmation required");
assert.ok(process.env.TEST_DATABASE_URL);
assert.equal(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL, "Never use the shared database");

const origin = "http://127.0.0.1:5101";
const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const email = `e2e-worksheet-activity-${suffix}@example.com`;
let teacherId: number | undefined;
try {
  const [teacher] = await db.insert(teachersTable).values({
    name: `Activity smoke ${suffix}`, email, passwordHash: "unused-test-fixture",
    verificationOtp: "994000", otpExpiresAt: new Date(Date.now() + 600_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  teacherId = teacher.id;
  const verified = await fetch(`${origin}/api/auth/verify-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, otp: "994000" }),
  });
  assert.equal(verified.status, 200, "Fixture verification failed");
  const cookie = verified.headers.getSetCookie().map(s => s.split(";")[0])
    .find(s => s.startsWith("connect.sid=") || s.startsWith("session="));
  assert.ok(cookie, "Fixture session missing");
  const constraints = { difficulty: "easy", itemCount: 1, activityDuration: 5, allowedTypes: ["short_answer"] };
  const generated = await fetch(`${origin}/api/worksheets/ai/generate`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      questionSelection: "auto", subject: "الرياضيات", gradeLevel: "الصف الأول",
      topic: "الأشكال الهندسية", language: "ar", pages: 1,
      activityStyle: "coloring", executionMode: "individual", generationConstraints: constraints,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const result = await generated.json() as {
    message?: string;
    questions: Array<{ type: string; activity: { kind: string }; visual: { shapes: Array<{ shaded?: boolean }> } }>;
  };
  console.log("Real AI status:", generated.status);
  if (generated.status !== 200) console.log("Generation message:", result.message);
  assert.equal(generated.status, 200, "Real AI generation failed");
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].activity.kind, "coloring");
  assert.ok(result.questions[0].visual.shapes.some((s: { shaded?: boolean }) => !s.shaded));
  const settings = { activityStyle: "coloring", executionMode: "individual", targetPages: 1, generationConstraints: constraints };
  const saved = await fetch(`${origin}/api/worksheets`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: `Activity smoke ${suffix}`, subject: "الرياضيات", gradeLevel: "الصف الأول",
      language: "ar", questions: result.questions.map((q: object, i: number) => ({ ...q, id: `smoke-${i}` })),
      settings, smartGrading: false,
    }),
  });
  assert.equal(saved.status, 201, "Actual worksheet save failed");
  const row = await saved.json() as { id: number };
  const reloaded = await fetch(`${origin}/api/worksheets/${row.id}`, { headers: { Cookie: cookie } });
  assert.equal(reloaded.status, 200);
  const persisted = await reloaded.json() as typeof result & { settings: typeof settings };
  assert.equal(persisted.questions[0].activity.kind, "coloring");
  assert.deepEqual(persisted.questions[0].visual, result.questions[0].visual);
  assert.deepEqual(persisted.settings.generationConstraints, constraints);
  assert.equal(persisted.settings.targetPages, 1);
  console.log("PASS: real coloring AI, actual save, reload, visual and constraints preserved");
} finally {
  try {
    if (teacherId !== undefined) {
      await db.delete(worksheetsTable).where(eq(worksheetsTable.teacherId, teacherId));
      await db.delete(teachersTable).where(eq(teachersTable.id, teacherId));
    }
  } finally { await pool.end(); }
}