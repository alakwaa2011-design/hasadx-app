import { describe, expect, it } from "vitest";
import { mapJoinGameInfo } from "./join";

describe("join game-info mapping", () => {
  it("retains team chooser metadata for an existing no-class game", () => {
    expect(mapJoinGameInfo({
      exists: true,
      targetClasses: [],
      teamNames: ["الفريق أ", "الفريق ب"],
      studentTeamChoiceEnabled: true,
    })).toEqual({
      exists: true,
      classes: [],
      teamNames: ["الفريق أ", "الفريق ب"],
      studentTeamChoiceEnabled: true,
      gameMode: null,
    });
  });

  it("keeps one-class teams distinguishable from solo for the chooser", () => {
    expect(mapJoinGameInfo({
      exists: true, targetClasses: ["أولى"], gameMode: "teams",
      teamNames: ["أ", "ب"], studentTeamChoiceEnabled: true,
    })).toMatchObject({ classes: ["أولى"], gameMode: "teams", studentTeamChoiceEnabled: true });
    expect(mapJoinGameInfo({
      exists: true, targetClasses: ["أولى"], gameMode: "solo",
      teamNames: [], studentTeamChoiceEnabled: false,
    })).toMatchObject({ classes: ["أولى"], gameMode: "solo" });
  });

  it("clears team metadata for an invalid game", () => {
    expect(mapJoinGameInfo({ exists: false, teamNames: ["A"], studentTeamChoiceEnabled: true }))
      .toMatchObject({ exists: false, teamNames: [], studentTeamChoiceEnabled: false });
  });
});