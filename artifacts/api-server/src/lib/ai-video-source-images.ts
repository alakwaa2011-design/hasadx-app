import sharp from "sharp";
import { sql } from "drizzle-orm";
import { aiVideoProjectsTable, db } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";

export const AI_VIDEO_SOURCE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const AI_VIDEO_SOURCE_IMAGE_MAX_PIXELS = 20_000_000;
export const AI_VIDEO_PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

type SupportedImageFormat = "jpeg" | "png" | "webp";

export class InvalidAiVideoSourceImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiVideoSourceImageError";
  }
}

export async function normalizeAiVideoSourceImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: ".jpg" | ".png" | ".webp";
  width: number;
  height: number;
}> {
  if (buffer.length === 0 || buffer.length > AI_VIDEO_SOURCE_IMAGE_MAX_BYTES) {
    throw new InvalidAiVideoSourceImageError("Image must be between 1 byte and 15MB");
  }

  try {
    const image = sharp(buffer, {
      animated: false,
      failOn: "error",
      limitInputPixels: AI_VIDEO_SOURCE_IMAGE_MAX_PIXELS,
    }).rotate();
    const metadata = await image.metadata();
    const format = metadata.format as SupportedImageFormat | undefined;
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (!format || !["jpeg", "png", "webp"].includes(format)) {
      throw new InvalidAiVideoSourceImageError("Only valid JPEG, PNG, or WebP images are supported");
    }
    if (width <= 0 || height <= 0 || width * height > AI_VIDEO_SOURCE_IMAGE_MAX_PIXELS) {
      throw new InvalidAiVideoSourceImageError("Image dimensions are invalid or too large");
    }

    let normalized: Buffer;
    if (format === "jpeg") {
      normalized = await image.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    } else if (format === "png") {
      normalized = await image.png({ compressionLevel: 9 }).toBuffer();
    } else {
      normalized = await image.webp({ quality: 92 }).toBuffer();
    }
    if (normalized.length > AI_VIDEO_SOURCE_IMAGE_MAX_BYTES) {
      throw new InvalidAiVideoSourceImageError("Normalized image exceeds 15MB");
    }

    return {
      buffer: normalized,
      contentType: format === "jpeg" ? "image/jpeg" : `image/${format}`,
      extension: format === "jpeg" ? ".jpg" : `.${format}`,
      width,
      height,
    };
  } catch (err) {
    if (err instanceof InvalidAiVideoSourceImageError) throw err;
    throw new InvalidAiVideoSourceImageError("File bytes are not a valid supported image");
  }
}

const storage = new ObjectStorageService();

export async function markAiVideoSourceImagesClaimed(paths: string[]): Promise<void> {
  await Promise.all(paths.map(async (path) => {
    const file = await storage.getObjectEntityFile(path);
    const [metadata] = await file.getMetadata();
    const customMetadata = (metadata.metadata ?? {}) as Record<string, string>;
    await file.setMetadata({
      metadata: {
        ...customMetadata,
        aiVideoUploadState: "claimed",
        aiVideoClaimedAt: new Date().toISOString(),
      },
    });
  }));
}

export async function deleteStaleUnclaimedAiVideoSourceImages(
  now: Date = new Date(),
): Promise<number> {
  const files = await storage.listUploadObjects("ai-video");
  let deleted = 0;

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const customMetadata = (metadata.metadata ?? {}) as Record<string, string>;
    if (customMetadata.aiVideoUploadState !== "pending") continue;

    const uploadedAt = Date.parse(customMetadata.aiVideoUploadedAt ?? "");
    if (!Number.isFinite(uploadedAt) || now.getTime() - uploadedAt < AI_VIDEO_PENDING_UPLOAD_TTL_MS) {
      continue;
    }

    const objectPath = storage.toNormalizedObjectPath(file);
    const [reference] = await db.select({ id: aiVideoProjectsTable.id })
      .from(aiVideoProjectsTable)
      .where(sql`${aiVideoProjectsTable.brief} -> 'sourceImages' @> ${JSON.stringify([objectPath])}::jsonb`)
      .limit(1);

    if (reference) {
      await file.setMetadata({
        metadata: {
          ...customMetadata,
          aiVideoUploadState: "claimed",
          aiVideoClaimedAt: now.toISOString(),
        },
      });
      continue;
    }

    await file.delete({ ignoreNotFound: true });
    deleted += 1;
  }

  return deleted;
}