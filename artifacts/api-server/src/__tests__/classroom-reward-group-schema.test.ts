import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(process.cwd(), "../..");

describe("classroom reward group schema", () => {
  it("references teacher_classes by its primary key without a composite owner foreign key", () => {
    const schema = readFileSync(
      resolve(workspaceRoot, "lib/db/src/schema/classroom-rewards.ts"),
      "utf8",
    );
    const migration = readFileSync(
      resolve(workspaceRoot, "scripts/migrations/2026-09-09-classroom-reward-groups.sql"),
      "utf8",
    );

    expect(schema).toContain(
      'teacherClassId: integer("teacher_class_id").notNull().references(() => teacherClassesTable.id',
    );
    expect(schema).not.toContain("classroom_reward_groups_id_teacher_uq");
    expect(migration).toContain(
      "teacher_class_id INTEGER NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE",
    );
    expect(migration).not.toMatch(
      /FOREIGN KEY\s*\(\s*teacher_class_id\s*,\s*teacher_id\s*\)/,
    );
    expect(migration).not.toContain("teacher_classes_id_teacher_reward_groups_uq");
  });
});