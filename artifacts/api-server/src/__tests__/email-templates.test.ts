/**
 * Integration-level tests verifying that every email-building function
 * in routes/auth.ts sanitises any link argument through safeUrl, so a
 * developer who accidentally writes esc(link) instead of safeUrl(link)
 * in a new template is caught here.
 *
 * Strategy: call each builder with dangerous scheme URLs as every URL
 * argument and assert:
 *   1. No href= or action= attribute in the rendered HTML contains a
 *      dangerous scheme (javascript:, vbscript:, data:).
 *   2. Where safeUrl is the only sanitiser, the href is replaced with
 *      "about:blank".
 *
 * Note: the templates also render the raw link as visible plain text (so
 * the user can copy-paste it).  That text value is sanitised by esc(), which
 * HTML-encodes special characters but does NOT strip the scheme — that is
 * intentional and harmless because it is display text, not an executable
 * attribute.  These tests therefore focus on href= attributes, which is the
 * security-sensitive surface.
 */

import { describe, it, expect } from "vitest";
import {
  buildResetEmail,
  buildNewDeviceLoginEmail,
  buildOtpEmail,
  buildPasswordChangedEmail,
} from "../lib/auth-emails";

/** Matches any href="..." or href='...' that contains a dangerous scheme. */
const DANGEROUS_HREF = /href\s*=\s*["'][^"']*(?:javascript:|vbscript:|data:)/i;
/** Matches any action="..." or action='...' that contains a dangerous scheme. */
const DANGEROUS_ACTION = /action\s*=\s*["'][^"']*(?:javascript:|vbscript:|data:)/i;

function assertNoUnsafeLinks(html: string): void {
  expect(html, "href attribute must not contain a dangerous scheme").not.toMatch(DANGEROUS_HREF);
  expect(html, "action attribute must not contain a dangerous scheme").not.toMatch(DANGEROUS_ACTION);
}

const EVIL_VARIANTS = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",      // mixed-case bypass attempt
  "JAVASCRIPT:alert(1)",      // upper-case bypass attempt
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
];

// ─── buildResetEmail ──────────────────────────────────────────────────────────

describe("buildResetEmail – URL sanitisation", () => {
  it("does not place javascript: in any href attribute", () => {
    const { html } = buildResetEmail("أستاذ", "javascript:alert(1)");
    assertNoUnsafeLinks(html);
  });

  it("replaces the evil href with about:blank", () => {
    const { html } = buildResetEmail("أستاذ", "javascript:alert(1)");
    expect(html).toContain('href="about:blank"');
  });

  it.each(EVIL_VARIANTS)("blocks dangerous scheme in href: %s", (url) => {
    const { html } = buildResetEmail("أستاذ", url);
    assertNoUnsafeLinks(html);
  });

  it("keeps a safe https:// URL intact in the href", () => {
    const safeLink = "https://hasad.app/reset?token=abc123";
    const { html } = buildResetEmail("أستاذ", safeLink);
    expect(html).toContain(`href="${safeLink}"`);
  });
});

// ─── buildNewDeviceLoginEmail ─────────────────────────────────────────────────

describe("buildNewDeviceLoginEmail – URL sanitisation", () => {
  const baseArgs = {
    name: "أستاذ",
    loginAt: new Date("2026-01-01T12:00:00Z"),
    ipAddress: "1.2.3.4",
    userAgent: "Mozilla/5.0",
  };

  it("does not place javascript: in any href attribute", () => {
    const { html } = buildNewDeviceLoginEmail(
      baseArgs.name,
      baseArgs.loginAt,
      baseArgs.ipAddress,
      baseArgs.userAgent,
      "javascript:alert(1)",
    );
    assertNoUnsafeLinks(html);
  });

  it("replaces the evil href with about:blank", () => {
    const { html } = buildNewDeviceLoginEmail(
      baseArgs.name,
      baseArgs.loginAt,
      baseArgs.ipAddress,
      baseArgs.userAgent,
      "javascript:alert(1)",
    );
    expect(html).toContain('href="about:blank"');
  });

  it.each(EVIL_VARIANTS)("blocks dangerous scheme in href: %s", (url) => {
    const { html } = buildNewDeviceLoginEmail(
      baseArgs.name,
      baseArgs.loginAt,
      baseArgs.ipAddress,
      baseArgs.userAgent,
      url,
    );
    assertNoUnsafeLinks(html);
  });

  it("keeps a safe https:// sessions URL intact in the href", () => {
    const safeLink = "https://hasad.app/teacher/sessions";
    const { html } = buildNewDeviceLoginEmail(
      baseArgs.name,
      baseArgs.loginAt,
      baseArgs.ipAddress,
      baseArgs.userAgent,
      safeLink,
    );
    expect(html).toContain(`href="${safeLink}"`);
  });
});

// ─── buildOtpEmail ────────────────────────────────────────────────────────────
// buildOtpEmail has no URL parameters.  We verify its output contains no href
// at all, acting as a regression guard against a future refactor accidentally
// adding an un-sanitised link.

describe("buildOtpEmail – no href attributes", () => {
  it("contains no href in the rendered HTML", () => {
    const { html } = buildOtpEmail("أستاذ", "123456");
    expect(html).not.toMatch(/\bhref\s*=/i);
  });

  it("contains no action attribute in the rendered HTML", () => {
    const { html } = buildOtpEmail("أستاذ", "123456");
    expect(html).not.toMatch(/\baction\s*=/i);
  });

  it("does not contain any dangerous scheme anywhere in the rendered HTML", () => {
    const { html } = buildOtpEmail("أستاذ", "123456");
    assertNoUnsafeLinks(html);
  });
});

// ─── buildPasswordChangedEmail ────────────────────────────────────────────────
// buildPasswordChangedEmail has no URL parameters.  Same regression guard.

describe("buildPasswordChangedEmail – no href attributes", () => {
  it("contains no href in the rendered HTML (reset context)", () => {
    const { html } = buildPasswordChangedEmail("أستاذ", new Date(), "reset");
    expect(html).not.toMatch(/\bhref\s*=/i);
  });

  it("contains no href in the rendered HTML (change context)", () => {
    const { html } = buildPasswordChangedEmail("أستاذ", new Date(), "change");
    expect(html).not.toMatch(/\bhref\s*=/i);
  });

  it("contains no action attribute in the rendered HTML", () => {
    const { html } = buildPasswordChangedEmail("أستاذ", new Date(), "reset");
    expect(html).not.toMatch(/\baction\s*=/i);
  });

  it("does not contain any dangerous scheme anywhere in the rendered HTML", () => {
    const { html } = buildPasswordChangedEmail("أستاذ", new Date(), "reset");
    assertNoUnsafeLinks(html);
  });
});
