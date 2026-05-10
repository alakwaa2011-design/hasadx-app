import { db, teachersTable, platformSettingsTable, presentationsTable, presentationAssetsTable } from "@workspace/db";
import { DEFAULT_PRESENTATION_LIMITS, type PresentationLimits } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export interface PresentationTier {
  isPro: boolean;
  isAdmin: boolean;
  limits: PresentationLimits;
}

export interface PresentationUsage {
  slides: number;
  images: number;
  files: number;
  sizeMb: number;
}

/* Resolve the effective presentations tier for a teacher. A teacher
   is "pro" if they have the per-teacher flag, OR the global flag is
   on, OR they're an admin. Admin always sees uncapped values via
   `Number.POSITIVE_INFINITY`-style sentinels — but we keep the raw
   limits payload so the UI can still show "—" for pro users. */
export async function resolvePresentationsTier(teacherId: number): Promise<PresentationTier> {
  const [teacher] = await db
    .select({
      isAdmin: teachersTable.isAdmin,
      proEnabled: teachersTable.presentationsProEnabled,
    })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  const [settings] = await db
    .select({
      forAll: platformSettingsTable.presentationsProForAll,
      limits: platformSettingsTable.presentationLimits,
    })
    .from(platformSettingsTable)
    .limit(1);

  const isAdmin = !!teacher?.isAdmin;
  const isPro = !!(isAdmin || teacher?.proEnabled || settings?.forAll);
  const limits = settings?.limits ?? DEFAULT_PRESENTATION_LIMITS;
  return { isPro, isAdmin, limits };
}

/* Compute current usage for a single presentation: slide count from
   the JSONB column, image-element count, and registered-asset bytes
   so the editor can show live "X / Y" counters. */
export async function getPresentationUsage(presentationId: number): Promise<PresentationUsage> {
  const [deck] = await db
    .select({ slides: presentationsTable.slides })
    .from(presentationsTable)
    .where(eq(presentationsTable.id, presentationId))
    .limit(1);

  const slidesArr = Array.isArray(deck?.slides) ? (deck!.slides as Array<Record<string, unknown>>) : [];
  let images = 0;
  for (const s of slidesArr) {
    const els = Array.isArray(s.elements) ? (s.elements as Array<{ kind?: string }>) : [];
    for (const el of els) if (el?.kind === "image") images += 1;
  }

  const [agg] = await db
    .select({
      files: sql<number>`COALESCE(SUM(CASE WHEN ${presentationAssetsTable.kind} = 'file' THEN 1 ELSE 0 END), 0)::int`,
      bytes: sql<number>`COALESCE(SUM(${presentationAssetsTable.byteSize}), 0)::bigint`,
    })
    .from(presentationAssetsTable)
    .where(eq(presentationAssetsTable.presentationId, presentationId));

  const totalBytes = Number(agg?.bytes ?? 0);
  return {
    slides: slidesArr.length,
    images,
    files: Number(agg?.files ?? 0),
    sizeMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
  };
}
