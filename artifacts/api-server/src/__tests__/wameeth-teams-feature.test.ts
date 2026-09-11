import { describe, expect, it } from "vitest";
import {
  isJoinMutationAllowed,
  normalizeRosterName,
  normalizeTargetClasses,
  rosterSelectionToken,
  validateExplicitTargetClasses,
} from "../game/socket-handlers";
import {
  assignTeamsAlphabetically,
  createGame,
  movePlayerToTeam,
  addPlayer,
  deleteGame,
} from "../game/manager";

const questions = [{ id: 1, text: "q", optionA: "a", optionB: "b", correctAnswer: "A", points: 1 }] as any;

describe("Wameeth teams pure validation", () => {
  it("normalizes concrete class lists and validates bounds/sentinel", () => {
    expect(validateExplicitTargetClasses([])).toMatchObject({ valid: true, classes: [] });
    expect(validateExplicitTargetClasses(["A", "B"])).toMatchObject({ valid: true, classes: ["A", "B"] });
    expect(validateExplicitTargetClasses(["A", "A", "B"])).toMatchObject({ valid: true, classes: ["A", "B"] });
    expect(validateExplicitTargetClasses(["A"])).toMatchObject({ valid: false, error: "one" });
    expect(validateExplicitTargetClasses(["A", "B", "C", "D", "E", "F"])).toMatchObject({ valid: true });
    expect(validateExplicitTargetClasses(["A", "B", "C", "D", "E", "F", "G"])).toMatchObject({ valid: false, error: "many" });
    expect(validateExplicitTargetClasses(["__all_classes__"])).toMatchObject({ valid: false, error: "sentinel" });
    expect(normalizeTargetClasses([" A ", "A", "B"])).toEqual(["A", "B"]);
  });

  it("binds roster tokens to pin, class and student", () => {
    const token = rosterSelectionToken("123456", "A", 9);
    expect(token).toBe(rosterSelectionToken("123456", "A", 9));
    expect(token).not.toBe(rosterSelectionToken("999999", "A", 9));
    expect(token).not.toBe(rosterSelectionToken("123456", "B", 9));
    expect(token).not.toBe(rosterSelectionToken("123456", "A", 10));
  });

  it("normalizes Arabic roster names for collision checks", () => {
    const roster = ["أحمد  محمد", "سارة"];
    expect(roster.some(n => normalizeRosterName(n) === normalizeRosterName("  أحمد محمد "))).toBe(true);
    expect(roster.some(n => normalizeRosterName(n) === normalizeRosterName("ليان"))).toBe(false);
  });

  it("requires an existing unlocked requested team and guards mutable state", () => {
    const base = { state: "lobby", roomLocked: false, reconnecting: false, gameMode: "teams", studentTeamChoiceEnabled: true, requestedTeam: "A", teamNames: ["A", "B"], lockedTeams: [] };
    expect(isJoinMutationAllowed(base).valid).toBe(true);
    expect(isJoinMutationAllowed({ ...base, requestedTeam: "C" }).valid).toBe(false);
    expect(isJoinMutationAllowed({ ...base, lockedTeams: ["A"] }).valid).toBe(false);
    expect(isJoinMutationAllowed({ ...base, roomLocked: true }).valid).toBe(false);
    expect(isJoinMutationAllowed({ ...base, state: "finished" }).valid).toBe(false);
  });
});

describe("Wameeth team assignment persistence", () => {
  it("preserves teacher moves and explicit student/class assignments while balancing automatic players", () => {
    const game = createGame(1, "t", "teacher", 1, questions, 20, false, "teams", 2, ["A", "B"]);
    try {
      const moved = addPlayer(game.pin, "s1", "one");
      const student = addPlayer(game.pin, "s2", "two", "🦁", null, null, "B", true);
      expect(moved && student).toBeTruthy();
      expect(movePlayerToTeam(game.pin, "one", "B")?.player.teamAssignmentExplicit).toBe(true);
      assignTeamsAlphabetically(game);
      expect(game.players.get("s1")?.teamName).toBe("B");
      expect(game.players.get("s2")?.teamName).toBe("B");
      expect(game.players.get("s1")?.teamAssignmentExplicit).toBe(true);
      expect(game.players.get("s2")?.teamAssignmentExplicit).toBe(true);
    } finally {
      deleteGame(game.pin);
    }
  });

  it("balances automatic players by default", () => {
    const game = createGame(1, "t", "teacher", 1, questions, 20, false, "teams", 2, ["A", "B"]);
    try {
      addPlayer(game.pin, "s1", "one");
      addPlayer(game.pin, "s2", "two");
      assignTeamsAlphabetically(game);
      expect(new Set(Array.from(game.players.values()).map(p => p.teamName))).toEqual(new Set(["A", "B"]));
      expect(Array.from(game.players.values()).every(p => !p.teamAssignmentExplicit)).toBe(true);
    } finally {
      deleteGame(game.pin);
    }
  });

  it("preserves guest verified roster identity across reconnects and rejects another student", () => {
    const game = createGame(1, "t", "teacher", 1, questions);
    try {
      const first = addPlayer(game.pin, "guest-1", "أحمد", "🦁", 42, null);
      expect(first?.studentId).toBe(42);
      const reconnect = addPlayer(game.pin, "guest-2", "أحمد", "🦁", 42, null);
      expect(reconnect?.studentId).toBe(42);
      expect(reconnect?.socketId).toBe("guest-2");
      expect(addPlayer(game.pin, "guest-3", "أحمد", "🦁", 99, null)).toBeNull();
    } finally {
      deleteGame(game.pin);
    }
  });
});