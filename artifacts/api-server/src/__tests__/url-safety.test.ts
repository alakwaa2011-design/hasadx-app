import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    if (hostname === "public.example") return [{ address: "93.184.216.34", family: 4 }];
    return [{ address: "127.0.0.1", family: 4 }];
  }),
}));
const { pinnedRequest } = vi.hoisted(() => ({ pinnedRequest: vi.fn() }));
vi.mock("node:https", () => ({ request: pinnedRequest }));

import { safeFetchText, validateSafeUrl } from "../lib/url-safety";

describe("validateSafeUrl", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://public.example/file",
    "http://user:pass@public.example/",
    "http://localhost/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[2001:db8::1]/",
    "http://224.0.0.1/",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validateSafeUrl(url)).resolves.toBeNull();
  });

  it("accepts a public URL", async () => {
    await expect(validateSafeUrl("https://public.example/path")).resolves.toBeInstanceOf(URL);
    await expect(validateSafeUrl("https://[2001:4860:4860::8888]/path")).resolves.toBeInstanceOf(URL);
  });

  it("rejects overlong URLs", async () => {
    await expect(validateSafeUrl(`https://public.example/${"x".repeat(2000)}`)).resolves.toBeNull();
  });

  it("pins the request to the address validated by DNS", async () => {
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(error?: Error): void };
    req.end = () => undefined;
    req.destroy = () => undefined;
    pinnedRequest.mockImplementationOnce((_url: URL, options: { lookup: Function }, callback: Function) => {
      options.lookup("public.example", {}, (error: Error | null, address: string, family: number) => {
        expect(error).toBeNull();
        expect(address).toBe("93.184.216.34");
        expect(family).toBe(4);
      });
      const response = {
        statusCode: 200,
        headers: { "content-type": "text/plain" },
        async *[Symbol.asyncIterator]() { yield Buffer.from("ok"); },
      };
      queueMicrotask(() => callback(response));
      return req;
    });
    await expect(safeFetchText("https://public.example/")).resolves.toBe("ok");
  });
});