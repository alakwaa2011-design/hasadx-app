/** HTTP's quoted filename must be ASCII; preserve Arabic via RFC 5987. */
export function presentationCsvDisposition(title: string | null, sessionId: number, kind: "session" | "students") {
  const raw = (title ?? "").trim() || "presentation";
  const ascii = raw.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "presentation";
  const label = kind === "students" ? "طلاب جلسة" : "جلسة";
  const utf8 = encodeURIComponent(`${raw} - ${label} ${sessionId}.csv`)
    .replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}-${kind}-${sessionId}.csv"; filename*=UTF-8''${utf8}`;
}
