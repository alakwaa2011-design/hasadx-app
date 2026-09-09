import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resetGameToLobby, type Game } from "../game/manager.js";
import { persistWameethGameHistoryInTx, snapshotWameethGame } from "./wameeth-game-history";

export type FullGameSaveResult={id:number;replayed:boolean};
const savedRuns=new Map<string,{savedAt:number;result:FullGameSaveResult}>();
const inFlightRuns=new Map<string,Promise<FullGameSaveResult>>();
const TTL=60*60*1000;
setInterval(()=>{
  const now=Date.now();
  for(const [id,saved] of savedRuns)if(now-saved.savedAt>TTL)savedRuns.delete(id);
},10*60*1000).unref();

export async function coordinateFullGameSave(
  game:Pick<Game,"gameRunId">,
  persist:()=>Promise<FullGameSaveResult>,
  insertedSideEffects:()=>Promise<void>,
):Promise<FullGameSaveResult>{
  const runId=String(game.gameRunId);
  const saved=savedRuns.get(runId);
  if(saved)return saved.result;
  const existing=inFlightRuns.get(runId);
  if(existing)return existing;
  const promise=Promise.resolve().then(async()=>{
    const result=await persist();
    if(!result.replayed)await insertedSideEffects();
    savedRuns.set(runId,{savedAt:Date.now(),result});
    return result;
  }).finally(()=>inFlightRuns.delete(runId));
  inFlightRuns.set(runId,promise);
  return promise;
}

/** Owns persistence and all once-per-run legacy Wameeth side effects. */
export async function saveFullWameethGame(game:Game):Promise<FullGameSaveResult>{
  if(game.state!=="finished")throw new Error("game_not_finished");
  if(game.currentQuestionIndex<0)throw new Error("game_not_started");
  const snapshot=snapshotWameethGame(game);
  return coordinateFullGameSave({gameRunId:snapshot.gameRunId},()=>db.transaction(async tx=>{
    const result=await persistWameethGameHistoryInTx(tx,snapshot);
    if(result.replayed)return result;
    if(snapshot.assignmentId!==null)await tx.execute(sql`UPDATE assignments SET content_kind='competition' WHERE id=${snapshot.assignmentId} AND content_kind='homework'`);
    for(const player of snapshot.accountPlayers) {
      await tx.execute(sql`INSERT INTO wameeth_scores
        (student_account_id,assignment_title,score,position,player_count,total_correct,total_questions)
        VALUES (${player.studentAccountId},${player.assignmentTitle},${player.score},${player.position},${player.playerCount},${player.totalCorrect},${player.totalQuestions})`);
      await tx.execute(sql`UPDATE student_accounts SET total_score=total_score+${player.score},games_played=games_played+1 WHERE id=${player.studentAccountId}`);
    }
    return result;
  }),async()=>{});
}

export async function finalizeWameethGameForReplay(
  game:Game,
  save:(game:Game)=>Promise<FullGameSaveResult>=saveFullWameethGame,
){
  await save(game);
  resetGameToLobby(game);
}