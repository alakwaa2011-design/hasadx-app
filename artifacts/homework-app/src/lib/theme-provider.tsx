import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface ThemeSettings {
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  platformName: string | null;
  logoUrl: string | null;
}

interface ThemeContextValue {
  settings: ThemeSettings;
  updateTheme: (s: ThemeSettings) => void;
}

const defaultSettings: ThemeSettings = {
  primaryColor: null,
  accentColor: null,
  fontFamily: null,
  platformName: null,
  logoUrl: null,
};

const ThemeContext = createContext<ThemeContextValue>({
  settings: defaultSettings,
  updateTheme: () => {},
});

export function useTheme(): ThemeSettings {
  return useContext(ThemeContext).settings;
}

export function useThemeUpdater(): (s: ThemeSettings) => void {
  return useContext(ThemeContext).updateTheme;
}

export function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function loadGoogleFont(family: string) {
  const id = `gfont-${family.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700;900&display=swap`;
  document.head.appendChild(link);
}

export function applyThemeSettings(s: ThemeSettings) {
  const root = document.documentElement;
  if (s.primaryColor) {
    const hsl = hexToHsl(s.primaryColor);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
    }
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
  }
  if (s.accentColor) {
    const hsl = hexToHsl(s.accentColor);
    if (hsl) root.style.setProperty("--accent", hsl);
  } else {
    root.style.removeProperty("--accent");
  }
  if (s.fontFamily && s.fontFamily !== "Tajawal") {
    loadGoogleFont(s.fontFamily);
    document.body.style.fontFamily = `'${s.fontFamily}', sans-serif`;
  } else {
    document.body.style.fontFamily = "";
  }
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);

  const updateTheme = (s: ThemeSettings) => {
    setSettings(s);
    applyThemeSettings(s);
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/public/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return;
        const s: ThemeSettings = {
          primaryColor: data.primaryColor || null,
          accentColor: data.accentColor || null,
          fontFamily: data.fontFamily || null,
          platformName: data.platformName || null,
          logoUrl: data.logoUrl || null,
        };
        setSettings(s);
        applyThemeSettings(s);
      })
      .catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
