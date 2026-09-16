const API_BASE = import.meta.env.VITE_API_URL || "";

export const QUESTION_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export class QuestionImageUploadError extends Error {
  constructor(
    public readonly reason: "unsupported-type" | "too-large" | "request-failed" | "upload-failed",
  ) {
    super(reason);
  }
}

export async function uploadQuestionImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new QuestionImageUploadError("unsupported-type");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new QuestionImageUploadError("too-large");
  }

  const request = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });

  if (!request.ok) {
    throw new QuestionImageUploadError("request-failed");
  }

  const result = await request.json() as {
    uploadURL?: unknown;
    objectPath?: unknown;
  };
  if (
    typeof result.uploadURL !== "string"
    || typeof result.objectPath !== "string"
    || !result.objectPath.startsWith("/objects/")
  ) {
    throw new QuestionImageUploadError("request-failed");
  }

  const upload = await fetch(result.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!upload.ok) {
    throw new QuestionImageUploadError("upload-failed");
  }

  return result.objectPath;
}