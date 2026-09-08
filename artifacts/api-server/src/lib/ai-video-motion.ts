import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ReplitConnectors } from "@replit/connectors-sdk";

const MODEL = "fal-ai/veo3.1/fast";
const TRACKING_MODEL = MODEL.split("/").slice(0, 2).join("/");
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_PROXY_JSON_BYTES = 1024 * 1024;
const POLL_INTERVAL_MS = 2_000;
const TRANSIENT_ATTEMPTS = 4;
const TRACKING_CALL_TIMEOUT_MS = 30_000;
const FAL_MEDIA_HOST = /^(?:[a-z0-9-]+\.)*fal\.media$/i;

type ProxyCall = (
  connectorName: string,
  path: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> },
) => Promise<Response>;

let injectedProxy: ProxyCall | undefined;
let injectedMediaFetch: typeof fetch | undefined;

/**
 * Test seam only. Passing no arguments restores the production connector and
 * global fetch implementations.
 */
export function setAiVideoMotionTestClients(clients?: {
  proxy?: ProxyCall;
  mediaFetch?: typeof fetch;
}): void {
  injectedProxy = clients?.proxy;
  injectedMediaFetch = clients?.mediaFetch;
}

function proxyCall(): ProxyCall {
  if (injectedProxy) return injectedProxy;
  const connectors = new ReplitConnectors();
  return connectors.proxy.bind(connectors);
}

function errorMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["error", "detail", "message"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 1_000);
    if (candidate && typeof candidate === "object") {
      const nested = errorMessage(candidate);
      if (nested) return nested;
    }
  }
  return "";
}

async function bounded<T>(
  promise: Promise<T>,
  deadline: number,
  label: string,
  capMs = Number.POSITIVE_INFINITY,
): Promise<T> {
  const remaining = Math.min(deadline - Date.now(), capMs);
  if (remaining <= 0) throw new Error(`AI video generation timed out during ${label}`);
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AI video generation timed out during ${label}`)),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function jsonResponse(response: Response, label: string, deadline: number): Promise<unknown> {
  const length = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_PROXY_JSON_BYTES) {
    throw new Error(`${label} returned an oversized response`);
  }
  if (!response.body) throw new Error(`${label} returned invalid JSON`);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await bounded(
        reader.read(),
        deadline,
        `${label} response body`,
        TRACKING_CALL_TIMEOUT_MS,
      );
      if (done) break;
      if (!value?.length) continue;
      total += value.length;
      if (total > MAX_PROXY_JSON_BYTES) {
        await reader.cancel();
        throw new Error(`${label} returned an oversized response`);
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total).toString("utf8");
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} returned invalid JSON or an oversized/late response`);
  }
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sleep(ms: number, deadline: number): Promise<void> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("AI video generation timed out while polling");
  await new Promise((resolve) => setTimeout(resolve, Math.min(ms, remaining)));
}

async function trackingGet(path: string, deadline: number, label: string): Promise<unknown> {
  let lastStatus = 0;
  let lastError: unknown;
  for (let attempt = 0; attempt < TRANSIENT_ATTEMPTS; attempt += 1) {
    let response: Response;
    const callDeadline = Math.min(deadline, Date.now() + TRACKING_CALL_TIMEOUT_MS);
    try {
      response = await bounded(
        proxyCall()("falai", path, { method: "GET" }),
        callDeadline,
        label,
        TRACKING_CALL_TIMEOUT_MS,
      );
    } catch (error) {
      lastError = error;
      if (attempt + 1 < TRANSIENT_ATTEMPTS) {
        await sleep(250 * (attempt + 1), deadline);
        continue;
      }
      throw new Error(`${label} failed after transient retries: ${error instanceof Error ? error.message : "network error"}`);
    }
    lastStatus = response.status;
    if (response.ok) {
      try {
        return await jsonResponse(response, label, callDeadline);
      } catch (error) {
        lastError = error;
        if (attempt + 1 < TRANSIENT_ATTEMPTS) {
          await sleep(250 * (attempt + 1), deadline);
          continue;
        }
        throw error;
      }
    }
    if (!isTransientStatus(response.status)) {
      const payload = await jsonResponse(response, label, callDeadline);
      throw new Error(`${label} failed (${response.status}): ${errorMessage(payload) || "provider rejected the request"}`);
    }
    // Do not require a well-formed error body from a transient gateway response.
    await jsonResponse(response, label, callDeadline).catch((error) => {
      lastError = error;
    });
    if (attempt + 1 < TRANSIENT_ATTEMPTS) await sleep(250 * (attempt + 1), deadline);
  }
  throw new Error(`${label} failed after transient retries (${lastStatus}): ${lastError instanceof Error ? lastError.message : "provider unavailable"}`);
}

function requestIdFrom(payload: unknown): string {
  const requestId = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).request_id
    : undefined;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) {
    throw new Error("fal queue submission did not return a valid request_id");
  }
  return requestId;
}

function providerDuration(requested: number): 4 | 6 | 8 {
  if (!Number.isFinite(requested) || requested <= 0 || requested > 8) {
    throw new Error("Veo 3.1 Fast scene duration must be greater than 0 and at most 8 seconds");
  }
  if (requested <= 4) return 4;
  if (requested <= 6) return 6;
  return 8;
}

async function bestEffortCancel(requestId: string): Promise<void> {
  const path = `/${TRACKING_MODEL}/requests/${encodeURIComponent(requestId)}/cancel`;
  try {
    await Promise.race([
      proxyCall()("falai", path, { method: "PUT" }),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  } catch {
    // Cancellation cannot mask the original timeout, provider failure, or lease loss.
  }
}

function videoUrlFrom(payload: unknown): URL {
  const video = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).video
    : undefined;
  const rawUrl = video && typeof video === "object"
    ? (video as Record<string, unknown>).url
    : undefined;
  if (typeof rawUrl !== "string") throw new Error("fal result did not contain a video URL");
  const videoRecord = video as Record<string, unknown>;
  if (
    videoRecord.content_type !== undefined &&
    String(videoRecord.content_type).split(";", 1)[0]?.trim().toLowerCase() !== "video/mp4"
  ) {
    throw new Error("fal result metadata did not describe an MP4");
  }
  if (
    videoRecord.file_size !== undefined &&
    (!Number.isFinite(Number(videoRecord.file_size)) ||
      Number(videoRecord.file_size) <= 0 ||
      Number(videoRecord.file_size) > MAX_VIDEO_BYTES)
  ) {
    throw new Error("fal result metadata contained an invalid or oversized file");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("fal result contained an invalid video URL");
  }
  if (url.protocol !== "https:" || !FAL_MEDIA_HOST.test(url.hostname) || url.username || url.password) {
    throw new Error("fal result video URL is not on an approved HTTPS fal media host");
  }
  return url;
}

async function downloadVideo(url: URL, outputPath: string, deadline: number): Promise<void> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("AI video generation timed out before download");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  const tempPath = `${outputPath}.fal-download-${process.pid}-${Date.now()}`;
  try {
    const response = await (injectedMediaFetch ?? fetch)(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "video/mp4" },
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error("fal video download redirect was rejected");
    }
    if (!response.ok) throw new Error(`fal video download failed (${response.status})`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "video/mp4") throw new Error("fal video download was not an MP4");
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_VIDEO_BYTES) {
      throw new Error("fal video exceeds the 100MB download limit");
    }
    if (!response.body) throw new Error("fal video download returned an empty body");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      total += value.length;
      if (total > MAX_VIDEO_BYTES) {
        await reader.cancel();
        throw new Error("fal video exceeds the 100MB download limit");
      }
      chunks.push(value);
    }
    if (total < 12) throw new Error("fal video download returned an empty or truncated file");
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
    if (bytes.subarray(4, 8).toString("ascii") !== "ftyp") {
      throw new Error("fal video payload does not have a valid MP4 signature");
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(tempPath, bytes, { flag: "wx", mode: 0o600 });
    await rename(tempPath, outputPath);
  } finally {
    clearTimeout(timer);
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function generateAiVideoMotion({
  prompt,
  aspectRatio,
  durationSeconds,
  outputPath,
  timeoutMs,
  assertActive,
}: {
  prompt: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  durationSeconds: number;
  outputPath: string;
  timeoutMs: number;
  assertActive: () => Promise<void>;
}): Promise<{ requestId: string; model: string; generatedDurationSeconds: number }> {
  if (!prompt.trim()) throw new Error("AI video prompt is required");
  if (!outputPath) throw new Error("AI video outputPath is required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("AI video timeoutMs must be positive");

  const generatedDurationSeconds = providerDuration(durationSeconds);
  const deadline = Date.now() + timeoutMs;
  const providerPrompt = aspectRatio === "1:1"
    ? `${prompt.trim()}\nComposition requirement: keep the primary subject and all important action centered within the middle square safe area for a downstream centered 1:1 crop.`
    : prompt.trim();
  let requestId: string | undefined;
  let succeeded = false;
  let outputWritten = false;

  try {
    await bounded(assertActive(), deadline, "active-job check");
    // Deliberately submit once only: retrying an ambiguous POST can duplicate paid work.
    const submission = await bounded(
      proxyCall()("falai", `/${MODEL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Fal-No-Retry": "1" },
        body: {
          prompt: providerPrompt,
          aspect_ratio: aspectRatio === "1:1" ? "16:9" : aspectRatio,
          duration: `${generatedDurationSeconds}s`,
          resolution: "720p",
          generate_audio: false,
        },
      }),
      deadline,
      "fal queue submission",
    );
    const submissionPayload = await jsonResponse(submission, "fal queue submission", deadline);
    if (!submission.ok) {
      throw new Error(`fal queue submission failed (${submission.status}): ${errorMessage(submissionPayload) || "provider rejected the request"}`);
    }
    requestId = requestIdFrom(submissionPayload);

    const encodedId = encodeURIComponent(requestId);
    const statusPath = `/${TRACKING_MODEL}/requests/${encodedId}/status`;
    while (true) {
      await bounded(assertActive(), deadline, "active-job check");
      const statusPayload = await trackingGet(statusPath, deadline, "fal queue status");
      const status = statusPayload && typeof statusPayload === "object"
        ? String((statusPayload as Record<string, unknown>).status ?? "").toUpperCase()
        : "";
      if (status === "COMPLETED") {
        const completed = statusPayload as Record<string, unknown>;
        const completedError = errorMessage(completed);
        const errorType = typeof completed.error_type === "string"
          ? completed.error_type.trim()
          : "";
        if (completedError || errorType) {
          throw new Error(`fal queue completed with an error: ${completedError || errorType}`);
        }
        break;
      }
      if (status === "FAILED" || status === "CANCELLED") {
        throw new Error(`fal queue ${status.toLowerCase()}: ${errorMessage(statusPayload) || "video generation did not complete"}`);
      }
      if (status !== "IN_QUEUE" && status !== "IN_PROGRESS") {
        throw new Error(`fal queue returned an unknown status: ${status || "missing"}`);
      }
      await sleep(POLL_INTERVAL_MS, deadline);
    }

    await bounded(assertActive(), deadline, "active-job check");
    const resultPath = `/${TRACKING_MODEL}/requests/${encodedId}`;
    const result = await trackingGet(resultPath, deadline, "fal queue result");
    const mediaUrl = videoUrlFrom(result);
    await downloadVideo(mediaUrl, outputPath, deadline);
    outputWritten = true;
    await bounded(assertActive(), deadline, "active-job check");
    succeeded = true;
    return { requestId, model: MODEL, generatedDurationSeconds };
  } finally {
    if (requestId && !succeeded) await bestEffortCancel(requestId);
    if (outputWritten && !succeeded) await rm(outputPath, { force: true }).catch(() => undefined);
  }
}