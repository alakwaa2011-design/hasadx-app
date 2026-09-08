import { db, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** AI video production is internal-only. Read current privileges, not session claims. */
export async function hasAiVideoAdminAccess(teacherId: number): Promise<boolean> {
  const [teacher] = await db.select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  return teacher?.isAdmin === true;
}