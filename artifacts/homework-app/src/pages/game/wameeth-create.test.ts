import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildWameethClassPayload } from "./wameeth-create";

const source = readFileSync(resolve(import.meta.dirname, "./wameeth-create.tsx"), "utf8");

describe("Wameedh play mode ordering", () => {
  it("defaults to classroom mode and puts board modes above device modes", () => {
    expect(source).toContain('useState<PlayMode | null>("classroom")');
    expect(source).toMatch(
      /data-testid="playmode-devices-section"[\s\S]*?className="order-2[\s\S]*?data-testid="playmode-board-section"/,
    );
    expect(source).toContain('data-testid="playmode-board-section"\n                className="order-1');
  });

  it("keeps classroom and independent together above individual and teams", () => {
    const boardStart = source.indexOf('data-testid="playmode-board-section"');
    const devicesStart = source.indexOf('data-testid="playmode-devices-section"');
    expect(boardStart).toBeGreaterThanOrEqual(0);
    expect(devicesStart).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('data-testid="playmode-classroom"', boardStart)).toBeGreaterThan(boardStart);
    expect(source.indexOf('data-testid="playmode-independent"', boardStart)).toBeGreaterThan(boardStart);
    expect(source.indexOf('data-testid="playmode-solo"', devicesStart)).toBeGreaterThan(devicesStart);
    expect(source.indexOf('data-testid="playmode-teams"', devicesStart)).toBeGreaterThan(devicesStart);
  });
});

describe("Wameeth class-selection payload", () => {
  it("preserves solo multi-selection directives and sends an explicit unrestricted selection", () => {
    expect(buildWameethClassPayload("solo", ["A", "B", "__all_classes__"]).targetClasses)
      .toEqual(["A", "B", "__all_classes__"]);
    expect(buildWameethClassPayload("solo", []).targetClasses).toEqual([]);
    expect(buildWameethClassPayload("solo", []).targetClass).toBeUndefined();
  });

  it("retains the teams two-to-six constraint while solo accepts many", () => {
    expect(buildWameethClassPayload("teams", ["A"]).teamsValid).toBe(false);
    expect(buildWameethClassPayload("teams", ["A", "B", "C", "D", "E", "F"]).teamsValid).toBe(true);
    expect(buildWameethClassPayload("teams", ["A", "B", "C", "D", "E", "F", "G"]).teamsValid).toBe(false);
    expect(buildWameethClassPayload("solo", Array.from({ length: 10 }, (_, i) => `C${i}`)).teamsValid).toBe(true);
  });
});