import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/game/play.tsx"), "utf8");

describe("solo true/false answer layout", () => {
  it("keeps the two choices centered at a moderate responsive size", () => {
    expect(source).toContain('data-question-type={qType}');
    expect(source).toContain('max-w-[820px] mx-auto content-center');
    expect(source).toContain('height: "clamp(104px, 12vw, 150px)"');
    expect(source).toContain('qType === "true_false" || (isSoloRef.current && qType !== "true_false") ? "" : "auto-rows-fr"');
  });
});