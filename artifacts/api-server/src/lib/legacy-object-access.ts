import { pool } from "@workspace/db";

/**
 * Legacy uploads have no trustworthy ownership metadata. Access is granted only
 * when an exact application record belonging to this teacher references the
 * requested path. Object-path knowledge alone is never authorization.
 */
export async function teacherHasLegacyObjectReference(
  teacherId: number,
  objectPath: string,
): Promise<boolean> {
  const result = await pool.query<{ has_reference: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM (
          SELECT object_path AS path
            FROM teacher_library_files
           WHERE teacher_id = $1
          UNION ALL
          SELECT attachment->>'objectPath'
            FROM parent_messages pm
            CROSS JOIN LATERAL jsonb_array_elements(pm.attachments::jsonb) attachment
           WHERE pm.teacher_id = $1
             AND pm.attachments IS NOT NULL
          UNION ALL
          SELECT attachment->>'objectPath'
            FROM parent_message_replies pmr
            JOIN parent_messages pm ON pm.id = pmr.message_id
            CROSS JOIN LATERAL jsonb_array_elements(pmr.attachments::jsonb) attachment
           WHERE pm.teacher_id = $1
             AND pmr.attachments IS NOT NULL
        ) scalar_paths
        WHERE path = $2
        LIMIT 1
      ) AS has_reference
    `,
    [teacherId, objectPath],
  );
  return result.rows[0]?.has_reference === true;
}

/**
 * Parent-owned object paths are authorized only by an exact attachment entry in
 * a thread owned by the current teacher. Other mutable content records can
 * never grant access to a parent upload.
 */
export async function teacherHasParentAttachmentReference(
  teacherId: number,
  objectPath: string,
): Promise<boolean> {
  const result = await pool.query<{ has_reference: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
          FROM parent_messages pm
          CROSS JOIN LATERAL jsonb_array_elements(pm.attachments::jsonb) attachment
         WHERE pm.teacher_id = $1
           AND pm.attachments IS NOT NULL
           AND attachment->>'objectPath' = $2
        UNION ALL
        SELECT 1
          FROM parent_message_replies pmr
          JOIN parent_messages pm ON pm.id = pmr.message_id
          CROSS JOIN LATERAL jsonb_array_elements(pmr.attachments::jsonb) attachment
         WHERE pm.teacher_id = $1
           AND pmr.attachments IS NOT NULL
           AND attachment->>'objectPath' = $2
        LIMIT 1
      ) AS has_reference
    `,
    [teacherId, objectPath],
  );
  return result.rows[0]?.has_reference === true;
}

/**
 * School logos are intentionally embedded in public profile and parent-email
 * surfaces. The privacy write route prevents creating new flat-path references;
 * this lookup preserves only logos already stored as exact legacy references.
 */
export async function hasLegacySchoolLogoReference(
  objectPath: string,
): Promise<boolean> {
  const result = await pool.query<{ has_reference: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
          FROM teachers
         WHERE school_logo = $1
         LIMIT 1
      ) AS has_reference
    `,
    [objectPath],
  );
  return result.rows[0]?.has_reference === true;
}