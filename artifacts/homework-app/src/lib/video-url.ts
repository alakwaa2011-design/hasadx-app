/**
 * Video URL detection and normalization for the slide editor.
 * Supports:
 *  - YouTube (watch, short, embed, shorts, live)
 *  - Hasaad interactive video lessons (/video/:id or /student/video-lesson/:id)
 */

export type VideoKind = "youtube" | "hasad-video";

export interface ParsedVideo {
  kind: VideoKind;
  videoId: string;
  /** Ready-to-use iframe src */
  embedUrl: string;
  /** Static thumbnail URL (null for Hasaad videos) */
  thumbnailUrl: string | null;
}

const YT_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

const HASAD_RE = /\/(?:student\/)?video(?:-lesson)?\/(\d+)/;

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const url = raw.trim();
  if (!url) return null;

  const ytMatch = url.match(YT_RE);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      kind: "youtube",
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  const hasadMatch = url.match(HASAD_RE);
  if (hasadMatch) {
    const videoId = hasadMatch[1];
    return {
      kind: "hasad-video",
      videoId,
      embedUrl: `/video/${videoId}`,
      thumbnailUrl: null,
    };
  }

  return null;
}

export function isVideoUrl(raw: string): boolean {
  return parseVideoUrl(raw) !== null;
}
