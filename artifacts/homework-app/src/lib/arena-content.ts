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
  type: "text" | "image" | "video" | "memory" | "sin-jeem" | "categorize" | "logo";
  difficulty: 200 | 400 | 600;
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

export async function createArenaActivity(body: Partial<DbArenaActivity>): Promise<DbArenaActivity | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arena-content/activities`, {
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

/**
 * Builds virtual ArenaSection objects for selected DB categories so they can
 * be played alongside the static ARENA_SECTIONS. Empty difficulty buckets are
 * filled with the full activity pool to guarantee 6 cards per sub-category.
 */
export function buildDbSections(
  categories: DbArenaCategory[],
  activities: DbArenaActivity[],
  selectedIds: Set<number>,
): { sections: ArenaSection[]; subIdMap: Map<string, number> } {
  const subIdMap = new Map<string, number>();
  // Group categories by parent (root = parentId==null). Each root becomes a section,
  // each child becomes a sub-category. If a root has no children, it becomes both.
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

  const sections: ArenaSection[] = [];
  let coverIdx = 100; // offset so DB sections get distinct palette tones
  for (const root of roots) {
    const children = childrenByParent.get(root.id) ?? [];
    const candidateCats = children.length > 0 ? children : [root];
    const subCategories: ArenaSubCategory[] = [];
    let subCoverIdx = coverIdx;
    for (const cat of candidateCats) {
      if (!selectedIds.has(cat.id)) continue;
      const acts = activitiesByCat.get(cat.id) ?? [];
      if (acts.length === 0) continue;
      const toQ = (a: DbArenaActivity): ArenaQuestion => ({
        q: a.question,
        a: a.answer,
        hint: a.hint ?? undefined,
        type: a.type as ArenaQuestion["type"],
        imageUrl: a.imageUrl ?? undefined,
        videoUrl: a.videoUrl ?? undefined,
        payload: (a.payload as ArenaQuestion["payload"]) ?? undefined,
      });
      const byDiff: Record<ArenaDifficulty, ArenaQuestion[]> = { 200: [], 400: [], 600: [] };
      for (const a of acts) {
        const diff = (a.difficulty as ArenaDifficulty);
        byDiff[diff].push(toQ(a));
      }
      const allQs = acts.map(toQ);
      for (const d of [200, 400, 600] as ArenaDifficulty[]) {
        if (byDiff[d].length === 0) byDiff[d] = allQs;
      }
      const subId = `db-${cat.id}`;
      subIdMap.set(subId, cat.id);
      const cover: ArenaCover = {
        emoji: cat.emoji || "🎯",
        color: cat.coverColor || "#1E4D35",
        gradient: cat.coverGradient || coverForIndex(subCoverIdx).gradient,
        imageUrl: cat.coverImageUrl,
      };
      subCoverIdx++;
      subCategories.push({
        id: subId,
        name: cat.name,
        questions: byDiff,
        cover,
      });
    }
    if (subCategories.length === 0) continue;
    const sectionCover: ArenaCover = {
      emoji: root.emoji || "🎯",
      color: root.coverColor || "#1E4D35",
      gradient: root.coverGradient || coverForIndex(coverIdx).gradient,
      imageUrl: root.coverImageUrl,
    };
    sections.push({
      id: `db-section-${root.id}`,
      name: root.name,
      emoji: root.emoji || "🎯",
      cover: sectionCover,
      subCategories,
    });
    coverIdx++;
  }
  return { sections, subIdMap };
}
