import { rm } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateAiVideoMotion,
  setAiVideoMotionTestClients,
} from "../lib/ai-video-motion";

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(16)]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const video = () => new Response(mp4, {
  status: 200,
  headers: { "content-type": "video/mp4", "content-length": String(mp4.length) },
});
const journal = (requestId?: string) => ({
  prepare: vi.fn(async () => requestId
    ? { action: "resume" as const, requestId }
    : { action: "submit" as const }),
  recordRequestId: vi.fn(async () => undefined),
  recordCompleted: vi.fn(async () => undefined),
  recordFailed: vi.fn(async () => undefined),
  recordUnusableResult: vi.fn(async () => undefined),
  recordSubmissionUnknown: vi.fn(async () => undefined),
});

afterEach(async () => {
  setAiVideoMotionTestClients();
  vi.restoreAllMocks();
  await rm("/tmp/ai-video-motion-test.mp4", { force: true });
});

describe("generateAiVideoMotion", () => {
  it("submits one documented 1080p native-audio request and uses family tracking paths", async () => {
    const proxy = vi.fn(async (
      _connector: string,
      path: string,
      _options?: { method?: string; body?: unknown; headers?: Record<string, string> },
    ) => {
      if (path.endsWith("/status")) return json({ status: "COMPLETED" });
      if (path.endsWith("/requests/request_1")) {
        return json({ video: { url: "https://v3b.fal.media/files/output.mp4" } });
      }
      return json({
        request_id: "request_1",
        status_url: "https://evil.example/tracking",
        response_url: "https://evil.example/result",
      });
    });
    const mediaFetch = vi.fn(async () => video());
    setAiVideoMotionTestClients({ proxy, mediaFetch });

    const result = await generateAiVideoMotion({
      prompt: "Show water molecules moving",
      aspectRatio: "1:1",
      durationSeconds: 5,
      outputPath: "/tmp/ai-video-motion-test.mp4",
      timeoutMs: 10_000,
      assertActive: async () => undefined,
      requestJournal: journal(),
    });

    expect(result).toEqual({
      requestId: "request_1",
      model: "fal-ai/veo3.1",
      generatedDurationSeconds: 6,
    });
    expect(proxy).toHaveBeenNthCalledWith(1, "falai", "/fal-ai/veo3.1", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-Fal-No-Retry": "1" }),
      body: expect.objectContaining({
        aspect_ratio: "16:9",
        duration: "6s",
        resolution: "1080p",
        generate_audio: true,
        auto_fix: false,
      }),
    }));
    expect((proxy.mock.calls[0]?.[2]?.body as { prompt: string }).prompt).toContain("centered");
    expect(proxy.mock.calls.map((call) => call[1])).toEqual([
      "/fal-ai/veo3.1",
      "/fal-ai/veo3.1/requests/request_1/status",
      "/fal-ai/veo3.1/requests/request_1",
    ]);
  });

  it("does not retry an ambiguous paid submission", async () => {
    const proxy = vi.fn(async () => {
      throw new Error("connection reset");
    });
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn() });
    let unknown = false;
    const requestJournal = {
      ...journal(),
      prepare: vi.fn(async () => {
        if (unknown) {
          throw new Error("Automatic resubmission is blocked pending reconciliation");
        }
        return { action: "submit" as const };
      }),
      recordSubmissionUnknown: vi.fn(async () => {
        unknown = true;
      }),
    };
    const attempt = () => generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9" as const,
      durationSeconds: 4,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 1_000,
      assertActive: async () => undefined,
      requestJournal,
    });
    await expect(attempt()).rejects.toThrow("connection reset");
    await expect(attempt()).rejects.toThrow("Automatic resubmission is blocked");
    expect(proxy).toHaveBeenCalledTimes(1);
    expect(requestJournal.recordSubmissionUnknown).toHaveBeenCalledOnce();
  });

  it("resumes a recovered request ID without another paid POST", async () => {
    const proxy = vi.fn(async (_connector: string, path: string, options?: { method?: string }) => {
      expect(options?.method).toBe("GET");
      if (path.endsWith("/status")) return json({ status: "COMPLETED" });
      return json({ video: { url: "https://v3b.fal.media/files/recovered.mp4" } });
    });
    const requestJournal = journal("request_recovered");
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn(async () => video()) });

    await expect(generateAiVideoMotion({
      prompt: "Teacher and student speak Arabic",
      aspectRatio: "9:16",
      durationSeconds: 6,
      outputPath: "/tmp/ai-video-motion-test.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
      requestJournal,
    })).resolves.toMatchObject({ requestId: "request_recovered" });
    expect(proxy.mock.calls.every((call) => call[2]?.method === "GET")).toBe(true);
    expect(requestJournal.recordRequestId).not.toHaveBeenCalled();
  });

  it("retries only request-ID persistence after a successful POST", async () => {
    const proxy = vi.fn(async (
      _connector: string,
      path: string,
      _options?: { method?: string },
    ) => {
      if (path.endsWith("/status")) return json({ status: "COMPLETED" });
      if (path.endsWith("/requests/persist_retry")) {
        return json({ video: { url: "https://v3b.fal.media/files/persisted.mp4" } });
      }
      return json({ request_id: "persist_retry" });
    });
    const requestJournal = journal();
    requestJournal.recordRequestId
      .mockRejectedValueOnce(new Error("temporary database disconnect"))
      .mockResolvedValueOnce(undefined);
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn(async () => video()) });

    await expect(generateAiVideoMotion({
      prompt: "Native classroom dialogue",
      aspectRatio: "16:9",
      durationSeconds: 6,
      outputPath: "/tmp/ai-video-motion-test.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
      requestJournal,
    })).resolves.toMatchObject({ requestId: "persist_retry" });
    expect(requestJournal.recordRequestId).toHaveBeenCalledTimes(2);
    expect(proxy.mock.calls.filter((call) => call[2]?.method === "POST")).toHaveLength(1);
  });

  it("retains the known request for resume when the job lease is lost", async () => {
    const proxy = vi.fn(async (_connector: string, path: string) => {
      if (path.endsWith("/cancel")) return json({});
      if (path.endsWith("/status")) return json({ status: "IN_PROGRESS" });
      return json({ request_id: "request_2" });
    });
    let checks = 0;
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn() });
    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "9:16",
      durationSeconds: 4,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => {
        checks += 1;
        if (checks > 1) throw new Error("worker lease lost");
      },
      requestJournal: journal(),
    })).rejects.toThrow("worker lease lost");
    expect(proxy.mock.calls.some((call) => call[1].endsWith("/cancel"))).toBe(false);
  });

  it("rejects a COMPLETED queue status that carries a provider error", async () => {
    const proxy = vi.fn(async (_connector: string, path: string) => {
      if (path.endsWith("/status")) {
        return json({
          status: "COMPLETED",
          error_type: "CONTENT_POLICY",
          error: "Prompt was rejected",
        });
      }
      if (path.endsWith("/cancel")) return json({ status: "CANCELLATION_REQUESTED" }, 202);
      return json({ request_id: "request_error" });
    });
    const mediaFetch = vi.fn();
    const requestJournal = journal();
    setAiVideoMotionTestClients({ proxy, mediaFetch });

    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 4,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
      requestJournal,
    })).rejects.toThrow("completed with an error: Prompt was rejected");
    expect(requestJournal.recordFailed).toHaveBeenCalledWith("Prompt was rejected");
    expect(mediaFetch).not.toHaveBeenCalled();
    expect(proxy.mock.calls.some((call) => call[1].endsWith("/cancel"))).toBe(false);
  });

  it("journals a successful submit ID even when its response arrives after the caller deadline", async () => {
    let resolveSubmission!: (response: Response) => void;
    const proxy = vi.fn(() => new Promise<Response>((resolve) => {
      resolveSubmission = resolve;
    }));
    const requestJournal = journal();
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn() });

    const attempt = generateAiVideoMotion({
      prompt: "Teacher speaks to a visible student",
      aspectRatio: "9:16",
      durationSeconds: 6,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 20,
      assertActive: async () => undefined,
      requestJournal,
    });
    await expect(attempt).rejects.toThrow("timed out");
    resolveSubmission(json({ request_id: "late_response_id" }));
    await vi.waitFor(() => {
      expect(requestJournal.recordRequestId).toHaveBeenCalledWith("late_response_id");
    });
    expect(proxy).toHaveBeenCalledTimes(1);
  });

  it("bounds JSON response bodies even without Content-Length", async () => {
    const oversized = JSON.stringify({ padding: "x".repeat(1024 * 1024) });
    const proxy = vi.fn(async () => new Response(oversized, {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn() });

    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 4,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
      requestJournal: journal(),
    })).rejects.toThrow("oversized/late response");
    expect(proxy).toHaveBeenCalledTimes(1);
  });

  it("rejects unapproved media hosts and durations over eight seconds", async () => {
    const proxy = vi.fn(async (_connector: string, path: string) => {
      if (path.endsWith("/status")) return json({ status: "COMPLETED" });
      if (path.endsWith("/requests/request_3")) {
        return json({ video: { url: "https://fal.media.evil.example/output.mp4" } });
      }
      if (path.endsWith("/cancel")) return json({});
      return json({ request_id: "request_3" });
    });
    const mediaFetch = vi.fn();
    const requestJournal = journal();
    setAiVideoMotionTestClients({ proxy, mediaFetch });
    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 6,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
      requestJournal,
    })).rejects.toThrow("approved HTTPS fal media host");
    expect(mediaFetch).not.toHaveBeenCalled();
    expect(requestJournal.recordUnusableResult).toHaveBeenCalledOnce();

    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 9,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
      requestJournal: journal(),
    })).rejects.toThrow("at most 8 seconds");
  });
});