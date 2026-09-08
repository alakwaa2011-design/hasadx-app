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

afterEach(async () => {
  setAiVideoMotionTestClients();
  vi.restoreAllMocks();
  await rm("/tmp/ai-video-motion-test.mp4", { force: true });
});

describe("generateAiVideoMotion", () => {
  it("submits one documented 720p silent request and uses derived tracking paths", async () => {
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
    });

    expect(result).toEqual({
      requestId: "request_1",
      model: "fal-ai/veo3.1/fast",
      generatedDurationSeconds: 6,
    });
    expect(proxy).toHaveBeenNthCalledWith(1, "falai", "/fal-ai/veo3.1/fast", expect.objectContaining({
      method: "POST",
      body: expect.objectContaining({
        aspect_ratio: "16:9",
        duration: "6s",
        resolution: "720p",
        generate_audio: false,
      }),
    }));
    expect((proxy.mock.calls[0]?.[2]?.body as { prompt: string }).prompt).toContain("centered");
    expect(proxy.mock.calls.map((call) => call[1])).toEqual([
      "/fal-ai/veo3.1/fast",
      "/fal-ai/veo3.1/requests/request_1/status",
      "/fal-ai/veo3.1/requests/request_1",
    ]);
  });

  it("does not retry an ambiguous paid submission", async () => {
    const proxy = vi.fn(async () => {
      throw new Error("connection reset");
    });
    setAiVideoMotionTestClients({ proxy, mediaFetch: vi.fn() });
    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 4,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 1_000,
      assertActive: async () => undefined,
    })).rejects.toThrow("connection reset");
    expect(proxy).toHaveBeenCalledTimes(1);
  });

  it("cancels best effort when the job lease is lost", async () => {
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
    })).rejects.toThrow("worker lease lost");
    expect(proxy).toHaveBeenCalledWith(
      "falai",
      "/fal-ai/veo3.1/requests/request_2/cancel",
      { method: "PUT" },
    );
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
    setAiVideoMotionTestClients({ proxy, mediaFetch });

    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 4,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
    })).rejects.toThrow("completed with an error: Prompt was rejected");
    expect(mediaFetch).not.toHaveBeenCalled();
    expect(proxy).toHaveBeenCalledWith(
      "falai",
      "/fal-ai/veo3.1/requests/request_error/cancel",
      { method: "PUT" },
    );
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
    setAiVideoMotionTestClients({ proxy, mediaFetch });
    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 6,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
    })).rejects.toThrow("approved HTTPS fal media host");
    expect(mediaFetch).not.toHaveBeenCalled();

    await expect(generateAiVideoMotion({
      prompt: "A moving diagram",
      aspectRatio: "16:9",
      durationSeconds: 9,
      outputPath: "/tmp/unused.mp4",
      timeoutMs: 5_000,
      assertActive: async () => undefined,
    })).rejects.toThrow("at most 8 seconds");
  });
});