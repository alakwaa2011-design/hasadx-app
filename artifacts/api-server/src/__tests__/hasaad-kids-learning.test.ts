import {
  countingActivitySchema,
  evaluateKidsMastery,
  kidsActivitySchema,
  selectKidsAdventure,
  type KidsAttempt,
} from "@workspace/api-zod";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { KIDS_CATALOG_ASSET_KEYS, KIDS_CATALOG_V2_ACTIVITIES } from "../kids-catalog";
import { evaluateKidsTrace, isKidsCompletionEligible, kidsAdventureAttemptFromRow } from "../routes/kids";

const attempt = (overrides: Partial<KidsAttempt> = {}): KidsAttempt => ({
  activityId: "activity-1", activityType: "matching", skillId: "letters",
  exampleId: "example-1", sessionId: "session-1", completedAt: new Date("2026-01-01"),
  correctWeight: 1, possibleWeight: 1, errors: [], ...overrides,
});

describe("Hasaad Kids learning contracts", () => {
  it("rejects content whose answer contract is inconsistent", () => {
    expect(countingActivitySchema.safeParse({
      id: "count", type: "counting", skillId: "numbers", title: "Count", instructions: "Count", exampleId: "one",
      prompt: "How many?", items: [{ id: "a" }, { id: "b" }], correctCount: 3, choices: [1, 2, 3],
    }).success).toBe(false);
  });

  it("accepts each declarative engine type", () => {
    const base = { skillId: "letters", title: "Learn", instructions: "Try it", exampleId: "example" };
    const activities = [
      { ...base, id: "match", type: "matching", pairs: [{ id: "a", left: "A", right: "a" }, { id: "b", left: "B", right: "b" }] },
      { ...base, id: "trace", type: "tracing", strokes: [{ id: "line", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] },
      { ...base, id: "media", type: "media_choice", prompt: "Find A", choices: [
        { id: "a", label: "A", media: { kind: "image", assetKey: "kids/images/a" }, isCorrect: true },
        { id: "b", label: "B", media: { kind: "audio", assetKey: "kids/audio/b" }, isCorrect: false },
      ] },
      { ...base, id: "count", type: "counting", prompt: "Count", items: [{ id: "a" }], correctCount: 1, choices: [1, 2] },
      { ...base, id: "order", type: "ordering_puzzle", prompt: "Order", pieces: [
        { id: "first", label: "First", correctPosition: 0 }, { id: "last", label: "Last", correctPosition: 1 },
      ] },
    ];
    expect(activities.every((activity) => kidsActivitySchema.safeParse(activity).success)).toBe(true);
  });

  it("permits only internal first-party media keys", () => {
    const mediaChoice = {
      id: "media", type: "media_choice", skillId: "letters", title: "Learn", instructions: "Try it", exampleId: "example",
      prompt: "Find A", choices: [
        { id: "a", label: "A", media: { kind: "image", assetKey: "https://example.com/a.png" }, isCorrect: true },
        { id: "b", label: "B", media: { kind: "image", assetKey: "data:image/png;base64,abc" }, isCorrect: false },
      ],
    };
    expect(kidsActivitySchema.safeParse(mediaChoice).success).toBe(false);
  });

  it("keeps every versioned catalog fixture valid and fully covered", () => {
    expect(KIDS_CATALOG_V2_ACTIVITIES).toHaveLength(9);
    for (const seed of KIDS_CATALOG_V2_ACTIVITIES) {
      const parsed = kidsActivitySchema.safeParse(seed.content);
      expect(parsed.success, seed.slug).toBe(true);
      expect(seed.content.type).toMatch(/^(matching|tracing|media_choice|counting|ordering_puzzle)$/);
    }
    expect(new Set(KIDS_CATALOG_V2_ACTIVITIES.map((seed) => seed.content.type))).toEqual(new Set([
      "matching", "tracing", "media_choice", "counting", "ordering_puzzle",
    ]));
    for (const skillSlug of ["arabic-letter-recognition", "english-basic-phonics", "numbers-0-20"]) {
      const skillActivities = KIDS_CATALOG_V2_ACTIVITIES.filter((seed) => seed.skillSlug === skillSlug);
      expect(new Set(skillActivities.map((seed) => seed.content.type)).size).toBeGreaterThanOrEqual(2);
      expect(new Set(skillActivities.map((seed) => seed.content.exampleId)).size).toBeGreaterThanOrEqual(3);
    }

    const arabic = new Set(["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"]);
    const english = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const labels = KIDS_CATALOG_V2_ACTIVITIES.flatMap((seed) => {
      const content = seed.content;
      if (content.type === "ordering_puzzle") return content.pieces.map((piece) => piece.label);
      if (content.type === "matching") return content.pairs.flatMap((pair) => [pair.left, pair.right]);
      if (content.type === "media_choice") return content.choices.map((choice) => choice.label);
      return [];
    });
    expect([...arabic].every((letter) => labels.includes(letter))).toBe(true);
    expect([...english].every((letter) => labels.includes(letter))).toBe(true);
    const numericLabels = new Set(labels.filter((label) => /^\d+$/.test(label)).map(Number));
    const countActivity = KIDS_CATALOG_V2_ACTIVITIES.find((seed) => seed.slug === "numbers-count-20")!.content;
    expect(countActivity.type).toBe("counting");
    if (countActivity.type === "counting") numericLabels.add(countActivity.correctCount);
    expect([...Array(21).keys()].every((number) => numericLabels.has(number))).toBe(true);
  });

  it("ships a non-empty local file for every catalog asset key", () => {
    const publicDirectory = resolve(process.cwd(), "../homework-app/public");
    const clientRegistry = readFileSync(resolve(process.cwd(), "../homework-app/src/lib/kids-assets.ts"), "utf8");
    for (const assetKey of KIDS_CATALOG_ASSET_KEYS) {
      const extension = assetKey.startsWith("kids/audio/") ? ".mp3" : ".svg";
      const file = resolve(publicDirectory, `${assetKey}${extension}`);
      expect(existsSync(file), assetKey).toBe(true);
      expect(statSync(file).size, assetKey).toBeGreaterThan(100);
      expect(clientRegistry, `${assetKey} is missing from the client registry`).toContain(`"${assetKey}"`);
    }
  });

  it("requires every mastery threshold, including weighted accuracy", () => {
    const attempts = [0, 1, 2, 3, 4].map((index) => attempt({
      activityId: `activity-${index}`, activityType: index % 2 ? "counting" : "matching",
      exampleId: `example-${index % 3}`, sessionId: `session-${index % 2}`,
      correctWeight: index === 0 ? 0 : 1,
    }));
    expect(evaluateKidsMastery("letters", attempts)).toMatchObject({
      state: "mastered", attempts: 5, activityTypes: 2, sessions: 2, examples: 3, weightedAccuracy: 0.8,
    });
    expect(evaluateKidsMastery("letters", attempts.slice(0, 4)).state).toBe("practising");
  });

  it("prioritizes errors, then need, then least recently practiced activities", () => {
    const activity = (id: string, type: "matching" | "counting", skillId = "letters") => kidsActivitySchema.parse(
      type === "matching"
        ? { id, type, skillId, title: id, instructions: "Match", exampleId: id, pairs: [{ id: "a", left: "A", right: "a" }, { id: "b", left: "B", right: "b" }] }
        : { id, type, skillId, title: id, instructions: "Count", exampleId: id, prompt: "Count", items: [{ id: "a" }], correctCount: 1, choices: [1, 2] },
    );
    const selected = selectKidsAdventure(
      [{ activity: activity("old", "matching") }, { activity: activity("error", "counting"), need: 1 }, { activity: activity("need", "matching"), need: 8 }],
      [attempt({ activityId: "error", activityType: "counting", errors: ["wrong-choice"], completedAt: new Date("2026-01-02") })],
      new Date("2026-02-01"),
    );
    expect(selected.activities.map((entry) => entry.id)).toEqual(["error", "need", "old"]);
    expect(selected.reasons).toMatchObject({ error: "errors", need: "need", old: "last_practice" });
  });

  it("translates endpoint evidence to the stable catalog id used by adaptive ranking", () => {
    const errored = KIDS_CATALOG_V2_ACTIVITIES[0].content;
    const alternative = KIDS_CATALOG_V2_ACTIVITIES[1].content;
    const mapped = kidsAdventureAttemptFromRow({
      activity_id: 42,
      content: errored,
      activity_type: errored.type,
      skill_id: errored.skillId,
      example_id: errored.exampleId,
      session_id: 7,
      created_at: new Date("2026-01-02"),
      correct_weight: 0,
      possible_weight: 1,
      errors: ["incorrect-answer"],
    });
    expect(mapped.activityId).toBe(errored.id);
    const selected = selectKidsAdventure(
      [{ activity: alternative, need: 100 }, { activity: errored, need: 0 }],
      [mapped],
      new Date("2026-02-01"),
    );
    expect(selected.activities[0].id).toBe(errored.id);
    expect(selected.reasons[errored.id]).toBe("errors");
  });

  it("does not allow a consumed assignment or completed daily slot to earn again", () => {
    expect(isKidsCompletionEligible({ activityId: 8, assignmentId: 31 })).toBe(true);
    expect(isKidsCompletionEligible({
      activityId: 8,
      dailyActivityIds: [8, 9, 10],
      dailyCompletedIds: [],
    })).toBe(true);
    expect(isKidsCompletionEligible({
      activityId: 8,
      dailyActivityIds: [8, 9, 10],
      dailyCompletedIds: [8],
    })).toBe(false);
    expect(isKidsCompletionEligible({
      activityId: 9,
      dailyActivityIds: [8, 9, 10],
      dailyCompletedIds: [],
    })).toBe(false);
  });

  it("accepts a full traced stroke and rejects taps or distant scribbles", () => {
    const guide = [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }];
    const traced = Array.from({ length: 21 }, (_, index) => ({ x: 0.5, y: 0.1 + index * 0.04 }));
    const distant = Array.from({ length: 21 }, (_, index) => ({ x: 0.1, y: 0.1 + index * 0.04 }));
    const backwards = [...traced].reverse();
    const scribble = traced.flatMap((point) => [point, { x: 0.1, y: point.y }, point]);
    expect(evaluateKidsTrace(traced, guide, 0.8)).toBe(true);
    expect(evaluateKidsTrace([{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }], guide, 0.8)).toBe(false);
    expect(evaluateKidsTrace(distant, guide, 0.8)).toBe(false);
    expect(evaluateKidsTrace(backwards, guide, 0.8)).toBe(false);
    expect(evaluateKidsTrace(scribble, guide, 0.8)).toBe(false);
  });
});