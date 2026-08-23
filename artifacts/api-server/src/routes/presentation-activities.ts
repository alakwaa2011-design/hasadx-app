/**
 * Presentation Activities — دمج أنشطة حصاد في العروض المولّدة (task #980)
 *
 * Two teacher-only endpoints that power the "suggest + one-click Wameeth"
 * flow on generated presentation activity slides:
 *
 *   GET  /presentation-activities/suggestions?q=…&limit=…
 *        Read-only. Returns matching, playable activities from the teacher's
 *        own library plus the visibly-published shared library. Never mutates
 *        anything and never calls AI (zero credit cost).
 *
 *   POST /presentation-activities
 *        Idempotent create of a real assignment (competition) from a slide's
 *        AI-generated questions. The stable client key is presentation-scoped
 *        ("presId:slideId", stored in assignments.from_presentation_slide) —
 *        generated decks reuse deterministic slide ids (s1, s2, …), so the
 *        key MUST include the presentation id or unrelated decks would link
 *        each other's activities. Replays return the existing assignment
 *        instead of creating a duplicate. No AI call, no credits.
 *
 * Explicitly out of scope: implicit creation during generation/autosave
 * (creation happens only on an explicit teacher click in the editor).
 */
import { Router, type IRouter } from "express";
import { db, assignmentsTable, questionsTable, teachersTable } from "@workspace/db";
import { eq, and, ne, sql, isNull } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

/* ── Arabic-aware text normalization for relevance matching ────────────── */

const STOPWORDS = new Set([
  "في", "من", "على", "عن", "الى", "إلى", "او", "ما", "مع", "هذا", "هذه",
  "ذلك", "التي", "الذي", "بين", "حول", "لدى", "عند", "بعد", "قبل",
  "درس", "وحده", "شريحه", "مقدمه", "خاتمه", "نشاط", "تقويم", "مراجعه", "عرض",
  "the", "and", "of", "for", "to", "in", "is", "on", "at", "a", "an",
  "lesson", "unit", "slide", "intro", "review", "activity", "quiz",
]);

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // diacritics + tatweel
    .replace(/[أإآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

function tokenize(s: string): string[] {
  const seen = new Set<string>();
  for (let tok of normalizeText(s).split(/[^\p{L}\p{N}]+/u)) {
    if (tok.startsWith("ال") && tok.length > 3) tok = tok.slice(2);
    if (tok.length < 2 || STOPWORDS.has(tok)) continue;
    seen.add(tok);
    if (seen.size >= 12) break;
  }
  return [...seen];
}

/* ── GET /presentation-activities/suggestions ──────────────────────────── */

const CANDIDATE_LIMIT = 200;

router.get("/presentation-activities/suggestions", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const q = String(req.query.q ?? "").trim().slice(0, 300);
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(10, Math.floor(rawLimit))) : 5;

    const tokens = tokenize(q);
    if (tokens.length === 0) {
      res.json({ suggestions: [] });
      return;
    }

    const selectShape = {
      id: assignmentsTable.id,
      title: assignmentsTable.title,
      subject: assignmentsTable.subject,
      description: assignmentsTable.description,
      teacherId: assignmentsTable.teacherId,
      teacherName: teachersTable.name,
      contentKind: assignmentsTable.contentKind,
      activityType: assignmentsTable.activityType,
      createdAt: assignmentsTable.createdAt,
      questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.assignment_id = ${assignmentsTable.id})`.as("question_count"),
    };

    /* Internal rows (auto-created from slides, worksheet grading) never
       surface as suggestions — mirrors the assignments list exclusions. */
    const notInternal = and(
      isNull(assignmentsTable.fromPresentationSlide),
      sql`${assignmentsTable.source} IS DISTINCT FROM 'worksheet'`,
    );

    const own = await db
      .select(selectShape)
      .from(assignmentsTable)
      .innerJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .where(and(eq(assignmentsTable.teacherId, teacherId), notInternal))
      .orderBy(sql`${assignmentsTable.createdAt} DESC`)
      .limit(CANDIDATE_LIMIT);

    /* Shared library: visibly published only — same boundary as the shared
       assignments list (no approval gating; hidden and private are excluded). */
    const shared = await db
      .select(selectShape)
      .from(assignmentsTable)
      .innerJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .where(
        and(
          eq(assignmentsTable.isShared, true),
          eq(assignmentsTable.hiddenByAdmin, false),
          ne(assignmentsTable.accessMode, "private"),
          ne(assignmentsTable.teacherId, teacherId),
          notInternal,
        ),
      )
      .orderBy(sql`${assignmentsTable.createdAt} DESC`)
      .limit(CANDIDATE_LIMIT);

    type Candidate = (typeof own)[number] & { isOwn: boolean };
    const candidates: Candidate[] = [
      ...own.map((r) => ({ ...r, isOwn: true })),
      ...shared.map((r) => ({ ...r, isOwn: false })),
    ];

    const scored = candidates
      .filter((c) => Number(c.questionCount) >= 1)
      .map((c) => {
        const title = normalizeText(c.title ?? "");
        const subject = normalizeText(c.subject ?? "");
        const description = normalizeText(c.description ?? "");
        let titleHits = 0, subjectHits = 0, descHits = 0;
        for (const tok of tokens) {
          if (title.includes(tok)) titleHits++;
          if (subject.includes(tok)) subjectHits++;
          if (description.includes(tok)) descHits++;
        }
        const score = titleHits * 3 + subjectHits * 2 + descHits + (c.isOwn ? 0.5 : 0);
        return { c, score, strongHits: titleHits + subjectHits };
      })
      /* Require at least one title/subject hit — description-only matches
         are too weak and produce noisy suggestions. */
      .filter((s) => s.strongHits >= 1)
      .sort((a, b) =>
        b.score - a.score ||
        Number(b.c.isOwn) - Number(a.c.isOwn) ||
        b.c.createdAt.getTime() - a.c.createdAt.getTime(),
      )
      .slice(0, limit);

    res.json({
      suggestions: scored.map(({ c }) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        questionCount: Number(c.questionCount),
        isOwn: c.isOwn,
        ownerName: c.isOwn ? null : c.teacherName,
        contentKind: c.contentKind,
        activityType: c.activityType,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Presentation activity suggestions error");
    res.status(500).json({ message: "خطأ في جلب الاقتراحات" });
  }
});

/* ── POST /presentation-activities — idempotent create from a slide ────── */

const CreateQuestionSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  questionType: z.enum(["mcq", "true_false", "fill_blank"]).default("mcq"),
  optionA: z.string().max(500).nullish(),
  optionB: z.string().max(500).nullish(),
  optionC: z.string().max(500).nullish(),
  optionD: z.string().max(500).nullish(),
  correctAnswer: z.string().max(200).nullish(),
  points: z.number().int().min(0).max(100).default(1),
});

const CreateBody = z.object({
  slideKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  activityType: z.enum(["quick_quiz", "tug_war"]),
  questions: z.array(CreateQuestionSchema).min(1).max(20),
});

router.post("/presentation-activities", async (req, res) => {
  const teacherId = req.session?.teacherId;
  if (!teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات النشاط غير صالحة" });
      return;
    }
    const body = parsed.data;

    for (const qn of body.questions) {
      if (qn.questionType === "true_false" && qn.correctAnswer && !["true", "false"].includes(qn.correctAnswer)) {
        res.status(400).json({ message: "إجابة سؤال صح/خطأ يجب أن تكون true أو false" });
        return;
      }
      if (qn.questionType === "mcq") {
        const parts = (qn.correctAnswer ?? "").split(",").map((s) => s.trim());
        if (!qn.correctAnswer || !parts.every((p) => ["A", "B", "C", "D"].includes(p))) {
          res.status(400).json({ message: "إجابة سؤال الاختيار يجب أن تكون من A أو B أو C أو D" });
          return;
        }
      }
    }

    const totalPoints = body.questions.reduce((sum, qn) => sum + (qn.points || 1), 0);

    const result = await db.transaction(async (tx) => {
      /* Serialize concurrent creates for the same (teacher, slide) pair —
         the advisory xact lock releases automatically at commit/rollback,
         so a racing replay waits, re-checks, and reuses instead of
         inserting a duplicate (no schema change needed). */
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${`presentation-activity:${teacherId}:${body.slideKey}`}, 0))`,
      );

      const [existing] = await tx
        .select({
          id: assignmentsTable.id,
          title: assignmentsTable.title,
          activityType: assignmentsTable.activityType,
        })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.teacherId, teacherId),
            eq(assignmentsTable.fromPresentationSlide, body.slideKey),
          ),
        )
        .limit(1);

      if (existing) {
        return { reused: true as const, assignment: existing };
      }

      const [assignmentRow] = await tx
        .insert(assignmentsTable)
        .values({
          title: body.title,
          subject: body.subject || "عروض تفاعلية",
          description: body.description || "تم إنشاؤه تلقائيًا من شريحة عرض تفاعلي في حصاد.",
          submissionMode: "electronic",
          accessMode: "public",
          accessCode: null,
          showResults: true,
          totalPoints,
          /* Auto-created slide activities never join the public library —
             they exist to power the linked in-slide game. */
          isShared: false,
          isShareApproved: true,
          contentKind: "competition",
          fromPresentationSlide: body.slideKey,
          activityType: body.activityType,
          resultsReleaseMode: "immediate",
          teacherId,
        })
        .returning();

      await tx.insert(questionsTable).values(
        body.questions.map((qn) => ({
          assignmentId: assignmentRow.id,
          questionType: qn.questionType,
          text: qn.text,
          optionA: qn.optionA || null,
          optionB: qn.optionB || null,
          optionC: qn.optionC || null,
          optionD: qn.optionD || null,
          correctAnswer: qn.correctAnswer || null,
          points: qn.points || 1,
        })),
      );

      return { reused: false as const, assignment: assignmentRow };
    });

    res.status(result.reused ? 200 : 201).json({
      id: result.assignment.id,
      title: result.assignment.title,
      activityType: result.assignment.activityType,
      reused: result.reused,
    });
  } catch (error) {
    req.log.error({ err: error }, "Create presentation activity error");
    res.status(500).json({ message: "تعذّر إنشاء النشاط" });
  }
});

export default router;
