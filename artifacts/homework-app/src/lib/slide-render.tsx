/**
 * Shared read-only slide rendering used by present mode (`/teacher/
 * presentations/:id/present`), the public viewer (`/p/:id`), and any
 * future export pipeline (T412). The editor (`pages/teacher/
 * presentations/editor.tsx`) ships its own interactive renderer so it
 * can keep selection / drag / contentEditable logic in one place — but
 * it intentionally mirrors the same constants & helpers below so both
 * surfaces produce visually identical output.
 *
 * Keep this file dependency-light: no react-query, no socket, no
 * @dnd-kit. It only needs lucide-react for icon resolution and the
 * shared theme/pattern catalog.
 */
import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Square } from "lucide-react";
import type { Slide, SlideElement } from "@workspace/api-client-react";
import { getTheme, getPattern, defaultTextColorForSlide } from "@/lib/slide-themes";

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function getLucideIcon(name: string | null | undefined): IconCmp {
  if (!name) return Square as unknown as IconCmp;
  const Comp = (LucideIcons as unknown as Record<string, IconCmp>)[name];
  return (Comp ?? (Square as unknown as IconCmp));
}

export function slideBgStyle(
  slide: Slide,
  theme: string,
  pattern: string,
): React.CSSProperties {
  const p = getPattern(pattern);
  if (slide.background && slide.background !== "#ffffff" && slide.background !== "#fff") {
    return { background: slide.background, ...p.style };
  }
  const t = getTheme(theme);
  return {
    background: t.cssGrad ?? "#ffffff",
    ...p.style,
  };
}

function ShapeRenderer({ el }: { el: SlideElement }) {
  if (el.kind !== "shape") return null;
  const stroke = el.borderColor ?? "#1f2937";
  const sw = Math.max(1, el.borderWidth ?? 4);
  const fill = el.bgColor ?? "transparent";
  if (el.shape === "circle") {
    return (
      <div style={{
        width: "100%", height: "100%", background: fill,
        border: el.borderWidth ? `${sw}px solid ${stroke}` : undefined,
        borderRadius: "50%",
      }} />
    );
  }
  if (el.shape === "line" || el.shape === "divider") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (el.shape === "arrow") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id={`ah_${el.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
          </marker>
        </defs>
        <line x1="0" y1="50" x2="92" y2="50" stroke={stroke} strokeWidth={sw} markerEnd={`url(#ah_${el.id})`} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <div style={{
      width: "100%", height: "100%", background: fill,
      border: el.borderWidth ? `${sw}px solid ${stroke}` : undefined,
      borderRadius: 6,
    }} />
  );
}

/**
 * Read-only render of an embedded activity element (Phase 2A). The
 * interactive answering runtime ships in Phase 2B; for now we render
 * a styled brand card so the slide is presentable + exports cleanly.
 * Falls back gracefully when `prompt` is missing (e.g. mid-edit). */
function ActivityRenderer({ el, lang }: { el: SlideElement; lang?: "ar" | "en" }) {
  if (el.kind !== "activity") return null;
  const isAr = lang !== "en";
  const accent = el.accentColor ?? "#225739";
  const gold = "#D9A521";
  const kindLabel: Record<string, { ar: string; en: string }> = {
    mcq: { ar: "اختيار من متعدد", en: "Multiple choice" },
    true_false: { ar: "صح / خطأ", en: "True / False" },
    open: { ar: "إجابة مفتوحة", en: "Open answer" },
    poll: { ar: "تصويت", en: "Poll" },
    word_cloud: { ar: "سحابة الكلمات", en: "Word Cloud" },
    open_wall: { ar: "جدار الردود", en: "Response Wall" },
  };
  const label = (kindLabel[el.activityKind ?? "open"] ?? { ar: "نشاط", en: "Activity" })[isAr ? "ar" : "en"];
  const opts = (el.options ?? []).slice(0, 8);
  const showOpts =
    el.activityKind === "mcq" ||
    el.activityKind === "poll" ||
    el.activityKind === "true_false";
  const tfOpts = el.activityKind === "true_false" && opts.length === 0
    ? (isAr ? ["صح", "خطأ"] : ["True", "False"])
    : opts;
  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "#ffffff",
        border: `3px solid ${accent}`,
        borderRadius: 16,
        boxShadow: "0 6px 18px rgba(34,87,57,0.08)",
        padding: "18px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        <span style={{
          background: accent, color: "white",
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          padding: "4px 10px", borderRadius: 999,
        }}>{label}</span>
        <span style={{
          background: gold, color: "#1f2937",
          fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
          opacity: 0.9,
        }}>{isAr ? "نشاط" : "Activity"}</span>
      </div>
      <div style={{
        color: "#0f172a", fontWeight: 700, fontSize: 22, lineHeight: 1.35,
        wordBreak: "break-word",
      }}>
        {el.prompt || (isAr ? "نص السؤال…" : "Question text…")}
      </div>
      {showOpts && tfOpts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: tfOpts.length > 2 ? "1fr 1fr" : "1fr 1fr", gap: 8, marginTop: 4 }}>
          {tfOpts.map((opt, i) => (
            <div key={i} style={{
              border: `1.5px solid ${accent}33`,
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 16,
              color: "#1f2937",
              background: "#f8fafc",
            }}>
              <span style={{ color: accent, fontWeight: 700, marginInlineEnd: 8 }}>
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}
      {el.activityKind === "open" && (
        <div style={{
          flex: 1, minHeight: 40,
          border: `1.5px dashed ${accent}55`,
          borderRadius: 10,
          background: "#f8fafc",
          color: "#94a3b8", fontSize: 13,
          padding: "8px 12px",
        }}>
          {isAr ? "مساحة للإجابة" : "Answer space"}
        </div>
      )}
    </div>
  );
}

/* Phase 7 — Activity card. We deliberately do NOT label the slide
   with the underlying platform game's brand name (Kahoot, Wheel, …).
   Per teacher feedback the slide should just present the questions
   and answers cleanly so they're readable in projection mode, not
   only when running live. The first question is shown large; the
   rest are listed compactly so the teacher can see what's coming.
   The correct answer is highlighted on the slide itself — this is
   the teacher's projector view, not the student device. */
export function HasadGameRenderer({ el, lang }: { el: SlideElement; lang?: "ar" | "en" }) {
  if (el.kind !== "hasad-game") return null;
  const isAr = lang !== "en";
  const accent = el.accentColor ?? "#225739";
  const gold = "#D9A521";
  const questions = Array.isArray(el.questions) ? el.questions : [];
  const total = questions.length;
  const headTitle = el.topic || el.prompt || (isAr ? "نشاط الصف" : "Class activity");
  const first = questions[0];
  const rest = questions.slice(1);
  const letters = isAr ? ["أ", "ب", "ج", "د", "هـ", "و"] : ["A", "B", "C", "D", "E", "F"];
  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "#ffffff",
        border: `3px solid ${accent}`,
        borderRadius: 18,
        boxShadow: "0 8px 24px rgba(34,87,57,0.10)",
        padding: "20px 26px",
        display: "flex", flexDirection: "column", gap: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{
          background: accent, color: "white",
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
          padding: "5px 12px", borderRadius: 999,
        }}>{isAr ? "نشاط تفاعلي" : "Activity"}</span>
        {total > 0 ? (
          <span style={{
            background: gold, color: "#1f2937",
            fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 8,
          }}>{isAr ? `${total} سؤال` : `${total} question${total === 1 ? "" : "s"}`}</span>
        ) : null}
      </div>

      <div style={{ color: accent, fontWeight: 900, fontSize: 22, lineHeight: 1.25, wordBreak: "break-word" }}>
        {headTitle}
      </div>

      {first ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
          <div style={{ color: "#0f172a", fontWeight: 800, fontSize: 26, lineHeight: 1.3, wordBreak: "break-word" }}>
            {total > 1 ? <span style={{ color: accent, marginInlineEnd: 8 }}>{isAr ? "س1." : "Q1."}</span> : null}
            {first.prompt}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: first.options.length > 2 ? "1fr 1fr" : "1fr", gap: 8 }}>
            {first.options.map((opt, i) => {
              const isCorrect = i === first.correctIndex;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    background: isCorrect ? `${accent}14` : "#f8fafc",
                    border: `2px solid ${isCorrect ? accent : "#e2e8f0"}`,
                    borderRadius: 12,
                    color: "#0f172a", fontSize: 17, fontWeight: isCorrect ? 800 : 600,
                    minWidth: 0,
                  }}
                >
                  <span style={{
                    flex: "none",
                    width: 26, height: 26, borderRadius: 8,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: isCorrect ? accent : "#cbd5e1",
                    color: "white", fontWeight: 900, fontSize: 13,
                  }}>{letters[i] ?? String(i + 1)}</span>
                  <span style={{ wordBreak: "break-word", minWidth: 0 }}>{opt}</span>
                  {isCorrect ? (
                    <span style={{ marginInlineStart: "auto", color: accent, fontWeight: 900, fontSize: 18 }}>✓</span>
                  ) : null}
                </div>
              );
            })}
          </div>
          {rest.length > 0 ? (
            <div style={{
              marginTop: 4, padding: "8px 12px",
              background: "#f1f5f9", borderRadius: 10,
              color: "#475569", fontSize: 13, fontWeight: 600,
            }}>
              {isAr
                ? `+ ${rest.length} ${rest.length === 1 ? "سؤال إضافي" : "أسئلة إضافية"}`
                : `+ ${rest.length} more question${rest.length === 1 ? "" : "s"}`}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#64748b", fontSize: 16, fontWeight: 600, textAlign: "center",
        }}>
          {el.prompt
            ? el.prompt
            : (isAr ? "أضف أسئلة لهذا النشاط من لوحة التحرير." : "Add questions for this activity from the editor.")}
        </div>
      )}
    </div>
  );
}

/* ── VideoEmbedRenderer ────────────────────────────────────────────────
   Present-mode renderer for video-embed elements. Renders a live iframe
   so the teacher can play the video directly from the slide. For YouTube
   it uses the standard embed URL; for Hasad interactive video lessons it
   points at the student player route (/video/:id) which handles auth-
   free viewing via the lesson's accessMode. */
function VideoEmbedRenderer({ el }: { el: SlideElement }) {
  if (el.kind !== "video-embed") return null;
  const { videoKind, videoId, url, title } = el as {
    kind: "video-embed";
    videoKind?: string;
    videoId?: string;
    url?: string;
    title?: string;
  };

  let embedSrc = "";
  if (videoKind === "youtube" && videoId) {
    embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  } else if (videoKind === "hasad-video" && videoId) {
    embedSrc = `/video/${videoId}`;
  } else {
    embedSrc = url ?? "";
  }

  if (!embedSrc) {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 12,
      }}>
        <span style={{ color: "#64748b", fontSize: 14 }}>
          {videoKind === "hasad-video" ? "فيديو تفاعلي" : "Video"}
        </span>
      </div>
    );
  }

  return (
    <iframe
      src={embedSrc}
      title={title ?? (videoKind === "hasad-video" ? "فيديو تفاعلي" : "Video")}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        width: "100%", height: "100%",
        border: "none",
        borderRadius: 12,
        display: "block",
      }}
    />
  );
}

/**
 * Render a single slide at the canonical 1280×720 ratio. Parent
 * controls the outer size — we just lay the elements out at percentage
 * coordinates so it scales letterboxed inside any container.
 */
export function SlideRender({
  slide, theme, pattern, lang,
}: { slide: Slide; theme: string; pattern: string; lang?: "ar" | "en" }) {
  const bg = slideBgStyle(slide, theme, pattern);
  const dir = lang === "ar" ? "rtl" : "ltr";
  /* Per-slide default text color is contrast-aware: a slide with a
     light custom background must NOT inherit the dark theme's white
     default (that produced the white-on-white bug teachers reported).
     `defaultTextColorForSlide` resolves this by inspecting the actual
     slide.background luminance before falling back to the theme. */
  const defaultTextColor = defaultTextColorForSlide(slide, theme);
  /* When the slide has its own image, override the theme background.
     CRITICAL: do NOT include `backgroundImage / backgroundSize /
     backgroundPosition: undefined` in the style object — `bg` uses
     the `background` shorthand to set the theme gradient, and React
     applies undefined longhand values as empty strings on hydration/
     update, which CLEARS the gradient set by the shorthand. The
     symptom was a "fully black" preview/present surface where only
     text/elements rendered. Build the style conditionally instead. */
  const finalStyle: React.CSSProperties = slide.backgroundImage
    ? {
        ...bg,
        backgroundImage: `url(${slide.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : bg;
  return (
    <div
      dir={dir}
      lang={lang}
      className="relative w-full h-full overflow-hidden"
      style={finalStyle}
    >
      {(slide.elements ?? []).map((el: SlideElement) => {
        const left = `${(el.x / CANVAS_W) * 100}%`;
        const top = `${(el.y / CANVAS_H) * 100}%`;
        const w = `${(el.w / CANVAS_W) * 100}%`;
        const h = `${(el.h / CANVAS_H) * 100}%`;
        const style: React.CSSProperties = {
          position: "absolute",
          left, top, width: w, height: h,
        };
        if (el.kind === "text") {
          return (
            <div
              key={el.id}
              style={{
                ...style,
                color: el.color ?? defaultTextColor,
                fontFamily: el.fontFamily ?? undefined,
                fontSize: `${el.fontSize ?? 28}px`,
                fontWeight: el.fontWeight ?? "400",
                textAlign: (el.align as React.CSSProperties["textAlign"]) ?? "start",
                background: el.bgColor ?? undefined,
                lineHeight: 1.2,
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                overflow: "hidden",
              }}
            >
              {el.text ?? ""}
            </div>
          );
        }
        if (el.kind === "image") {
          const imgEl = el as typeof el & {
            objectFit?: "cover" | "contain" | "fill" | "none";
            objectPositionX?: number;
            objectPositionY?: number;
            cropPct?: { x: number; y: number; w: number; h: number };
            imageOpacity?: number;
            imageBorderRadius?: number;
            flipH?: boolean;
            flipV?: boolean;
            brightness?: number;
            contrast?: number;
            saturation?: number;
          };
          const transforms: string[] = [];
          if (imgEl.flipH) transforms.push("scaleX(-1)");
          if (imgEl.flipV) transforms.push("scaleY(-1)");
          const filters: string[] = [];
          if (imgEl.brightness !== undefined && imgEl.brightness !== 100) filters.push(`brightness(${imgEl.brightness}%)`);
          if (imgEl.contrast   !== undefined && imgEl.contrast   !== 100) filters.push(`contrast(${imgEl.contrast}%)`);
          if (imgEl.saturation !== undefined && imgEl.saturation !== 100) filters.push(`saturate(${imgEl.saturation}%)`);
          const crop = imgEl.cropPct;
          const transformStr = transforms.length ? transforms.join(" ") : undefined;
          const filterStr   = filters.length ? filters.join(" ") : undefined;
          return (
            <div key={el.id} style={{ ...style, borderRadius: imgEl.imageBorderRadius ? `${imgEl.imageBorderRadius}px` : undefined, overflow: "hidden", opacity: imgEl.imageOpacity ?? 1 }}>
              {el.url
                ? crop
                  ? (
                    <div style={{
                      width: `${100 / crop.w}%`,
                      height: `${100 / crop.h}%`,
                      transform: `translate(${-(crop.x / crop.w) * 100}%, ${-(crop.y / crop.h) * 100}%)`,
                    }}>
                      <img src={el.url} alt="" draggable={false}
                        style={{ display: "block", width: "100%", height: "100%", objectFit: "fill",
                          transform: transformStr, filter: filterStr }} />
                    </div>
                  )
                  : (
                    <img
                      src={el.url}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: imgEl.objectFit ?? "cover",
                        objectPosition: `${imgEl.objectPositionX ?? 50}% ${imgEl.objectPositionY ?? 50}%`,
                        transform: transformStr,
                        filter: filterStr,
                      }}
                      draggable={false}
                    />
                  )
                : null}
            </div>
          );
        }
        if (el.kind === "icon") {
          const Icon = getLucideIcon(el.iconName);
          const size = Math.max(16, Math.min(el.w, el.h) * 0.85);
          return (
            <div key={el.id} style={{ ...style, color: el.color ?? defaultTextColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={size} strokeWidth={1.75} />
            </div>
          );
        }
        if (el.kind === "activity") {
          return <div key={el.id} style={style}><ActivityRenderer el={el} lang={lang} /></div>;
        }
        if (el.kind === "hasad-game") {
          return <div key={el.id} style={style}><HasadGameRenderer el={el} lang={lang} /></div>;
        }
        if (el.kind === "video-embed") {
          return <div key={el.id} style={style}><VideoEmbedRenderer el={el} /></div>;
        }
        return <div key={el.id} style={style}><ShapeRenderer el={el} /></div>;
      })}
    </div>
  );
}

/**
 * A slide rendered into a 16:9 box that scales-to-fit the parent while
 * preserving the canonical aspect ratio (letterboxed). Used by present
 * mode and the public viewer.
 */
export function SlideStage({
  slide, theme, pattern, lang,
}: { slide: Slide; theme: string; pattern: string; lang?: "ar" | "en" }) {
  /* Letterbox a 16:9 stage inside any parent (full-screen present
     mode OR a constrained modal). We render the inner frame at its
     canonical pixel size (1280×720) and use a JS-driven `transform:
     scale(...)` to fit the parent — the same approach reveal.js,
     impress.js, and most slide engines use.

     Why not pure CSS: we tried both `width:100% + aspect-ratio +
     max-h-full` (landscape OK, portrait collapses) and container-
     query sizing with `containerType: size` + `100cqw / 100cqh`
     math (mathematically correct but observed to collapse to 0×0
     in production inside flex / animated / `position:absolute inset-0`
     ancestors, leaving only the parent's `bg-black`). A measured
     scale is robust regardless of parent layout, animation, or
     ancestor `containerType` quirks, and the inner content lays out
     once at a fixed pixel canvas so children never re-flow on
     resize. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const s = Math.min(r.width / CANVAS_W, r.height / CANVAS_H);
      if (s > 0 && Number.isFinite(s)) setScale(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      data-slide-stage=""
    >
      <div
        className="relative shadow-2xl"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flex: "none",
        }}
        data-slide-stage-frame=""
      >
        <SlideRender slide={slide} theme={theme} pattern={pattern} lang={lang} />
      </div>
    </div>
  );
}
