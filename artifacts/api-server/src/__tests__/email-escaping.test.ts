/**
 * XSS-escaping regression tests for every email template builder.
 *
 * Each test feeds a raw XSS payload through all user-controlled fields of a
 * builder and asserts that the resulting HTML contains no unescaped '<img',
 * '<script', or 'onerror' sequences.  A future builder that skips esc() will
 * immediately fail here.
 */

import { describe, it, expect } from "vitest";

import {
  buildOtpEmail,
  buildPasswordChangedEmail,
  buildNewDeviceLoginEmail,
  buildResetEmail,
} from "../lib/auth-emails";

import {
  buildParentMessageEmail,
  buildTeacherReplyNotificationEmail,
  buildParentThreadReplyEmail,
} from "../lib/parent-message-email";

import {
  buildBadgeEmailHtml,
  buildThresholdEmailHtml,
  buildLevelUpEmailHtml,
  buildQuestCompleteEmailHtml,
} from "../lib/xp/email-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const XSS = `<img src=x onerror=alert(1)>`;

/**
 * Assert that user-supplied XSS payloads are escaped in the rendered HTML.
 *
 * We check that the exact raw payload string never appears verbatim in the
 * output — if `esc()` is applied, the `<` becomes `&lt;` and the payload
 * cannot be present as-is.  This approach is immune to false positives from
 * legitimate `<img>` or `<script>` elements that are part of the template
 * itself (e.g. a logo image in the email shell).
 */
function assertEscaped(html: string, label: string) {
  expect(
    html,
    `${label}: raw XSS payload must not appear verbatim`,
  ).not.toContain(XSS);
}

// ---------------------------------------------------------------------------
// auth-emails.ts
// ---------------------------------------------------------------------------

describe("buildOtpEmail", () => {
  it("escapes XSS in name and otp fields", () => {
    const { html } = buildOtpEmail(XSS, XSS);
    assertEscaped(html, "buildOtpEmail");
  });

  it("escapes only the injected fields, not the rest of the template", () => {
    const { html } = buildOtpEmail("أحمد", "123456");
    expect(html).toContain("أحمد");
    expect(html).toContain("123456");
  });
});

describe("buildPasswordChangedEmail", () => {
  const date = new Date("2026-01-15T10:00:00Z");

  it("escapes XSS in name (reset context)", () => {
    const { html } = buildPasswordChangedEmail(XSS, date, "reset");
    assertEscaped(html, "buildPasswordChangedEmail(reset)");
  });

  it("escapes XSS in name (change context)", () => {
    const { html } = buildPasswordChangedEmail(XSS, date, "change");
    assertEscaped(html, "buildPasswordChangedEmail(change)");
  });
});

describe("buildNewDeviceLoginEmail", () => {
  const date = new Date("2026-01-15T10:00:00Z");

  it("escapes XSS in name, ipAddress, userAgent, and sessionsLink", () => {
    const { html } = buildNewDeviceLoginEmail(XSS, date, XSS, XSS, XSS);
    assertEscaped(html, "buildNewDeviceLoginEmail");
  });

  it("does not corrupt safe inputs", () => {
    const { html } = buildNewDeviceLoginEmail(
      "سارة",
      date,
      "203.0.113.42",
      "Mozilla/5.0 (Windows NT 10.0) Chrome/120",
      "https://example.com/sessions",
    );
    expect(html).toContain("سارة");
    expect(html).toContain("203.0.113.42");
  });
});

describe("buildResetEmail", () => {
  it("escapes XSS in name and link", () => {
    const { html } = buildResetEmail(XSS, XSS);
    assertEscaped(html, "buildResetEmail");
  });

  it("does not corrupt a legitimate reset link", () => {
    const { html } = buildResetEmail("خالد", "https://example.com/reset?token=abc");
    expect(html).toContain("خالد");
    expect(html).toContain("https://example.com/reset?token=abc");
  });
});

// ---------------------------------------------------------------------------
// parent-message-email.ts
// ---------------------------------------------------------------------------

describe("buildParentMessageEmail", () => {
  it("escapes XSS in all user-controlled fields", () => {
    const html = buildParentMessageEmail({
      teacherName: XSS,
      studentName: XSS,
      studentClass: XSS,
      gradeLevel: XSS,
      subject: XSS,
      body: XSS,
      portalUrl: XSS,
      parentName: XSS,
    });
    assertEscaped(html, "buildParentMessageEmail");
  });

  it("does not corrupt safe inputs", () => {
    const html = buildParentMessageEmail({
      teacherName: "ليلى",
      studentName: "محمد",
      studentClass: "أ",
      gradeLevel: "الصف الخامس",
      subject: "الواجب",
      body: "متميز هذا الأسبوع",
      portalUrl: "https://example.com/portal",
    });
    expect(html).toContain("ليلى");
    expect(html).toContain("محمد");
    expect(html).toContain("https://example.com/portal");
  });
});

describe("buildTeacherReplyNotificationEmail", () => {
  it("escapes XSS in all user-controlled fields", () => {
    const html = buildTeacherReplyNotificationEmail({
      teacherName: XSS,
      studentName: XSS,
      parentName: XSS,
      replyText: XSS,
      inboxUrl: XSS,
    });
    assertEscaped(html, "buildTeacherReplyNotificationEmail");
  });
});

describe("buildParentThreadReplyEmail", () => {
  it("escapes XSS in all user-controlled fields", () => {
    const html = buildParentThreadReplyEmail({
      teacherName: XSS,
      parentName: XSS,
      replyText: XSS,
      portalUrl: XSS,
    });
    assertEscaped(html, "buildParentThreadReplyEmail");
  });

  it("handles missing parentName without throwing", () => {
    const html = buildParentThreadReplyEmail({
      teacherName: "فاطمة",
      replyText: XSS,
      portalUrl: "https://example.com/portal",
    });
    assertEscaped(html, "buildParentThreadReplyEmail (no parentName)");
  });
});

// ---------------------------------------------------------------------------
// xp/email-helpers.ts
// ---------------------------------------------------------------------------

describe("buildBadgeEmailHtml", () => {
  it("escapes XSS in teacherName and badgeName", () => {
    const html = buildBadgeEmailHtml(XSS, XSS);
    assertEscaped(html, "buildBadgeEmailHtml");
  });
});

describe("buildThresholdEmailHtml", () => {
  it("escapes XSS in teacherName and label", () => {
    const html = buildThresholdEmailHtml(XSS, XSS);
    assertEscaped(html, "buildThresholdEmailHtml");
  });
});

describe("buildLevelUpEmailHtml", () => {
  it("escapes XSS in teacherName and levelNameAr", () => {
    const html = buildLevelUpEmailHtml(XSS, 10, XSS);
    assertEscaped(html, "buildLevelUpEmailHtml");
  });

  it("does not corrupt a safe level number", () => {
    const html = buildLevelUpEmailHtml("عمر", 25, "خبير");
    expect(html).toContain("25");
    expect(html).toContain("خبير");
  });
});

describe("buildQuestCompleteEmailHtml", () => {
  it("escapes XSS in teacherName and questNameAr", () => {
    const html = buildQuestCompleteEmailHtml(XSS, XSS, 50);
    assertEscaped(html, "buildQuestCompleteEmailHtml");
  });

  it("does not corrupt safe reward XP value", () => {
    const html = buildQuestCompleteEmailHtml("نورة", "مهمة الأسبوع", 100);
    expect(html).toContain("100");
    expect(html).toContain("مهمة الأسبوع");
  });
});
