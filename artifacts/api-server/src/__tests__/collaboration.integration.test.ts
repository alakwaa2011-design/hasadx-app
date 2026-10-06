import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { db, pool, teachersTable, collaborationBoardsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import router from "../routes/collaboration";
import { migrateCollaborationBoards } from "../lib/collaboration-migration";

const ready = !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
describe.skipIf(!ready)("collaboration HTTP journeys with real PostgreSQL", () => {
  const owners: number[] = [];
  const app = express();
  app.use(express.json());
  // This middleware exists only in this isolated test process.
  app.use((req, _res, next) => { req.session = { teacherId: Number(req.get("test-owner")) || undefined } as typeof req.session; next(); });
  app.use("/api", router);
  let owner: number, other: number, id: string, pin: string, alice: string, bob: string;
  const teacher = () => request(app).post(`/api/collaboration/${id}/actions`).set("test-owner", String(owner));
  const guest = (token: string) => request(app).post(`/api/collaboration/${id}/actions`).set("X-Collaboration-Token", token);
  const view = (token: string) => request(app).get(`/api/collaboration/${id}`).set("X-Collaboration-Token", token);
  beforeAll(async () => {
    await migrateCollaborationBoards();
    for (let i = 0; i < 2; i++) {
      const [t] = await db.insert(teachersTable).values({ name: "Collaboration isolated test", passwordHash: "test-only" }).returning();
      owners.push(t.id);
    }
    [owner, other] = owners;
  });
  afterAll(async () => {
    if (owners.length) await db.delete(teachersTable).where(inArray(teachersTable.id, owners));
    await pool.end();
  });
  it("creates a private persistent draft exactly once on retry", async () => {
    const input = { clientId: randomUUID(), title: "لوحة تجربة", prompt: "شارك فكرتك" };
    const a = await request(app).post("/api/collaboration").set("test-owner", String(owner)).send(input).expect(201);
    const retry = await request(app).post("/api/collaboration").set("test-owner", String(owner)).send(input).expect(201);
    id = a.body.id; pin = a.body.pin;
    expect(retry.body.id).toBe(id); expect(a.body.status).toBe("draft"); expect(a.body.owner).toBe(true);
    const [row] = await db.select().from(collaborationBoardsTable).where(eq(collaborationBoardsTable.id, id));
    expect(row).toBeTruthy();
    await request(app).get(`/api/collaboration/${id}`).expect(401);
    await request(app).get(`/api/collaboration/${id}`).set("test-owner", String(other)).expect(401);
  });
  it("requires the owner to open the board and preserves separate identities for same-name students", async () => {
    await request(app).post(`/api/collaboration/join/${pin}`).send({ name: "طالب" }).expect(409);
    await teacher().send({ type: "board.status", status: "open" }).expect(200);
    const a = await request(app).post(`/api/collaboration/join/${pin}`).send({ name: "طالب" }).expect(200);
    const b = await request(app).post(`/api/collaboration/join/${pin}`).send({ name: "طالب" }).expect(200);
    alice = a.body.token; bob = b.body.token;
    expect(a.body.participantId).not.toBe(b.body.participantId);
    const resumed = await request(app).post(`/api/collaboration/join/${pin}`).set("X-Collaboration-Token", alice).send({ name: "اسم آخر" }).expect(200);
    expect(resumed.body.participantId).toBe(a.body.participantId);
  });
  it("serializes simultaneous writes without losing a card and hides pending content", async () => {
    await Promise.all([guest(alice).send({ type: "post.create", text: "ألف", clientId: randomUUID() }).expect(200),
      guest(bob).send({ type: "post.create", text: "باء", clientId: randomUUID() }).expect(200)]);
    const ownerView = await request(app).get(`/api/collaboration/${id}`).set("test-owner", String(owner)).expect(200);
    expect(ownerView.body.posts).toHaveLength(2);
    expect((await view(alice).expect(200)).body.posts.map((p: { text: string }) => p.text)).toEqual(["ألف"]);
    expect((await view(bob).expect(200)).body.posts.map((p: { text: string }) => p.text)).toEqual(["باء"]);
    expect(JSON.stringify(ownerView.body)).not.toContain(alice);
    for (const p of ownerView.body.posts) await teacher().send({ type: "post.approve", postId: p.id }).expect(200);
    expect((await view(alice).expect(200)).body.posts).toHaveLength(2);
  });
  it("returns to persisted content from another HTTP request and rejects cross-participant edits", async () => {
    const posts = (await view(bob).expect(200)).body.posts;
    const otherPost = posts.find((p: { own: boolean }) => !p.own);
    await guest(bob).send({ type: "post.edit", postId: otherPost.id, text: "اختراق" }).expect(403);
    const teacherList = await request(app).get("/api/collaboration").set("test-owner", String(owner)).expect(200);
    expect(teacherList.body.some((b: { id: string }) => b.id === id)).toBe(true);
    expect((await request(app).get("/api/collaboration").set("test-owner", String(other)).expect(200)).body).toEqual([]);
  });
  it("enforces teacher reveal on the server, not just in the interface", async () => {
    const current = await request(app).get(`/api/collaboration/${id}`).set("test-owner", String(owner)).expect(200);
    await teacher().send({ type: "board.update", settings: { ...current.body.settings, silent: true } }).expect(200);
    expect((await view(alice).expect(200)).body.posts).toHaveLength(1);
    await guest(alice).send({ type: "board.reveal" }).expect(403);
    await teacher().send({ type: "board.reveal" }).expect(200);
    expect((await view(alice).expect(200)).body.posts).toHaveLength(2);
  });
  it("preserves one card under simultaneous retries", async () => {
    const input = { type: "post.create", clientId: randomUUID(), text: "إعادة متزامنة" };
    await Promise.all([guest(alice).send(input).expect(200), guest(alice).send(input).expect(200)]);
    expect((await view(alice).expect(200)).body.posts.filter((p: { text: string }) => p.text === input.text)).toHaveLength(1);
  });
  it("revokes blocked participants and freezes closed board writes", async () => {
    const current = await request(app).get(`/api/collaboration/${id}`).set("test-owner", String(owner)).expect(200);
    const member = current.body.members[1];
    await teacher().send({ type: "member.block", memberId: member.id }).expect(200);
    await view(bob).expect(403);
    await guest(bob).send({ type: "post.create", text: "ممنوع", clientId: randomUUID() }).expect(403);
    await teacher().send({ type: "board.status", status: "closed" }).expect(200);
    await guest(alice).send({ type: "post.create", text: "مغلق", clientId: randomUUID() }).expect(409);
    expect((await view(alice).expect(200)).body.status).toBe("closed");
  });
});
