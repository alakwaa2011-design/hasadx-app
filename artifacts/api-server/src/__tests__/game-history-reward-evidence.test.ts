import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildDetailedResults } from "../routes/game-history";

describe("trusted game history automatic-reward evidence", () => {
  it("persists only a verified student ID and leaves leaderboard result fields intact", () => {
    const player = (studentId?: number) => ({ isBot:false, name:"ريم", avatar:"a", studentId, score:12, totalCorrect:3, teamName:null, answers:new Map() });
    const game:any = { players:new Map([["a",player(42)],["b",player()]]), questions:[{ text:"س" },{ text:"ص" }] };
    const rows=buildDetailedResults(game);
    expect(rows[0]).toMatchObject({ name:"ريم", score:12, totalCorrect:3, totalQuestions:2, rank:1, studentId:42 });
    expect(rows[1]).not.toHaveProperty("studentId");
  });

  it("uses durable history IDs for replay/evaluation and never name matching", () => {
    const route=readFileSync(new URL("../routes/game-history.ts", import.meta.url),"utf8");
    const helper=readFileSync(new URL("../lib/wameeth-game-history.ts", import.meta.url),"utf8");
    expect(helper).toContain('sourceType:"game_history"');
    expect(helper).toContain("sourceResultId:inserted.id");
    expect(helper).toContain("ON CONFLICT (game_run_id) DO NOTHING RETURNING id");
    expect(helper).toContain("WHERE game_run_id=${snapshot.gameRunId}");
    expect(helper).toContain("inserted.detailed_results");
    const schema=readFileSync(new URL("../../../../lib/db/src/schema/game-history.ts", import.meta.url),"utf8");
    expect(schema).toContain("game_history_game_run_uq");
    expect(schema).not.toContain("game_history_teacher_pin_uq");
    expect(route).toContain("message: \"already_saved\"");
    expect(route).not.toContain("matchStudentByName");
  });

  it("derives trusted player identity only from the authenticated socket session", () => {
    const sockets=readFileSync(new URL("../game/socket-handlers.ts", import.meta.url),"utf8");
    const join=sockets.slice(sockets.indexOf('socket.on("student:join-game"'),sockets.indexOf('socket.on("student:submit-answer"'));
    expect(join).toContain("(socket.request as any).session?.studentAccountId");
    expect(join).toContain("resolveWameethStudentIdentity");
    expect(join).not.toContain("const { pin, name, avatar, studentId");
    expect(join).not.toContain("eq(studentsTable.id, studentId)");
    expect(join).toContain("verifiedStudentId");
    expect(join).toContain("verifiedStudentAccountId");
  });

  it("finalizes the finished run before renewing replay identity",()=>{
    const sockets=readFileSync(new URL("../game/socket-handlers.ts",import.meta.url),"utf8");
    const replay=sockets.slice(sockets.indexOf('socket.on("teacher:replay-game"'),sockets.indexOf('socket.on("teacher:end-game"'));
    expect(replay).toContain("await finalizeWameethGameForReplay(game");
    expect(replay).toContain("else resetGameToLobby(game)");
    expect(replay).toContain("catch(err)");
  });
});