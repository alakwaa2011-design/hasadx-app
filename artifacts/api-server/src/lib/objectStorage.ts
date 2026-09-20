import { Storage, File } from "@google-cloud/storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { createHmac, timingSafeEqual } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(file: File, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers["Content-Length"] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  /* Server-side direct upload of a Buffer (used for AI-generated images). The
     blob is stored under the same private dir as user uploads, then marked
     PUBLIC via the ACL so any teacher viewing the deck can fetch it via
     GET /objects/:entityId. Returns the normalised /objects/... path. */
  async uploadBufferAsPublic(opts: {
    buffer: Buffer;
    contentType: string;
    extension?: string;
  }): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const ext = opts.extension ? (opts.extension.startsWith(".") ? opts.extension : `.${opts.extension}`) : "";
    const fullPath = `${privateObjectDir}/uploads/${objectId}${ext}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(opts.buffer, {
      contentType: opts.contentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=86400" },
    });
    /* Mark public so GET /objects/:id can serve without auth checks. */
    const rawUrl = `https://storage.googleapis.com/${bucketName}/${objectName}`;
    return await this.trySetObjectEntityAclPolicy(rawUrl, {
      owner: "system",
      visibility: "public",
    });
  }

  /* Server-side upload for teacher-owned generated artifacts. Unlike
     uploadBufferAsPublic, this never assigns a public ACL; callers must serve
     the normalized path through an authenticated route. */
  async uploadBufferAsPrivate(opts: {
    buffer: Buffer;
    contentType: string;
    ownerPrefix: string;
    extension?: string;
    customMetadata?: Record<string, string>;
  }): Promise<string> {
    const normalizedPrefix = opts.ownerPrefix.replace(/^\/+|\/+$/g, "");
    if (!normalizedPrefix || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(normalizedPrefix)) {
      throw new Error("Invalid object owner prefix");
    }
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const ext = opts.extension ? (opts.extension.startsWith(".") ? opts.extension : `.${opts.extension}`) : "";
    const fullPath = `${privateObjectDir}/uploads/${normalizedPrefix}/${objectId}${ext}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    await file.save(opts.buffer, {
      contentType: opts.contentType,
      resumable: false,
      metadata: {
        cacheControl: "private, no-store",
        metadata: opts.customMetadata,
      },
    });
    return this.normalizeObjectEntityPath(
      `https://storage.googleapis.com/${bucketName}/${objectName}`,
    );
  }

  async getObjectEntityUploadURL(ownerPrefix?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const normalizedPrefix = ownerPrefix?.replace(/^\/+|\/+$/g, "");
    if (normalizedPrefix && !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(normalizedPrefix)) {
      throw new Error("Invalid object owner prefix");
    }
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${normalizedPrefix ? `${normalizedPrefix}/` : ""}${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  /**
   * Verify an uploaded object's bytes rather than trusting the user supplied
   * Content-Type header.  This deliberately only recognises the formats
   * supported by the upload endpoints.
   */
  async verifyUploadedObject(
    objectPath: string,
    expectedType: string,
    maxBytes: number,
  ): Promise<{
    size: number;
    contentType: string;
    generation: string;
    customMetadata: Record<string, string>;
  }> {
    const verified = await this.inspectUploadedObject(objectPath, expectedType, maxBytes);
    const file = await this.getObjectEntityFile(objectPath);
    await file.setMetadata({
      metadata: {
        ...verified.customMetadata,
        verifiedUpload: "true",
        verifiedGeneration: verified.generation,
      },
    }, {
      preconditionOpts: { ifGenerationMatch: Number(verified.generation) },
    });
    return verified;
  }

  /**
   * Read-only byte inspection for legacy objects. Unlike finalization this
   * deliberately does not add or change verification metadata.
   */
  async inspectUploadedObject(
    objectPath: string,
    expectedType: string,
    maxBytes: number,
  ): Promise<{
    size: number;
    contentType: string;
    generation: string;
    customMetadata: Record<string, string>;
  }> {
    const file = await this.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size || 0);
    if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
      throw new Error("INVALID_UPLOAD_SIZE");
    }
    const [head] = await file.download({ start: 0, end: Math.min(size, 8192) - 1 });
    const detected = detectUploadType(head, expectedType);
    if (!detected || detected !== expectedType) {
      throw new Error("UPLOAD_TYPE_MISMATCH");
    }
    const generation = String(metadata.generation || "");
    if (!generation || !Number.isSafeInteger(Number(generation))) {
      throw new Error("INVALID_UPLOAD_GENERATION");
    }
    return {
      size,
      contentType: detected,
      generation,
      customMetadata: (metadata.metadata as Record<string, string> | undefined) ?? {},
    };
  }

  issueUploadTicket(input: { objectPath: string; teacherId: number; purpose: string; contentType: string; maxBytes: number; videoEntitled?: boolean }): string {
    const payload = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + 15 * 60_000 })).toString("base64url");
    return `${payload}.${createHmac("sha256", uploadTicketSecret()).update(payload).digest("base64url")}`;
  }

  issueScopedUploadTicket(input: { objectPath: string; owner: string; purpose: string; contentType: string; maxBytes: number }): string {
    const payload = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + 15 * 60_000 })).toString("base64url");
    return `${payload}.${createHmac("sha256", uploadTicketSecret()).update(payload).digest("base64url")}`;
  }

  verifyScopedUploadTicket(ticket: string, expected: { objectPath: string; owner: string; purpose: string }) {
    const [payload, signature] = ticket.split(".");
    const expectedSig = createHmac("sha256", uploadTicketSecret()).update(payload || "").digest();
    const actualSig = Buffer.from(signature || "", "base64url");
    if (!payload || actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) throw new Error("INVALID_UPLOAD_TICKET");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.exp < Date.now() || parsed.objectPath !== expected.objectPath || parsed.owner !== expected.owner || parsed.purpose !== expected.purpose) throw new Error("INVALID_UPLOAD_TICKET");
    return parsed as { contentType: string; maxBytes: number; owner: string };
  }

  verifyUploadTicket(ticket: string, expected: { objectPath: string; teacherId: number; purpose?: string }): {
    purpose: string; contentType: string; maxBytes: number; videoEntitled?: boolean;
  } {
    const [payload, signature] = ticket.split(".");
    if (!payload || !signature) throw new Error("INVALID_UPLOAD_TICKET");
    const expectedSig = createHmac("sha256", uploadTicketSecret()).update(payload).digest();
    const actualSig = Buffer.from(signature, "base64url");
    if (actualSig.length !== expectedSig.length || !timingSafeEqual(actualSig, expectedSig)) throw new Error("INVALID_UPLOAD_TICKET");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.exp < Date.now() || parsed.objectPath !== expected.objectPath || parsed.teacherId !== expected.teacherId ||
        (expected.purpose !== undefined && parsed.purpose !== expected.purpose)) {
      throw new Error("INVALID_UPLOAD_TICKET");
    }
    return { purpose: parsed.purpose, contentType: parsed.contentType, maxBytes: parsed.maxBytes, videoEntitled: parsed.videoEntitled };
  }

  async listUploadObjects(ownerPrefix?: string): Promise<File[]> {
    let dir = this.getPrivateObjectDir();
    if (!dir.endsWith("/")) dir = `${dir}/`;
    const normalizedPrefix = ownerPrefix?.replace(/^\/+|\/+$/g, "");
    if (normalizedPrefix && !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(normalizedPrefix)) {
      throw new Error("Invalid object owner prefix");
    }
    const prefixPath = `${dir}uploads/${normalizedPrefix ? `${normalizedPrefix}/` : ""}`;
    const { bucketName, objectName } = parseObjectPath(prefixPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: objectName });
    return files;
  }

  async copyObjectEntityToOwner(
    sourcePath: string,
    ownerPrefix: string,
    stableName: string,
    expectedSourceGeneration?: string,
  ): Promise<{ objectPath: string; sourceGeneration: string }> {
    const normalizedPrefix = ownerPrefix.replace(/^\/+|\/+$/g, "");
    if (!normalizedPrefix || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(normalizedPrefix)) {
      throw new Error("Invalid object owner prefix");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(stableName)) {
      throw new Error("Invalid stable object name");
    }

    const source = await this.getObjectEntityFile(sourcePath);
    const [sourceMetadata] = await source.getMetadata();
    const sourceGeneration = String(sourceMetadata.generation || "");
    if (!sourceGeneration) throw new Error("INVALID_SOURCE_GENERATION");
    if (
      expectedSourceGeneration !== undefined &&
      sourceGeneration !== expectedSourceGeneration
    ) {
      throw new Error("MIGRATION_SOURCE_GENERATION_CHANGED");
    }
    const pinnedSource = source.bucket.file(source.name, {
      generation: sourceGeneration,
    });

    let dir = this.getPrivateObjectDir();
    if (!dir.endsWith("/")) dir = `${dir}/`;
    const { bucketName, objectName } = parseObjectPath(
      `${dir}uploads/${normalizedPrefix}/${stableName}`,
    );
    const destination = objectStorageClient.bucket(bucketName).file(objectName);
    const [destinationExists] = await destination.exists();
    if (!destinationExists) {
      await pinnedSource.copy(destination, {
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          libraryMigrationSourcePath: sourcePath,
          libraryMigrationSourceGeneration: sourceGeneration,
        },
      });
    } else {
      const [destinationMetadata] = await destination.getMetadata();
      const custom = (destinationMetadata.metadata || {}) as Record<string, string>;
      if (
        custom.libraryMigrationSourcePath !== sourcePath ||
        custom.libraryMigrationSourceGeneration !== sourceGeneration
      ) {
        throw new Error("MIGRATION_DESTINATION_CONFLICT");
      }
    }

    return {
      objectPath: this.toNormalizedObjectPath(destination),
      sourceGeneration,
    };
  }

  async deleteObjectEntityGeneration(
    objectPath: string,
    generation: string,
  ): Promise<boolean> {
    try {
      const file = await this.getObjectEntityFile(objectPath);
      await file.delete({
        ignoreNotFound: true,
        ifGenerationMatch: Number(generation),
      });
      return true;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) return false;
      throw err;
    }
  }

  toNormalizedObjectPath(file: File): string {
    return this.normalizeObjectEntityPath(
      `https://storage.googleapis.com/${file.bucket.name}/${file.name}`,
    );
  }

  async tryDeleteObjectEntity(objectPath: string): Promise<boolean> {
    try {
      const file = await this.getObjectEntityFile(objectPath);
      await file.delete({ ignoreNotFound: true });
      return true;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        return false;
      }
      throw err;
    }
  }

  async signFileDownloadUrl(file: File, ttlSec: number = 3600): Promise<string> {
    const bucketName = file.bucket.name;
    const objectName = file.name;
    return signObjectURL({ bucketName, objectName, method: "GET", ttlSec });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

export function detectUploadType(bytes: Buffer, claimedType: string): string | null {
  const b = bytes;
  const u32 = b.length >= 4 ? b.readUInt32BE(0) : 0;
  const isZip = u32 === 0x504b0304 || u32 === 0x504b0506 || u32 === 0x504b0708;
  if (b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (b.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))) return "image/jpeg";
  if (b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (b.length >= 12 && b.subarray(4, 8).toString("ascii") === "ftyp" &&
      /^(avif|avis|heic|heix|hevc|hevx)$/i.test(b.subarray(8, 12).toString("ascii"))) {
    return claimedType === "image/heic" || claimedType === "image/heif" ? claimedType : "image/avif";
  }
  if (b.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (b.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex")) && (
    claimedType === "application/msword" || claimedType === "application/vnd.ms-excel" ||
    claimedType === "application/vnd.ms-powerpoint"
  )) return claimedType;
  const zipText = isZip ? b.toString("latin1") : "";
  if (isZip && (claimedType === "application/zip" || claimedType === "application/x-zip-compressed" ||
    zipText.includes("[Content_Types].xml")) && (
    claimedType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    claimedType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    claimedType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    claimedType === "application/zip" || claimedType === "application/x-zip-compressed"
  )) return claimedType;
  if (claimedType === "text/plain" && !b.subarray(0, Math.min(b.length, 8192)).includes(0)) {
    const text = b.toString("utf8").trimStart().toLowerCase();
    if (!/^<!doctype\s+(html|svg)|^<\s*(html|svg|script|xml)\b/.test(text)) return "text/plain";
  }
  // Container formats and media have signatures too, but are intentionally
  // accepted only by their dedicated endpoints.
  if (claimedType.startsWith("audio/") || claimedType.startsWith("video/")) {
    if (b.subarray(0, 4).toString("ascii") === "OggS" || (b.subarray(0, 4).toString("ascii") === "RIFF" &&
        b.subarray(8, 12).toString("ascii") === "WAVE") ||
        b.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")) ||
        b.subarray(0, 2).equals(Buffer.from("fffb", "hex")) ||
        b.subarray(0, 2).equals(Buffer.from("fff3", "hex")) ||
        b.subarray(4, 8).toString("ascii") === "ftyp" || b.subarray(0, 3).toString("ascii") === "ID3" ||
        b.subarray(0, 4).toString("ascii") === "fLaC") return claimedType;
  }
  return null;
}

export function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

function uploadTicketSecret(): string {
  const secret = process.env.UPLOAD_TICKET_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("UPLOAD_TICKET_SECRET is not configured");
  return secret;
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json() as { signed_url: string };
  return signedURL;
}
