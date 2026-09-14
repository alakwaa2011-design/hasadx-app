import { describe, expect, it } from "vitest";
import {
  isJoinMutationAllowed,
  normalizeRosterName,
  normalizeTargetClasses,
  rosterSelectionToken,
  validateExplicitTargetClasses,
  validateTeamsTargetClasses,
  resolveSoloTargetClasses,
  deriveWameethTeams,
  requiresRosterBinding,
  resolveLiveGameClassOverride,
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

  it("resolves solo unrestricted, concrete, expanded groups, and directives", () => {
    const owned = Array.from({ length: 10 }, (_, i) => `Class ${i + 1}`);
    expect(resolveSoloTargetClasses([], owned)).toMatchObject({ valid: true, classes: [] });
    expect(resolveSoloTargetClasses([" Class 1 "], owned).classes).toEqual(["Class 1"]);
    expect(resolveSoloTargetClasses(["Class 1", "Class 2"], owned).classes).toEqual(["Class 1", "Class 2"]);
    expect(resolveSoloTargetClasses(owned, owned).classes).toHaveLength(10);
    expect(resolveSoloTargetClasses(["__all_classes__"], owned).classes).toEqual(owned);
    expect(resolveSoloTargetClasses(["__all_classes__", "__excluded_class__:Class 2", "__excluded_class__:Class 4"], owned).classes)
      .toEqual(owned.filter(name => !["Class 2", "Class 4"].includes(name)));
    expect(resolveSoloTargetClasses(["Class 1", "Class 2", "Class 2", " Class 1 "], owned).classes)
      .toEqual(["Class 1", "Class 2"]);
  });

  it("lets an explicit empty game selection clear classes inherited from an assignment", () => {
    expect(resolveLiveGameClassOverride("Class A", ["Class A"], [], true))
      .toEqual({ targetClass: null, targetClasses: null });
    expect(resolveLiveGameClassOverride("Class A", ["Class A"], [], false))
      .toEqual({ targetClass: "Class A", targetClasses: ["Class A"] });
    expect(resolveLiveGameClassOverride("Class A", ["Class A"], ["Class B"], true))
      .toEqual({ targetClass: "Class B", targetClasses: ["Class B"] });
  });

  it("rejects unknown, malformed, and over-cap solo selections", () => {
    const owned = ["A", "B"];
    expect(resolveSoloTargetClasses(["Unknown"], owned)).toMatchObject({ valid: false, error: "ownership" });
    expect(resolveSoloTargetClasses(["__all_classes__", "A"], owned)).toMatchObject({ valid: false, error: "malformed" });
    expect(resolveSoloTargetClasses(["__excluded_class__:A"], owned)).toMatchObject({ valid: false, error: "malformed" });
    const many = Array.from({ length: 101 }, (_, i) => `C${i}`);
    expect(resolveSoloTargetClasses(["__all_classes__"], many)).toMatchObject({ valid: false, error: "cap" });
  });

  it("keeps teams at zero or two-to-six concrete classes", () => {
    expect(validateTeamsTargetClasses([], ["A", "B"], 0)).toMatchObject({ valid: true, classes: [] });
    expect(validateTeamsTargetClasses(["A"], ["A", "B"], 0)).toMatchObject({ valid: true, classes: ["A"] });
    expect(validateTeamsTargetClasses(Array.from({ length: 7 }, (_, i) => `C${i}`), Array.from({ length: 7 }, (_, i) => `C${i}`), 0))
      .toMatchObject({ valid: false, error: "many" });
    expect(validateTeamsTargetClasses(["__all_classes__", "A", "B"], ["A", "B"], 0)).toMatchObject({ valid: false, error: "sentinel" });
  });

  it("never turns solo class restrictions into teams", () => {
    expect(deriveWameethTeams("solo", ["A", "B", "C"], 2, ["Custom A", "Custom B"]))
      .toEqual({ classTeams: null, effectiveTeamCount: 2, effectiveTeamNames: ["Custom A", "Custom B"] });
    expect(deriveWameethTeams("teams", ["A", "B"], 2, undefined))
      .toEqual({ classTeams: ["A", "B"], effectiveTeamCount: 2, effectiveTeamNames: ["A", "B"] });
    expect(deriveWameethTeams("teams", ["A"], 3, ["Red", "Blue", "Green"]))
      .toEqual({ classTeams: null, effectiveTeamCount: 3, effectiveTeamNames: ["Red", "Blue", "Green"] });
  });

  it("requires roster-bound class and name selection for configured one-class games", () => {
    expect(requiresRosterBinding(["A"], true)).toBe(true);
    expect(requiresRosterBinding(["A", "B"], false)).toBe(true);
    expect(requiresRosterBinding(["A"], false)).toBe(false);
    expect(requiresRosterBinding([], false)).toBe(false);
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
    expect(isJoinMutationAllowed({ ...base, state: "finished", reconnecting: true }).valid).toBe(true);
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