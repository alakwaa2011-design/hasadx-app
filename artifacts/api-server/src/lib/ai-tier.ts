import { db, teachersTable, platformSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SONNET_MODEL } from "./anthropic-client";

export type AiTier = "standard" | "pro" | "claude";

const STANDARD_MODEL = "gpt-4o-mini";
const PRO_MODEL = "gpt-4o";

export function modelForTier(tier: AiTier): string {
  if (tier === "claude") return SONNET_MODEL;
  if (tier === "pro") return PRO_MODEL;
  return STANDARD_MODEL;
}

export function isClaudeTier(tier: AiTier): boolean {
  return tier === "claude";
}

export async function getAvailableTiers(teacherId: number): Promise<AiTier[]> {
  const [t] = await db
    .select({ isAdmin: teachersTable.isAdmin, aiTier: teachersTable.aiTier })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  if (!t) return ["standard"];
  if (t.isAdmin) return ["standard", "pro", "claude"];

  const [ps] = await db
    .select({ proAiForAll: platformSettingsTable.proAiForAll })
    .from(platformSettingsTable)
    .limit(1);

  if (t.aiTier === "claude") return ["standard", "pro", "claude"];
  if (ps?.proAiForAll) return ["standard", "pro"];
  if (t.aiTier === "pro") return ["standard", "pro"];
  return ["standard"];
}

export async function resolveTier(
  teacherId: number,
  requested?: string | null,
): Promise<AiTier> {
  const allowed = await getAvailableTiers(teacherId);
  const want: AiTier | null =
    requested === "claude" ? "claude"
    : requested === "pro" ? "pro"
    : requested === "standard" ? "standard"
    : null;
  if (want && allowed.includes(want)) return want;
  // Default to the highest tier the teacher has access to (claude > pro > standard)
  if (allowed.includes("claude")) return "claude";
  if (allowed.includes("pro")) return "pro";
  return "standard";
}
