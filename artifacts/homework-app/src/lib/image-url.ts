/**
 * Resolves a question image URL to the correct fetch-able URL for the current
 * environment.
 *
 * Problem: AI-generated images are stored in Replit Object Storage and their
 * path is persisted in the DB as "/objects/uploads/<uuid>.png". Before this
 * fix was introduced, create-assignment.tsx prepended the dev-time VITE_API_URL
 * host (e.g. "https://abc123.replit.dev") when saving the assignment, so the
 * DB ended up containing a stale absolute URL tied to a Replit dev-domain that
 * rotates over time — breaking all images after a few days.
 *
 * This function normalises any of the three forms that may appear in the DB:
 *   1. "/objects/..."            → newly-stored relative path (after the fix)
 *   2. "http(s)://…/api/objects/…" → stale absolute URL (legacy data)
 *   3. Anything else             → base64 data URI, external http URL, etc.
 *
 * For (1) and (2) we re-build the URL using the *current* VITE_API_URL so the
 * request is always routed to the live API server regardless of how old the
 * DB record is.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Form 1: relative object-storage path — prepend current API base.
  if (url.startsWith("/objects/")) {
    return `${API_BASE}/api${url}`;
  }

  // Form 2: absolute URL from a (possibly stale) host — extract the path part
  // and re-build with the current API base so it works regardless of domain rotation.
  const match = url.match(/\/api(\/objects\/.+)$/);
  if (match) {
    return `${API_BASE}/api${match[1]}`;
  }

  // Form 3: base64 data URI, external http/https image, etc. — return as-is.
  return url;
}
