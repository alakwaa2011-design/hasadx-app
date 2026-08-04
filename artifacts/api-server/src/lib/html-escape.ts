/**
 * Escape user-controlled (or externally-sourced) text before interpolating
 * it into email HTML. Covers the five characters that are meaningful in HTML
 * contexts: &, <, >, ", '
 */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validate and sanitise a URL before placing it in an href or action
 * attribute. Only http: and https: schemes are allowed; anything else
 * (javascript:, data:, vbscript:, …) is replaced with "about:blank" so
 * the link is inert rather than executable.
 *
 * The returned string is also HTML-escaped so it can be interpolated
 * directly into an attribute value without a separate esc() call.
 */
export function safeUrl(url: string | null | undefined): string {
  const raw = String(url ?? "").trim();
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "about:blank";
    }
  } catch {
    // Not a valid absolute URL — treat as unsafe.
    return "about:blank";
  }
  return esc(raw);
}
