import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (file: string) =>
  readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("خيارات مصدر أسئلة الكرسي الساخن", () => {
  it("يعرض الخيارات الثلاثة ويرسل الوضع المختار للخادم", () => {
    const createSource = readSource("src/pages/game/hotseat-create.tsx");

    expect(createSource).toContain('"students" as const');
    expect(createSource).toContain('"assignment" as const');
    expect(createSource).toContain('"mixed" as const');
    expect(createSource).toContain("questionMode,");
    expect(createSource).toContain('questionMode !== "students"');
  });

  it("تلتزم شاشتا المعلم والطالب بالوضع المختار", () => {
    const hostSource = readSource("src/pages/game/hotseat-host.tsx");
    const studentSource = readSource("src/pages/game/hotseat-play.tsx");

    expect(hostSource).toContain('state.questionMode === "mixed"');
    expect(hostSource).toContain('state.questionMode !== "assignment"');
    expect(hostSource).toContain('state.questionMode !== "students"');
    expect(studentSource).toContain('state.questionMode === "assignment"');
  });
});