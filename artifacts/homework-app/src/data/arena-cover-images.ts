// Static cover images for the built-in ARENA_SECTIONS sub-categories.
// Files live in src/assets/arena-covers and are named:
//   <section-id>__<sub-id>.png
// They are imported eagerly by Vite and resolved to hashed asset URLs so the
// images load instantly with the rest of the bundle.

const modules = import.meta.glob("../assets/arena-covers/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const lookup: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const file = path.split("/").pop()!;
  const key = file.replace(/\.png$/, "");
  lookup[key] = url;
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
