import { describe, expect, it } from "vitest";
import { getHasadActivityLaunchDetails } from "./presentation-hasad-activities";

describe("getHasadActivityLaunchDetails", () => {
  it.each([
    ["rocket_race", "rocket_race", "rocket_race", "/game/rocket/create?assignmentId=42"],
    ["tug_war", "tug_war", "tug_of_war", "/game/tug/create?assignmentId=42"],
    ["quick_quiz", "quick_quiz", "knowledge_race", undefined],
    ["unsupported_library_activity", "quick_quiz", "knowledge_race", undefined],
    [null, "quick_quiz", "knowledge_race", undefined],
  ] as const)(
    "maps %s to the correct presentation launcher",
    (activityType, expectedActivityType, expectedGameType, expectedUrl) => {
      expect(getHasadActivityLaunchDetails(activityType, 42)).toEqual({
        activityType: expectedActivityType,
        gameType: expectedGameType,
        url: expectedUrl,
      });
    },
  );
});