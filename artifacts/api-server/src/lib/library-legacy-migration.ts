import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { libraryUploadOwnerPrefix } from "./library-constants";
import { isLibraryOwnedUpload } from "./library-orphan-sweep";
import { logger } from "./logger";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

const BATCH_SIZE = 25;
const RETRY_INTERVAL_MS = 60 * 60 * 1000;

export interface LegacyLibraryMigrationRecord {
  fileId: number;
  teacherId: number;
  sourcePath: string;
  targetPath: string | null;
  sourceGeneration: string | null;
  state: "pending" | "copied" | "committed";
}

export interface LegacyLibraryMigrationDeps {
  copy(record: LegacyLibraryMigrationRecord): Promise<{
    objectPath: string;
    sourceGeneration: string;
  }>;
  ensureCopy(
    record: LegacyLibraryMigrationRecord,
    targetPath: string,
    sourceGeneration: string,
  ): Promise<void>;
  commit(record: LegacyLibraryMigrationRecord, targetPath: string): Promise<"committed" | "missing" | "conflict">;
  saveCopy(record: LegacyLibraryMigrationRecord, targetPath: string, sourceGeneration: string): Promise<void>;
  deleteSource(record: LegacyLibraryMigrationRecord, sourceGeneration: string): Promise<void>;
  deleteTarget(record: LegacyLibraryMigrationRecord, targetPath: string): Promise<void>;
  hasSourceReferences(record: LegacyLibraryMigrationRecord): Promise<boolean>;
  defer(record: LegacyLibraryMigrationRecord): Promise<void>;
  block(record: LegacyLibraryMigrationRecord, reason: string): Promise<void>;
  markCommitted(record: LegacyLibraryMigrationRecord): Promise<void>;
  markCleaned(record: LegacyLibraryMigrationRecord): Promise<void>;
}

export async function migrateLegacyLibraryRecord(
  record: LegacyLibraryMigrationRecord,
  deps: LegacyLibraryMigrationDeps,
): Promise<"cleaned" | "skipped"> {
  let targetPath = record.targetPath;
  let sourceGeneration = record.sourceGeneration;
  if (!targetPath || !sourceGeneration) {
    const copied = await deps.copy(record);
    targetPath = copied.objectPath;
    sourceGeneration = copied.sourceGeneration;
    await deps.saveCopy(record, targetPath, sourceGeneration);
  }

  if (record.state !== "committed") {
    await deps.ensureCopy(record, targetPath, sourceGeneration);
    const outcome = await deps.commit(record, targetPath);
    if (outcome === "conflict") {
      await deps.block(record, "library row points to a different object");
      return "skipped";
    }
    if (outcome === "missing") {
      await deps.deleteTarget(record, targetPath);
      await deps.markCommitted(record);
    } else {
      await deps.markCommitted(record);
    }
  }

  if (await deps.hasSourceReferences(record)) {
    await deps.defer(record);
    return "skipped";
  }
  await deps.deleteSource(record, sourceGeneration);
  await deps.markCleaned(record);
  return "cleaned";
}

export async function migrateLegacyLibraryUploads(): Promise<void> {
  const storage = new ObjectStorageService();
  await db.execute(sql`
    INSERT INTO teacher_library_object_migrations
      (file_id, teacher_id, source_path, state)
    SELECT id, teacher_id, object_path, 'pending'
    FROM teacher_library_files
    WHERE source = 'upload'
      AND object_path IS NOT NULL
      AND object_path NOT LIKE '/objects/uploads/teacher-library/%'
    ON CONFLICT (file_id) DO NOTHING
  `);

  const records = (await db.execute(sql`
    SELECT file_id, teacher_id, source_path, target_path, source_generation, state
    FROM teacher_library_object_migrations
    WHERE cleaned_at IS NULL AND blocked_at IS NULL
    ORDER BY updated_at, file_id
    LIMIT ${BATCH_SIZE}
  `)).rows as Array<{
    file_id: number;
    teacher_id: number;
    source_path: string;
    target_path: string | null;
    source_generation: string | null;
    state: LegacyLibraryMigrationRecord["state"];
  }>;

  for (const row of records) {
    const record: LegacyLibraryMigrationRecord = {
      fileId: row.file_id,
      teacherId: row.teacher_id,
      sourcePath: row.source_path,
      targetPath: row.target_path,
      sourceGeneration: row.source_generation,
      state: row.state,
    };
    if (isLibraryOwnedUpload(record.sourcePath)) {
      await db.execute(sql`
        UPDATE teacher_library_object_migrations
        SET cleaned_at = NOW(), updated_at = NOW()
        WHERE file_id = ${record.fileId}
      `);
      continue;
    }
    try {
      await migrateLegacyLibraryRecord(record, {
        copy: () => storage.copyObjectEntityToOwner(
          record.sourcePath,
          libraryUploadOwnerPrefix(record.teacherId),
          `legacy-${record.fileId}`,
        ),
        ensureCopy: async (_record, targetPath, sourceGeneration) => {
          const verified = await storage.copyObjectEntityToOwner(
            record.sourcePath,
            libraryUploadOwnerPrefix(record.teacherId),
            `legacy-${record.fileId}`,
            sourceGeneration,
          );
          if (verified.objectPath !== targetPath) {
            throw new Error("MIGRATION_TARGET_PATH_MISMATCH");
          }
        },
        saveCopy: async (_record, targetPath, sourceGeneration) => {
          await db.execute(sql`
            UPDATE teacher_library_object_migrations
            SET target_path = ${targetPath}, source_generation = ${sourceGeneration},
                state = 'copied', updated_at = NOW()
            WHERE file_id = ${record.fileId} AND cleaned_at IS NULL
          `);
        },
        commit: async (_record, targetPath) => {
          const result = await db.execute(sql`
            UPDATE teacher_library_files
            SET object_path = ${targetPath}
            WHERE id = ${record.fileId}
              AND teacher_id = ${record.teacherId}
              AND object_path = ${record.sourcePath}
            RETURNING id
          `);
          if (result.rows.length > 0) return "committed";
          const current = await db.execute(sql`
            SELECT object_path FROM teacher_library_files
            WHERE id = ${record.fileId} AND teacher_id = ${record.teacherId}
          `);
          if (current.rows.length === 0) return "missing";
          return (current.rows[0] as { object_path: string | null }).object_path === targetPath
            ? "committed"
            : "conflict";
        },
        markCommitted: async () => {
          await db.execute(sql`
            UPDATE teacher_library_object_migrations
            SET state = 'committed', updated_at = NOW()
            WHERE file_id = ${record.fileId}
          `);
        },
        deleteSource: (_record, generation) =>
          storage.deleteObjectEntityGeneration(record.sourcePath, generation).then(() => undefined),
        deleteTarget: (_record, targetPath) =>
          storage.tryDeleteObjectEntity(targetPath).then(() => undefined),
        hasSourceReferences: async () => {
          const references = await db.execute(sql`
            SELECT EXISTS (
              SELECT 1 FROM teacher_library_files
                WHERE object_path = ${record.sourcePath}
              UNION ALL
              SELECT 1
                FROM parent_messages pm
                CROSS JOIN LATERAL jsonb_array_elements(pm.attachments::jsonb) attachment
               WHERE pm.attachments IS NOT NULL
                 AND attachment->>'objectPath' = ${record.sourcePath}
              UNION ALL
              SELECT 1
                FROM parent_message_replies pmr
                CROSS JOIN LATERAL jsonb_array_elements(pmr.attachments::jsonb) attachment
               WHERE pmr.attachments IS NOT NULL
                 AND attachment->>'objectPath' = ${record.sourcePath}
              UNION ALL
              SELECT 1 FROM teachers
                WHERE school_logo = ${record.sourcePath}
              LIMIT 1
            ) AS has_reference
          `);
          return (references.rows[0] as { has_reference: boolean } | undefined)
            ?.has_reference === true;
        },
        defer: async () => {
          await db.execute(sql`
            UPDATE teacher_library_object_migrations
            SET updated_at = NOW()
            WHERE file_id = ${record.fileId} AND cleaned_at IS NULL
          `);
        },
        block: async (_record, reason) => {
          await db.execute(sql`
            UPDATE teacher_library_object_migrations
            SET blocked_at = NOW(), last_error = ${reason}, updated_at = NOW()
            WHERE file_id = ${record.fileId} AND cleaned_at IS NULL
          `);
        },
        markCleaned: async () => {
          await db.execute(sql`
            UPDATE teacher_library_object_migrations
            SET cleaned_at = NOW(), updated_at = NOW()
            WHERE file_id = ${record.fileId}
          `);
        },
      });
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        await db.execute(sql`
          UPDATE teacher_library_object_migrations
          SET blocked_at = NOW(), updated_at = NOW()
          WHERE file_id = ${record.fileId} AND cleaned_at IS NULL
        `);
        logger.warn(
          { fileId: record.fileId },
          "legacy library object migration blocked: source object is missing",
        );
        continue;
      }
      logger.error({ err, fileId: record.fileId }, "legacy library object migration failed");
      await db.execute(sql`
        UPDATE teacher_library_object_migrations
        SET attempt_count = attempt_count + 1,
            last_error = ${err instanceof Error ? err.message.slice(0, 500) : "unknown error"},
            updated_at = NOW()
        WHERE file_id = ${record.fileId} AND cleaned_at IS NULL
      `);
    }
  }
}

export function startLegacyLibraryMigrationJob(): NodeJS.Timeout {
  void migrateLegacyLibraryUploads().catch((err) =>
    logger.error({ err }, "legacy library migration startup failed"),
  );
  const handle = setInterval(() => {
    void migrateLegacyLibraryUploads().catch((err) =>
      logger.error({ err }, "legacy library migration retry failed"),
    );
  }, RETRY_INTERVAL_MS);
  if (typeof handle.unref === "function") handle.unref();
  return handle;
}