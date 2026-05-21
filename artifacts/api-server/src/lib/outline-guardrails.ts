/* AI Presentation Builder — Phase 1A guardrails.
   Run after parseJsonLoose and before Zod validation. Normalizes the
   model's payload (truncate / drop offending bits) and returns a
   structured feedback array used for an optional corrective retry. */

import { isKnownThemeKey } from "@workspace/slide-templates";
import {
  bannedPhrasesFor,
  densityLimits,
  type OutlineBrief,
  type OutlineDensity,
  type OutlineLanguage,
} from "./outline-prompt";

export interface GuardrailReport {
  feedback: string[];
  fatal: boolean;
}

export type SanitizedInteractionHint =
  | "poll" | "quiz" | "discussion" | "activity" | null;

export interface SanitizedVisualDirection {
  icon?: string;
  shape?: "rect" | "circle" | "line" | "arrow" | "divider";
  layoutHint?: string;
}

export type SanitizedGameSuggestion =
  | "kahoot" | "wheel" | "millionaire" | "flag-quiz" | "capitals"
  | "letrly" | "rocket" | "tug" | "maraqui" | "hack"
  | null;

export interface SanitizedGameQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface SanitizedSlide {
  index: number;
  kind: string;
  title: string;
  subtitle?: string;
  purpose: string;
  talkingPoints: string[];
  interactionHint: SanitizedInteractionHint;
  /* Phase 3 — when set, the materializer emits a `hasad-game` launcher
     instead of (or in addition to) the default activity scaffold. */
  gameSuggestion: SanitizedGameSuggestion;
  /* Phase 5 — AI-generated complete question set tied to the slide's
     gameSuggestion. Sanitized to MCQ-shape (2–6 options, valid
     correctIndex). Cleared when no gameSuggestion is set. */
  gameQuestions?: SanitizedGameQuestion[];
  activityType?: string;
  strategyStage?: string;
  /* Phase 4 — per-slide design intelligence. AI-picked theme key from
     the 15-theme registry. Validated against `isKnownThemeKey`;
     unknown values fall through to the deck's default theme. */
  slideTheme?: string;
  visualDirection: SanitizedVisualDirection;
  source?: string;
}

export interface SanitizedFlowEntry {
  stage: "opener" | "concept" | "practice" | "closure";
  slideIndices: number[];
  estimatedMinutes: number;
}

export interface SanitizedOutline {
  language: OutlineLanguage;
  density: OutlineDensity;
  totalEstimatedMinutes: number;
  objectives: string[];
  teachingFlow: SanitizedFlowEntry[];
  slides: SanitizedSlide[];
}

type RawRecord = Record<string, unknown>;
type Stage = SanitizedFlowEntry["stage"];

const ALLOWED_KINDS = new Set([
  "title", "objectives", "concept-card", "comparison", "visual-hero",
  "steps", "interactive", "closure", "timeline", "formula",
  /* Presentation-director kinds — keep in sync with
     outlineSlideKindSchema in routes/ai-presentations.ts and the
     OutlineSlideKind enum in lib/api-spec/openapi.yaml. */
  "stat", "quote", "callout",
]);
const ALLOWED_STAGES = new Set<Stage>(["opener", "concept", "practice", "closure"]);
const ALLOWED_INTERACTION = new Set(["poll", "quiz", "discussion", "activity"]);
const ALLOWED_GAMES = new Set<NonNullable<SanitizedGameSuggestion>>([
  "kahoot", "wheel", "millionaire", "flag-quiz", "capitals",
  "letrly", "rocket", "tug", "maraqui", "hack",
]);
const ALLOWED_ACTIVITY_TYPES = new Set([
  "word_cloud", "discussion_wall", "live_poll", "quick_quiz",
  "tug_war", "wheel_spin", "rocket_race", "millionaire_quiz", "hack_challenge",
]);
const ALLOWED_SHAPE = new Set<SanitizedVisualDirection["shape"]>([
  "rect", "circle", "line", "arrow", "divider",
]);

/* Deterministic Fisher–Yates shuffle of an MCQ's options. The seed is
   derived from the prompt text so the same question always renders
   the same shuffle (no flicker between teacher control + student
   screens). Returns the new options array plus the relocated index
   of the correct answer. */
function shuffleOptionsDeterministic(
  options: string[],
  correctIndex: number,
  seedText: string,
): { options: string[]; correctIndex: number } {
  if (options.length <= 1) return { options, correctIndex };
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) {
    seed = ((seed << 5) - seed + seedText.charCodeAt(i)) | 0;
  }
  /* mulberry32 PRNG — small, fast, deterministic. */
  let state = (seed >>> 0) || 1;
  const rand = () => {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pairs = options.map((o, i) => ({ o, isCorrect: i === correctIndex }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const newCorrect = pairs.findIndex((p) => p.isCorrect);
  return {
    options: pairs.map((p) => p.o),
    correctIndex: newCorrect >= 0 ? newCorrect : 0,
  };
}

function asRecord(v: unknown): RawRecord {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as RawRecord) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/* Strip HTML/script markup, control chars, and zero-width characters
   from untrusted free text before persisting. Belt-and-suspenders for
   downstream consumers that may render in non-React contexts (PPTX
   export, PDF, server-rendered email). */
export function sanitizeText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")        // HTML tags
    .replace(/<!--[\s\S]*?-->/g, "")           // HTML comments
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "") // control chars
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "") // zero-width / bidi
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clipStr(v: unknown, max: number): string {
  return sanitizeText(v, max);
}

/* Token-set Jaccard similarity in [0,1]. Used to detect near-duplicate
   talking points / objectives that the model loves to emit. */
export function similarity(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

const SIMILARITY_THRESHOLD = 0.8;

function dedupeBySimilarity(
  items: string[],
  onDrop: (kept: string, dropped: string) => void,
): string[] {
  const kept: string[] = [];
  for (const item of items) {
    const dup = kept.find((k) => similarity(k, item) > SIMILARITY_THRESHOLD);
    if (dup) {
      onDrop(dup, item);
      continue;
    }
    kept.push(item);
  }
  return kept;
}

function wordsOf(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function containsBanned(s: string, lang: OutlineLanguage): string | null {
  const lower = s.toLowerCase().replace(/\s+/g, " ").trim();
  for (const phrase of bannedPhrasesFor(lang)) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

function hasDigit(s: string): boolean {
  // ASCII + Arabic-Indic digits.
  return /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(s);
}

export function sanitizeOutline(
  raw: unknown,
  brief: OutlineBrief,
): { outline: SanitizedOutline; report: GuardrailReport } {
  const feedback: string[] = [];
  const lim = densityLimits(brief.density);
  const r = asRecord(raw);

  /* Objectives — drop banned, exact-dedup, similarity-dedup, cap to 6. */
  const objSeen = new Set<string>();
  const objectivesPre = asArray(r.objectives)
    .map((s) => clipStr(s, 140))
    .filter((s) => {
      if (!s) return false;
      const banned = containsBanned(s, brief.language);
      if (banned) {
        feedback.push(`Objective dropped (banned phrase: "${banned}")`);
        return false;
      }
      const key = s.toLowerCase();
      if (objSeen.has(key)) return false;
      objSeen.add(key);
      return true;
    });
  const objectives = dedupeBySimilarity(objectivesPre, (kept, dropped) => {
    feedback.push(`Objective dropped (near-duplicate of "${kept}"): "${dropped}"`);
  }).slice(0, 6);

  /* Slides — coerce per-element shape, enforce density caps, dedup
     titles, drop talking-points violating length / banned / numbers. */
  const titleSeen = new Set<string>();
  const slidesIn = asArray(r.slides).slice(0, brief.slideCount);
  const slides: SanitizedSlide[] = slidesIn.map((s, i): SanitizedSlide => {
    const slide = asRecord(s);
    const kindRaw = typeof slide.kind === "string" ? slide.kind : "";
    const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : "concept-card";

    const titleRaw = clipStr(slide.title, 80);
    let title = titleRaw || (brief.language === "ar" ? `شريحة ${i + 1}` : `Slide ${i + 1}`);
    if (titleSeen.has(title.toLowerCase())) {
      title = `${title} (${i + 1})`;
      feedback.push(`Slide ${i + 1} title duplicated → suffixed.`);
    }
    titleSeen.add(title.toLowerCase());

    const purpose = clipStr(slide.purpose, 140) || "—";
    const subtitle = lim.allowSubtitle ? (clipStr(slide.subtitle, 80) || undefined) : undefined;
    const sourceField = clipStr(slide.source, 200) || undefined;
    const slideHasSource = !!sourceField;

    const tpRaw = asArray(slide.talkingPoints)
      .map((p) => clipStr(p, 140))
      .filter((p) => p.length > 0);
    const tpDeduped = dedupeBySimilarity(tpRaw, (kept, dropped) => {
      feedback.push(`Slide ${i + 1}: talking point dropped (near-duplicate of "${kept}"): "${dropped}"`);
    });
    let talkingPoints = tpDeduped
      .filter((p) => {
        const banned = containsBanned(p, brief.language);
        if (banned) {
          feedback.push(`Slide ${i + 1}: talking point dropped (banned: "${banned}")`);
          return false;
        }
        if (hasDigit(p) && !slideHasSource) {
          feedback.push(`Slide ${i + 1}: numeric talking point dropped (no source)`);
          return false;
        }
        if (wordsOf(p) > lim.maxWordsPerPoint) {
          feedback.push(`Slide ${i + 1}: talking point exceeds ${lim.maxWordsPerPoint} words for ${brief.density}.`);
          return false;
        }
        return true;
      });
    if (talkingPoints.length > lim.maxPoints) talkingPoints = talkingPoints.slice(0, lim.maxPoints);
    while (talkingPoints.length < lim.minPoints) {
      talkingPoints.push("...");
    }

    /* interactionHint enforcement vs brief toggles.
       activities=false ⇒ all hints null.
       activities=true  ⇒ remap disallowed hints to closest allowed bucket. */
    let interactionHint: SanitizedInteractionHint = null;
    const rawHint = typeof slide.interactionHint === "string" ? slide.interactionHint : "";
    if (rawHint && ALLOWED_INTERACTION.has(rawHint)) {
      if (!brief.toggles.activities) {
        feedback.push(`Slide ${i + 1}: interactionHint cleared (activities disabled).`);
      } else {
        const toggleAllows: Record<string, boolean> = {
          poll:       brief.toggles.poll,
          quiz:       brief.toggles.quiz,
          discussion: brief.toggles.questions,
          activity:   true,
        };
        let mapped: SanitizedInteractionHint;
        if (toggleAllows[rawHint]) mapped = rawHint as SanitizedInteractionHint;
        else if (rawHint === "poll" && brief.toggles.quiz) mapped = "quiz";
        else if (rawHint === "quiz" && brief.toggles.poll) mapped = "poll";
        else if ((rawHint === "poll" || rawHint === "quiz") && brief.toggles.questions) mapped = "discussion";
        else mapped = "activity";
        interactionHint = mapped;
        if (mapped !== rawHint) {
          feedback.push(`Slide ${i + 1}: interactionHint mapped (${rawHint} → ${mapped}).`);
        }
      }
    }

    const vd = asRecord(slide.visualDirection);
    const visualDirection: SanitizedVisualDirection = {};
    const icon = clipStr(vd.icon, 40);
    if (icon) visualDirection.icon = icon;
    if (typeof vd.shape === "string" && ALLOWED_SHAPE.has(vd.shape as SanitizedVisualDirection["shape"])) {
      visualDirection.shape = vd.shape as SanitizedVisualDirection["shape"];
    }
    const layoutHint = clipStr(vd.layoutHint, 40);
    if (layoutHint) visualDirection.layoutHint = layoutHint;

    /* gameSuggestion — only honoured when activities are enabled.
       Anything outside the allowed set silently becomes null so the
       materializer falls back to the default activity scaffold. */
    let gameSuggestion: SanitizedGameSuggestion = null;
    const rawGame = typeof slide.gameSuggestion === "string" ? slide.gameSuggestion : "";
    if (rawGame && ALLOWED_GAMES.has(rawGame as NonNullable<SanitizedGameSuggestion>)) {
      if (brief.toggles.activities) {
        gameSuggestion = rawGame as SanitizedGameSuggestion;
      } else {
        feedback.push(`Slide ${i + 1}: gameSuggestion cleared (activities disabled).`);
      }
    } else if (rawGame) {
      feedback.push(`Slide ${i + 1}: unknown gameSuggestion "${rawGame}" — cleared.`);
    }

    /* gameQuestions — Phase 7. Sanitize the AI-generated question set
       for the slide. Each entry must be a well-formed MCQ (2–6
       options, valid correctIndex). Drop malformed entries silently;
       cap total at 12. As of Phase 7 we accept gameQuestions even
       when gameSuggestion is null — questions are slide-native
       content and no longer require picking a named platform game.
       We still gate the whole thing on the activities toggle so the
       teacher can opt out. */
    let gameQuestions: SanitizedGameQuestion[] | undefined;
    if (brief.toggles.activities) {
      const rawQs = asArray((slide as RawRecord).gameQuestions);
      const cleaned: SanitizedGameQuestion[] = [];
      for (const q of rawQs) {
        if (cleaned.length >= 12) break;
        const qr = asRecord(q);
        const qPrompt = clipStr(qr.prompt, 500);
        if (!qPrompt) continue;
        const optsIn = asArray(qr.options).map((o) => clipStr(o, 200)).filter(Boolean);
        if (optsIn.length < 2 || optsIn.length > 6) continue;
        const ci = Number(qr.correctIndex);
        if (!Number.isInteger(ci) || ci < 0 || ci >= optsIn.length) continue;
        /* Shuffle options so the correct answer doesn't always land in
           slot A. Models heavily bias `correctIndex: 0` in their
           examples; without this, every overlay tile A is correct,
           which gives the game away and looks unprofessional. We use
           a deterministic shuffle seeded by the question prompt so
           re-renders are stable. */
        const shuffled = shuffleOptionsDeterministic(optsIn, ci, qPrompt);
        cleaned.push({ prompt: qPrompt, options: shuffled.options, correctIndex: shuffled.correctIndex });
      }
      if (cleaned.length > 0) {
        gameQuestions = cleaned;
      } else if (rawQs.length > 0) {
        feedback.push(`Slide ${i + 1}: gameQuestions empty or malformed — slide will show no questions.`);
      }
    }

    /* slideTheme — Phase 4. Drop unknown values silently so the
       materializer falls back to the deck-default theme rather than
       failing the build for a config glitch. */
    let slideTheme: string | undefined;
    const rawTheme = typeof slide.slideTheme === "string" ? slide.slideTheme.trim() : "";
    if (rawTheme && isKnownThemeKey(rawTheme)) {
      slideTheme = rawTheme;
    } else if (rawTheme) {
      feedback.push(`Slide ${i + 1}: unknown slideTheme "${rawTheme}" — using deck default.`);
    }

    const out: SanitizedSlide = {
      index: i + 1,
      kind,
      title,
      purpose,
      talkingPoints,
      interactionHint,
      gameSuggestion,
      visualDirection,
    };
    if (subtitle) out.subtitle = subtitle;
    if (sourceField) out.source = sourceField;
    if (slideTheme) out.slideTheme = slideTheme;
    if (gameQuestions && gameQuestions.length > 0) out.gameQuestions = gameQuestions;
    const rawActivityType = clipStr((slide as RawRecord).activityType, 40);
    if (rawActivityType && ALLOWED_ACTIVITY_TYPES.has(rawActivityType)) out.activityType = rawActivityType;
    const rawStrategyStage = clipStr((slide as RawRecord).strategyStage, 60);
    if (rawStrategyStage) out.strategyStage = rawStrategyStage;
    return out;
  });

  /* Teaching flow — must cover every slide index exactly once across
     the 4 fixed stages. Rebuilt from defaults if malformed. */
  const flowIn = asArray(r.teachingFlow);
  const allIndices = slides.map((s) => s.index);
  let teachingFlow: SanitizedFlowEntry[] | null = null;

  if (flowIn.length === 4) {
    const flowEntries = flowIn.map(asRecord);
    const stages = flowEntries.map((f) => f.stage);
    const stagesOk =
      stages.every((s): s is Stage => typeof s === "string" && ALLOWED_STAGES.has(s as Stage)) &&
      new Set(stages).size === 4;

    if (stagesOk) {
      const seen = new Set<number>();
      const flowCandidate: SanitizedFlowEntry[] = flowEntries.map((f) => {
        const indices = asArray(f.slideIndices)
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n >= 1 && n <= slides.length && !seen.has(n))
          .map((n) => { seen.add(n); return n; });
        const minutes = Math.max(1, Math.floor(Number(f.estimatedMinutes) || 1));
        return { stage: f.stage as Stage, slideIndices: indices, estimatedMinutes: minutes };
      });
      const leftover = allIndices.filter((n) => !seen.has(n));
      if (leftover.length > 0) {
        const conceptIdx = flowCandidate.findIndex((f) => f.stage === "concept");
        if (conceptIdx >= 0) {
          flowCandidate[conceptIdx].slideIndices.push(...leftover);
          flowCandidate[conceptIdx].slideIndices.sort((a, b) => a - b);
          feedback.push(`Teaching flow: ${leftover.length} slide(s) appended to "concept".`);
        }
      }
      const allCovered =
        flowCandidate.reduce((sum, f) => sum + f.slideIndices.length, 0) === slides.length;
      if (allCovered) teachingFlow = flowCandidate;
    }
  }

  if (!teachingFlow) {
    feedback.push("Teaching flow rebuilt from default split.");
    teachingFlow = defaultTeachingFlow(slides.length, brief.durationMinutes);
  }

  const totalEstimatedMinutes = Math.max(
    1,
    Math.floor(Number(r.totalEstimatedMinutes) || brief.durationMinutes),
  );

  const outline: SanitizedOutline = {
    language: brief.language,
    density: brief.density,
    totalEstimatedMinutes,
    objectives,
    teachingFlow,
    slides,
  };

  const fatal = slides.length === 0 || objectives.length < 2;
  if (fatal) feedback.push("Outline is too sparse after sanitization.");

  return { outline, report: { feedback, fatal } };
}

/* Default teaching flow: 1 opener, ~60% concept, ~30% practice, 1 closure. */
export function defaultTeachingFlow(
  slideCount: number,
  durationMinutes: number,
): SanitizedFlowEntry[] {
  const indices = Array.from({ length: slideCount }, (_, i) => i + 1);
  const opener = indices.slice(0, 1);
  const closure = indices.slice(-1);
  const middle = indices.slice(1, -1);
  const conceptCount = Math.max(0, Math.ceil(middle.length * 0.6));
  const concept = middle.slice(0, conceptCount);
  const practice = middle.slice(conceptCount);

  const m = (frac: number) => Math.max(1, Math.round(durationMinutes * frac));
  const openerM = m(0.1);
  const conceptM = m(0.5);
  const practiceM = m(0.3);
  const closureM = Math.max(1, durationMinutes - openerM - conceptM - practiceM);

  return [
    { stage: "opener",   slideIndices: opener, estimatedMinutes: openerM },
    { stage: "concept",  slideIndices: concept.length ? concept : (middle.length ? middle : opener), estimatedMinutes: conceptM },
    { stage: "practice", slideIndices: practice.length ? practice : (closure.length ? closure : opener), estimatedMinutes: practiceM },
    { stage: "closure",  slideIndices: closure.length ? closure : opener, estimatedMinutes: closureM },
  ];
}

export function buildRetryMessage(report: GuardrailReport, lang: OutlineLanguage): string {
  if (report.feedback.length === 0) return "";
  const header = lang === "ar"
    ? "أعد توليد المخطط مع تصحيح المشكلات التالية فقط، مع المحافظة على نفس صيغة JSON والطول المطلوب:"
    : "Regenerate the outline correcting the issues below ONLY, keeping the same JSON shape and requested length:";
  return [header, ...report.feedback.slice(0, 8).map((f) => `- ${f}`)].join("\n");
}

export type OutlineDensityName = OutlineDensity;
