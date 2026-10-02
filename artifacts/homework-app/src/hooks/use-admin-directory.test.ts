import { describe, expect, it } from "vitest";
import { buildDirectoryUrl, clampPage } from "./use-admin-directory";

describe("admin directory helpers", () => {
  it("clamps pages", () => {
    expect(clampPage(9, 3)).toBe(3);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });
  it("builds server-side query url", () => {
    const u = buildDirectoryUrl("activities", { page: 2, pageSize: 500, q: " abc ", section: "tug" });
    expect(u).toContain("/api/admin/directory/activities?");
    expect(u).toContain("page=2");
    expect(u).toContain("pageSize=100");
    expect(u).toContain("q=abc");
    expect(u).toContain("section=tug");
  });
  it("omits empty q and sets lookup", () => {
    const u = buildDirectoryUrl("teachers", { page: 1, pageSize: 25, q: "  ", lookup: true });
    expect(u).not.toContain("q=");
    expect(u).toContain("lookup=true");
  });
  it("caps q length", () => {
    const u = buildDirectoryUrl("students", { page: 1, pageSize: 25, q: "x".repeat(300) });
    expect(new URL(u, "http://x").searchParams.get("q")!.length).toBe(120);
  });
});
