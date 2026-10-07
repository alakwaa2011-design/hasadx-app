import { createHmac, timingSafeEqual } from "node:crypto";
import type { CollaborationView } from "@workspace/api-zod";
import { BoardError, boardIsOpen, canSeePost, votesUsed, type Actor, type BoardData } from "./collaboration-domain";

export interface BoardRecord {
  id: string; pin: string; teacherId: number; data: unknown; createdAt: Date; updatedAt: Date;
}
export function boardSummary(row: BoardRecord) {
  const data = row.data as BoardData;
  return { id: row.id, pin: row.pin, title: data.title, prompt: data.prompt,
    status: data.status === "open" && !boardIsOpen(data) ? "closed" as const : data.status,
    revision: data.revision, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    memberCount: data.members.filter(m => !m.blocked).length, postCount: data.posts.length,
    pendingCount: data.posts.filter(p => p.status === "pending").length };
}
function signature(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new BoardError("خدمة الصور غير جاهزة.", 503);
  return createHmac("sha256", secret).update(`collaboration-media:${value}`).digest("base64url");
}
export function createMediaGrant(boardId: string, imageId: string, actorId: string, now = Date.now()) {
  // Keep image URLs stable across polling responses; otherwise every refresh
  // makes the browser download every picture again.
  const expires = Math.floor(now / 60_000) * 60_000 + 300_000;
  const payload = Buffer.from(JSON.stringify({ b: boardId, i: imageId, a: actorId, e: expires })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
export function verifyMediaGrant(grant: string, boardId: string, imageId: string, now = Date.now()): string {
  if (grant.length > 1200) throw new BoardError("رابط الصورة غير صالح.", 403);
  const [payload, sig, extra] = grant.split(".");
  if (!payload || !sig || extra) throw new BoardError("رابط الصورة غير صالح.", 403);
  const expected = Buffer.from(signature(payload)), actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new BoardError("رابط الصورة غير صالح.", 403);
  let value: { b: string; i: string; a: string; e: number };
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString()); }
  catch { throw new BoardError("رابط الصورة غير صالح.", 403); }
  if (value.b !== boardId || value.i !== imageId || typeof value.a !== "string" || !Number.isFinite(value.e) || value.e <= now) {
    throw new BoardError("انتهت صلاحية رابط الصورة.", 403);
  }
  return value.a;
}
export function boardView(row: BoardRecord, actor: Actor): CollaborationView {
  const data = row.data as BoardData;
  const visiblePosts = data.posts.filter(p => canSeePost(data, actor, p));
  return {
    ...boardSummary(row), owner: actor.owner, selfId: actor.id, settings: { ...data.settings },
    postCount: visiblePosts.length, pendingCount: visiblePosts.filter(p => p.status === "pending").length,
    columns: data.columns, voteUsed: votesUsed(data, actor), timerEndsAt: data.timerEndsAt,
    timerRemainingSeconds: data.timerRemainingSeconds ?? null,
    spotlightId: visiblePosts.some(p => p.id === data.spotlightId && p.status === "approved" && !p.hidden)
      && (!data.settings.silent || data.settings.revealed) ? data.spotlightId : null,
    members: actor.owner ? data.members.map(m => ({ id: m.id, name: m.name, blocked: m.blocked,
      postCount: data.posts.filter(p => p.authorId === m.id).length })) : [],
    posts: visiblePosts.map(p => ({
      id: p.id, text: p.text, columnId: p.columnId, color: p.color, imageId: p.imageId,
      imageUrl: p.imageId ? `/api/collaboration/${row.id}/media/${p.imageId}?grant=${createMediaGrant(row.id, p.imageId, actor.id)}` : null,
      referenceUrl: p.referenceUrl, tags: p.tags, createdAt: p.createdAt, teacher: p.teacher,
      authorName: p.teacher ? "المعلم" : actor.owner || data.settings.showNames || p.authorId === actor.id ? p.authorName : "مشارك",
      own: p.authorId === actor.id, status: p.status, hidden: p.hidden, pinned: p.pinned,
      reactions: (["like", "idea", "question", "vote"] as const).map(kind => ({
        kind, count: p.reactions[kind].length, mine: p.reactions[kind].includes(actor.id),
      })),
      comments: p.comments.map(c => ({ id: c.id, text: c.text, createdAt: c.createdAt, own: c.authorId === actor.id,
        authorName: c.authorId.startsWith("t:") ? "المعلم"
          : actor.owner || data.settings.showNames || c.authorId === actor.id ? c.authorName : "مشارك" })),
    })),
  };
}
