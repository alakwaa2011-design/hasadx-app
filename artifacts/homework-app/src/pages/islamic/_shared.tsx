import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.VITE_API_URL || "";

/* ─── Palette ──────────────────────────────────────────────────────────────
   Background:   #f7f2e8  warm cream
   Surface:      #ffffff  white cards
   Border:       #e8d8b8  warm tan
   Primary text: #2c1a06  deep warm brown
   Muted text:   #78716c  stone
   Amber accent: #d97706  amber-600  (badges, highlights)
   Amber dark:   #92400e  amber-900  (headings, gold button text)
   Amber button: #fef3c7  amber-100  (ghost button fill)
   ───────────────────────────────────────────────────────────────────────── */
export const ISLAMIC_GREEN      = "#064e3b";
export const ISLAMIC_GOLD       = "#d97706";  // amber-600
export const ISLAMIC_GOLD_LIGHT = "#92400e";  // amber-900
export const ISLAMIC_CREAM      = "#f7f2e8";

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err?.message || res.statusText);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

const GEOMETRIC_PATTERN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'>
      <g fill='none' stroke='rgba(180,83,9,0.07)' stroke-width='1'>
        <path d='M40 4 L52 28 L76 28 L56 44 L64 68 L40 54 L16 68 L24 44 L4 28 L28 28 Z'/>
        <circle cx='40' cy='40' r='14'/>
        <path d='M0 0 L80 80 M80 0 L0 80'/>
      </g>
    </svg>`,
  );

/* ─── NavBar ──────────────────────────────────────────────────────────────── */
export function IslamicNavBar() {
  const [, setLocation] = useLocation();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (cancelled || !u) return;
        if (u.role === "teacher" || u.role === "organizer" || u.role === "admin" || u.isAdmin)
          setIsTeacher(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const linkStyle: React.CSSProperties = {
    color: "#92400e",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
    padding: "6px 14px",
    borderRadius: 10,
    border: "1px solid #e8d8b8",
    background: "#fef9ee",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.15s, border-color 0.15s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, justifyContent: "flex-start" }} dir="rtl">
      <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation("/"); }} style={linkStyle}>
        ← رجوع
      </button>
      <button type="button" onClick={() => setLocation("/")} style={linkStyle}>
        🏠 القائمة الرئيسية
      </button>
      {isTeacher && (
        <button type="button" onClick={() => setLocation("/teacher")} style={linkStyle}>
          📋 لوحة التحكم
        </button>
      )}
    </div>
  );
}

/* ─── Shell ───────────────────────────────────────────────────────────────── */
export function IslamicShell({ children, title, subtitle, topSlot }: {
  children: ReactNode; title?: string; subtitle?: string; topSlot?: ReactNode;
}) {
  useEffect(() => {
    if (document.getElementById("islamic-cairo-font")) return;
    const link = document.createElement("link");
    link.id = "islamic-cairo-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div dir="rtl" lang="ar" style={{
      minHeight: "100vh",
      fontFamily: "'Cairo', system-ui, sans-serif",
      color: "#2c1a06",
      position: "relative",
      overflowX: "hidden",
      background: "#f7f2e8",
    }}>
      {/* Subtle geometric pattern overlay */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: `url("${GEOMETRIC_PATTERN}")`,
        backgroundSize: "80px 80px",
        opacity: 1,
        pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "28px 16px 80px" }}>
        {topSlot}

        {title && (
          <div style={{ textAlign: "center", marginBottom: subtitle ? 6 : 28 }}>
            <h1 style={{
              fontSize: "clamp(26px, 5vw, 42px)",
              fontWeight: 900,
              margin: 0,
              lineHeight: 1.2,
              color: "#92400e",
              letterSpacing: "-0.01em",
            }}>
              {title}
            </h1>
            <div style={{
              margin: "10px auto 0",
              width: 80,
              height: 3,
              borderRadius: 2,
              background: "linear-gradient(90deg, transparent, #d97706, transparent)",
            }} />
          </div>
        )}

        {subtitle && (
          <p style={{ textAlign: "center", color: "#78716c", marginTop: 6, marginBottom: 24, fontSize: 15 }}>
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}

/* ─── Card ────────────────────────────────────────────────────────────────── */
export function IslamicCard({ children, glow, onClick, style, disabled }: {
  children: ReactNode; glow?: boolean; onClick?: () => void;
  style?: React.CSSProperties; disabled?: boolean;
}) {
  const interactive = !!onClick && !disabled;
  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        background: glow ? "#fffbf0" : "#ffffff",
        border: `1px solid ${glow ? "#e8c97a" : "#e8d8b8"}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: glow
          ? "0 4px 20px rgba(180,83,9,0.14), 0 1px 4px rgba(0,0,0,0.06)"
          : "0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        cursor: interactive ? "pointer" : disabled ? "not-allowed" : "default",
        opacity: disabled ? 0.55 : 1,
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        position: "relative",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!interactive) return;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(180,83,9,0.16), 0 2px 6px rgba(0,0,0,0.07)";
        e.currentTarget.style.borderColor = "#d4a843";
      }}
      onMouseLeave={(e) => {
        if (!interactive) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = glow
          ? "0 4px 20px rgba(180,83,9,0.14), 0 1px 4px rgba(0,0,0,0.06)"
          : "0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = glow ? "#e8c97a" : "#e8d8b8";
      }}
    >
      {children}
    </div>
  );
}

/* ─── GoldButton ──────────────────────────────────────────────────────────── */
export function GoldButton({ children, onClick, disabled, style, type }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  style?: React.CSSProperties; type?: "button" | "submit";
}) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled
          ? "linear-gradient(135deg, #d1c7b0, #c4ba9e)"
          : "linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)",
        color: disabled ? "#9c8e7a" : "#1c0f00",
        border: disabled ? "1px solid #c4ba9e" : "1px solid #b7860c",
        padding: "12px 26px",
        borderRadius: 12,
        fontWeight: 800,
        fontFamily: "inherit",
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled
          ? "none"
          : "0 4px 14px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
        transition: "transform 0.18s, box-shadow 0.18s, filter 0.18s",
        letterSpacing: "0.01em",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.filter = "brightness(1.06)";
        e.currentTarget.style.boxShadow = "0 8px 22px rgba(217,119,6,0.45), inset 0 1px 0 rgba(255,255,255,0.5)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.filter = "none";
        e.currentTarget.style.boxShadow = "0 4px 14px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.4)";
      }}
    >
      {children}
    </button>
  );
}

/* ─── GhostButton ─────────────────────────────────────────────────────────── */
export function GhostButton({ children, onClick, style, disabled }: {
  children: ReactNode; onClick?: () => void;
  style?: React.CSSProperties; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #e8c97a",
        padding: "10px 20px",
        borderRadius: 12,
        fontWeight: 700,
        fontFamily: "inherit",
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "#fde68a";
        e.currentTarget.style.borderColor = "#d4a843";
        e.currentTarget.style.boxShadow = "0 3px 10px rgba(180,83,9,0.18)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "#fef3c7";
        e.currentTarget.style.borderColor = "#e8c97a";
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)";
      }}
    >
      {children}
    </button>
  );
}

/* ─── BackLink ────────────────────────────────────────────────────────────── */
export function BackLink() {
  const [, setLocation] = useLocation();
  return (
    <GhostButton onClick={() => setLocation("/islamic")} style={{ marginBottom: 16 }}>
      ← العودة
    </GhostButton>
  );
}

/* ─── Audio helpers ───────────────────────────────────────────────────────── */
export function playCorrect() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(523, ctx.currentTime);
    o.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
    o.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.start(); o.stop(ctx.currentTime + 0.45);
  } catch { /* ignore */ }
}

export function playWrong() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch { /* ignore */ }
}
