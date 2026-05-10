/* ─────────────────────────────────────────────────────────────
   Sanitisers for AI-generated per-slide design fields.

   Pro / Claude tiers can return:
     - customStyle.background : a raw CSS background value (gradient, solid).
     - customStyle.accentColor: a hex colour.
     - svgIllustration        : inline SVG markup for a decorative element.

   Anything that fails validation is dropped silently — the slide just falls
   back to the deck-level theme. We never throw; failures must not block
   bulk generation of an otherwise good deck.
   ───────────────────────────────────────────────────────────── */

const MAX_BACKGROUND_LEN = 400;
const MAX_SVG_LEN = 8_000;

/* Allow only the characters needed for safe CSS background values:
   - hex colours, rgb/rgba/hsl(a)
   - linear-gradient / radial-gradient / conic-gradient
   - whitespace, commas, parens, percent, hash, digits, letters, dot, hyphen
   We explicitly reject anything that smells like url(), expression(), <, >,
   semicolons, braces, backslashes, or @import. */
const BACKGROUND_OK_RE = /^[A-Za-z0-9#%(),.\s\-+/_]+$/;
const BACKGROUND_FN_ALLOWED = new Set([
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
]);

export function sanitizeCssBackground(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > MAX_BACKGROUND_LEN) return null;
  if (!BACKGROUND_OK_RE.test(v)) return null;

  /* Verify every "fn(" prefix is in the allowlist. */
  const fnMatches = v.matchAll(/([a-zA-Z-]+)\(/g);
  for (const m of fnMatches) {
    if (!BACKGROUND_FN_ALLOWED.has(m[1].toLowerCase())) return null;
  }

  /* Disallow CSS escape hatches even if they pass the regex. */
  const lower = v.toLowerCase();
  if (lower.includes("url(") || lower.includes("expression(") || lower.includes("@import")) {
    return null;
  }
  return v;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export function sanitizeHexColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return HEX_COLOR_RE.test(v) ? v : null;
}

export function sanitizeCustomStyle(raw: unknown): {
  background: string;
  textOnLight?: boolean;
  accentColor?: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const bg = sanitizeCssBackground(o.background);
  if (!bg) return null;
  const out: { background: string; textOnLight?: boolean; accentColor?: string } = {
    background: bg,
  };
  if (typeof o.textOnLight === "boolean") out.textOnLight = o.textOnLight;
  const accent = sanitizeHexColor(o.accentColor);
  if (accent) out.accentColor = accent;
  return out;
}

/* ─────────────────────────────────────────────────────────────
   SVG sanitiser.

   We accept a tiny allow-list of presentational SVG elements and strip
   everything else. Attributes are filtered by an allow-list too, with extra
   guards: no `on*` event handlers, no `href`/`xlink:href` (would allow
   javascript: links), no `style` (could embed url()/expression()).

   The result is plain SVG markup safe to render inside the slide via
   `dangerouslySetInnerHTML`.
   ───────────────────────────────────────────────────────────── */

/* Allowed tags. Map lowercase form (the lookup key, since SVG/HTML tag names
   are case-insensitive in our parser) to the canonical form we want to emit
   (SVG gradient elements are camelCase and stop being recognised by the
   browser if rewritten lowercase). */
const SVG_ALLOWED_TAGS: Record<string, string> = {
  svg: "svg", g: "g", defs: "defs", title: "title", desc: "desc",
  path: "path", rect: "rect", circle: "circle", ellipse: "ellipse",
  line: "line", polyline: "polyline", polygon: "polygon",
  lineargradient: "linearGradient", radialgradient: "radialGradient", stop: "stop",
  text: "text", tspan: "tspan",
};

const SVG_ALLOWED_ATTRS = new Set([
  "viewbox", "width", "height", "xmlns", "preserveaspectratio",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-opacity", "fill-opacity", "opacity",
  "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "points", "transform", "offset", "stop-color", "stop-opacity",
  "gradientunits", "gradienttransform", "spreadmethod",
  "id", "class",
  "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline",
]);

function stripSvgAttributes(attrStr: string): string {
  /* Tokenise simple `name="value"` / `name='value'` pairs. Anything weird is
     dropped. */
  const out: string[] = [];
  const re = /([a-zA-Z_][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    const name = m[1].toLowerCase();
    const value = (m[3] ?? m[4] ?? "").trim();
    if (name.startsWith("on")) continue;
    if (name === "style") continue;
    if (name === "href" || name === "xlink:href") continue;
    if (!SVG_ALLOWED_ATTRS.has(name)) continue;
    /* Block javascript: / data: / vbscript: even in safe attrs (defence
       in depth — most won't carry URLs anyway). */
    const lv = value.toLowerCase();
    if (lv.includes("javascript:") || lv.includes("vbscript:") || lv.startsWith("data:")) continue;
    if (lv.includes("url(") || lv.includes("expression(")) continue;
    /* Re-quote with double quotes; escape any inner double quotes. */
    const safeValue = value.replace(/"/g, "&quot;");
    out.push(`${name}="${safeValue}"`);
  }
  return out.join(" ");
}

export function sanitizeSvg(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_SVG_LEN) return null;
  if (!/^<svg[\s>]/i.test(trimmed)) return null;
  if (/<script|<foreignobject|<iframe/i.test(trimmed)) return null;

  /* Walk all tags and rewrite each one with a sanitised attribute string.
     Drop disallowed tags entirely (open AND close). Self-closing tags keep
     their trailing slash. */
  const tagRe = /<\s*(\/?)\s*([a-zA-Z][\w-]*)\b([^>]*)>/g;
  let result = "";
  let last = 0;
  let kept = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(trimmed)) !== null) {
    const [full, slash, name, attrs] = m;
    const lowered = name.toLowerCase();
    /* Append text in between as-is — but only if it's whitespace/safe. */
    const between = trimmed.slice(last, m.index);
    last = m.index + full.length;
    if (between) result += between.replace(/[<>]/g, "");

    const canonical = SVG_ALLOWED_TAGS[lowered];
    if (!canonical) {
      /* Skip this tag entirely. */
      continue;
    }
    kept++;
    if (slash === "/") {
      result += `</${canonical}>`;
    } else {
      const cleanedAttrs = stripSvgAttributes(attrs);
      const selfClose = /\/\s*$/.test(attrs);
      if (selfClose) {
        result += `<${canonical}${cleanedAttrs ? " " + cleanedAttrs : ""}/>`;
      } else {
        result += `<${canonical}${cleanedAttrs ? " " + cleanedAttrs : ""}>`;
      }
    }
  }
  result += trimmed.slice(last).replace(/[<>]/g, "");
  if (kept === 0) return null;
  /* Final guard: must still parse as starting with <svg. */
  if (!/^<svg\b/i.test(result.trim())) return null;
  return result.trim();
}

const MAX_IMAGE_PROMPT_LEN = 400;
export function sanitizeImagePrompt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > MAX_IMAGE_PROMPT_LEN) return null;
  /* Strip control characters and braces — defence against accidental prompt
     injection markers. */
  const cleaned = v.replace(/[\u0000-\u001F\u007F{}]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}
