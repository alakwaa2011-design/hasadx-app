import { db, gameHistoryTable } from "@workspace/db";
import type { Game, GamePlayer, GameQuestion } from "../game/manager.js";
import { getLeaderboard } from "../game/manager.js";
import { evaluateClassroomRewardEvidence } from "./classroom-reward-evaluator";

export async function resolveWameethStudentIdentity(tx:any, input:{
  teacherId:number; studentAccountId:number|null; targetClasses:string[];
}) {
  if(!Number.isInteger(input.studentAccountId)||Number(input.studentAccountId)<1)return null;
  const rows=((await tx.execute(sql`
    SELECT id FROM students
    WHERE student_account_id=${input.studentAccountId} AND teacher_id=${input.teacherId}
      ${input.targetClasses.length ? sql`AND (
        grade_level IN (${sql.join(input.targetClasses.map(value=>sql`${value}`),sql`,`)})
        OR student_class IN (${sql.join(input.targetClasses.map(value=>sql`${value}`),sql`,`)})
      )` : sql``}
  `)).rows ?? []) as any[];
  return rows.length===1 ? {studentId:Number(rows[0].id),studentAccountId:Number(input.studentAccountId)} : null;
}
import { sql } from "drizzle-orm";

export interface WameethGameSnapshot {
  readonly gameRunId:string; readonly teacherId:number; readonly assignmentId:number|null;
  readonly assignmentTitle:string; readonly pin:string; readonly gameMode:string;
  readonly playerCount:number; readonly questionCount:number;
  readonly winner:{name:string;avatar:string;score:number}|null;
  readonly topPlayers:readonly {name:string;avatar:string;score:number}[];
  readonly detailedResults:readonly any[];
  readonly accountPlayers:readonly {studentAccountId:number;assignmentTitle:string;score:number;position:number;playerCount:number;totalCorrect:number;totalQuestions:number}[];
}

function deepFreeze<T>(value:T):T {
  if(value && typeof value==="object" && !Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value as any))deepFreeze(child);
  }
  return value;
}

/** Captures every persisted field synchronously; no later Game mutation is observed. */
export function snapshotWameethGame(game:Game):WameethGameSnapshot {
  const detailedResults=trustedDetailedGameResults(game);
  const leaderboard=getLeaderboard(game);
  const humans=leaderboard.filter(p=>Array.from(game.players.values()).some(x=>x.name===p.name&&!x.isBot));
  const ranking=humans.length?humans:leaderboard;
  const players=Array.from(game.players.values()).filter(player=>!player.isBot);
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  const snapshot:WameethGameSnapshot={
    gameRunId:String(game.gameRunId),teacherId:game.teacherId,
    assignmentId:game.assignmentId>0?game.assignmentId:null,
    assignmentTitle:game.assignmentTitle,pin:game.pin,gameMode:game.gameMode,
    playerCount:game.players.size,questionCount:game.questions.length,
    winner:ranking[0]?{name:ranking[0].name,avatar:ranking[0].avatar,score:ranking[0].score}:null,
    topPlayers:ranking.slice(0,5).map(p=>({name:p.name,avatar:p.avatar,score:p.score})),
    detailedResults,
    accountPlayers:players.filter(p=>p.studentAccountId).map(p=>({
      studentAccountId:p.studentAccountId!,assignmentTitle:game.assignmentTitle,score:p.score,
      position:sorted.findIndex(item=>item.socketId===p.socketId)+1,playerCount:players.length,
      totalCorrect:p.totalCorrect,totalQuestions:game.questions.length,
    })),
  };
  return deepFreeze(snapshot);
}

export async function persistWameethGameHistoryInTx(tx:any,snapshot:WameethGameSnapshot) {
  const winner=snapshot.winner;
  const inserted=(await tx.execute(sql`INSERT INTO game_history
    (teacher_id,assignment_id,assignment_title,pin,game_run_id,player_count,question_count,winner_name,winner_avatar,winner_score,top_players,game_mode,detailed_results)
    VALUES (${snapshot.teacherId},${snapshot.assignmentId},${snapshot.assignmentTitle},${snapshot.pin},${snapshot.gameRunId},${snapshot.playerCount},${snapshot.questionCount},${winner?.name??null},${winner?.avatar??null},${winner?.score??null},${JSON.stringify(snapshot.topPlayers)}::jsonb,${snapshot.gameMode},${JSON.stringify(snapshot.detailedResults)}::jsonb)
    ON CONFLICT (game_run_id) DO NOTHING RETURNING id,assignment_id,detailed_results`)).rows[0] as any;
  if(!inserted) {
    const history=(await tx.execute(sql`SELECT id,assignment_id FROM game_history WHERE game_run_id=${snapshot.gameRunId}`)).rows[0] as any;
    return {id:Number(history.id),replayed:true};
  }
  const persisted=Array.isArray(inserted.detailed_results)?inserted.detailed_results:[];
  for(const p of persisted)if(Number.isInteger(p?.studentId)&&p.studentId>0)await evaluateClassroomRewardEvidence(tx,{teacherId:snapshot.teacherId,sourceType:"game_history",sourceResultId:inserted.id,studentId:p.studentId,completed:true,score:Number(p.score),evidenceSummary:{gameHistoryId:inserted.id,assignmentId:inserted.assignment_id,score:p.score,rank:p.rank,totalCorrect:p.totalCorrect,totalQuestions:p.totalQuestions}});
  return {id:Number(inserted.id),replayed:false};
}

export function trustedDetailedGameResults(game: Game) {
  return Array.from(game.players.values()).filter((p: GamePlayer) => !p.isBot).sort((a,b) => b.score-a.score).map((p, index) => ({
    rank:index+1,name:p.name,avatar:p.avatar,score:p.score,totalCorrect:p.totalCorrect,totalQuestions:game.questions.length,teamName:p.teamName,
    ...(Number.isInteger(p.studentId) && (p.studentId as number)>0 ? { studentId:p.studentId as number } : {}),
    answers:Array.from(p.answers.entries()).map(([questionIndex, ans]) => ({ questionIndex,questionText:(game.questions[questionIndex] as GameQuestion | undefined)?.text || `سؤال ${questionIndex+1}`,answer:ans.answer,correct:ans.correct,points:ans.points,time:ans.time })),
  }));
}

/** Single durable Wameeth persistence path for socket lifecycle and HTTP save. */
export async function persistWameethGameHistory(game: Game) {
  const snapshot=snapshotWameethGame(game);
  return db.transaction(tx=>persistWameethGameHistoryInTx(tx,snapshot));
}