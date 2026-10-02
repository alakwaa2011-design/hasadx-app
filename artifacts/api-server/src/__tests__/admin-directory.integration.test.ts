import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
type TestClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  release: () => void;
};
const state = vi.hoisted(() => ({ client: undefined as TestClient | undefined }));
vi.mock("@workspace/db", () => ({
  pool: { query: (text: string, params?: unknown[]) => state.client!.query(text, params) },
}));
import { listAdminDirectory } from "../lib/admin-directory";

const isolated = Boolean(process.env.TEST_DATABASE_URL) && process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL;
describe.skipIf(!isolated)("admin directory real PostgreSQL (transactional isolated fixtures)", () => {
  let pool: typeof import("@workspace/db").pool;
  const marker = `directory-${Date.now()}`;
  let teacher: number;
  let student: number;
  let assignment: number;
  const options = { page: 1, pageSize: 1, q: marker, section: "assignments" as const, lookup: false };
  beforeAll(async () => {
    // The workspace DB package owns the pg dependency. Load its real pool only
    // after pinning the connection to the isolated DB, then restore the env.
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    try {
      const real = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
      pool = real.pool;
    } finally {
      process.env.DATABASE_URL = original;
    }
    state.client = await pool.connect();
    await state.client.query("BEGIN");
    const result = await state.client.query(`INSERT INTO teachers(name,password_hash,created_at)
      VALUES ($1,'not-a-login',CURRENT_TIMESTAMP),($2,'not-a-login',CURRENT_TIMESTAMP) RETURNING id`,
      [`${marker} أَحْمد`, `${marker} Other`]);
    teacher = result.rows[0].id;
    const students = await state.client.query(`INSERT INTO students(name,teacher_id,student_class)
      VALUES ($1,$2,'خامس') RETURNING id`, [`${marker} علي`, teacher]);
    student = students.rows[0].id;
    const assignments = await state.client.query(`INSERT INTO assignments(title,teacher_id,access_code)
      VALUES ($1,$2,$3) RETURNING id`, [`${marker} درس اختبار`, teacher, marker]);
    assignment = assignments.rows[0].id;
  });
  afterAll(async () => {
    if (state.client) {
      await state.client.query("ROLLBACK");
      state.client.release();
    }
    await pool?.end();
  });
  it("paginates with stable tie ordering and no repeated teacher IDs", async () => {
    const first = await listAdminDirectory("teachers", options);
    const second = await listAdminDirectory("teachers", { ...options, page: 2 });
    expect(first.total).toBe(2);
    expect(first.items[0].id).not.toBe(second.items[0].id);
    expect(first.items[0].id).toBeGreaterThan(second.items[0].id);
  });
  it("globally searches normalized Arabic and preserves exact count values", async () => {
    const result = await listAdminDirectory("teachers", { ...options, q: `${marker} احمد` });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: teacher, assignmentCount: 1, studentCount: 1, submissionCount: 0 });
    expect(result.items[0].passwordHash).toBeUndefined();
  });
  it("finds students by teacher name without exposing unrelated rows", async () => {
    const result = await listAdminDirectory("students", { ...options, q: `${marker} احمد` });
    expect(result.items[0]).toMatchObject({ id: student, teacherId: teacher });
    expect(result.total).toBe(1);
  });
  it("searches activity title and teacher name throughout the table", async () => {
    for (const q of [`${marker} درس اختبار`, `${marker} احمد`]) {
      const result = await listAdminDirectory("activities", { ...options, q });
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({ id: assignment, title: `${marker} درس اختبار` });
    }
  });
  it("executes lookup and every supported activity source on PostgreSQL", async () => {
    const lookup = await listAdminDirectory("teachers", { ...options, lookup: true });
    expect(Object.keys(lookup.items[0]).sort()).toEqual(["email", "id", "name"]);
    for (const section of ["games", "video", "tug", "memory"] as const) {
      const result = await listAdminDirectory("activities", { ...options, section });
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    }
  });
});