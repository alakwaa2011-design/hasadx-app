/**
 * Persistent per-teacher TTS audio cache — storage + state machine helpers.
 *
 * Financial invariant (approved plan v1–v5):
 *   pending → hold → generate → store(verified) → capture OK → ready → serve
 * Audio is served ONLY from status='ready' rows. A row reaches 'ready' only
 * after its credit hold (credit_request_id) was captured — or when no hold was
 * needed at all (credits system off / unlimited teacher).
 *
 * Uncertain-capture rule: a capture error/timeout NEVER triggers refund or
 * file deletion directly; the hold status is re-read from DB first
 * (resolveUncertainCapture). If even that read fails, the row stays 'pending'
 * (unservable) and recovers lazily on a later request.
 *
 * Compensation rule: compensateCapturedHold runs ONLY when storage reports a
 * DEFINITIVE absence (exists() === false). Transient storage errors leave the
 * row pending for a later re-check.
 */
import { randomUUID, createHash } from "node:crypto";
import { db, ttsAudioCacheTable, type TtsAudioCache } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { objectStorageClient, parseObjectPath } from "./objectStorage";
import { CreditService } from "./credit-service";

export const TTS_MODEL = "gpt-audio";
export const TTS_FORMAT = "mp3";
export const TTS_SYSTEM_PROMPT =
  "أنت نظام تحويل نص إلى كلام. مهمتك الوحيدة: اقرأ النص الذي يُرسَل إليك بصوت واضح وطبيعي، بالضبط كما هو، دون إضافة أي كلمة أو عبارة من عندك.";

export const PENDING_ORPHAN_MS  = 2 * 60 * 1000;   // pending older than this = orphaned (owner crashed)
export const FAILED_COOLDOWN_MS = 5 * 60 * 1000;   // failed rows block retries for this long
export const WAIT_TIMEOUT_MS    = 60 * 1000;       // second-request server-side wait budget
export const WAIT_POLL_MS       = 1000;
export const LAST_USED_REFRESH_MS = 6 * 60 * 60 * 1000; // throttled last_used_at updates
export const CLEANUP_EVERY_MS   = 24 * 60 * 60 * 1000;
export const READY_TTL_DAYS     = 90;
export const FAILED_TTL_DAYS    = 7;

// ─── cache key ────────────────────────────────────────────────────────────────

/** Everything that actually affects the audio output. Bump v on any change to
    the generation mechanics so stale entries regenerate naturally. */
export function buildTtsCacheKey(text: string, voice: string): string {
  const canonical = JSON.stringify({
    v: 1,
    text: text.trim(),
    voice,
    model: TTS_MODEL,
    format: TTS_FORMAT,
    sys: createHash("sha256").update(TTS_SYSTEM_PROMPT).digest("hex"),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ─── storage ops (private Object Storage) ─────────────────────────────────────

function ttsFile(storageKey: string) {
  const { bucketName, objectName } = parseObjectPath(storageKey);
  return objectStorageClient.bucket(bucketName).file(objectName);
}

export function newTtsStorageKey(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set");
  return `${dir.replace(/\/$/, "")}/tts-cache/${randomUUID()}.mp3`;
}

export async function uploadTtsAudio(storageKey: string, buffer: Buffer): Promise<void> {
  await ttsFile(storageKey).save(buffer, {
    contentType: "audio/mpeg",
    resumable: false,
    metadata: { cacheControl: "private, max-age=0" },
  });
}

/** Three-way storage check (plan v5):
    "exists"  — file is there
    "missing" — DEFINITIVE absence (exists() returned false)
    throws    — transient/indeterminate (timeout, 5xx, network) — caller must
                NOT compensate, delete, or change state. */
export async function checkTtsFile(storageKey: string): Promise<"exists" | "missing"> {
  const [exists] = await ttsFile(storageKey).exists();
  return exists ? "exists" : "missing";
}

export async function downloadTtsAudio(storageKey: string): Promise<Buffer> {
  const [buf] = await ttsFile(storageKey).download();
  return buf;
}

/** Best-effort delete; orphaned blobs are swept by cleanup later. */
export async function tryDeleteTtsAudio(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) return;
  try {
    await ttsFile(storageKey).delete({ ignoreNotFound: true });
  } catch { /* best-effort */ }
}

// ─── row helpers ──────────────────────────────────────────────────────────────

export async function getCacheRow(teacherId: number, cacheKey: string): Promise<TtsAudioCache | undefined> {
  const [row] = await db
    .select()
    .from(ttsAudioCacheTable)
    .where(and(eq(ttsAudioCacheTable.teacherId, teacherId), eq(ttsAudioCacheTable.cacheKey, cacheKey)))
    .limit(1);
  return row;
}

export async function getCacheRowById(id: number): Promise<TtsAudioCache | undefined> {
  const [row] = await db.select().from(ttsAudioCacheTable).where(eq(ttsAudioCacheTable.id, id)).limit(1);
  return row;
}

/** Atomic ownership claim for a brand-new key. Returns the row when THIS
    request won generation ownership; undefined when someone else already owns it. */
export async function tryInsertPending(
  teacherId: number,
  cacheKey: string,
  creditRequestId: string,
): Promise<TtsAudioCache | undefined> {
  const rows = await db
    .insert(ttsAudioCacheTable)
    .values({ teacherId, cacheKey, creditRequestId, status: "pending" })
    .onConflictDoNothing({ target: [ttsAudioCacheTable.teacherId, ttsAudioCacheTable.cacheKey] })
    .returning();
  return rows[0];
}

/** Atomic takeover of a failed row past its cooldown (or an orphaned pending
    row whose financial state was already resolved). Starts a fresh cycle with
    a NEW credit_request_id. Returns true when THIS request won. */
export async function tryTakeoverRow(
  rowId: number,
  fromStatus: "failed" | "pending",
  newCreditRequestId: string,
  extraWhere?: ReturnType<typeof sql>,
): Promise<boolean> {
  const rows = await db.execute(sql`
    UPDATE tts_audio_cache
    SET status = 'pending',
        credit_request_id = ${newCreditRequestId},
        storage_key = NULL,
        size_bytes = NULL,
        error_message = NULL,
        failed_at = NULL,
        created_at = NOW()
    WHERE id = ${rowId}
      AND status = ${fromStatus}
      AND credit_request_id != ${newCreditRequestId}
      ${extraWhere ?? sql``}
    RETURNING id
  `);
  return rows.rows.length > 0;
}

/** All cycle mutations are FENCED by credit_request_id: it acts as the
    generation lease token. A takeover rewrites it, so a stale worker's
    updates match zero rows and it can detect it lost ownership. */
export async function markReady(
  rowId: number,
  creditRequestId: string,
  storageKey: string,
  sizeBytes: number,
): Promise<boolean> {
  const r = await db.execute(sql`
    UPDATE tts_audio_cache
    SET status = 'ready', storage_key = ${storageKey}, size_bytes = ${sizeBytes},
        error_message = NULL, failed_at = NULL, last_used_at = NOW()
    WHERE id = ${rowId} AND status = 'pending' AND credit_request_id = ${creditRequestId}
    RETURNING id
  `);
  return r.rows.length > 0;
}

export async function markFailed(rowId: number, creditRequestId: string, errorMessage: string): Promise<boolean> {
  const r = await db.execute(sql`
    UPDATE tts_audio_cache
    SET status = 'failed', error_message = ${errorMessage}, failed_at = NOW()
    WHERE id = ${rowId} AND status = 'pending' AND credit_request_id = ${creditRequestId}
    RETURNING id
  `);
  return r.rows.length > 0;
}

/** Definitive loss of a READY row's paid file: compensate the captured hold
    (idempotent) and atomically flip ready → failed. Used when a download/exists
    check reports a hard 404 on a ready row. Never called on transient errors. */
export async function handleReadyFileLost(row: TtsAudioCache): Promise<void> {
  const claim = await db.execute(sql`
    UPDATE tts_audio_cache
    SET status = 'failed', error_message = 'ready_file_lost_compensated', failed_at = NOW()
    WHERE id = ${row.id} AND status = 'ready' AND credit_request_id = ${row.creditRequestId}
    RETURNING id
  `);
  if (claim.rows.length === 0) return; // another request already handled it
  try {
    await CreditService.compensateCapturedHold(row.creditRequestId, "تعويض: ملف tts جاهز فُقد من التخزين");
  } catch { /* hold may not exist (credits-off generation) or compensation already done */ }
}

/** Throttled: writes only when the stored value is older than 6h. */
export async function touchLastUsed(rowId: number): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE tts_audio_cache
      SET last_used_at = NOW()
      WHERE id = ${rowId} AND last_used_at < NOW() - INTERVAL '6 hours'
    `);
  } catch { /* non-critical */ }
}

// ─── uncertain-capture / orphan resolution (plan v3–v5) ───────────────────────

export type CaptureResolution =
  | { outcome: "ready" }                    // hold completed + file exists → promoted, serve
  | { outcome: "refunded" }                 // hold was still pending → refunded once, row failed
  | { outcome: "compensated" }              // hold completed + file DEFINITIVELY missing → compensated, row failed
  | { outcome: "new_cycle" }                // no hold / refunded hold → caller may take over and regenerate
  | { outcome: "indeterminate" };           // couldn't determine → row left pending, NO money moved

/**
 * Single resolution function used both after an uncertain capture result and
 * for lazy recovery of orphaned pending rows. Never creates a hold, never
 * generates, never charges. Only moves money in the two certain cases:
 *   hold pending           → refund once  (charge never landed)
 *   hold completed+missing → compensate once (charged but file is gone)
 */
export async function resolveUncertainCapture(
  row: TtsAudioCache,
  /** test seam: override storage/credit lookups to simulate transient failures */
  deps: {
    checkFile?: typeof checkTtsFile;
    getHoldStatus?: typeof CreditService.getHoldStatus;
  } = {},
): Promise<CaptureResolution> {
  const checkFile = deps.checkFile ?? checkTtsFile;
  const getHoldStatus = deps.getHoldStatus ?? CreditService.getHoldStatus.bind(CreditService);

  let holdStatus: Awaited<ReturnType<typeof CreditService.getHoldStatus>>;
  try {
    holdStatus = await getHoldStatus(row.creditRequestId);
  } catch {
    return { outcome: "indeterminate" }; // can't even read status — leave pending, zero actions
  }

  if (holdStatus === "completed") {
    if (!row.storageKey) {
      // Captured but no storage key was persisted. A crash between upload and
      // key-persist could leave a real paid object — absence of the KEY is not
      // proof of absence of the FILE. Compensation requires a definitive
      // exists()===false, which we cannot establish here → stay pending.
      return { outcome: "indeterminate" };
    }
    let fileState: "exists" | "missing";
    try {
      fileState = await checkFile(row.storageKey);
    } catch {
      return { outcome: "indeterminate" }; // transient storage error — no compensation, no deletion
    }
    if (fileState === "exists") {
      await db.execute(sql`
        UPDATE tts_audio_cache
        SET status = 'ready', error_message = NULL, failed_at = NULL, last_used_at = NOW()
        WHERE id = ${row.id} AND status = 'pending'
      `);
      return { outcome: "ready" };
    }
    // DEFINITIVE NoSuchKey/404 — compensate exactly once (idempotent claim inside)
    const { compensated } = await CreditService.compensateCapturedHold(
      row.creditRequestId, "تعويض: ملف tts مدفوع مفقود من التخزين",
    );
    await markFailed(row.id, row.creditRequestId, compensated ? "charged_no_file_compensated" : "charged_no_file_already_compensated");
    return { outcome: "compensated" };
  }

  if (holdStatus === "pending") {
    try {
      await CreditService.refund(row.creditRequestId, "tts: انقطاع قبل التحصيل");
    } catch {
      return { outcome: "indeterminate" }; // refund unclear — sweeper will reclaim; leave pending
    }
    await tryDeleteTtsAudio(row.storageKey);
    await markFailed(row.id, row.creditRequestId, "interrupted_before_capture");
    return { outcome: "refunded" };
  }

  // "none" (crash before hold, or credits system was off) or "refunded"/"expired"
  if (holdStatus === "none" && row.storageKey) {
    // Credits-off generation may have stored a file without any hold: if the
    // file exists it is servable free of charge (nothing was ever owed).
    try {
      if ((await checkFile(row.storageKey)) === "exists") {
        await db.execute(sql`
          UPDATE tts_audio_cache
          SET status = 'ready', error_message = NULL, failed_at = NULL, last_used_at = NOW()
          WHERE id = ${row.id} AND status = 'pending'
        `);
        return { outcome: "ready" };
      }
    } catch {
      return { outcome: "indeterminate" };
    }
  }
  return { outcome: "new_cycle" };
}

// ─── opportunistic cleanup (autoscale-safe — plan §cleanup) ──────────────────

/** At most one request per 24h wins the atomic claim and runs the sweep.
    Never throws. */
export async function maybeRunTtsCleanup(log?: { info?: Function; error?: Function }): Promise<void> {
  try {
    const claim = await db.execute(sql`
      UPDATE tts_cache_state
      SET last_cleanup_at = NOW()
      WHERE id = 1 AND last_cleanup_at < NOW() - INTERVAL '24 hours'
      RETURNING id
    `);
    if (claim.rows.length === 0) return;

    // 1. Stale ready rows (unused > 90 days): delete file first, then metadata.
    const stale = await db.execute(sql`
      SELECT id, storage_key FROM tts_audio_cache
      WHERE status = 'ready' AND last_used_at < NOW() - INTERVAL '90 days'
      LIMIT 500
    `);
    for (const r of stale.rows as Array<{ id: number; storage_key: string | null }>) {
      await tryDeleteTtsAudio(r.storage_key);
      await db.execute(sql`DELETE FROM tts_audio_cache WHERE id = ${r.id}`);
    }

    // 2. Old failed rows (> 7 days).
    await db.execute(sql`
      DELETE FROM tts_audio_cache
      WHERE status = 'failed' AND failed_at < NOW() - INTERVAL '7 days'
    `);

    log?.info?.({ staleReady: stale.rows.length }, "tts cache cleanup ran");
  } catch (err) {
    log?.error?.({ err }, "tts cache cleanup error");
  }
}
