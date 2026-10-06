import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { applyBoardAction, boardIsOpen, canSeePost, createBoardData, votesUsed, type Actor } from "../lib/collaboration-domain";
import { boardView, createMediaGrant, verifyMediaGrant } from "../lib/collaboration-view";

const owner: Actor = { id: "t:1", name: "المعلم", owner: true };
const a: Actor = { id: "a", name: "طالب أ", owner: false };
const b: Actor = { id: "b", name: "طالب ب", owner: false };
function setup(moderation = false) {
  const d = createBoardData({ title: " أفكار ", prompt: " سؤال " });
  d.status = "open"; d.settings.moderation = moderation;
  d.members.push({ ...a, tokenHash: "secret-a", blocked: false }, { ...b, tokenHash: "secret-b", blocked: false });
  return d;
}
function add(d: ReturnType<typeof setup>, actor = a, text = "فكرة") {
  applyBoardAction(d, actor, { type: "post.create", clientId: randomUUID(), text });
  return d.posts.at(-1)!;
}
describe("collaboration board ownership, privacy and classroom rules", () => {
  it("starts as a private moderated draft", () => {
    const d = createBoardData({ title: " لوحة ", prompt: " سؤال " });
    expect(d.status).toBe("draft"); expect(d.settings.moderation).toBe(true);
    expect(d.settings.showNames).toBe(false); expect(d.title).toBe("لوحة");
  });
  it("retains exactly one post on retry", () => {
    const d = setup(), action = { type: "post.create" as const, text: "فكرة", clientId: randomUUID() };
    applyBoardAction(d, a, action); applyBoardAction(d, a, action);
    expect(d.posts).toHaveLength(1); expect(d.revision).toBe(1);
  });
  it("does not confuse identical receipt UUIDs from different participants", () => {
    const d = setup(), action = { type: "post.create" as const, text: "فكرة", clientId: randomUUID() };
    applyBoardAction(d, a, action); applyBoardAction(d, b, action);
    expect(d.posts).toHaveLength(2);
  });
  it("does not recreate a deleted post when an old save is retried", () => {
    const d = setup(), action = { type: "post.create" as const, text: "فكرة", clientId: randomUUID() };
    applyBoardAction(d, a, action);
    applyBoardAction(d, a, { type: "post.delete", postId: d.posts[0].id });
    applyBoardAction(d, a, action); expect(d.posts).toHaveLength(0);
  });
  it.each(["post.create", "comment.create"] as const)("requires a stable client receipt for %s", type => {
    expect(() => applyBoardAction(setup(), a, { type, text: "فكرة" })).toThrow("معرّف");
  });
  it("allows all participants to write, without a hot seat", () => {
    const d = setup(); add(d, a); add(d, b); expect(d.posts).toHaveLength(2);
  });
  it("enforces participant post limits", () => {
    const d = setup(); d.settings.maxPosts = 1; add(d);
    expect(() => add(d)).toThrow("بطاقات");
  });
  it("prevents a guest changing or deleting another participant's post", () => {
    const d = setup(), p = add(d);
    expect(() => applyBoardAction(d, b, { type: "post.edit", postId: p.id, text: "بديل" })).toThrow("طالب آخر");
    expect(() => applyBoardAction(d, b, { type: "post.delete", postId: p.id })).toThrow("طالب آخر");
  });
  it("pending posts are visible only to their owner and the teacher", () => {
    const d = setup(true), p = add(d);
    expect(canSeePost(d, a, p)).toBe(true); expect(canSeePost(d, owner, p)).toBe(true);
    expect(canSeePost(d, b, p)).toBe(false);
    applyBoardAction(d, owner, { type: "post.approve", postId: p.id });
    expect(canSeePost(d, b, p)).toBe(true);
  });
  it("re-moderates an edited approved post", () => {
    const d = setup(true), p = add(d);
    applyBoardAction(d, owner, { type: "post.approve", postId: p.id });
    applyBoardAction(d, a, { type: "post.edit", postId: p.id, text: "تعديل" });
    expect(p.status).toBe("pending"); expect(canSeePost(d, b, p)).toBe(false);
  });
  it("keeps the silent gallery private until explicit reveal", () => {
    const d = setup(), p = add(d); d.settings.silent = true;
    expect(canSeePost(d, b, p)).toBe(false);
    applyBoardAction(d, owner, { type: "board.reveal" });
    expect(canSeePost(d, b, p)).toBe(true);
  });
  it("does not implicitly reveal a newly activated silent gallery", () => {
    const d = setup(); d.settings.revealed = true;
    applyBoardAction(d, owner, { type: "board.update", settings: { ...d.settings, silent: true } });
    expect(d.settings.revealed).toBe(false);
  });
  it("hidden posts cannot be fetched, reacted to or commented on by peers", () => {
    const d = setup(), p = add(d);
    applyBoardAction(d, owner, { type: "post.hide", postId: p.id });
    expect(canSeePost(d, b, p)).toBe(false);
    expect(() => applyBoardAction(d, b, { type: "reaction.toggle", postId: p.id, kind: "like" })).toThrow("غير موجودة");
    expect(() => applyBoardAction(d, b, { type: "comment.create", postId: p.id, text: "تعليق", clientId: randomUUID() })).toThrow("غير موجودة");
  });
  it("limits one vote per card and enforces the board-wide vote budget", () => {
    const d = setup(); d.settings.voteBudget = 1;
    const p = add(d), p2 = add(d);
    applyBoardAction(d, b, { type: "reaction.toggle", postId: p.id, kind: "vote" });
    expect(votesUsed(d, b)).toBe(1);
    expect(() => applyBoardAction(d, b, { type: "reaction.toggle", postId: p2.id, kind: "vote" })).toThrow("أصواتك");
    applyBoardAction(d, b, { type: "reaction.toggle", postId: p.id, kind: "vote" });
    applyBoardAction(d, b, { type: "reaction.toggle", postId: p2.id, kind: "vote" });
    expect(votesUsed(d, b)).toBe(1);
  });
  it("prevents self-voting", () => {
    const d = setup(), p = add(d);
    expect(() => applyBoardAction(d, a, { type: "reaction.toggle", postId: p.id, kind: "vote" })).toThrow("لبطاقتك");
  });
  it("keeps unsafe guest comments off moderated boards", () => {
    const d = setup(true), p = add(d, owner);
    expect(() => applyBoardAction(d, a, { type: "comment.create", postId: p.id, text: "تعليق", clientId: randomUUID() })).toThrow("التعليقات");
    applyBoardAction(d, owner, { type: "comment.create", postId: p.id, text: "تعليق المعلم", clientId: randomUUID() });
    expect(p.comments).toHaveLength(1);
  });
  it("preserves exactly one comment on a repeated submit", () => {
    const d = setup(), p = add(d);
    const action = { type: "comment.create" as const, postId: p.id, text: "تعليق", clientId: randomUUID() };
    applyBoardAction(d, b, action); applyBoardAction(d, b, action); expect(p.comments).toHaveLength(1);
  });
  it.each(["draft", "closed", "archived"] as const)("blocks participant writes on a %s board", status => {
    const d = setup(); d.status = status;
    expect(() => add(d)).toThrow("أغلق"); add(d, owner);
  });
  it("rejects unjoined and blocked writers", () => {
    const d = setup(); d.members[0].blocked = true;
    expect(() => add(d)).toThrow("غير مسموحة");
    expect(() => add(d, { id: "outsider", name: "ضيف", owner: false })).toThrow("غير مسموحة");
  });
  it("expires participation using the server deadline and explicitly reopens", () => {
    const d = setup(); applyBoardAction(d, owner, { type: "board.timer", timerSeconds: 60 }, Date.now() - 70_000);
    expect(boardIsOpen(d)).toBe(false); expect(() => add(d)).toThrow("أغلق");
    applyBoardAction(d, owner, { type: "board.status", status: "open" });
    expect(d.timerEndsAt).toBeNull(); add(d);
  });
  it.each(["board.update", "board.reveal", "board.status", "board.timer", "member.block", "post.approve", "post.hide", "post.pin", "post.move"] as const)(
    "keeps %s teacher-only", type => {
      const d = setup(), p = add(d);
      expect(() => applyBoardAction(d, b, { type, postId: p.id, status: "closed", memberId: a.id })).toThrow("للمعلم");
    });
  it("moves existing cards safely when a column is removed", () => {
    const d = setup(), p = add(d);
    applyBoardAction(d, owner, { type: "board.update", columns: [{ id: "new", title: "أفكار جديدة" }] });
    expect(p.columnId).toBe("new");
    expect(() => applyBoardAction(d, owner, { type: "board.update", columns: [] })).toThrow("عمود");
  });
  it("refuses arbitrary or another student's image identifiers and unsafe links", () => {
    const d = setup(); d.images.pic = { authorId: b.id, path: "/objects/uploads/collaboration/board/image.webp" };
    expect(() => applyBoardAction(d, a, { type: "post.create", text: "صورة", imageId: "pic", clientId: randomUUID() })).toThrow("لا تخص");
    expect(() => applyBoardAction(d, a, { type: "post.create", text: "رابط", referenceUrl: "javascript:alert(1)", clientId: randomUUID() })).toThrow("https");
    expect(() => applyBoardAction(d, a, { type: "post.create", text: "رابط", referenceUrl: "https://user:pass@example.com", clientId: randomUUID() })).toThrow("https");
  });
  it("does not expose token hashes, identities or pending posts in a peer DTO", () => {
    const d = setup(true); add(d); const approved = add(d, b);
    applyBoardAction(d, owner, { type: "post.approve", postId: approved.id });
    const row = { id: "board", pin: "123456", teacherId: 1, data: d, createdAt: new Date(), updatedAt: new Date() };
    const peerView = boardView(row, b);
    expect(peerView.posts).toHaveLength(1); expect(peerView.members).toEqual([]);
    expect(JSON.stringify(peerView)).not.toContain("secret-a");
    const teacherView = boardView(row, owner);
    expect(teacherView.posts).toHaveLength(2); expect(teacherView.members).toHaveLength(2);
  });
  it("anonymizes names for peers but preserves authorship for the teacher", () => {
    const d = setup(); add(d);
    const row = { id: "board", pin: "123456", teacherId: 1, data: d, createdAt: new Date(), updatedAt: new Date() };
    expect(boardView(row, b).posts[0].authorName).toBe("مشارك");
    expect(boardView(row, owner).posts[0].authorName).toBe(a.name);
  });
  it("binds media grants to board, image and expiration", () => {
    const grant = createMediaGrant("board", "image", a.id, 1000);
    expect(verifyMediaGrant(grant, "board", "image", 2000)).toBe(a.id);
    expect(() => verifyMediaGrant(grant, "other", "image", 2000)).toThrow("صلاحية");
    expect(() => verifyMediaGrant(grant, "board", "other", 2000)).toThrow("صلاحية");
    expect(() => verifyMediaGrant(grant, "board", "image", 301_000)).toThrow("صلاحية");
    expect(() => verifyMediaGrant(grant + "x", "board", "image", 2000)).toThrow("غير صالح");
  });
});
