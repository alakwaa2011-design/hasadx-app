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
    });
  });

  it("clears team metadata for an invalid game", () => {
    expect(mapJoinGameInfo({ exists: false, teamNames: ["A"], studentTeamChoiceEnabled: true }))
      .toMatchObject({ exists: false, teamNames: [], studentTeamChoiceEnabled: false });
  });
});