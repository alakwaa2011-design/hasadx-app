import type {
  ArenaDifficulty, ArenaQuestion, ArenaSection, ArenaSubCategory, ArenaCover,
} from "@/data/arena-questions";
import { coverForIndex } from "@/data/arena-questions";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface DbArenaCategory {
  id: number;
  name: string;
  emoji: string;
  coverImageUrl: string | null;
  coverColor: string;
  coverGradient: string | null;
  description: string | null;
  parentId: number | null;
  teacherId: number | null;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbArenaActivity {
  id: number;
  categoryId: number;
  type: "text" | "image" | "video" | "audio" | "memory" | "sin-jeem" | "categorize" | "logo";
  difficulty: 200 | 400 | 600 | 800;
  question: string;
  answer: string;
  hint: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  payload: unknown;
  teacherId: number | null;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
}

export async function fetchArenaCategories(): Promise<DbArenaCategory[]> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/categories`, { credentials: "include" });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function fetchArenaActivities(categoryIds: number[]): Promise<DbArenaActivity[]> {
  if (categoryIds.length === 0) return [];
  try {
    const r = await fetch(
      `${API_BASE}/api/arena-content/activities?categoryIds=${categoryIds.join(",")}`,
      { credentials: "include" },
    );
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function createArenaCategory(body: Partial<DbArenaCategory>): Promise<DbArenaCategory | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/categories`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function updateArenaCategory(id: number, body: Partial<DbArenaCategory>): Promise<DbArenaCategory | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/categories/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function deleteArenaCategory(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/categories/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface ArenaImportSources {
  manual: boolean;
  ai: boolean;
  homework: boolean;
  file: boolean;
}

export async function fetchArenaImportSources(): Promise<ArenaImportSources> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/import-sources`, { credentials: "include" });
    if (!r.ok) return { manual: true, ai: true, homework: false, file: false };
    return await r.json();
  } catch {
    return { manual: true, ai: true, homework: false, file: false };
  }
}

export interface AiGeneratedQuestion {
  q: string;
  a: string;
  difficulty: 200 | 400 | 600 | 800;
  hint?: string | null;
}

export async function aiGenerateArenaQuestions(input: {
  topic: string;
  count: number;
  includeBonus800: boolean;
  language?: "ar" | "en";
  notes?: string;
}): Promise<{ questions: AiGeneratedQuestion[]; error?: string }> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/ai-generate-questions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return { questions: [], error: j?.error || `HTTP ${r.status}` };
    }
    const j = await r.json();
    return { questions: Array.isArray(j?.questions) ? j.questions : [] };
  } catch (e) {
    return { questions: [], error: (e as Error).message };
  }
}

export async function createArenaActivity(
  body: Partial<DbArenaActivity>,
  source: "manual" | "ai" | "homework" | "file" = "manual",
): Promise<DbArenaActivity | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/activities?source=${source}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function updateArenaActivity(id: number, body: Partial<DbArenaActivity>): Promise<DbArenaActivity | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/activities/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function deleteArenaActivity(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/activities/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    return r.ok;
  } catch {
    return false;
  }
}

/* ─────────────────── Question reports ─────────────────── */

export interface ArenaQuestionReport {
  id: number;
  categoryId: number | null;
  activityId: number | null;
  subCategoryId: string | null;
  difficulty: number | null;
  questionType: string | null;
  questionText: string;
  currentAnswer: string;
  suggestedAnswer: string | null;
  note: string;
  reporterTeacherId: number | null;
  reporterName: string | null;
  status: "open" | "resolved" | "dismissed";
  resolvedByTeacherId: number | null;
  resolvedAt: string | null;
  adminNote: string | null;
  createdAt: string;
}

export interface SubmitArenaReportInput {
  categoryId?: number | null;
  activityId?: number | null;
  subCategoryId?: string | null;
  difficulty?: number | null;
  questionType?: string | null;
  questionText: string;
  currentAnswer: string;
  suggestedAnswer?: string | null;
  note: string;
}

export async function submitArenaReport(input: SubmitArenaReportInput): Promise<ArenaQuestionReport | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/reports`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function fetchArenaReports(status?: "open" | "resolved" | "dismissed"): Promise<ArenaQuestionReport[]> {
  try {
    const url = status
      ? `${API_BASE}/api/arena-content/reports?status=${status}`
      : `${API_BASE}/api/arena-content/reports`;
    const r = await fetch(url, { credentials: "include" });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function updateArenaReport(
  id: number,
  patch: { status?: "open" | "resolved" | "dismissed"; adminNote?: string | null },
): Promise<ArenaQuestionReport | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/reports/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function deleteArenaReport(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/reports/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function uploadImageFile(file: File): Promise<string | null> {
  try {
    const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!reqRes.ok) return null;
    const { uploadURL, objectPath } = await reqRes.json();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) return null;
    return `${API_BASE}/api${objectPath}`;
  } catch {
    return null;
  }
}

/** Upload an audio file (mp3/ogg/wav/m4a/webm) — reuses the same presigned-URL flow. */
export async function uploadAudioFile(file: File): Promise<string | null> {
  try {
    const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!reqRes.ok) return null;
    const { uploadURL, objectPath } = await reqRes.json();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) return null;
    return `${API_BASE}/api${objectPath}`;
  } catch {
    return null;
  }
}

/**
 * Maps DB parent-section names to their matching static ARENA_SECTIONS id.
 * Sub-categories under these parents are injected into the static section
 * instead of appearing as a separate "library" section.
 */
export const DB_PARENT_TO_STATIC_SECTION: Record<string, string> = {
  "أنبياء ورسل": "islamic",
  "صحابة وتابعون": "islamic",
  "قصص قرآنية": "islamic",
  "عواصم ودول": "general",
  "الأعلام والشخصيات": "history",
  "علم الفلك والفضاء": "technology",
  "الطب والصحة": "life",
  "السيارات والمركبات": "brands",
  "الطعام والمطبخ": "life",
  "أمثال وحكم": "arabic",
  // Extended static sections
  "واجهة الأطفال": "kids",
  "سؤال الصورة": "picture-q",
  "المنهج الدراسي": "curriculum",
  "رمضان": "ramadan",
  "السينما العربية": "cinema-arabic",
  "مطابخ العالم": "world-cuisine",
  "السيارات والمحركات": "cars-engines",
  "الفضاء والكواكب": "space-planets",
};

/**
 * Builds virtual ArenaSection objects for selected DB categories so they can
 * be played alongside the static ARENA_SECTIONS. Empty difficulty buckets are
 * filled with the full activity pool to guarantee 6 cards per sub-category.
 *
 * Sub-categories whose parent section maps to a static section via
 * DB_PARENT_TO_STATIC_SECTION are returned in `mergedSubsByStaticId` for
 * injection into the static section. The remaining DB roots become standalone
 * sections returned in `sections`.
 */
export function buildDbSections(
  categories: DbArenaCategory[],
  activities: DbArenaActivity[],
  selectedIds: Set<number>,
): { sections: ArenaSection[]; mergedSubsByStaticId: Record<string, ArenaSubCategory[]>; subIdMap: Map<string, number> } {
  const subIdMap = new Map<string, number>();
  const roots = categories.filter(c => c.parentId == null);
  const childrenByParent = new Map<number, DbArenaCategory[]>();
  for (const c of categories) {
    if (c.parentId != null) {
      const arr = childrenByParent.get(c.parentId) ?? [];
      arr.push(c);
      childrenByParent.set(c.parentId, arr);
    }
  }
  const activitiesByCat = new Map<number, DbArenaActivity[]>();
  for (const a of activities) {
    const arr = activitiesByCat.get(a.categoryId) ?? [];
    arr.push(a);
    activitiesByCat.set(a.categoryId, arr);
  }

  const toQ = (a: DbArenaActivity): ArenaQuestion => ({
    q: a.question,
    a: a.answer,
    hint: a.hint ?? undefined,
    type: a.type as ArenaQuestion["type"],
    imageUrl: a.imageUrl ?? undefined,
    videoUrl: a.videoUrl ?? undefined,
    payload: (a.payload as ArenaQuestion["payload"]) ?? undefined,
  });

  const buildSubCats = (
    candidateCats: DbArenaCategory[],
    parentColor: string,
    parentGradient: string | null,
    coverIdxStart: number,
  ): ArenaSubCategory[] => {
    const subs: ArenaSubCategory[] = [];
    let subCoverIdx = coverIdxStart;
    for (const cat of candidateCats) {
      if (!selectedIds.has(cat.id)) continue;
      const acts = activitiesByCat.get(cat.id) ?? [];
      if (acts.length === 0) continue;
      const byDiff: Record<ArenaDifficulty, ArenaQuestion[]> = { 200: [], 400: [], 600: [], 800: [] };
      for (const a of acts) byDiff[a.difficulty as ArenaDifficulty].push(toQ(a));
      const allQs = acts.map(toQ);
      for (const d of [200, 400, 600, 800] as ArenaDifficulty[]) {
        if (byDiff[d].length === 0) byDiff[d] = allQs;
      }
      const subId = `db-${cat.id}`;
      subIdMap.set(subId, cat.id);
      subs.push({
        id: subId,
        name: cat.name,
        questions: byDiff,
        cover: {
          emoji: cat.emoji || "🎯",
          color: cat.coverColor || parentColor,
          gradient: cat.coverGradient || parentGradient || coverForIndex(subCoverIdx).gradient,
          imageUrl: cat.coverImageUrl,
        },
      });
      subCoverIdx++;
    }
    return subs;
  };

  const sections: ArenaSection[] = [];
  const mergedSubsByStaticId: Record<string, ArenaSubCategory[]> = {};
  let coverIdx = 100;

  for (const root of roots) {
    const children = childrenByParent.get(root.id) ?? [];
    const candidateCats = children.length > 0 ? children : [root];
    const staticTarget = DB_PARENT_TO_STATIC_SECTION[root.name];

    if (staticTarget) {
      // Inject into matching static section
      const subs = buildSubCats(candidateCats, root.coverColor, root.coverGradient, coverIdx);
      if (subs.length > 0) {
        const existing = mergedSubsByStaticId[staticTarget] ?? [];
        mergedSubsByStaticId[staticTarget] = [...existing, ...subs];
        coverIdx += subs.length;
      }
    } else {
      // No mapping → standalone DB section
      const subs = buildSubCats(candidateCats, root.coverColor, root.coverGradient, coverIdx);
      if (subs.length > 0) {
        sections.push({
          id: `db-section-${root.id}`,
          name: root.name,
          emoji: root.emoji || "🎯",
          cover: {
            emoji: root.emoji || "🎯",
            color: root.coverColor || "#1E4D35",
            gradient: root.coverGradient || coverForIndex(coverIdx).gradient,
            imageUrl: root.coverImageUrl,
          },
          subCategories: subs,
        });
        coverIdx++;
      }
    }
  }

  return { sections, mergedSubsByStaticId, subIdMap };
}
