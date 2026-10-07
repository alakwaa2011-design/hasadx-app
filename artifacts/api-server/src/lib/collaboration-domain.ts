import { randomUUID } from "node:crypto";
import type { CollaborationAction, CollaborationColumn, CollaborationSettings } from "@workspace/api-zod";

export type Actor = { id: string; name: string; owner: boolean };
export type ReactionKind = "like" | "idea" | "question" | "vote";
export interface BoardMember { id: string; name: string; tokenHash: string; blocked: boolean }
export interface BoardComment { id: string; authorId: string; authorName: string; text: string; createdAt: string }
export interface BoardPost {
  id: string; authorId: string; authorName: string; teacher: boolean; text: string;
  columnId: string; color: "mint" | "sand" | "sky" | "rose" | "lavender";
  imageId: string | null; referenceUrl: string | null; tags: string[];
  status: "pending" | "approved" | "rejected"; hidden: boolean; pinned: boolean;
  reviewId?: string;
  reactions: Record<ReactionKind, string[]>; comments: BoardComment[]; createdAt: string;
}
export interface BoardData {
  title: string; prompt: string; status: "draft" | "open" | "closed" | "archived";
  revision: number; settings: CollaborationSettings; columns: CollaborationColumn[];
  members: BoardMember[]; posts: BoardPost[];
  images: Record<string, { path: string; authorId: string }>;
  receipts: string[]; spotlightId: string | null; timerEndsAt: string | null;
  timerRemainingSeconds?: number | null;
  reviewHistory?: { id: string; actorId: string; postIds: string[]; status: "approved" | "rejected"; undone: boolean }[];
}
export class BoardError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export const DEFAULT_BOARD_SETTINGS: CollaborationSettings = {
  moderation: true, allowComments: true, allowImages: true, allowReactions: true,
  showNames: false, silent: false, revealed: false, maxPosts: 3, voteBudget: 3,
};
export function createBoardData(input: {
  title: string; prompt: string; settings?: CollaborationSettings; columns?: CollaborationColumn[];
}): BoardData {
  const title = input.title.trim(), prompt = input.prompt.trim();
  if (!title || !prompt) throw new BoardError("اكتب عنوان اللوحة وسؤالها.");
  const columns = validateColumns(input.columns ?? [{ id: "ideas", title: "أفكارنا" }]);
  const settings = { ...DEFAULT_BOARD_SETTINGS, ...input.settings };
  if (settings.silent) settings.revealed = false;
  return { title, prompt, status: "draft", revision: 0, settings,
    columns, members: [], posts: [], images: {}, receipts: [], spotlightId: null, timerEndsAt: null };
}
export function validateColumns(columns: CollaborationColumn[]) {
  if (!columns.length || columns.length > 8 || columns.some(c => !c.id || c.id.length > 60 || !c.title.trim())
    || new Set(columns.map(c => c.id)).size !== columns.length) throw new BoardError("اختر من عمود واحد إلى ثمانية أعمدة بأسماء مختلفة.");
  return columns.map(c => ({ id: c.id, title: c.title.trim() }));
}
export function boardIsOpen(data: BoardData, now = Date.now()) {
  return data.status === "open" && (!data.timerEndsAt || new Date(data.timerEndsAt).getTime() > now);
}
export function assertWriter(data: BoardData, actor: Actor) {
  if (actor.owner) return;
  if (!data.members.some(m => m.id === actor.id && !m.blocked)) throw new BoardError("المشاركة غير مسموحة.", 403);
  if (!boardIsOpen(data)) throw new BoardError("المعلم أغلق المشاركة في اللوحة.", 409);
}
export function canSeePost(data: BoardData, actor: Actor, post: BoardPost) {
  if (actor.owner || post.authorId === actor.id) return true;
  return !post.hidden && post.status === "approved" && (!data.settings.silent || data.settings.revealed);
}
export function votesUsed(data: BoardData, actor: Actor) {
  return data.posts.reduce((n, p) => n + Number(p.reactions.vote.includes(actor.id)), 0);
}
function teacherOnly(actor: Actor) {
  if (!actor.owner) throw new BoardError("هذا الإجراء للمعلم فقط.", 403);
}
function textOf(value: string | undefined, max: number) {
  const text = (value ?? "").trim();
  if (text.length > max) throw new BoardError(`النص أطول من ${max} حرف.`);
  return text;
}
function linkOf(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || value.length > 1500) throw new Error();
    return url.toString();
  } catch { throw new BoardError("استخدم رابطًا آمنًا يبدأ بـ https://."); }
}
function postFields(data: BoardData, actor: Actor, action: CollaborationAction, existing?: BoardPost) {
  const text = action.text === undefined && existing ? existing.text : textOf(action.text, 2000);
  const imageId = action.imageId === undefined ? existing?.imageId ?? null : action.imageId;
  if (imageId) {
    const image = data.images[imageId];
    if (!image || (!actor.owner && image.authorId !== actor.id)) throw new BoardError("الصورة لا تخص مشاركتك.", 403);
    if (!actor.owner && !data.settings.allowImages && imageId !== existing?.imageId) throw new BoardError("إضافة الصور متوقفة.");
  }
  if (!text && !imageId) throw new BoardError("أضف نصًا أو صورة إلى البطاقة.");
  const columnId = action.columnId ?? existing?.columnId ?? data.columns[0].id;
  if (!data.columns.some(c => c.id === columnId)) throw new BoardError("العمود غير موجود.");
  return { text, imageId, columnId, color: action.color ?? existing?.color ?? "mint" as const,
    referenceUrl: action.referenceUrl === undefined ? existing?.referenceUrl ?? null : linkOf(action.referenceUrl),
    tags: (action.tags ?? existing?.tags ?? []).map(t => t.trim().replace(/^#+/, "")).filter(Boolean).slice(0, 5) };
}
/** Call only while holding this board's database row lock. */
export function applyBoardAction(data: BoardData, actor: Actor, action: CollaborationAction, now = Date.now()) {
  const isCreation = action.type === "post.create" || action.type === "comment.create";
  const receipted = isCreation || action.type === "post.review" || action.type === "post.review.undo"
    || (action.type === "board.timer" && !!action.timerCommand);
  if (receipted && !action.clientId) throw new BoardError("معرّف العملية مطلوب.");
  // The receipt includes the actor: a peer cannot consume another participant's retry.
  const receipt = `${actor.id}:${action.type}:${action.clientId}`;
  if (receipted && data.receipts.includes(receipt)) return false;
  if (action.type.startsWith("board.") || action.type === "member.block") teacherOnly(actor);
  else assertWriter(data, actor);
  const post = action.postId ? data.posts.find(p => p.id === action.postId) : undefined;
  const requirePost = () => {
    if (!post || !canSeePost(data, actor, post)) throw new BoardError("البطاقة غير موجودة.", 404);
    return post;
  };
  const ownPost = () => {
    const p = requirePost();
    if (!actor.owner && p.authorId !== actor.id) throw new BoardError("لا يمكنك تعديل بطاقة طالب آخر.", 403);
    return p;
  };
  switch (action.type) {
    case "post.create": {
      if (data.posts.length >= 500) throw new BoardError("امتلأت اللوحة؛ افتح لوحة جديدة.");
      if (!actor.owner && data.posts.filter(p => p.authorId === actor.id).length >= data.settings.maxPosts) {
        throw new BoardError(`يمكنك إضافة ${data.settings.maxPosts} بطاقات إلى هذه اللوحة.`);
      }
      data.posts.push({ id: randomUUID(), authorId: actor.id, authorName: actor.name, teacher: actor.owner,
        ...postFields(data, actor, action), status: actor.owner || !data.settings.moderation ? "approved" : "pending",
        hidden: false, pinned: false, reactions: { like: [], idea: [], question: [], vote: [] }, comments: [],
        createdAt: new Date(now).toISOString() });
      break;
    }
    case "post.edit": {
      const p = ownPost();
      Object.assign(p, postFields(data, actor, action, p));
      delete p.reviewId;
      if (!actor.owner && data.settings.moderation) p.status = "pending";
      break;
    }
    case "post.delete":
      ownPost();
      data.posts = data.posts.filter(p => p.id !== action.postId);
      if (data.spotlightId === action.postId) data.spotlightId = null;
      break;
    case "post.approve": {
      teacherOnly(actor);
      const p = requirePost();
      p.status = "approved";
      delete p.reviewId;
      break;
    }
    case "post.review": {
      teacherOnly(actor);
      if (!action.postIds?.length || !action.reviewStatus) throw new BoardError("اختر المشاركات وقرار المراجعة.");
      const ids = [...new Set(action.postIds)];
      const batch = ids.map(id => data.posts.find(p => p.id === id));
      // Validate every target before touching any card, under the board's row lock.
      if (batch.some(p => !p || p.status !== "pending")) throw new BoardError("تغيّرت إحدى المشاركات؛ حدّث شاشة المراجعة ثم حاول مجدداً.", 409);
      for (const p of batch as BoardPost[]) {
        p.status = action.reviewStatus;
        p.reviewId = action.clientId!;
        if (data.spotlightId === p.id && p.status !== "approved") data.spotlightId = null;
      }
      data.reviewHistory = [...(data.reviewHistory ?? []), {
        id: action.clientId!, actorId: actor.id, postIds: ids, status: action.reviewStatus, undone: false,
      }].slice(-100);
      break;
    }
    case "post.review.undo": {
      teacherOnly(actor);
      const review = data.reviewHistory?.find(r => r.id === action.reviewId && r.actorId === actor.id && !r.undone);
      if (!review) throw new BoardError("لم يعد هذا القرار متاحاً للتراجع.", 409);
      const batch = review.postIds.map(id => data.posts.find(p => p.id === id));
      if (batch.some(p => !p || p.reviewId !== review.id || p.status !== review.status)) {
        throw new BoardError("تغيّرت إحدى المشاركات بعد القرار؛ لا يمكن التراجع عن المجموعة.", 409);
      }
      for (const p of batch as BoardPost[]) {
        p.status = "pending";
        delete p.reviewId;
        if (data.spotlightId === p.id) data.spotlightId = null;
      }
      review.undone = true;
      break;
    }
    case "post.hide": teacherOnly(actor); requirePost().hidden = !post!.hidden; break;
    case "post.pin": teacherOnly(actor); requirePost().pinned = !post!.pinned; break;
    case "post.move": {
      teacherOnly(actor);
      if (!data.columns.some(c => c.id === action.columnId)) throw new BoardError("العمود غير موجود.");
      requirePost().columnId = action.columnId!; break;
    }
    case "reaction.toggle": {
      const p = requirePost(), kind = action.kind;
      if (!kind) throw new BoardError("اختر نوع التفاعل.");
      if (!actor.owner && (!data.settings.allowReactions || p.status !== "approved" || p.hidden
        || (data.settings.silent && !data.settings.revealed))) throw new BoardError("التفاعل غير متاح الآن.");
      const users = p.reactions[kind], has = users.includes(actor.id);
      if (kind === "vote" && !has) {
        if (p.authorId === actor.id) throw new BoardError("صوّت لأفكار زملائك، لا لبطاقتك.");
        if (votesUsed(data, actor) >= data.settings.voteBudget) throw new BoardError("استخدمت جميع أصواتك. يمكنك سحب صوت سابق.");
      }
      p.reactions[kind] = has ? users.filter(id => id !== actor.id) : [...users, actor.id];
      break;
    }
    case "comment.create": {
      const p = requirePost();
      if (!actor.owner && (!data.settings.allowComments || data.settings.moderation || p.status !== "approved" || p.hidden
        || (data.settings.silent && !data.settings.revealed))) throw new BoardError("التعليقات متوقفة أو تحتاج إدارة المعلم.");
      const text = textOf(action.text, 600);
      if (!text) throw new BoardError("اكتب تعليقًا.");
      if (p.comments.length >= 40) throw new BoardError("وصلت البطاقة إلى الحد الأقصى للتعليقات.");
      p.comments.push({ id: randomUUID(), text, authorId: actor.id, authorName: actor.name, createdAt: new Date(now).toISOString() });
      break;
    }
    case "comment.delete": {
      const p = requirePost(), c = p.comments.find(c => c.id === action.commentId);
      if (!c || (!actor.owner && c.authorId !== actor.id)) throw new BoardError("لا يمكنك حذف هذا التعليق.", 403);
      p.comments = p.comments.filter(c => c.id !== action.commentId);
      break;
    }
    case "board.update":
      if (action.title !== undefined) { if (!action.title.trim()) throw new BoardError("العنوان مطلوب."); data.title = action.title.trim(); }
      if (action.prompt !== undefined) { if (!action.prompt.trim()) throw new BoardError("سؤال اللوحة مطلوب."); data.prompt = action.prompt.trim(); }
      if (action.settings) {
        // Activating silent mode always starts a new private thinking phase.
        if (action.settings.silent && !data.settings.silent) action.settings.revealed = false;
        data.settings = { ...action.settings };
      }
      if (action.columns) {
        data.columns = validateColumns(action.columns);
        for (const p of data.posts) if (!data.columns.some(c => c.id === p.columnId)) p.columnId = data.columns[0].id;
      }
      break;
    case "board.status":
      if (!action.status) throw new BoardError("حالة اللوحة مطلوبة.");
      data.status = action.status;
      // Explicit reopening starts a fresh untimed session rather than an expired timer.
      if (action.status === "open") { data.timerEndsAt = null; data.timerRemainingSeconds = null; }
      break;
    case "board.reveal": data.settings.revealed = !data.settings.revealed; break;
    case "board.spotlight": {
      if (action.postId && (requirePost().status !== "approved" || post!.hidden)) throw new BoardError("اعتمد البطاقة وأظهرها أولًا.");
      data.spotlightId = action.postId ?? null; break;
    }
    case "board.timer": {
      const remaining = data.timerRemainingSeconds ?? (data.timerEndsAt
        ? Math.max(0, Math.ceil((new Date(data.timerEndsAt).getTime() - now) / 1000)) : 0);
      switch (action.timerCommand ?? "start") {
        case "start":
          if (action.timerSeconds === undefined) throw new BoardError("مدة المؤقت مطلوبة.");
          data.timerEndsAt = action.timerSeconds ? new Date(now + action.timerSeconds * 1000).toISOString() : null;
          data.timerRemainingSeconds = null;
          break;
        case "pause":
          if (!data.timerEndsAt || remaining <= 0) throw new BoardError("لا يوجد مؤقت جارٍ لإيقافه مؤقتاً.", 409);
          data.timerRemainingSeconds = remaining;
          data.timerEndsAt = null;
          break;
        case "resume":
          if (!data.timerRemainingSeconds) throw new BoardError("المؤقت ليس متوقفاً مؤقتاً.", 409);
          data.timerEndsAt = new Date(now + data.timerRemainingSeconds * 1000).toISOString();
          data.timerRemainingSeconds = null;
          break;
        case "extend": {
          if (remaining <= 0) throw new BoardError("انتهى المؤقت؛ ابدأ مؤقتاً جديداً.", 409);
          const extended = Math.min(3600, remaining + 60);
          if (data.timerRemainingSeconds != null) data.timerRemainingSeconds = extended;
          else data.timerEndsAt = new Date(now + extended * 1000).toISOString();
          break;
        }
        case "stop":
          data.timerEndsAt = null;
          data.timerRemainingSeconds = null;
          break;
      }
      break;
    }
    case "member.block": {
      const member = data.members.find(m => m.id === action.memberId);
      if (!member) throw new BoardError("المشارك غير موجود.");
      member.blocked = !member.blocked;
      break;
    }
    default: throw new BoardError("إجراء غير معروف.");
  }
  if (receipted) data.receipts.push(receipt);
  data.revision++;
  return true;
}
