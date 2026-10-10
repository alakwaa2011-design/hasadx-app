/* Public play links for the games on a deck's slides.

   A game card exported to PowerPoint must open the game directly, with no Hasad account: the classroom modes
   (Wameedh class, Tug of war class, XO class) already have opaque public tokens — a "direct play link" that
   serves only the question set. This module makes one per game slide, reusing the platform's own tables:
   - XO / Tug of war: a saved game activity (owner-only) + a `xo_class` / `tug_class` play link;
   - Wameedh class: an assignment created from the slide's questions + a `wameeth_class` play link.
   It is idempotent (same questions → same activity → same token) and never throws: a slide it cannot
   handle simply has no entry, and the export falls back to the deck's present page. */

import { randomBytes } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  assignmentsTable,
  questionsTable,
  directPlayLinksTable,
  savedGameActivitiesTable,
} from "@workspace/db";
import { canonicalizeJson, gameContentFingerprint } from "./saved-game-activities";
import { logger } from "./logger";

type GameQuestion = { prompt: string; options: string[]; correctIndex: number };
type SlideLike = { id?: string; elements?: Array<Record<string, unknown>> };

const LETTERS = ["A", "B", "C", "D"] as const;

function cleanQuestions(raw: unknown): GameQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: GameQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const r = q as { prompt?: unknown; options?: unknown; correctIndex?: unknown };
    const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
    const options = Array.isArray(r.options)
      ? r.options.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean).slice(0, 4)
      : [];
    const ci = typeof r.correctIndex === "number" ? r.correctIndex : -1;
    if (!prompt || options.length < 2 || !Number.isInteger(ci) || ci < 0 || ci >= options.length) continue;
    out.push({ prompt: prompt.slice(0, 500), options: options.map((o) => o.slice(0, 200)), correctIndex: ci });
  }
  return out.slice(0, 12);
}

async function linkFor(
  where: ReturnType<typeof and>,
  insert: { assignmentId?: number; savedGameActivityId?: number; gameType: string; teacherId: number },
): Promise<string | null> {
  const [existing] = await db.select({ token: directPlayLinksTable.token }).from(directPlayLinksTable).where(where).limit(1);
  if (existing) return existing.token;
  const token = randomBytes(16).toString("hex");
  const [created] = await db.insert(directPlayLinksTable).values({ token, ...insert })
    .onConflictDoNothing().returning({ token: directPlayLinksTable.token });
  if (created) return created.token;
  const [raced] = await db.select({ token: directPlayLinksTable.token }).from(directPlayLinksTable).where(where).limit(1);
  return raced?.token ?? null;
}

/** XO or Tug of war: saved activity + class play link. Returns the token. */
async function savedActivityToken(
  teacherId: number,
  gameType: "xo" | "tug",
  title: string,
  questions: GameQuestion[],
): Promise<string | null> {
  if (questions.length < 2) return null;
  const content = JSON.parse(canonicalizeJson({
    questions: questions.map((q) => ({ text: q.prompt, options: q.options, correct: q.correctIndex })),
  }));
  const settings = JSON.parse(canonicalizeJson({ duration: 20 }));
  const fingerprint = gameContentFingerprint(gameType, content);
  const [activity] = await db.insert(savedGameActivitiesTable).values({
    teacherId,
    gameType,
    title: title.slice(0, 250) || "نشاط عرض تفاعلي",
    content,
    settings,
    source: "presentation",
    isShared: false,
    publishedAt: null,
    contentFingerprint: fingerprint,
    questionCount: questions.length,
    playCount: 0,
    lastPlayedAt: new Date(),
  }).onConflictDoUpdate({
    target: [savedGameActivitiesTable.teacherId, savedGameActivitiesTable.gameType, savedGameActivitiesTable.contentFingerprint],
    set: { updatedAt: sql`NOW()` },
  }).returning({ id: savedGameActivitiesTable.id });
  if (!activity) return null;
  const linkType = gameType === "xo" ? "xo_class" : "tug_class";
  return linkFor(
    and(eq(directPlayLinksTable.savedGameActivityId, activity.id), eq(directPlayLinksTable.gameType, linkType)),
    { savedGameActivityId: activity.id, gameType: linkType, teacherId },
  );
}

/** Wameedh class: assignment from the slide's questions + `wameeth_class` play link. */
async function wameedhToken(
  teacherId: number,
  slideKey: string,
  title: string,
  questions: GameQuestion[],
): Promise<string | null> {
  if (questions.length < 2) return null;
  let assignmentId: number | null = null;
  const [existing] = await db.select({ id: assignmentsTable.id }).from(assignmentsTable)
    .where(and(eq(assignmentsTable.teacherId, teacherId), eq(assignmentsTable.fromPresentationSlide, slideKey))).limit(1);
  if (existing) {
    assignmentId = existing.id;
  } else {
    const created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(assignmentsTable).values({
        title: title.slice(0, 250) || "نشاط عرض تفاعلي",
        subject: "عروض تفاعلية",
        description: "تم إنشاؤه تلقائيًا من شريحة عرض تفاعلي في حصاد.",
        submissionMode: "electronic",
        accessMode: "public",
        accessCode: null,
        showResults: true,
        totalPoints: questions.length,
        isShared: false,
        isShareApproved: true,
        contentKind: "competition",
        fromPresentationSlide: slideKey,
        activityType: "quick_quiz",
        resultsReleaseMode: "immediate",
        teacherId,
      }).returning({ id: assignmentsTable.id });
      await tx.insert(questionsTable).values(questions.map((q) => ({
        assignmentId: row.id,
        questionType: "mcq" as const,
        text: q.prompt,
        optionA: q.options[0] ?? null,
        optionB: q.options[1] ?? null,
        optionC: q.options[2] ?? null,
        optionD: q.options[3] ?? null,
        correctAnswer: LETTERS[q.correctIndex],
        points: 1,
      })));
      return row;
    });
    assignmentId = created.id;
  }
  if (assignmentId === null) return null;
  return linkFor(
    and(
      eq(directPlayLinksTable.assignmentId, assignmentId),
      eq(directPlayLinksTable.gameType, "wameeth_class"),
      eq(directPlayLinksTable.teacherId, teacherId),
    ),
    { assignmentId, gameType: "wameeth_class", teacherId },
  );
}

const CLASS_PATH: Record<string, string> = {
  kahoot: "/game/wameeth/class",
  tug: "/game/tug/class",
  xo: "/game/xo/class",
};

/** slide index → public URL of that slide's game, for the slides it could build one for. */
export async function buildSlideGameLinks(
  teacherId: number,
  deckId: number | string,
  slides: SlideLike[],
  origin: string,
): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const game = (slide.elements ?? []).find((e) => e.kind === "hasad-game") as
      | { gameKind?: string; topic?: string; prompt?: string; questions?: unknown }
      | undefined;
    if (!game || !game.gameKind || !CLASS_PATH[game.gameKind]) continue;
    try {
      const questions = cleanQuestions(game.questions);
      const title = String(game.topic ?? game.prompt ?? "");
      let token: string | null = null;
      if (game.gameKind === "xo") token = await savedActivityToken(teacherId, "xo", title, questions);
      else if (game.gameKind === "tug") token = await savedActivityToken(teacherId, "tug", title, questions);
      else token = await wameedhToken(teacherId, `${deckId}:${slide.id ?? i}`, title, questions);
      if (token) out[i] = `${origin}${CLASS_PATH[game.gameKind]}?token=${token}`;
    } catch (err) {
      logger.warn({ err, slide: i }, "Could not build a public game link for a slide");
    }
  }
  return out;
}
