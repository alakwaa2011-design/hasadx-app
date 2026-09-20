export const LIBRARY_PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const LIBRARY_UPLOAD_OWNER_PREFIX = "teacher-library";

export function libraryUploadOwnerPrefix(teacherId: number): string {
  return `${LIBRARY_UPLOAD_OWNER_PREFIX}/${teacherId}`;
}
