import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import express from "express";
import request from "supertest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool, teachersTable, presentationsTable, presentationSessionsTable as sessions,
  presentationWallRunsTable as runs, presentationWallCardsTable as cards,
  presentationSessionEventsTable as events, presentationResponsesTable as responses } from "@workspace/db";
import { getWallSnapshot, migratePresentationWall, openWall, submitWall, toggleWallCard } from "../lib/presentation-wall";
import { migratePresentationWordCloud } from "../lib/presentation-word-cloud";
import { mintPresentationJoinToken } from "../lib/presentation-join-token";

vi.mock("../routes/presentations", () => ({ hydrateActivityQuestions: async (slides: unknown) => slides }));
const ready = !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

describe.skipIf(!ready)("collective walls (real PostgreSQL and Socket.IO)", () => {
  const owners: number[] = [];
  const sessionIds: number[] = [];
  const sockets: Socket[] = [];
  const pools = new Set([pool]);
  let server: ReturnType<typeof createServer>;
  let io: Server;
  let url: string;
  let sid: number;
  let teacherId: number;
  let otherId: number;
  const elementId = "wall";
  const input = (runId: string, studentKey = "student", sessionId = sid, text = "مشاركة") => ({
    sessionId, elementId, runId, studentKey, studentName: "طالب", classStudentId: null, text,
  });
  function event<T = any>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.off(name, handler); reject(new Error(`Missing ${name}`)); }, 5000);
      const handler = (data: T) => { clearTimeout(timer); resolve(data); };
      socket.once(name, handler);
    });
  }
  async function start(fresh = false) {
    if (fresh) vi.resetModules();
    const handlers = await import("../game/presentation-handlers");
    pools.add((await import("@workspace/db")).pool);
    server = createServer();
    io = new Server(server);
    io.use((socket, next) => {
      (socket.request as any).session = { teacherId: socket.handshake.auth.teacherId };
      next();
    });
    handlers.setupPresentationSocket(io);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }
  async function stop() {
    sockets.splice(0).forEach(s => s.disconnect());
    if (io) await new Promise<void>(resolve => io.close(() => resolve()));
  }
  async function client(owner?: number) {
    const socket = connect(url, { transports: ["websocket"], auth: { teacherId: owner }, reconnection: false });
    sockets.push(socket);
    await event(socket, "connect");
    return socket;
  }
  async function join(kind: "teacher" | "show" | "student", key = "student") {
    const socket = await client(kind === "student" ? undefined : teacherId);
    const sync = event(socket, "state:sync");
    socket.emit(kind === "teacher" ? "teacher:join-presentation" : `${kind}:join`, {
      sessionId: sid, studentKey: key, name: "طالب", joinToken: mintPresentationJoinToken(sid, key),
    });
    return { socket, state: await sync };
  }
  const toggle = (runId: string, cardId: string, visible: boolean, owner = teacherId) =>
    toggleWallCard({ sessionId: sid, teacherId: owner, elementId, runId, cardId, visible });

  beforeAll(async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS presentation_session_events (
      id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, event_key TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS presentation_session_events_unique
      ON presentation_session_events(session_id, kind, event_key)`);
    await migratePresentationWall();
    await migratePresentationWall();
    await migratePresentationWordCloud();
    for (let i = 0; i < 2; i++) {
      const [owner] = await db.insert(teachersTable).values({ name: "Wall test", passwordHash: "test-only" }).returning();
      owners.push(owner.id);
      const [deck] = await db.insert(presentationsTable).values({
        teacherId: owner.id, title: "Wall test",
        slides: [{ id: "slide", elements: [{ id: elementId, kind: "activity", activityKind: "open_wall", prompt: "شارك" }] }],
      }).returning();
      const [session] = await db.insert(sessions).values({
        teacherId: owner.id, presentationId: deck.id, pin: String(820000 + owner.id).slice(-6),
      }).returning();
      sessionIds.push(session.id);
    }
    [teacherId, otherId] = owners;
    [sid] = sessionIds;
    await start();
  });
  afterAll(async () => {
    await stop();
    if (owners.length) await db.delete(teachersTable).where(inArray(teachersTable.id, owners));
    await Promise.all([...pools].map(p => p.end()));
  });

  it("commits once under parallel retries and records descriptive evidence without graded responses", async () => {
    const run = (await openWall(sid, teacherId, elementId, 0))!;
    const results = await Promise.all(Array.from({ length: 12 }, () => submitWall(input(run.id))));
    expect(results.filter(r => r === "accepted")).toHaveLength(1);
    expect(results.filter(r => r === "already")).toHaveLength(11);
    await Promise.all(Array.from({ length: 5 }, (_, i) => submitWall(input(run.id, `student-${i}`))));
    const snapshot = (await getWallSnapshot(sid, true))!;
    expect(snapshot.cards).toHaveLength(6);
    expect(new Set(snapshot.cards.map(c => c.id)).size).toBe(6);
    expect(snapshot.revision).toBe(6);
    const reports = await db.select().from(events).where(and(eq(events.sessionId, sid), eq(events.kind, "answer")));
    expect(reports).toHaveLength(6);
    expect(reports.every(r => r.payload.isCorrect === null && r.payload.answerIndex === null)).toBe(true);
    expect(await db.select().from(responses).where(eq(responses.sessionId, sid))).toHaveLength(0);
  });

  it("persists moderation without exposing hidden cards to audience snapshots", async () => {
    const before = (await getWallSnapshot(sid, true))!;
    const card = before.cards.find(c => c.studentKey === "student")!;
    expect(await toggle(before.runId, card.id, false)).toBe(true);
    const teacher = (await getWallSnapshot(sid, true))!;
    expect(teacher.cards.find(c => c.id === card.id)?.visible).toBe(false);
    expect(teacher.revision).toBe(7);
    const audience = (await getWallSnapshot(sid))!;
    expect(audience.cards).toHaveLength(5);
    expect(JSON.stringify(audience)).not.toContain(card.id);
    expect(await toggle(before.runId, card.id, true, otherId)).toBe(false);
  });

  it("restores teacher, projector, and submit-once state after discarding all server memory", async () => {
    const before = (await getWallSnapshot(sid, true))!;
    await stop();
    await start(true);
    const teacher = await join("teacher");
    expect(teacher.state.wall).toEqual(before);
    expect(teacher.state.activeElementOpenedAt).toBe(before.openedAt);
    const show = await join("show");
    expect(show.state.wall.cards).toEqual(before.cards.filter(c => c.visible));
    const student = await join("student");
    expect(student.state.wallSubmitted).toBe(true);
    expect(student.state.wall.cards).toEqual(show.state.wall.cards);
    const already = event(student.socket, "answer:already");
    student.socket.emit("wall:submit", input(before.runId));
    expect((await already).runId).toBe(before.runId);
  });

  it("keeps restored REST state owner-or-token gated and filters hidden cards for tokens", async () => {
    const router = (await import("../routes/presentation-sessions")).default;
    const app = express();
    app.use((req, _res, next) => {
      (req as any).session = { teacherId: Number(req.headers["x-test-owner"]) || undefined };
      next();
    });
    app.use("/api", router);
    const path = `/api/p/sessions/${sid}/state`;
    expect((await request(app).get(path)).status).toBe(403);
    expect((await request(app).get(path).set("x-test-owner", String(otherId))).status).toBe(403);
    const owner = await request(app).get(path).set("x-test-owner", String(teacherId));
    expect(owner.status).toBe(200);
    expect(owner.body.wall).toEqual(await getWallSnapshot(sid, true));
    const student = await request(app).get(path).query({ token: mintPresentationJoinToken(sid, "student") });
    expect(student.status).toBe(200);
    expect(student.body.wall).toEqual(await getWallSnapshot(sid));
    expect(student.body.wallSubmitted).toBe(true);
    expect((await request(app).get(path).query({ token: mintPresentationJoinToken(sessionIds[1], "student") })).status).toBe(403);
    const intruder = await client(otherId);
    const denied = event(intruder, "error");
    intruder.emit("teacher:join-presentation", { sessionId: sid });
    expect(await denied).toEqual({ message: "Unauthorized" });
  });

  it("starts reopen empty, retains history, and rejects stale submissions and moderation", async () => {
    const old = (await getWallSnapshot(sid, true))!;
    const run = (await openWall(sid, teacherId, elementId, 0))!;
    expect(run.id).not.toBe(old.runId);
    expect((await getWallSnapshot(sid, true))?.cards).toEqual([]);
    expect(await submitWall(input(old.runId, "late"))).toBe("not-active");
    expect(await submitWall(input("", "late"))).toBe("not-active");
    expect(await toggle(old.runId, old.cards[0].id, true)).toBe(false);
    expect(await toggle(run.id, old.cards[0].id, true)).toBe(false);
    expect(await submitWall(input(run.id))).toBe("accepted");
    expect(await db.select().from(cards).where(eq(cards.runId, old.runId))).toHaveLength(6);
    expect(await db.select().from(runs).where(eq(runs.sessionId, sid))).toHaveLength(2);
  });

  it("isolates sessions, owners and students, and limits text to 500 characters", async () => {
    const own = (await getWallSnapshot(sid, true))!;
    expect(await openWall(sid, otherId, elementId, 0)).toBeNull();
    expect(await openWall(sid, teacherId, elementId, 10)).toBeNull();
    const other = (await openWall(sessionIds[1], otherId, elementId, 0))!;
    expect(await submitWall(input(own.runId, "student", sessionIds[1]))).toBe("not-active");
    expect(await submitWall(input(other.id, "student", sessionIds[1], "x".repeat(600)))).toBe("accepted");
    expect((await getWallSnapshot(sessionIds[1]))?.cards[0].text).toHaveLength(500);
    expect(await submitWall(input(own.runId, "blank", sid, "  "))).toBe("empty");
    expect((await getWallSnapshot(sid, true))?.cards).toHaveLength(1);
  });

  it("acknowledges only committed socket submissions and broadcasts moderation with audience filtering", async () => {
    const teacher = await join("teacher");
    const show = await join("show");
    const student = await join("student", "new");
    const wall = (await getWallSnapshot(sid, true))!;
    const accepted = event(student.socket, "answer:accepted");
    const added = event(teacher.socket, "wall:update");
    const projectedAddition = event(show.socket, "wall:update");
    student.socket.emit("wall:submit", input(wall.runId, "new"));
    await accepted;
    expect(await db.select().from(cards).where(and(eq(cards.runId, wall.runId), eq(cards.studentKey, "new")))).toHaveLength(1);
    const card = (await added).cards.find((c: any) => c.studentKey === "new");
    await projectedAddition;
    const moderated = event(teacher.socket, "wall:update");
    const projected = event(show.socket, "wall:update");
    teacher.socket.emit("wall:toggle-card", { sessionId: sid, elementId, runId: wall.runId, cardId: card.id, visible: false });
    expect((await moderated).cards.find((c: any) => c.id === card.id).visible).toBe(false);
    const audience = await projected;
    expect(audience.cards.some((c: any) => c.id === card.id)).toBe(false);
    const stranger = await client();
    const rejected = event(stranger, "answer:rejected");
    stranger.emit("wall:submit", input(wall.runId));
    expect(await rejected).toEqual({ reason: "not-joined" });
    const displayRejected = event(show.socket, "answer:rejected");
    show.socket.emit("wall:submit", input(wall.runId));
    expect(await displayRejected).toEqual({ reason: "not-joined" });
  });

  it("never confirms an actual PostgreSQL save or moderation failure and rolls back all evidence", async () => {
    const wall = (await getWallSnapshot(sid, true))!;
    const student = await join("student", "failure");
    const teacher = await join("teacher");
    const accepted = vi.fn();
    student.socket.on("answer:accepted", accepted);
    await db.execute(sql`ALTER TABLE presentation_wall_cards ADD CONSTRAINT wall_test_failure CHECK (text <> 'storage-failure')`);
    try {
      const rejected = event(student.socket, "answer:rejected");
      student.socket.emit("wall:submit", input(wall.runId, "failure", sid, "storage-failure"));
      expect(await rejected).toEqual({ reason: "save-failed", runId: wall.runId });
      expect(accepted).not.toHaveBeenCalled();
      expect(await getWallSnapshot(sid, true)).toEqual(wall);
      const reports = await db.select().from(events).where(and(eq(events.sessionId, sid), eq(events.kind, "answer")));
      expect(reports.some(r => r.payload.studentKey === "failure")).toBe(false);
    } finally {
      await db.execute(sql`ALTER TABLE presentation_wall_cards DROP CONSTRAINT wall_test_failure`);
    }
    const visible = wall.cards.find(c => c.visible)!;
    await db.execute(sql`ALTER TABLE presentation_wall_cards ADD CONSTRAINT wall_test_moderation
      CHECK (visible) NOT VALID`);
    try {
      const rejected = event(teacher.socket, "wall:rejected");
      teacher.socket.emit("wall:toggle-card", { sessionId: sid, elementId, runId: wall.runId, cardId: visible.id, visible: false });
      expect(await rejected).toEqual({ reason: "save-failed", runId: wall.runId });
      expect(await getWallSnapshot(sid, true)).toEqual(wall);
    } finally {
      await db.execute(sql`ALTER TABLE presentation_wall_cards DROP CONSTRAINT wall_test_moderation`);
    }
  });

  it("serializes parallel moderation/submission and fences reopening races", async () => {
    const old = (await getWallSnapshot(sid, true))!;
    await Promise.all([
      ...Array.from({ length: 4 }, (_, i) => submitWall(input(old.runId, `parallel-${i}`))),
      toggle(old.runId, old.cards[0].id, false),
    ]);
    const complete = (await getWallSnapshot(sid, true))!;
    expect(complete.cards).toHaveLength(old.cards.length + 4);
    expect(complete.revision).toBe(old.revision + 5);
    await Promise.all([
      submitWall(input(old.runId, "race")),
      toggle(old.runId, old.cards[0].id, true),
      openWall(sid, teacherId, elementId, 0),
    ]);
    expect((await getWallSnapshot(sid, true))?.cards).toEqual([]);
    const teacher = await join("teacher");
    const student = await join("student", "race");
    const opened = event(teacher.socket, "activity:opened");
    teacher.socket.emit("activity:open", { sessionId: sid, elementId });
    const next = await opened;
    expect(next.wallRunId).toBeTruthy();
    const rejected = event(student.socket, "answer:rejected");
    student.socket.emit("wall:submit", input(old.runId, "race"));
    expect((await rejected).reason).toBe("not-active");
  });

  it("close, slide change and end clear the active pointer without deleting history", async () => {
    const teacher = await join("teacher");
    const current = (await getWallSnapshot(sid, true))!;
    const closed = event(teacher.socket, "activity:closed");
    teacher.socket.emit("activity:close", { sessionId: sid });
    await closed;
    expect(await getWallSnapshot(sid, true)).toBeNull();
    expect(await submitWall(input(current.runId))).toBe("not-active");
    expect(await toggle(current.runId, "missing", true)).toBe(false);
    await openWall(sid, teacherId, elementId, 0);
    const changed = event(teacher.socket, "slide:changed");
    teacher.socket.emit("slide:change", { sessionId: sid, index: 0 });
    await changed;
    expect((await db.select().from(sessions).where(eq(sessions.id, sid)))[0].activeWallRunId).toBeNull();
    const last = (await openWall(sid, teacherId, elementId, 0))!;
    const ended = event(teacher.socket, "session:ended");
    teacher.socket.emit("session:end", { sessionId: sid });
    await ended;
    expect(await submitWall(input(last.id))).toBe("ended");
    expect(await toggle(last.id, "missing", true)).toBe(false);
    expect(await getWallSnapshot(sid, true)).toBeNull();
    expect((await db.select().from(runs).where(eq(runs.sessionId, sid))).length).toBeGreaterThan(3);
    expect((await db.select().from(cards).where(eq(cards.runId, current.runId)))).toHaveLength(0);
  });
});
