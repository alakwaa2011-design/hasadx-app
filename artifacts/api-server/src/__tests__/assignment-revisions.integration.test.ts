import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import assignmentsRouter from "../routes/assignments";
import submissionsRouter from "../routes/submissions";

const RUN =
  Boolean(process.env.TEST_DATABASE_URL) &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const suite = RUN ? describe : describe.skip;
const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

let ownerId = 0;
let otherTeacherId = 0;
let restorableId = 0;
let lockedId = 0;
let archivedId = 0;
let oldRevisionId = 0;
let lockedRevisionId = 0;
let archivedSubmissionId = 0;
let archivedQuestionId = 0;
let concurrentRestoreId = 0;
let concurrentRevisionAId = 0;
let concurrentRevisionBId = 0;

function app(teacherId?: number) {
  const server = express();
  server.use(express.json({ limit: "2mb" }));
  server.use((req: any, _res, next) => {
    req.session = teacherId ? { teacherId } : {};
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  server.use("/api", assignmentsRouter);
  server.use("/api", submissionsRouter);
  return server;
}

async function assignment(id: number) {
  return (await db.execute(sql`
    SELECT id, title, description, access_mode, access_code, is_shared,
           is_share_approved, archived_at, total_points, version
    FROM assignments WHERE id = ${id}
  `)).rows[0] as any;
}

async function questionTexts(id: number) {
  return (await db.execute(sql`
    SELECT text FROM questions WHERE assignment_id = ${id} ORDER BY id
  `)).rows.map((row: any) => row.text);
}

suite("assignment revision safety with PostgreSQL", () => {
  beforeAll(async () => {
    const versioningMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-09-10-assignment-versioning-archive.sql", import.meta.url),
      "utf8",
    );
    const revisionsMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-09-10-assignment-revision-history.sql", import.meta.url),
      "utf8",
    );
    const lifecycleMigration = readFileSync(
      new URL("../../../../scripts/migrations/2026-09-10-assignment-lifecycle.sql", import.meta.url),
      "utf8",
    );
    await db.execute(sql.raw(versioningMigration));
    await db.execute(sql.raw(revisionsMigration));
    await db.execute(sql.raw(lifecycleMigration));

    ownerId = Number((await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash)
      VALUES (${"Revision owner " + nonce}, ${`revision_owner_${nonce}@test.invalid`}, 'x')
      RETURNING id
    `)).rows[0].id);
    otherTeacherId = Number((await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash)
      VALUES (${"Revision other " + nonce}, ${`revision_other_${nonce}@test.invalid`}, 'x')
      RETURNING id
    `)).rows[0].id);

    restorableId = Number((await db.execute(sql`
      INSERT INTO assignments
        (title, description, teacher_id, access_mode, is_shared, is_share_approved, total_points, version)
      VALUES ('Current title', 'Current description', ${ownerId}, 'public', TRUE, TRUE, 2, 4)
      RETURNING id
    `)).rows[0].id);
    const oldQuestionId = Number((await db.execute(sql`
      INSERT INTO questions
        (assignment_id, question_type, text, option_a, option_b, correct_answer, points)
      VALUES (${restorableId}, 'mcq', 'Old question', 'A', 'B', 'A', 1)
      RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO questions
        (assignment_id, question_type, text, option_a, option_b, correct_answer, points)
      VALUES (${restorableId}, 'mcq', 'Current question', 'A', 'B', 'B', 2)
    `);
    oldRevisionId = Number((await db.execute(sql`
      INSERT INTO assignment_revisions
        (assignment_id, teacher_id, source_version, settings, questions)
      VALUES (
        ${restorableId},
        ${ownerId},
        1,
        ${JSON.stringify({
          title: "Historical title",
          description: "Historical description",
          accessMode: "public",
          accessCode: null,
          isShared: true,
          isShareApproved: true,
          totalPoints: 1,
        })}::jsonb,
        ${JSON.stringify([{
          id: oldQuestionId,
          assignmentId: restorableId,
          questionType: "mcq",
          text: "Historical question",
          optionA: "A",
          optionB: "B",
          optionC: null,
          optionD: null,
          correctAnswer: "A",
          points: 1,
          imageUrl: null,
          readAloud: false,
          allowMultipleAnswers: false,
          repeatQuestion: false,
        }])}::jsonb
      )
      RETURNING id
    `)).rows[0].id);

    lockedId = Number((await db.execute(sql`
      INSERT INTO assignments (title, teacher_id, is_shared, total_points, version)
      VALUES ('Locked assignment', ${ownerId}, TRUE, 1, 2) RETURNING id
    `)).rows[0].id);
    const lockedQuestionId = Number((await db.execute(sql`
      INSERT INTO questions
        (assignment_id, question_type, text, option_a, option_b, correct_answer, points)
      VALUES (${lockedId}, 'mcq', 'Locked current question', 'A', 'B', 'A', 1)
      RETURNING id
    `)).rows[0].id);
    lockedRevisionId = Number((await db.execute(sql`
      INSERT INTO assignment_revisions
        (assignment_id, teacher_id, source_version, settings, questions)
      SELECT id, teacher_id, 1, to_jsonb(assignments),
        ${JSON.stringify([{
          id: lockedQuestionId,
          assignmentId: lockedId,
          questionType: "mcq",
          text: "Locked historical question",
          optionA: "A",
          optionB: "B",
          correctAnswer: "A",
          points: 1,
        }])}::jsonb
      FROM assignments WHERE id = ${lockedId}
      RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO submissions
        (assignment_id, student_name, score, total_questions, correct_answers, earned_points, total_points)
      VALUES (${lockedId}, 'Student', 1, 1, 1, 1, 1)
    `);

    archivedId = Number((await db.execute(sql`
      INSERT INTO assignments
        (title, teacher_id, submission_mode, exam_mode, exam_duration_minutes,
         archived_at, is_shared, total_points)
      VALUES ('Archived assignment', ${ownerId}, 'both', TRUE, 10, NOW(), FALSE, 1)
      RETURNING id
    `)).rows[0].id);
    archivedQuestionId = Number((await db.execute(sql`
      INSERT INTO questions
        (assignment_id, question_type, text, option_a, option_b, correct_answer, points, repeat_question)
      VALUES (${archivedId}, 'mcq', 'Archived question', 'A', 'B', 'A', 1, TRUE)
      RETURNING id
    `)).rows[0].id);
    archivedSubmissionId = Number((await db.execute(sql`
      INSERT INTO submissions
        (assignment_id, student_name, device_fingerprint, score, total_questions,
         correct_answers, earned_points, total_points)
      VALUES (${archivedId}, 'Student', ${`archived-repeat-${nonce}`}, 0, 1, 0, 0, 1)
      RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO answers
        (submission_id, question_id, selected_answer, is_correct)
      VALUES (${archivedSubmissionId}, ${archivedQuestionId}, 'B', FALSE)
    `);

    concurrentRestoreId = Number((await db.execute(sql`
      INSERT INTO assignments
        (title, description, teacher_id, access_mode, is_shared, is_share_approved, total_points, version)
      VALUES ('Concurrent current', 'Concurrent current description', ${ownerId}, 'public', TRUE, TRUE, 1, 1)
      RETURNING id
    `)).rows[0].id);
    await db.execute(sql`
      INSERT INTO questions
        (assignment_id, question_type, text, option_a, option_b, correct_answer, points)
      VALUES (${concurrentRestoreId}, 'mcq', 'Concurrent current question', 'A', 'B', 'A', 1)
    `);
    const concurrentRevisions = (await db.execute(sql`
      INSERT INTO assignment_revisions
        (assignment_id, teacher_id, source_version, settings, questions)
      VALUES
        (
          ${concurrentRestoreId},
          ${ownerId},
          1,
          ${JSON.stringify({
            title: "Concurrent revision A",
            description: "Concurrent description A",
            accessMode: "public",
            totalPoints: 2,
          })}::jsonb,
          ${JSON.stringify([{
            questionType: "mcq",
            text: "Concurrent question A",
            optionA: "A",
            optionB: "B",
            correctAnswer: "A",
            points: 2,
          }])}::jsonb
        ),
        (
          ${concurrentRestoreId},
          ${ownerId},
          1,
          ${JSON.stringify({
            title: "Concurrent revision B",
            description: "Concurrent description B",
            accessMode: "public",
            totalPoints: 3,
          })}::jsonb,
          ${JSON.stringify([{
            questionType: "mcq",
            text: "Concurrent question B",
            optionA: "A",
            optionB: "B",
            correctAnswer: "B",
            points: 3,
          }])}::jsonb
        )
      RETURNING id
    `)).rows;
    [concurrentRevisionAId, concurrentRevisionBId] = concurrentRevisions.map((row: any) => Number(row.id));
  });

  afterAll(async () => {
    if (ownerId && otherTeacherId) {
      await db.execute(sql`DELETE FROM teachers WHERE id IN (${ownerId}, ${otherTeacherId})`);
    }
  });

  it("does not expose the revision list to another teacher", async () => {
    const response = await request(app(otherTeacherId))
      .get(`/api/assignments/${restorableId}/revisions`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({ code: "OWNER_ONLY" }));
    expect(JSON.stringify(response.body)).not.toContain("correctAnswer");
    expect(JSON.stringify(response.body)).not.toContain("Historical question");
  });

  it("does not expose revision details or answer keys to another teacher", async () => {
    const response = await request(app(otherTeacherId))
      .get(`/api/assignments/${restorableId}/revisions/${oldRevisionId}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({ code: "OWNER_ONLY" }));
    expect(JSON.stringify(response.body)).not.toContain("correctAnswer");
    expect(JSON.stringify(response.body)).not.toContain("Historical question");
  });

  it("allows only the owner to read revision history and details", async () => {
    const listResponse = await request(app(ownerId))
      .get(`/api/assignments/${restorableId}/revisions`);
    const detailResponse = await request(app(ownerId))
      .get(`/api/assignments/${restorableId}/revisions/${oldRevisionId}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: oldRevisionId, sourceVersion: 1 }),
    ]));
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.questions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: "Historical question",
        correctAnswer: "A",
      }),
    ]));
  });

  it("rejects a restore by a teacher who does not own the assignment", async () => {
    const response = await request(app(otherTeacherId))
      .post(`/api/assignments/${restorableId}/revisions/${oldRevisionId}/restore`)
      .send({ version: 4, mode: "full" });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("OWNER_ONLY");
    expect((await assignment(restorableId)).title).toBe("Current title");
  });

  it("returns 409 for a stale assignment version without changing data", async () => {
    const response = await request(app(ownerId))
      .post(`/api/assignments/${restorableId}/revisions/${oldRevisionId}/restore`)
      .send({ version: 3, mode: "full" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("ASSIGNMENT_VERSION_CONFLICT");
    expect(await questionTexts(restorableId)).toEqual(["Old question", "Current question"]);
  });

  it("allows only one of two concurrent restores with the same version", async () => {
    const revisions = [
      {
        id: concurrentRevisionAId,
        title: "Concurrent revision A",
        description: "Concurrent description A",
        question: "Concurrent question A",
        totalPoints: 2,
      },
      {
        id: concurrentRevisionBId,
        title: "Concurrent revision B",
        description: "Concurrent description B",
        question: "Concurrent question B",
        totalPoints: 3,
      },
    ];

    const responses = await Promise.all(revisions.map((revision) =>
      request(app(ownerId))
        .post(`/api/assignments/${concurrentRestoreId}/revisions/${revision.id}/restore`)
        .send({ version: 1, mode: "full" }),
    ));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winnerIndex = responses.findIndex((response) => response.status === 200);
    const loser = responses.find((response) => response.status === 409)!;
    expect(responses[winnerIndex].body).toMatchObject({ ok: true, mode: "full", version: 2 });
    expect(loser.body.code).toBe("ASSIGNMENT_VERSION_CONFLICT");

    const winner = revisions[winnerIndex];
    expect(await assignment(concurrentRestoreId)).toMatchObject({
      title: winner.title,
      description: winner.description,
      total_points: winner.totalPoints,
      is_shared: false,
      is_share_approved: false,
      version: 2,
    });
    expect(await questionTexts(concurrentRestoreId)).toEqual([winner.question]);
  });

  it("restores settings only while preserving questions and disabling sharing", async () => {
    const response = await request(app(ownerId))
      .post(`/api/assignments/${restorableId}/revisions/${oldRevisionId}/restore`)
      .send({ version: 4, mode: "settings" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true, mode: "settings", version: 5 });
    expect(await questionTexts(restorableId)).toEqual(["Old question", "Current question"]);
    expect(await assignment(restorableId)).toMatchObject({
      title: "Historical title",
      description: "Historical description",
      is_shared: false,
      is_share_approved: false,
    });
  });

  it("fully restores historical questions but never republishes the assignment", async () => {
    const response = await request(app(ownerId))
      .post(`/api/assignments/${restorableId}/revisions/${oldRevisionId}/restore`)
      .send({ version: 5, mode: "full" });

    expect(response.status).toBe(200);
    expect(response.body.version).toBe(6);
    expect(await questionTexts(restorableId)).toEqual(["Historical question"]);
    expect(await assignment(restorableId)).toMatchObject({
      is_shared: false,
      is_share_approved: false,
    });
  });

  it("keeps questions locked when submissions exist", async () => {
    const response = await request(app(ownerId))
      .post(`/api/assignments/${lockedId}/revisions/${lockedRevisionId}/restore`)
      .send({ version: 2, mode: "full" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("REVISION_QUESTIONS_LOCKED");
    expect(await questionTexts(lockedId)).toEqual(["Locked current question"]);
    expect((await assignment(lockedId)).version).toBe(2);
  });

  it("duplicates an old revision as a private library copy owned by the caller", async () => {
    const response = await request(app(ownerId))
      .post(`/api/assignments/${restorableId}/revisions/${oldRevisionId}/duplicate`);

    expect(response.status).toBe(201);
    const copy = await assignment(response.body.id);
    expect(copy).toMatchObject({
      title: "Historical title (نسخة)",
      is_shared: false,
      is_share_approved: false,
      archived_at: null,
      version: 1,
    });
    expect(await questionTexts(response.body.id)).toEqual(["Historical question"]);
  });

  it("blocks exam start plus electronic and paper submissions after archiving", async () => {
    const studentPayload = {
      studentName: "Student",
      studentClass: "A",
      deviceFingerprint: `archived-${nonce}`,
    };
    const [start, electronic, repeat, paper, ownerPaper] = await Promise.all([
      request(app()).post(`/api/assignments/${archivedId}/start-exam`).send(studentPayload),
      request(app()).post(`/api/assignments/${archivedId}/submit`).send({
        ...studentPayload,
        answers: [],
      }),
      request(app()).post(`/api/assignments/${archivedId}/submissions/${archivedSubmissionId}/repeat`).send({
        deviceFingerprint: `archived-repeat-${nonce}`,
        answers: [{ questionId: archivedQuestionId, selectedAnswer: "A" }],
      }),
      request(app()).post(`/api/assignments/${archivedId}/submit-image`).send({
        ...studentPayload,
        imageBase64: "data:image/png;base64,AA==",
      }),
      request(app(ownerId)).post(`/api/assignments/${archivedId}/submit-image`).send({
        ...studentPayload,
        deviceFingerprint: `archived-owner-${nonce}`,
        imageBase64: "data:image/png;base64,AA==",
      }),
    ]);

    for (const response of [start, electronic, repeat, paper, ownerPaper]) {
      expect(response.status).toBe(410);
      expect(response.body.code).toBe("ASSIGNMENT_ARCHIVED");
    }
  });
});