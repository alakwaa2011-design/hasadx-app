import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListAdminDirectoryParams, ListAdminDirectoryQueryParams } from "@workspace/api-zod";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@workspace/db", () => ({ pool: { query } }));
import { directorySearchPattern, listAdminDirectory, teacherDirectorySql } from "../lib/admin-directory";

const options = { page: 1, pageSize: 25, q: "", section: "assignments" as const, lookup: false };
beforeEach(() => query.mockReset());

describe("admin directory contracts and bounded queries", () => {
  it("normalizes Arabic spellings, diacritics, whitespace and case", () => {
    expect(directorySearchPattern("  أَحْمد  على ")).toBe("%احمد علي%");
    expect(directorySearchPattern(" Mary  ANN ")).toBe("%mary ann%");
    expect(directorySearchPattern("   ")).toBe("");
  });
  it("treats SQL wildcard characters as literal search text", () => {
    expect(directorySearchPattern("100%_\\")).toBe("%100\\%\\_\\\\%");
  });
  it("rejects invalid resource, unbounded pages and query lengths", () => {
    expect(ListAdminDirectoryParams.safeParse({ kind: "passwords" }).success).toBe(false);
    for (const invalid of [{ page: 0 }, { page: 1.5 }, { pageSize: 101 }, { q: "x".repeat(121) }, { section: "teachers" }]) {
      expect(ListAdminDirectoryQueryParams.safeParse(invalid).success).toBe(false);
    }
    expect(ListAdminDirectoryQueryParams.parse({}).pageSize).toBe(25);
    expect(ListAdminDirectoryQueryParams.parse({ lookup: "false" }).lookup).toBe("false");
  });
  it("aggregates content once per table, restricting metrics to selected IDs", () => {
    const sql = teacherDirectorySql(true, false);
    expect(sql).toContain("WITH selected AS MATERIALIZED");
    expect(sql).toContain("LIMIT $2 OFFSET $3");
    expect(sql).toContain("GROUP BY teacher_id");
    expect(sql).toContain("IN (SELECT id FROM selected)");
    expect(sql).not.toContain("= teachers.id");
    expect(sql).toContain('AS "submissionCount"');
  });
  it("lookup does not request statistics or private account fields", () => {
    const sql = teacherDirectorySql(true, true);
    expect(sql).toContain("SELECT t.id, t.name, t.email");
    expect(sql).not.toContain("COUNT");
    expect(sql).not.toContain("password");
    expect(sql).not.toContain("teacher_stats");
  });
  it("clamps a deleted last page and binds search without interpolation", async () => {
    query.mockResolvedValueOnce({ rows: [{ total: 26 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: "Test" }] });
    const page = await listAdminDirectory("students", { ...options, page: 999, q: "'; DROP TABLE teachers;--" });
    expect(page.page).toBe(2);
    expect(page.totalPages).toBe(2);
    expect(query.mock.calls[0][0]).not.toContain("DROP TABLE");
    expect(query.mock.calls[0][1]).toEqual(["%'; drop table teachers;--%"]);
    expect(query.mock.calls[1][1]).toEqual(["%'; drop table teachers;--%", 25, 25]);
  });
  it("returns a stable empty first page", async () => {
    query.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
    const result = await listAdminDirectory("teachers", options);
    expect(result).toMatchObject({ items: [], total: 0, page: 1, totalPages: 1 });
  });
  it("fetches only the selected activity type, including author-name search", async () => {
    query.mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 8, title: "Lesson" }] })
      .mockResolvedValueOnce({ rows: [{ totalAssignments: 1, totalGames: 0, totalVideoLessons: 0, totalTugGames: 0, totalMemorySets: 0, totalSubmissions: 0 }] });
    const result = await listAdminDirectory("activities", { ...options, section: "video", q: "أحمد" });
    expect(result.items).toHaveLength(1);
    expect(query.mock.calls[1][0]).toContain("FROM video_lessons");
    expect(query.mock.calls[1][0]).toContain("a.title, t.name, a.subject");
    expect(query.mock.calls[1][0]).not.toContain("FROM adventure_games");
    expect(result.summary?.totalAssignments).toBe(1);
  });
});