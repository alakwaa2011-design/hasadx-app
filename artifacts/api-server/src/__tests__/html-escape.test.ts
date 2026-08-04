/**
 * Unit tests for the html-escape module.
 *
 * Tests cover:
 *  - safeUrl: scheme allowlist (https, http pass through; javascript, data, relative → about:blank)
 *  - safeUrl: edge cases (empty string, null, undefined)
 *  - safeUrl: HTML special characters in a valid URL are escaped in the output
 */

import { describe, it, expect } from "vitest";
import { esc, safeUrl } from "../lib/html-escape";

// ─── esc ──────────────────────────────────────────────────────────────────────

describe("esc", () => {
  it("escapes & < > \" '", () => {
    expect(esc(`<script>alert("it's a test & more")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;it&#39;s a test &amp; more&quot;)&lt;/script&gt;",
    );
  });

  it("returns empty string for null", () => {
    expect(esc(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(esc(undefined)).toBe("");
  });

  it("leaves plain text unchanged", () => {
    expect(esc("hello world")).toBe("hello world");
  });
});

// ─── safeUrl ──────────────────────────────────────────────────────────────────

describe("safeUrl", () => {
  it("passes a valid https:// URL through unchanged", () => {
    expect(safeUrl("https://example.com/path")).toBe("https://example.com/path");
  });

  it("passes a valid http:// URL through unchanged", () => {
    expect(safeUrl("http://example.com/page")).toBe("http://example.com/page");
  });

  it("returns about:blank for a javascript: URL", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("about:blank");
  });

  it("returns about:blank for a javascript: URL with mixed case", () => {
    expect(safeUrl("JavaScript:alert(1)")).toBe("about:blank");
  });

  it("returns about:blank for a data: URL", () => {
    expect(safeUrl("data:text/html,<h1>hi</h1>")).toBe("about:blank");
  });

  it("returns about:blank for a relative URL", () => {
    expect(safeUrl("/some/path")).toBe("about:blank");
  });

  it("returns about:blank for an empty string", () => {
    expect(safeUrl("")).toBe("about:blank");
  });

  it("returns about:blank for null", () => {
    expect(safeUrl(null)).toBe("about:blank");
  });

  it("returns about:blank for undefined", () => {
    expect(safeUrl(undefined)).toBe("about:blank");
  });

  it("HTML-escapes special characters in a valid URL", () => {
    // A URL with an ampersand in the query string must be HTML-escaped for
    // safe embedding inside an attribute value.
    const url = "https://example.com/search?a=1&b=2";
    expect(safeUrl(url)).toBe("https://example.com/search?a=1&amp;b=2");
  });

  it("HTML-escapes double quotes in a valid URL", () => {
    // Unusual but possible — must not break out of the attribute.
    const url = 'https://example.com/path?q="hello"';
    expect(safeUrl(url)).toBe("https://example.com/path?q=&quot;hello&quot;");
  });

  it("returns about:blank for a vbscript: URL", () => {
    expect(safeUrl("vbscript:msgbox(1)")).toBe("about:blank");
  });

  it("returns about:blank for a bare word with no scheme", () => {
    expect(safeUrl("notaurl")).toBe("about:blank");
  });
});
