// Static cover images for the built-in ARENA_SECTIONS sub-categories.
// Files live in src/assets/arena-covers and are named:
//   <section-id>__<sub-id>.webp  (small thumbnails, generated from PNG sources)
// They are imported eagerly by Vite and resolved to hashed asset URLs so the
// images load instantly with the rest of the bundle.

const webpModules = import.meta.glob("../assets/arena-covers/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const pngModules = import.meta.glob("../assets/arena-covers/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const lookup: Record<string, string> = {};
// PNG first (fallback), then WebP overrides — WebP wins where present.
for (const [p, url] of Object.entries(pngModules)) {
  const file = p.split("/").pop()!;
  lookup[file.replace(/\.png$/, "")] = url;
}
for (const [p, url] of Object.entries(webpModules)) {
  const file = p.split("/").pop()!;
  lookup[file.replace(/\.webp$/, "")] = url;
}

/**
 * Returns a bundled cover image URL for the given (sectionId, subId), or
 * undefined when no asset has been provided. The fallback path keeps the
 * emoji + gradient cover already used by ARENA_COVER_PALETTE.
 */
export function getStaticCoverImage(
  sectionId: string,
  subId: string,
): string | undefined {
  return lookup[`${sectionId}__${subId}`];
}

/**
 * Rewrites a DB-stored cover URL (e.g. `/arena-covers/foo.png`) to its small
 * WebP thumbnail variant when the path lives under `/arena-covers/`. Falls
 * back to the original URL untouched (custom uploads, external URLs, etc.).
 */
export function toCoverThumb(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (/^\/arena-covers\/[^/]+\.png$/i.test(url)) {
    return url.replace(/\.png$/i, ".webp");
  }
  if (url.includes("wikimedia.org") || url.includes("wikipedia.org")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}
