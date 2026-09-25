/**
 * Wouter decodes the pathname with decodeURI, which deliberately leaves %2F
 * inside route parameters. Read the original encoded path segment instead so
 * class names with slashes (and literal percent escapes) survive one decode.
 */
export function classNameFromPath(pathname: string, fallback: string): string {
  const rawSegment = pathname.match(/\/([^/]+)\/?$/)?.[1];
  if (!rawSegment) return fallback;
  try {
    return decodeURIComponent(rawSegment);
  } catch {
    return fallback;
  }
}