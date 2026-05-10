import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.VITE_API_URL || "";

export const ISLAMIC_GREEN = "#064e3b";
export const ISLAMIC_GOLD = "#fbbf24";
export const ISLAMIC_GOLD_LIGHT = "#fde68a";

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
      <g fill='none' stroke='rgba(251,191,36,0.10)' stroke-width='1'>
        <path d='M40 4 L52 28 L76 28 L56 44 L64 68 L40 54 L16 68 L24 44 L4 28 L28 28 Z'/>
        <circle cx='40' cy='40' r='14'/>
        <path d='M0 0 L80 80 M80 0 L0 80'/>
      </g>
    </svg>`,
  );

export function IslamicNavBar() {
  const [, setLocation] = useLocation();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (cancelled || !u) return;
        if (u.role === "teacher" || u.role === "organizer" || u.role === "admin" || u.isAdmin) {
          setIsTeacher(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const linkStyle: React.CSSProperties = {
    color: ISLAMIC_GOLD_LIGHT,
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid rgba(251,191,36,0.35)",
    background: "rgba(0,0,0,0.25)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.18s ease",
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20,
        justifyContent: "flex-start",
      }}
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else setLocation("/");
        }}
        style={linkStyle}
      >
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

export function IslamicShell({ children, title, subtitle, topSlot }: { children: ReactNode; title?: string; subtitle?: string; topSlot?: ReactNode }) {
  useEffect(() => {
    if (document.getElementById("islamic-cairo-font")) return;
    const link = document.createElement("link");
    link.id = "islamic-cairo-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);
  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        minHeight: "100vh",
        fontFamily: "'Cairo', system-ui, sans-serif",
        color: "#fef9c3",
        position: "relative",
        overflowX: "hidden",
        background:
          "radial-gradient(ellipse at top, #065f46 0%, #022c22 55%, #000000 100%)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${GEOMETRIC_PATTERN}")`,
          backgroundSize: "80px 80px",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(251,191,36,0.18) 0, transparent 35%), radial-gradient(circle at 85% 90%, rgba(252,211,77,0.12) 0, transparent 40%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "32px 16px 80px",
        }}
      >
        {topSlot}
        {title && (
          <div style={{ textAlign: "center", marginBottom: subtitle ? 4 : 24 }}>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 900,
                margin: 0,
                lineHeight: 1.2,
                background: "linear-gradient(135deg, #fde68a 0%, #fef3c7 35%, #fbbf24 70%, #f59e0b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 24px rgba(251,191,36,0.45))",
              }}
            >
              {title}
            </h1>
            <div
              style={{
                margin: "10px auto 0",
                width: 120,
                height: 3,
                background: "linear-gradient(90deg, transparent, #fbbf24, transparent)",
                borderRadius: 2,
              }}
            />
          </div>
        )}
        {subtitle && (
          <p style={{ textAlign: "center", color: "#fde68a", opacity: 0.85, marginTop: 0, marginBottom: 24 }}>{subtitle}</p>
        )}
        {children}
      </div>
    </div>
  );
}

export function IslamicCard({
  children,
  glow,
  onClick,
  style,
  disabled,
}: {
  children: ReactNode;
  glow?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const interactive = !!onClick && !disabled;
  return (
    <div
      onClick={interactive ? onClick : undefined}
      style={{
        background:
          "linear-gradient(135deg, rgba(6,78,59,0.55) 0%, rgba(6,95,70,0.35) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid rgba(251,191,36,${glow ? 0.55 : 0.22})`,
        borderRadius: 18,
        padding: 22,
        boxShadow: glow
          ? "0 0 40px rgba(251,191,36,0.35), inset 0 0 30px rgba(251,191,36,0.05)"
          : "0 8px 32px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.03)",
        cursor: interactive ? "pointer" : disabled ? "not-allowed" : "default",
        opacity: disabled ? 0.55 : 1,
        transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
        position: "relative",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!interactive) return;
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 0 50px rgba(251,191,36,0.45), inset 0 0 30px rgba(251,191,36,0.08)";
        e.currentTarget.style.borderColor = "rgba(251,191,36,0.6)";
      }}
      onMouseLeave={(e) => {
        if (!interactive) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = glow
          ? "0 0 40px rgba(251,191,36,0.35), inset 0 0 30px rgba(251,191,36,0.05)"
          : "0 8px 32px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.03)";
        e.currentTarget.style.borderColor = `rgba(251,191,36,${glow ? 0.55 : 0.22})`;
      }}
    >
      {children}
    </div>
  );
}

export function GoldButton({
  children,
  onClick,
  disabled,
  style,
  type,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled
          ? "linear-gradient(135deg, #4b5563, #374151)"
          : "linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #f59e0b 100%)",
        color: disabled ? "#9ca3af" : "#1f2937",
        border: disabled ? "1px solid #4b5563" : "1px solid rgba(252,211,77,0.8)",
        padding: "12px 26px",
        borderRadius: 14,
        fontWeight: 800,
        fontFamily: "inherit",
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled
          ? "none"
          : "0 6px 22px rgba(251,191,36,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
        transition: "transform 0.2s, box-shadow 0.2s, filter 0.2s",
        letterSpacing: "0.02em",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.filter = "brightness(1.08)";
        e.currentTarget.style.boxShadow = "0 10px 28px rgba(251,191,36,0.6), inset 0 1px 0 rgba(255,255,255,0.6)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.filter = "none";
        e.currentTarget.style.boxShadow = "0 6px 22px rgba(251,191,36,0.45), inset 0 1px 0 rgba(255,255,255,0.5)";
      }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  style,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "rgba(6,78,59,0.5)",
        color: "#fde68a",
        border: "1px solid rgba(251,191,36,0.4)",
        padding: "10px 20px",
        borderRadius: 12,
        fontWeight: 700,
        fontFamily: "inherit",
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        backdropFilter: "blur(8px)",
        transition: "background 0.2s, border-color 0.2s, color 0.2s",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "rgba(251,191,36,0.15)";
        e.currentTarget.style.borderColor = "rgba(251,191,36,0.7)";
        e.currentTarget.style.color = "#fef3c7";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "rgba(6,78,59,0.5)";
        e.currentTarget.style.borderColor = "rgba(251,191,36,0.4)";
        e.currentTarget.style.color = "#fde68a";
      }}
    >
      {children}
    </button>
  );
}

export function BackLink() {
  const [, setLocation] = useLocation();
  return (
    <GhostButton onClick={() => setLocation("/islamic")} style={{ marginBottom: 16 }}>
      ← العودة
    </GhostButton>
  );
}

export function playCorrect() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(523, ctx.currentTime);
    o.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
    o.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.start();
    o.stop(ctx.currentTime + 0.45);
  } catch {
    /* ignore */
  }
}

export function playWrong() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    /* ignore */
  }
}
