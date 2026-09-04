import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const client = readFileSync("src/pages/islamic/play.tsx", "utf8");
const server = readFileSync("../api-server/src/routes/islamic-competitions.ts", "utf8");

describe("Islamic multi-point recall mode contract", () => {
  it("reveals independently scoreable points and submits only a bounded count", () => {
    expect(client).toContain('q.questionType !== "multi_point" || !revealed || recalledPoints !== null');
    expect(client).toContain("كم نقطة تذكّرت قبل الكشف؟");
    expect(client).toContain("recalledPoints: count");
    expect(server).toContain("Number.isInteger(recalledPoints)");
    expect(server).toContain("recalledPoints > multiPointAnswer.points.length");
  });

  it("awards ten points per recalled point and keeps MCQ branches separate", () => {
    expect(server).toContain("pointsAwarded = recalledPoints * 10");
    expect(server).toContain('q.questionType === "mcq"');
    expect(client).toContain("MULTI_POINT_TIME = 60");
  });
});