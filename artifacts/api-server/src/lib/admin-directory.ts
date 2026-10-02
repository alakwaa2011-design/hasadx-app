import { pool } from "@workspace/db";

export type DirectoryKind = "teachers" | "students" | "activities";
export type ActivitySection = "assignments" | "games" | "video" | "tug" | "memory";
export interface DirectoryOptions {
  page: number;
  pageSize: number;
  q: string;
  section: ActivitySection;
  lookup: boolean;
}

/** Search spelling, not diacritics; LIKE metacharacters remain literal user text. */
export function directorySearchPattern(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ").toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
  return normalized ? `%${normalized.replace(/[\\%_]/g, "\\$&")}%` : "";
}

function searchPredicate(fields: string[]): string {
  return `($1::text = '' OR translate(lower(regexp_replace(concat_ws(' ', ${fields.join(", ")}),
    '[ً-ٰٟۖ-ۭـ]', '', 'g')), 'أإآٱى', 'ااااي') LIKE $1)`;
}

// These identifiers are developer-owned allowlists, never interpolated user input.
const teacherMetrics = [
  ["assignments", "teacher_id", "assignmentCount"],
  ["students", "teacher_id", "studentCount"],
  ["question_bank", "teacher_id", "questionCount"],
  ["solo_challenges", "teacher_id", "soloChallengeCount"],
  ["presentations", "teacher_id", "presentationCount"],
  ["worksheets", "teacher_id", "worksheetCount"],
  ["lesson_plans", "teacher_id", "lessonPlanCount"],
  ["video_lessons", "teacher_id", "videoLessonCount"],
  ["tug_templates", "teacher_id", "tugTemplateCount"],
  ["wheel_templates", "teacher_id", "wheelTemplateCount"],
  ["rocket_templates", "teacher_id", "rocketTemplateCount"],
  ["letrly_puzzles", "creator_teacher_id", "letrlyPuzzleCount"],
  ["content_collections", "teacher_id", "collectionCount"],
] as const;

export function teacherDirectorySql(paginated: boolean, lookup: boolean): string {
  const selection = lookup ? "t.id, t.name, t.email" : `t.id, t.name, t.email, t.phone,
    t.is_admin AS "isAdmin", t.is_blocked AS "isBlocked", t.ai_tier AS "aiTier",
    t.has_pro_design AS "hasProDesign", t.presentations_pro_enabled AS "presentationsProEnabled",
    t.last_login_at AS "lastLoginAt", t.created_at AS "createdAt",
    COALESCE(ts.total_xp, 0)::int AS "totalXp", COALESCE(ts.level, 1)::int AS "xpLevel",
    ts.display_level_override AS "displayLevelOverride"`;
  const selected = `SELECT ${selection} FROM teachers t
    ${lookup ? "" : "LEFT JOIN teacher_stats ts ON ts.teacher_id = t.id"}
    WHERE ${searchPredicate(["t.name", "t.email", "t.phone"])}
    ORDER BY t.created_at DESC, t.id DESC ${paginated ? "LIMIT $2 OFFSET $3" : ""}`;
  if (lookup) return selected;
  // Each content table is aggregated once for the selected teacher IDs, rather
  // than rescanned by one correlated COUNT subquery per teacher.
  return `WITH selected AS MATERIALIZED (${selected})
    SELECT selected.*, ${teacherMetrics.map(([, , field], i) =>
      `COALESCE(m${i}.n, 0)::int AS "${field}"`).join(", ")},
      COALESCE(sub.n, 0)::int AS "submissionCount"
    FROM selected
    ${teacherMetrics.map(([table, column], i) =>
      `LEFT JOIN (SELECT ${column} AS teacher_id, COUNT(*)::int AS n FROM ${table}
       WHERE ${column} IN (SELECT id FROM selected) GROUP BY ${column})
       m${i} ON m${i}.teacher_id = selected.id`).join("\n")}
    LEFT JOIN (SELECT a.teacher_id, COUNT(*)::int AS n FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE a.teacher_id IN (SELECT id FROM selected) GROUP BY a.teacher_id)
      sub ON sub.teacher_id = selected.id
    ORDER BY selected."createdAt" DESC, selected.id DESC`;
}

export async function listLegacyAdminTeachers() {
  const result = await pool.query(teacherDirectorySql(false, false), [""]);
  return result.rows;
}

const activitySources = {
  assignments: {
    table: "assignments", owner: "teacher_id",
    fields: `a.subject, a.is_shared AS "isShared", a.is_adaptive AS "isAdaptive",
      a.exam_mode AS "examMode", a.access_mode AS "accessMode", a.target_class AS "targetClass",
      (SELECT COUNT(*)::int FROM submissions s WHERE s.assignment_id = a.id) AS "submissionCount",
      (SELECT COUNT(*)::int FROM questions q WHERE q.assignment_id = a.id) AS "questionCount"`,
    search: ["a.title", "t.name", "a.subject"],
  },
  games: {
    table: "adventure_games", owner: "teacher_id",
    fields: `a.pin, a.status, a.game_type AS "gameType", a.is_shared AS "isShared"`,
    search: ["a.title", "t.name", "a.pin"],
  },
  video: {
    table: "video_lessons", owner: "teacher_id",
    fields: `a.subject, a.is_published AS "isPublished", a.is_shared AS "isShared", a.video_type AS "videoType"`,
    search: ["a.title", "t.name", "a.subject"],
  },
  tug: {
    table: "tug_templates", owner: "teacher_id",
    fields: "a.duration", search: ["a.title", "t.name"],
  },
  memory: {
    table: "memory_card_sets", owner: "creator_id",
    fields: `a.creator_id AS "creatorId", a.grade_level AS "gradeLevel", a.pin`,
    search: ["a.title", "t.name", "a.grade_level", "a.pin"],
  },
} satisfies Record<ActivitySection, { table: string; owner: string; fields: string; search: string[] }>;

let summaryCache: { expires: number; value: Record<string, number> } | undefined;
let summaryPending: Promise<Record<string, number>> | undefined;
async function activitySummary(): Promise<Record<string, number>> {
  if (summaryCache && summaryCache.expires > Date.now()) return summaryCache.value;
  if (summaryPending) return summaryPending;
  summaryPending = pool.query(`SELECT
    (SELECT COUNT(*)::int FROM assignments) AS "totalAssignments",
    (SELECT COUNT(*)::int FROM adventure_games) AS "totalGames",
    (SELECT COUNT(*)::int FROM video_lessons) AS "totalVideoLessons",
    (SELECT COUNT(*)::int FROM tug_templates) AS "totalTugGames",
    (SELECT COUNT(*)::int FROM memory_card_sets) AS "totalMemorySets",
    (SELECT COUNT(*)::int FROM submissions) AS "totalSubmissions"`).then(result => {
      const value = result.rows[0] as Record<string, number>;
      summaryCache = { expires: Date.now() + 30_000, value };
      return value;
    }).finally(() => { summaryPending = undefined; });
  return summaryPending;
}

export async function listAdminDirectory(kind: DirectoryKind, options: DirectoryOptions) {
  const pattern = directorySearchPattern(options.q);
  let from: string;
  let predicate: string;
  let select: string;
  if (kind === "teachers") {
    from = "teachers t";
    predicate = searchPredicate(["t.name", "t.email", "t.phone"]);
    select = "";
  } else if (kind === "students") {
    from = "students a LEFT JOIN teachers t ON t.id = a.teacher_id";
    predicate = searchPredicate(["a.name", "a.student_class", "t.name", "a.parent_phone"]);
    select = `a.id, a.name, a.student_class AS "studentClass", a.parent_phone AS "parentPhone",
      a.notes, a.teacher_id AS "teacherId", t.name AS "teacherName", a.created_at AS "createdAt"`;
  } else {
    const source = activitySources[options.section];
    from = `${source.table} a LEFT JOIN teachers t ON t.id = a.${source.owner}`;
    predicate = searchPredicate(source.search);
    select = `a.id, a.title, t.name AS "teacherName", a.${source.owner} AS "teacherId",
      a.created_at AS "createdAt", ${source.fields}`;
  }
  const counts = await pool.query(`SELECT COUNT(*)::int AS total FROM ${from} WHERE ${predicate}`, [pattern]);
  const total = counts.rows[0].total as number;
  const totalPages = Math.max(1, Math.ceil(total / options.pageSize));
  const page = Math.min(options.page, totalPages);
  const query = kind === "teachers"
    ? teacherDirectorySql(true, options.lookup)
    : `SELECT ${select} FROM ${from} WHERE ${predicate}
       ORDER BY a.created_at DESC, a.id DESC LIMIT $2 OFFSET $3`;
  const [rows, summary] = await Promise.all([
    pool.query(query, [pattern, options.pageSize, (page - 1) * options.pageSize]),
    kind === "activities" ? activitySummary() : undefined,
  ]);
  return { items: rows.rows, page, pageSize: options.pageSize, total, totalPages,
    ...(summary ? { summary } : {}) };
}