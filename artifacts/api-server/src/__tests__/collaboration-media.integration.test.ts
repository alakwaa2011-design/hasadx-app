import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { db, pool, teachersTable, collaborationBoardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { migrateCollaborationBoards } from "../lib/collaboration-migration";
import { createMediaGrant } from "../lib/collaboration-view";

const memory = vi.hoisted(() => ({ files: new Map<string, Buffer>(), removed: [] as string[] }));
// Replace only physical cloud storage. HTTP authorization, sharp processing,
// signed grants, PostgreSQL writes and participant revocation remain real.
vi.mock("../lib/objectStorage", async () => {
  const { Readable } = await import("node:stream");
  return { ObjectStorageService: class {
    async uploadBufferAsPrivate({ buffer, ownerPrefix }: { buffer: Buffer; ownerPrefix: string }) {
      const path = `/objects/uploads/${ownerPrefix}/${memory.files.size + 1}.webp`;
      memory.files.set(path, buffer); return path;
    }
    async getObjectEntityFile(path: string) {
      if (!memory.files.has(path)) throw new Error("Missing synthetic image");
      return {
        createReadStream: () => Readable.from(memory.files.get(path)!),
        delete: async () => { memory.files.delete(path); memory.removed.push(path); },
      };
    }
  } };
});
import router from "../routes/collaboration";

const ready = !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
describe.skipIf(!ready)("collaboration raster uploads and actor-filtered media", () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { teacherId: Number(req.get("test-owner")) || undefined } as typeof req.session; next(); });
  app.use("/api", router);
  let owner: number, id: string, token: string, peerToken: string, memberId: string, imageId: string, postId: string;
  let jpeg: Buffer;
  const host = () => request(app).post(`/api/collaboration/${id}/actions`).set("test-owner", String(owner));
  const guest = () => request(app).post(`/api/collaboration/${id}/actions`).set("X-Collaboration-Token", token);
  const image = (t = token) => request(app).post(`/api/collaboration/${id}/images`).set("X-Collaboration-Token", t);
  const media = (actor: string) => `/api/collaboration/${id}/media/${imageId}?grant=${createMediaGrant(id, imageId, actor)}`;
  beforeAll(async () => {
    await migrateCollaborationBoards();
    const [t] = await db.insert(teachersTable).values({ name: "Synthetic media fixture", passwordHash: "test-only" }).returning();
    owner = t.id;
    const created = await request(app).post("/api/collaboration").set("test-owner", String(owner))
      .send({ clientId: randomUUID(), title: "صور", prompt: "شارك صورة" }).expect(201);
    id = created.body.id;
    await host().send({ type: "board.status", status: "open" }).expect(200);
    const a = await request(app).post(`/api/collaboration/join/${created.body.pin}`).send({ name: "أ" }).expect(200);
    const b = await request(app).post(`/api/collaboration/join/${created.body.pin}`).send({ name: "ب" }).expect(200);
    token = a.body.token; memberId = a.body.participantId; peerToken = b.body.token;
    jpeg = await sharp({ create: { width: 12, height: 8, channels: 3, background: "#225739" } })
      .withMetadata({ exif: { IFD0: { Artist: "synthetic-private-tag" } } }).jpeg().toBuffer();
  });
  afterAll(async () => {
    if (owner) await db.delete(teachersTable).where(eq(teachersTable.id, owner));
    await pool.end();
  });
  it("rejects anonymous file bodies and non-raster bytes without storage writes", async () => {
    await request(app).post(`/api/collaboration/${id}/images`).attach("file", jpeg, "fixture.jpg").expect(401);
    await image().attach("file", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
      { filename: "disguised.jpg", contentType: "image/jpeg" }).expect(400);
    expect(memory.files.size).toBe(0);
  });
  it("converts a real multipart raster to private WebP and strips metadata", async () => {
    const uploaded = await image().attach("file", jpeg, "fixture.jpg").expect(201);
    imageId = uploaded.body.imageId;
    expect(imageId).toMatch(/^[a-f0-9-]{36}$/);
    const [path, bytes] = [...memory.files][0];
    expect(path).toContain(`/uploads/collaboration/${id}/`);
    const meta = await sharp(bytes).metadata();
    expect(meta.format).toBe("webp"); expect(meta.exif).toBeUndefined();
    // An uploaded but unposted image is not retrievable, even by its author.
    await request(app).get(media(memberId)).expect(403);
  });
  it("serves pending media to the author but not a peer; approval changes real authorization", async () => {
    const posted = await guest().send({ type: "post.create", imageId, clientId: randomUUID() }).expect(200);
    postId = posted.body.posts[0].id;
    const ownImage = await request(app).get(posted.body.posts[0].imageUrl).expect(200);
    expect(ownImage.headers["content-type"]).toContain("image/webp");
    expect(ownImage.headers["cache-control"]).toBe("private, no-store");
    expect(ownImage.headers["x-content-type-options"]).toBe("nosniff");
    const peerView = await request(app).get(`/api/collaboration/${id}`).set("X-Collaboration-Token", peerToken).expect(200);
    expect(peerView.body.posts).toHaveLength(0);
    const [row] = await db.select().from(collaborationBoardsTable).where(eq(collaborationBoardsTable.id, id));
    const peer = (row.data as { members: { id: string }[] }).members[1];
    await request(app).get(media(peer.id)).expect(403);
    await host().send({ type: "post.approve", postId }).expect(200);
    await request(app).get(media(peer.id)).expect(200);
    await host().send({ type: "post.hide", postId }).expect(200);
    await request(app).get(media(peer.id)).expect(403);
    await host().send({ type: "post.hide", postId }).expect(200);
    const current = await request(app).get(`/api/collaboration/${id}`).set("test-owner", String(owner)).expect(200);
    await host().send({ type: "board.update", settings: { ...current.body.settings, silent: true } }).expect(200);
    await request(app).get(media(peer.id)).expect(403);
    await host().send({ type: "board.reveal" }).expect(200);
    await request(app).get(media(peer.id)).expect(200);
  });
  it("immediately revokes an already-issued image grant when a participant is blocked", async () => {
    const grant = media(memberId);
    await host().send({ type: "member.block", memberId }).expect(200);
    await request(app).get(grant).expect(403);
    await host().send({ type: "member.block", memberId }).expect(200);
    await host().send({ type: "board.status", status: "closed" }).expect(200);
    await image().attach("file", jpeg, "fixture.jpg").expect(409);
  });
});
