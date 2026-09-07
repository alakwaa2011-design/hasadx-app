import { db } from "@workspace/db";
import { kidsActivitySchema, type KidsActivity, type KidsActivityType } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

export const KIDS_CATALOG_VERSION = "kids-catalog-v3";

type KidsCatalogActivity = {
  skillSlug: "arabic-letter-recognition" | "english-basic-phonics" | "numbers-0-20";
  slug: string;
  titleAr: string;
  assetKey: string;
  sortOrder: number;
  content: KidsActivity;
};

const arabicLetters = ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"];
const englishLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const numberedPieces = (labels: readonly string[]) => labels.map((label, correctPosition) => ({
  id: `piece-${correctPosition}`,
  label,
  correctPosition,
}));
const letterPairs = (letters: readonly string[]) => letters.map((letter, index) => ({
  id: `pair-${index}`,
  left: letter,
  right: letter,
}));
const activity = (content: unknown): KidsActivity => kidsActivitySchema.parse(content);

/**
 * Versioned, inspectable seed fixtures. Each skill has three examples and at
 * least two engines; together their declarative content covers every target.
 */
export const KIDS_CATALOG_V2_ACTIVITIES: readonly KidsCatalogActivity[] = [
  {
    skillSlug: "arabic-letter-recognition", slug: "arabic-letter-match", titleAr: "رتّب الحروف", assetKey: "kids/activities/arabic-order-01-20", sortOrder: 1,
    content: activity({ id: "arabic-order-01-20", type: "ordering_puzzle", skillId: "arabic-letter-recognition", title: "رتّب الحروف العربية", instructions: "رتّب الحروف بالترتيب.", exampleId: "arabic-order-first-20", prompt: "ما ترتيب الحروف؟", pieces: numberedPieces(arabicLetters.slice(0, 20)) }),
  },
  {
    skillSlug: "arabic-letter-recognition", slug: "arabic-match-21-28", titleAr: "طابق الحروف", assetKey: "kids/activities/arabic-match-21-28", sortOrder: 2,
    content: activity({ id: "arabic-match-21-28", type: "matching", skillId: "arabic-letter-recognition", title: "طابق الحروف العربية", instructions: "صِل الحرف بمثله.", exampleId: "arabic-match-last-8", pairs: letterPairs(arabicLetters.slice(20)) }),
  },
  {
    skillSlug: "arabic-letter-recognition", slug: "arabic-trace-alif", titleAr: "تتبّع الألف", assetKey: "kids/activities/arabic-trace-alif", sortOrder: 3,
    content: activity({ id: "arabic-trace-alif", type: "tracing", skillId: "arabic-letter-recognition", title: "تتبّع حرف الألف", instructions: "تتبّع خط الحرف بإصبعك.", exampleId: "arabic-trace-alif", strokes: [{ id: "alif-stroke", points: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }] }] }),
  },
  {
    skillSlug: "english-basic-phonics", slug: "english-phonics-sounds", titleAr: "رتّب الحروف الإنجليزية", assetKey: "kids/activities/english-order-a-t", sortOrder: 1,
    content: activity({ id: "english-order-a-t", type: "ordering_puzzle", skillId: "english-basic-phonics", title: "Order A to T", instructions: "Put the letters in order.", exampleId: "english-order-a-t", prompt: "What comes next?", pieces: numberedPieces(englishLetters.slice(0, 20)) }),
  },
  {
    skillSlug: "english-basic-phonics", slug: "english-match-u-z", titleAr: "طابق الحروف والأصوات", assetKey: "kids/activities/english-match-u-z", sortOrder: 2,
    content: activity({ id: "english-match-u-z", type: "matching", skillId: "english-basic-phonics", title: "Match U to Z", instructions: "Match each letter to itself.", exampleId: "english-match-u-z", pairs: letterPairs(englishLetters.slice(20)) }),
  },
  {
    skillSlug: "english-basic-phonics", slug: "english-sound-a", titleAr: "استمع واختر", assetKey: "kids/activities/english-sound-a", sortOrder: 3,
    content: activity({ id: "english-sound-a", type: "media_choice", skillId: "english-basic-phonics", title: "Find the A sound", instructions: "Listen, then choose the letter.", exampleId: "english-sound-a", prompt: "Which letter says /æ/?", promptMedia: { kind: "audio", assetKey: "kids/audio/phonics/a-prompt" }, choices: [
      { id: "a", label: "A", media: { kind: "image", assetKey: "kids/images/letters/a" }, isCorrect: true },
      { id: "e", label: "E", media: { kind: "image", assetKey: "kids/images/letters/e" }, isCorrect: false },
    ] }),
  },
  {
    skillSlug: "numbers-0-20", slug: "numbers-count-0-20", titleAr: "رتّب الأرقام", assetKey: "kids/activities/numbers-order-0-19", sortOrder: 1,
    content: activity({ id: "numbers-order-0-19", type: "ordering_puzzle", skillId: "numbers-0-20", title: "رتّب الأرقام", instructions: "رتّب الأرقام من صفر.", exampleId: "numbers-order-0-19", prompt: "ما ترتيب الأرقام؟", pieces: numberedPieces(Array.from({ length: 20 }, (_, number) => String(number))) }),
  },
  {
    skillSlug: "numbers-0-20", slug: "numbers-count-20", titleAr: "عدّ حتى عشرين", assetKey: "kids/activities/numbers-count-20", sortOrder: 2,
    content: activity({ id: "numbers-count-20", type: "counting", skillId: "numbers-0-20", title: "Count to twenty", instructions: "Count the stars.", exampleId: "numbers-count-20", prompt: "How many stars?", items: Array.from({ length: 20 }, (_, number) => ({ id: `star-${number}`, label: "★" })), correctCount: 20, choices: [0, 10, 19, 20] }),
  },
  {
    skillSlug: "numbers-0-20", slug: "numbers-choose-zero", titleAr: "اختر الصفر", assetKey: "kids/activities/numbers-choose-zero", sortOrder: 3,
    content: activity({ id: "numbers-choose-zero", type: "media_choice", skillId: "numbers-0-20", title: "اختر الصفر", instructions: "استمع، ثم اختر الصفر.", exampleId: "numbers-choose-zero", prompt: "أين الرقم صفر؟", promptMedia: { kind: "audio", assetKey: "kids/audio/numbers/zero-prompt-ar" }, choices: [
      { id: "zero", label: "0", media: { kind: "image", assetKey: "kids/images/numbers/zero" }, isCorrect: true },
      { id: "one", label: "1", media: { kind: "image", assetKey: "kids/images/numbers/one" }, isCorrect: false },
    ] }),
  },
];

const collectAssetKeys = (value: unknown, keys = new Set<string>()): Set<string> => {
  if (typeof value === "string" && value.startsWith("kids/")) keys.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectAssetKeys(entry, keys));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => collectAssetKeys(entry, keys));
  return keys;
};

/** Complete first-party bundle contract shared by catalog validation and asset checks. */
export const KIDS_CATALOG_ASSET_KEYS = Object.freeze([
  "kids/avatars/star",
  "kids/avatars/moon",
  "kids/avatars/rainbow",
  "kids/worlds/arabic-letters",
  "kids/worlds/english-phonics",
  "kids/worlds/numbers",
  ...collectAssetKeys(KIDS_CATALOG_V2_ACTIVITIES),
].sort());

export async function migrateKidsSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS kids_profiles (
      id SERIAL PRIMARY KEY, student_account_id INTEGER NOT NULL UNIQUE REFERENCES student_accounts(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL, avatar_key TEXT NOT NULL DEFAULT 'kids/avatars/star', age_band TEXT NOT NULL DEFAULT '4-5'
        CHECK (age_band IN ('3-4','4-5','5-6')),
      locale TEXT NOT NULL DEFAULT 'ar', created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS kids_worlds (
      id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title_ar TEXT NOT NULL, title_en TEXT NOT NULL,
      description_ar TEXT NOT NULL, icon_key TEXT NOT NULL, sort_order INTEGER NOT NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS kids_skills (
      id SERIAL PRIMARY KEY, world_id INTEGER NOT NULL REFERENCES kids_worlds(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE, title_ar TEXT NOT NULL, title_en TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kids_activities (
      id SERIAL PRIMARY KEY, skill_id INTEGER NOT NULL REFERENCES kids_skills(id) ON DELETE CASCADE, slug TEXT NOT NULL UNIQUE,
      title_ar TEXT NOT NULL, activity_type TEXT NOT NULL, content JSONB NOT NULL, asset_key TEXT NOT NULL,
      sort_order INTEGER NOT NULL, is_published BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS kids_activity_sessions (
      id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL REFERENCES kids_profiles(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES kids_activities(id) ON DELETE CASCADE, idempotency_key TEXT NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP, score INTEGER, status TEXT NOT NULL DEFAULT 'started',
      UNIQUE(profile_id, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS kids_attempts (
      id SERIAL PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES kids_activity_sessions(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL, item_key TEXT NOT NULL, is_correct BOOLEAN NOT NULL, response JSONB,
      activity_type TEXT NOT NULL DEFAULT 'matching', example_id TEXT NOT NULL DEFAULT '', correct_weight INTEGER NOT NULL DEFAULT 0,
      possible_weight INTEGER NOT NULL DEFAULT 1, errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(session_id, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS kids_mastery (
      id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL REFERENCES kids_profiles(id) ON DELETE CASCADE,
      skill_id INTEGER NOT NULL REFERENCES kids_skills(id) ON DELETE CASCADE, correct_count INTEGER NOT NULL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0, mastery_percent INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'not_started',
      review_due_at TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(profile_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS kids_adventure_states (
      profile_id INTEGER PRIMARY KEY REFERENCES kids_profiles(id) ON DELETE CASCADE, stars INTEGER NOT NULL DEFAULT 0,
      current_world_slug TEXT NOT NULL DEFAULT 'arabic-letters', updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS kids_teacher_assignments (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      profile_id INTEGER NOT NULL REFERENCES kids_profiles(id) ON DELETE CASCADE, activity_id INTEGER NOT NULL REFERENCES kids_activities(id) ON DELETE CASCADE,
      due_at TIMESTAMP, completed_at TIMESTAMP, created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(teacher_id, profile_id, activity_id)
    );
    CREATE TABLE IF NOT EXISTS kids_daily_adventures (
      id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL REFERENCES kids_profiles(id) ON DELETE CASCADE,
      adventure_date TEXT NOT NULL, activity_ids JSONB NOT NULL, completed_ids JSONB NOT NULL DEFAULT '[]'::jsonb, started_at TIMESTAMP, completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(profile_id, adventure_date)
    );
    CREATE TABLE IF NOT EXISTS kids_reward_grants (
      id SERIAL PRIMARY KEY, profile_id INTEGER NOT NULL REFERENCES kids_profiles(id) ON DELETE CASCADE,
      session_id INTEGER UNIQUE REFERENCES kids_activity_sessions(id) ON DELETE CASCADE,
      reward_key TEXT NOT NULL, granted_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS kids_adult_gates (
      profile_id INTEGER PRIMARY KEY REFERENCES kids_profiles(id) ON DELETE CASCADE,
      verified_at TIMESTAMP NOT NULL, expires_at TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kids_board_sessions (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
      activity_id INTEGER REFERENCES kids_activities(id) ON DELETE RESTRICT,
      join_code TEXT UNIQUE, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMP NOT NULL DEFAULT NOW(), closed_at TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS kids_board_events (
      id SERIAL PRIMARY KEY, board_session_id INTEGER NOT NULL REFERENCES kids_board_sessions(id) ON DELETE CASCADE,
      profile_id INTEGER REFERENCES kids_profiles(id) ON DELETE SET NULL, event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE kids_profiles ADD COLUMN IF NOT EXISTS age_band TEXT NOT NULL DEFAULT '4-5';
    UPDATE kids_profiles SET age_band = '4-5' WHERE age_band NOT IN ('3-4','4-5','5-6');
    DO $$ BEGIN
      ALTER TABLE kids_profiles ADD CONSTRAINT kids_profiles_age_band_check CHECK (age_band IN ('3-4','4-5','5-6'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    ALTER TABLE kids_attempts ADD COLUMN IF NOT EXISTS activity_type TEXT NOT NULL DEFAULT 'matching',
      ADD COLUMN IF NOT EXISTS example_id TEXT NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS correct_weight INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS possible_weight INTEGER NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS errors JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE kids_mastery ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'not_started',
      ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMP;
    ALTER TABLE kids_daily_adventures ADD COLUMN IF NOT EXISTS completed_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE kids_teacher_assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    WITH ranked AS (
      SELECT id,ROW_NUMBER() OVER (PARTITION BY profile_id,activity_id ORDER BY started_at,id) AS rn
      FROM kids_activity_sessions WHERE status='started'
    )
    UPDATE kids_activity_sessions SET status='abandoned',completed_at=NOW()
    WHERE id IN (SELECT id FROM ranked WHERE rn>1);
    CREATE UNIQUE INDEX IF NOT EXISTS kids_sessions_one_active_activity_uq
      ON kids_activity_sessions(profile_id,activity_id) WHERE status='started';
    ALTER TABLE kids_board_sessions ADD COLUMN IF NOT EXISTS join_code TEXT;
    ALTER TABLE kids_board_sessions ADD COLUMN IF NOT EXISTS activity_id INTEGER REFERENCES kids_activities(id) ON DELETE RESTRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS kids_board_sessions_join_code_uq ON kids_board_sessions(join_code) WHERE join_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS kids_sessions_profile_idx ON kids_activity_sessions(profile_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS kids_assignments_teacher_idx ON kids_teacher_assignments(teacher_id, created_at DESC);
  `);
}

/** First-party catalog only: asset keys are resolved by the Kids client, never remote URLs. */
export async function seedKidsCatalogV1(): Promise<void> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS kids_catalog_versions (version TEXT PRIMARY KEY, seeded_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  const existing = await db.execute(sql`SELECT 1 FROM kids_catalog_versions WHERE version = ${KIDS_CATALOG_VERSION}`);
  if ((existing as unknown as { rows: unknown[] }).rows.length > 0) return;

  await db.execute(sql`
    INSERT INTO kids_worlds (slug, title_ar, title_en, description_ar, icon_key, sort_order)
    VALUES
      ('arabic-letters', 'حروف العربية', 'Arabic letters', 'تعرّف على الحروف العربية وأصواتها.', 'kids/worlds/arabic-letters', 1),
      ('english-phonics', 'الحروف الإنجليزية', 'English phonics', 'الحروف الإنجليزية والأصوات الأساسية.', 'kids/worlds/english-phonics', 2),
      ('numbers-0-20', 'الأرقام', 'Numbers 0–20', 'عدّ الأرقام من صفر إلى عشرين.', 'kids/worlds/numbers', 3)
    ON CONFLICT (slug) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO kids_skills (world_id, slug, title_ar, title_en, sort_order)
    SELECT id, CASE slug
      WHEN 'arabic-letters' THEN 'arabic-letter-recognition'
      WHEN 'english-phonics' THEN 'english-basic-phonics'
      ELSE 'numbers-0-20'
    END, CASE slug
      WHEN 'arabic-letters' THEN 'تمييز الحروف'
      WHEN 'english-phonics' THEN 'الأصوات الأساسية'
      ELSE 'العد من ٠ إلى ٢٠'
    END, CASE slug
      WHEN 'arabic-letters' THEN 'Letter recognition'
      WHEN 'english-phonics' THEN 'Basic phonics'
      ELSE 'Count 0–20'
    END, sort_order
    FROM kids_worlds
    ON CONFLICT (slug) DO NOTHING
  `);
  for (const seed of KIDS_CATALOG_V2_ACTIVITIES) {
    await db.execute(sql`
      INSERT INTO kids_activities (skill_id, slug, title_ar, activity_type, content, asset_key, sort_order)
      SELECT id, ${seed.slug}, ${seed.titleAr}, ${seed.content.type as KidsActivityType},
        ${JSON.stringify(seed.content)}::jsonb, ${seed.assetKey}, ${seed.sortOrder}
      FROM kids_skills WHERE slug = ${seed.skillSlug}
      ON CONFLICT (slug) DO UPDATE SET
        skill_id = EXCLUDED.skill_id,
        title_ar = EXCLUDED.title_ar,
        activity_type = EXCLUDED.activity_type,
        content = EXCLUDED.content,
        asset_key = EXCLUDED.asset_key,
        sort_order = EXCLUDED.sort_order,
        is_published = TRUE
    `);
  }
  // Record completion only after all catalog rows have been written, so a
  // restart after a partial failure safely retries the complete version.
  await db.execute(sql`INSERT INTO kids_catalog_versions (version) VALUES (${KIDS_CATALOG_VERSION}) ON CONFLICT (version) DO NOTHING`);
}