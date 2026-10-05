import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import express from "express";
import request from "supertest";
import { io as connect, type Socket } from "socket.io-client";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool, teachersTable, presentationsTable, presentationSessionsTable as sessions,
  presentationWordCloudRunsTable as runs, presentationWordCloudSubmissionsTable as submissions,
   presentationResponsesTable, presentationSessionEventsTable } from "@workspace/db";
import { getWordCloudSnapshot, migratePresentationWordCloud, openWordCloud, submitWordCloud } from "../lib/presentation-word-cloud";
import { mintPresentationJoinToken } from "../lib/presentation-join-token";

// Hydration isn't under test. All session, owner and participant checks, socket
// handlers, transactions and persistence below are real.
vi.mock("../routes/presentations", () => ({ hydrateActivityQuestions: async (slides: unknown) => slides }));

const ready = !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

describe.skipIf(!ready)("durable live word clouds (real PostgreSQL and Socket.IO)", () => {
  const teacherIds: number[] = [];
  const sessionIds: number[] = [];
  const sockets: Socket[] = [];
  const pools = new Set([pool]);
  let server: ReturnType<typeof createServer>;
  let io: Server;
  let url: string;
  let teacherId: number;
  let otherTeacher: number;
  let sid: number;
  let otherSid: number;
  const elementId = "cloud";
  const key = "word-cloud-student-1";

  function event<T = any>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Missing ${name}`)); }, 5000);
      const handler = (payload: T) => { clearTimeout(timeout); resolve(payload); };
      socket.once(name, handler);
    });
  }
  async function start(fresh = false) {
    if (fresh) vi.resetModules(); // discard ALL participant/activity maps, as in a process restart
    const module = await import("../game/presentation-handlers");
    pools.add((await import("@workspace/db")).pool);
    server = createServer();
    io = new Server(server);
    io.use((socket, next) => {
      // Test-only replacement for the existing authenticated session middleware.
      (socket.request as any).session = { teacherId: socket.handshake.auth.teacherId };
      next();
    });
    module.setupPresentationSocket(io);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }
  async function stop() {
    sockets.splice(0).forEach(socket => socket.disconnect());
    if (io) await new Promise<void>(resolve => io.close(() => resolve()));
  }
  async function client(owner?: number) {
    const socket = connect(url, { transports: ["websocket"], auth: { teacherId: owner }, reconnection: false });
    sockets.push(socket);
    await event(socket, "connect");
    return socket;
  }
  async function teacher(owner = teacherId, sessionId = sid) {
    const socket = await client(owner);
    const sync = event(socket, "state:sync");
    socket.emit("teacher:join-presentation", { sessionId });
    return { socket, state: await sync };
  }
  async function student(studentKey = key, sessionId = sid) {
    const socket = await client();
    const sync = event(socket, "state:sync");
    socket.emit("student:join", {
      sessionId, studentKey, name: "طالب", joinToken: mintPresentationJoinToken(sessionId, studentKey),
    });
    return { socket, state: await sync };
  }
  const input = (runId: string, studentKey = key, sessionId = sid, text = "علم") => ({
    sessionId, elementId, runId, studentKey, studentName: "طالب", classStudentId: null, text,
  });

  beforeAll(async () => {
    // The schema push can stop at an unrelated interactive rename prompt.
    // Mirror the additive reporting migration required by the incoming code.
    await db.execute(sql`CREATE TABLE IF NOT EXISTS presentation_session_events (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, event_key TEXT NOT NULL, payload JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS presentation_session_events_unique
      ON presentation_session_events(session_id, kind, event_key)`);
    await migratePresentationWordCloud();
    await migratePresentationWordCloud(); // additive runtime migration is idempotent
    for (let i = 0; i < 2; i++) {
      const [t] = await db.insert(teachersTable).values({ name: "Cloud integration", passwordHash: "test-only" }).returning();
      teacherIds.push(t.id);
      const [deck] = await db.insert(presentationsTable).values({
        teacherId: t.id, title: "Cloud integration",
        slides: [{ id: "slide", elements: [{ id: elementId, kind: "activity", activityKind: "word_cloud", prompt: "كلمة" }] }],
      }).returning();
      const [session] = await db.insert(sessions).values({
        teacherId: t.id, presentationId: deck.id, pin: String(810000 + t.id).slice(-6),
      }).returning();
      sessionIds.push(session.id);
    }
    [teacherId, otherTeacher] = teacherIds;
    [sid, otherSid] = sessionIds;
    await start();
  });
  afterAll(async () => {
    await stop();
    if (teacherIds.length) await db.delete(teachersTable).where(inArray(teachersTable.id, teacherIds));
    await Promise.all([...pools].map(p => p.end()));
  });

  it("commits once under simultaneous submissions and retries, and never writes graded responses", async () => {
    const run = (await openWordCloud(sid, teacherId, elementId, 0))!;
    const results = await Promise.all(Array.from({ length: 12 }, () => submitWordCloud(input(run.id))));
    expect(results.filter(r => r === "accepted")).toHaveLength(1);
    expect(results.filter(r => r === "already")).toHaveLength(11);
    await Promise.all(Array.from({ length: 6 }, (_, i) => submitWordCloud(input(run.id, `student-${i}`, sid, "  SCIENCE  "))));
    expect((await getWordCloudSnapshot(sid))?.words).toEqual([{ text: "science", count: 6 }, { text: "علم", count: 1 }]);
    const rows = await db.select().from(submissions).where(eq(submissions.runId, run.id));
    expect(rows).toHaveLength(7);
    const reports = await db.select().from(presentationSessionEventsTable).where(and(
      eq(presentationSessionEventsTable.sessionId, sid), eq(presentationSessionEventsTable.kind, "answer"),
    ));
    expect(reports).toHaveLength(7);
    expect(reports.every(r => r.payload.isCorrect === null && r.payload.answerIndex === null)).toBe(true);
    expect(await db.select().from(presentationResponsesTable).where(eq(presentationResponsesTable.sessionId, sid))).toHaveLength(0);
  });

  it("starts each reopen empty, retains history, and rejects old or missing round identities", async () => {
    const old = (await getWordCloudSnapshot(sid))!;
    const run = (await openWordCloud(sid, teacherId, elementId, 0))!;
    expect(run.id).not.toBe(old.runId);
    expect((await getWordCloudSnapshot(sid))?.words).toEqual([]);
    expect(await submitWordCloud(input(old.runId, "late"))).toBe("not-active");
    expect(await submitWordCloud(input("", "late"))).toBe("not-active");
    expect(await submitWordCloud(input(run.id))).toBe("accepted");
    expect(await db.select().from(submissions).where(eq(submissions.runId, old.runId))).toHaveLength(7);
    expect(await db.select().from(runs).where(eq(runs.sessionId, sid))).toHaveLength(2);
    expect(await db.select().from(presentationSessionEventsTable).where(and(
      eq(presentationSessionEventsTable.sessionId, sid), eq(presentationSessionEventsTable.kind, "answer"),
    ))).toHaveLength(8);
  });

  it("isolates teachers and sessions even for identical element and student identities", async () => {
    expect(await openWordCloud(sid, otherTeacher, elementId, 0)).toBeNull();
    expect(await openWordCloud(sid, teacherId, elementId, 99)).toBeNull();
    const own = (await getWordCloudSnapshot(sid))!;
    const other = (await openWordCloud(otherSid, otherTeacher, elementId, 0))!;
    expect(await submitWordCloud(input(own.runId, key, otherSid))).toBe("not-active");
    expect(await submitWordCloud(input(other.id, key, otherSid, "مستقل"))).toBe("accepted");
    expect((await getWordCloudSnapshot(otherSid))?.words).toEqual([{ text: "مستقل", count: 1 }]);
    expect((await getWordCloudSnapshot(sid))?.words).toEqual([{ text: "علم", count: 1 }]);
  });

  it("recovers cloud and submit-once state for teacher, projector and participant after a fresh server", async () => {
    const before = (await getWordCloudSnapshot(sid))!;
    await stop();
    await start(true);
    const control = await teacher();
    expect(control.state.wordCloud).toEqual(before);
    expect(control.state.activeElementOpenedAt).toBe(before.openedAt);
    const show = await client(teacherId);
    const sync = event(show, "state:sync");
    show.emit("show:join", { sessionId: sid });
    expect((await sync).wordCloud).toEqual(before);
    const participant = await student();
    expect(participant.state.wordCloudSubmitted).toBe(true);
    const already = event(participant.socket, "answer:already");
    participant.socket.emit("word_cloud:submit", { ...input(before.runId), text: "تكرار" });
    expect(await already).toEqual({ runId: before.runId });
    expect((await getWordCloudSnapshot(sid))?.words).toEqual(before.words);
  });

  it("acknowledges only durable inserts, and does not accept display or unjoined sockets", async () => {
    const cloud = (await getWordCloudSnapshot(sid))!;
    const participant = await student("fresh-student");
    const accepted = event(participant.socket, "answer:accepted");
    participant.socket.emit("word_cloud:submit", input(cloud.runId, "fresh-student", sid, "عمل"));
    await accepted;
    expect(await db.select().from(submissions).where(and(eq(submissions.runId, cloud.runId), eq(submissions.studentKey, "fresh-student")))).toHaveLength(1);
    const stranger = await client();
    const rejected = event(stranger, "answer:rejected");
    stranger.emit("word_cloud:submit", input(cloud.runId));
    expect(await rejected).toEqual({ reason: "not-joined" });
    const show = await client(teacherId);
    const sync = event(show, "state:sync");
    show.emit("show:join", { sessionId: sid });
    await sync;
    const displayRejected = event(show, "answer:rejected");
    show.emit("word_cloud:submit", input(cloud.runId));
    expect(await displayRejected).toEqual({ reason: "not-joined" });
  });

  it("reports an actual PostgreSQL insert failure without confirming or broadcasting an accepted word", async () => {
    const cloud = (await getWordCloudSnapshot(sid))!;
    const participant = await student("failure-student");
    const accepted = vi.fn();
    participant.socket.on("answer:accepted", accepted);
    await db.execute(sql`ALTER TABLE presentation_word_cloud_submissions
      ADD CONSTRAINT cloud_integration_failure CHECK (word <> 'simulate-storage-failure')`);
    try {
      const rejected = event(participant.socket, "answer:rejected");
      participant.socket.emit("word_cloud:submit", input(cloud.runId, "failure-student", sid, "simulate-storage-failure"));
      expect(await rejected).toEqual({ reason: "storage-failed", runId: cloud.runId });
      expect(accepted).not.toHaveBeenCalled();
      expect(await getWordCloudSnapshot(sid)).toEqual(cloud);
      expect(await submitWordCloud(input(cloud.runId, "failure-student"))).toBe("accepted");
    } finally {
      await db.execute(sql`ALTER TABLE presentation_word_cloud_submissions DROP CONSTRAINT cloud_integration_failure`);
      participant.socket.off("answer:accepted", accepted);
    }
  });

  it("keeps restored REST state owner-or-token gated and rejects other teachers' socket joins", async () => {
    const router = (await import("../routes/presentation-sessions")).default;
    const app = express();
    app.use((req, _res, next) => {
      (req as any).session = { teacherId: req.headers["x-test-owner"] ? Number(req.headers["x-test-owner"]) : undefined };
      next();
    });
    app.use("/api", router);
    const path = `/api/p/sessions/${sid}/state`;
    expect((await request(app).get(path)).status).toBe(403);
    expect((await request(app).get(path).set("x-test-owner", String(otherTeacher))).status).toBe(403);
    const cloud = (await getWordCloudSnapshot(sid))!;
    const owner = await request(app).get(path).set("x-test-owner", String(teacherId));
    expect(owner.status).toBe(200);
    expect(owner.body.wordCloud).toEqual(cloud);
    const participant = await request(app).get(path).query({ token: mintPresentationJoinToken(sid, key) });
    expect(participant.status).toBe(200);
    expect(participant.body.wordCloud).toEqual(cloud);
    expect(JSON.stringify(participant.body.wordCloud)).not.toContain("studentKey");
    expect((await request(app).get(path).query({ token: mintPresentationJoinToken(otherSid, key) })).status).toBe(403);
    const intruder = await client(otherTeacher);
    const denied = event(intruder, "error");
    intruder.emit("teacher:join-presentation", { sessionId: sid });
    expect(await denied).toEqual({ message: "Unauthorized" });
  });

  it("serializes reopening against submissions and fences delayed socket packets", async () => {
    const control = await teacher();
    const participant = await student("race-student");
    const old = (await getWordCloudSnapshot(sid))!;
    await Promise.all([
      submitWordCloud(input(old.runId, "race-student")),
      openWordCloud(sid, teacherId, elementId, 0),
    ]);
    expect((await getWordCloudSnapshot(sid))?.words).toEqual([]);
    const opened = event(control.socket, "activity:opened");
    control.socket.emit("activity:open", { sessionId: sid, elementId });
    const next = await opened;
    expect(next.wordCloudRunId).toBeTruthy();
    const rejected = event(participant.socket, "answer:rejected");
    participant.socket.emit("word_cloud:submit", input(old.runId, "race-student"));
    expect((await rejected).reason).toBe("not-active");
    expect((await getWordCloudSnapshot(sid))?.words).toEqual([]);
  });

  it("close and end block writes without deleting earlier rounds", async () => {
    const control = await teacher();
    const old = (await getWordCloudSnapshot(sid))!;
    const closed = event(control.socket, "activity:closed");
    control.socket.emit("activity:close", { sessionId: sid });
    await closed;
    expect(await getWordCloudSnapshot(sid)).toBeNull();
    expect(await submitWordCloud(input(old.runId))).toBe("not-active");
    const run = (await openWordCloud(sid, teacherId, elementId, 0))!;
    await db.update(sessions).set({ status: "ended" }).where(eq(sessions.id, sid));
    expect(await submitWordCloud(input(run.id))).toBe("ended");
    expect(await getWordCloudSnapshot(sid)).toBeNull();
    const history = await db.execute(sql`SELECT count(*)::integer AS n FROM presentation_word_cloud_runs WHERE session_id = ${sid}`);
    expect(Number(history.rows[0].n)).toBeGreaterThan(2);
  });
});
