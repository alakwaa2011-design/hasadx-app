import { describe, it, expect } from "vitest";
import { resolveExportOrigin } from "../routes/presentations";

describe("resolveExportOrigin", () => {
  it("prefers APP_ORIGIN when set", () => {
    expect(
      resolveExportOrigin({
        APP_ORIGIN: "https://override.example.com",
        REPLIT_DOMAINS: "ignored.replit.app",
        REPLIT_DEV_DOMAIN: "ignored.dev",
      } as NodeJS.ProcessEnv),
    ).toBe("https://override.example.com");
  });

  it("falls back to first REPLIT_DOMAINS entry when APP_ORIGIN is missing", () => {
    expect(
      resolveExportOrigin({
        REPLIT_DOMAINS: "primary.replit.app,secondary.replit.app",
        REPLIT_DEV_DOMAIN: "ignored.dev",
      } as NodeJS.ProcessEnv),
    ).toBe("https://primary.replit.app");
  });

  it("falls back to REPLIT_DEV_DOMAIN when prior options are absent", () => {
    expect(
      resolveExportOrigin({
        REPLIT_DEV_DOMAIN: "workspace.replit.dev",
      } as NodeJS.ProcessEnv),
    ).toBe("https://workspace.replit.dev");
  });

  it("falls back to localhost when no env vars are set", () => {
    // URL.origin drops the default :80 for http, but it's still the
    // shared-proxy loopback that fronts every artifact in dev.
    expect(resolveExportOrigin({} as NodeJS.ProcessEnv)).toBe(
      "http://localhost",
    );
  });

  it("skips invalid APP_ORIGIN and uses the next candidate", () => {
    expect(
      resolveExportOrigin({
        APP_ORIGIN: "not a valid url",
        REPLIT_DOMAINS: "fallback.replit.app",
      } as NodeJS.ProcessEnv),
    ).toBe("https://fallback.replit.app");
  });

  it("rejects non-http(s) APP_ORIGIN schemes (SSRF guard)", () => {
    expect(
      resolveExportOrigin({
        APP_ORIGIN: "file:///etc/passwd",
        REPLIT_DOMAINS: "safe.replit.app",
      } as NodeJS.ProcessEnv),
    ).toBe("https://safe.replit.app");
  });

  it("trims whitespace around REPLIT_DOMAINS entries", () => {
    expect(
      resolveExportOrigin({
        REPLIT_DOMAINS: "  spaced.replit.app  , other.app",
      } as NodeJS.ProcessEnv),
    ).toBe("https://spaced.replit.app");
  });
});
