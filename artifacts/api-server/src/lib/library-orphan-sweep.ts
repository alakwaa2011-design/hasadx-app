import {
  db,
  teacherLibraryFilesTable,
  teacherLibraryPendingUploadsTable,
} from "@workspace/db";
import { and, gte, inArray, lt } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";
import { LIBRARY_PENDING_UPLOAD_TTL_MS } from "./library-constants";

const PENDING_UPLOAD_TTL_MS = LIBRARY_PENDING_UPLOAD_TTL_MS;
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 5 * 60 * 1000;
const DB_BATCH_SIZE = 500;

export interface LibraryOrphanSweepResult {
  scanned: number;
  ageEligible: number;
  deleted: number;
  errors: number;
}

export async function sweepOrphanLibraryUploads(): Promise<LibraryOrphanSweepResult> {
  const result: LibraryOrphanSweepResult = {
    scanned: 0,
    ageEligible: 0,
    deleted: 0,
    errors: 0,
  };

  const svc = new ObjectStorageService();
  let files;
  try {
    files = await svc.listUploadObjects();
  } catch (err) {
    logger.error({ err }, "library orphan sweep: failed to list blobs");
    result.errors += 1;
    return result;
  }

  result.scanned = files.length;
  if (files.length === 0) {
    logger.info(result, "library orphan sweep complete");
    return result;
  }

  const cutoff = Date.now() - PENDING_UPLOAD_TTL_MS;
  const candidates: Array<{ file: (typeof files)[number]; objectPath: string }> = [];
  for (const f of files) {
    const created = f.metadata?.timeCreated
      ? new Date(f.metadata.timeCreated as string).getTime()
      : NaN;
    if (Number.isFinite(created) && created < cutoff) {
      const objectPath = svc.toNormalizedObjectPath(f);
      if (objectPath.startsWith("/objects/")) {
        candidates.push({ file: f, objectPath });
      }
    }
  }
  result.ageEligible = candidates.length;
  if (candidates.length === 0) {
    logger.info(result, "library orphan sweep complete");
    return result;
  }

  // Prune expired pending-upload rows so they don't keep blocking sweeps.
  try {
    await db
      .delete(teacherLibraryPendingUploadsTable)
      .where(
        lt(
          teacherLibraryPendingUploadsTable.createdAt,
          new Date(cutoff),
        ),
      );
  } catch (err) {
    logger.error(
      { err },
      "library orphan sweep: failed to prune expired pending uploads",
    );
  }

  const referenced = new Set<string>();
  const pendingCutoff = new Date(cutoff);
  const allPaths = candidates.map((c) => c.objectPath);
  for (let i = 0; i < allPaths.length; i += DB_BATCH_SIZE) {
    const batch = allPaths.slice(i, i + DB_BATCH_SIZE);
    try {
      const [refFiles, refPending] = await Promise.all([
        db
          .select({ objectPath: teacherLibraryFilesTable.objectPath })
          .from(teacherLibraryFilesTable)
          .where(inArray(teacherLibraryFilesTable.objectPath, batch)),
        db
          .select({ objectPath: teacherLibraryPendingUploadsTable.objectPath })
          .from(teacherLibraryPendingUploadsTable)
          .where(
            and(
              inArray(teacherLibraryPendingUploadsTable.objectPath, batch),
              gte(
                teacherLibraryPendingUploadsTable.createdAt,
                pendingCutoff,
              ),
            ),
          ),
      ]);
      for (const row of refFiles) {
        if (row.objectPath) referenced.add(row.objectPath);
      }
      for (const row of refPending) {
        if (row.objectPath) referenced.add(row.objectPath);
      }
    } catch (err) {
      logger.error({ err }, "library orphan sweep: db lookup failed");
      result.errors += 1;
      return result;
    }
  }

  for (const { file, objectPath } of candidates) {
    if (referenced.has(objectPath)) continue;
    try {
      await file.delete({ ignoreNotFound: true });
      result.deleted += 1;
    } catch (err) {
      result.errors += 1;
      logger.error(
        { err, objectPath },
        "library orphan sweep: failed to delete blob",
      );
    }
  }

  logger.info(result, "library orphan sweep complete");
  return result;
}

export function startLibraryOrphanSweepJob(): NodeJS.Timeout {
  const startupHandle = setTimeout(() => {
    void sweepOrphanLibraryUploads().catch((err) => {
      logger.error({ err }, "library orphan sweep: unexpected error");
    });
  }, STARTUP_DELAY_MS);
  if (typeof startupHandle.unref === "function") startupHandle.unref();

  const handle = setInterval(() => {
    void sweepOrphanLibraryUploads().catch((err) => {
      logger.error({ err }, "library orphan sweep: unexpected error");
    });
  }, SWEEP_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();
  return handle;
}
