import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const createPages = [
  "escape-create.tsx",
  "rocket-create.tsx",
  "tug-create.tsx",
];

describe("game assignment deep-link loading", () => {
  it.each(createPages)("%s ignores a delayed assignment response after unmount", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");

    expect(source).toContain("let active = true;");
    expect(source).toContain("if (!active || !r.ok) return;");
    expect(source).toMatch(/const data = await r\.json\(\);\s+if \(!active\) return;/);
    expect(source).toContain("return () => { active = false; };");
  });

  it.each(createPages)("%s keeps the normal mounted assignment load path", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const mountedGuard = source.indexOf("if (!active) return;");
    const questionUpdate = source.indexOf("setQuestions(qs);", mountedGuard);

    expect(mountedGuard).toBeGreaterThan(-1);
    expect(questionUpdate).toBeGreaterThan(mountedGuard);
  });
});