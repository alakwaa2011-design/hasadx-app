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
