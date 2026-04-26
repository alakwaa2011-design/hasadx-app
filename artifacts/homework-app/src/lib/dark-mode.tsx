import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ColorScheme = "light" | "dark" | "system";

interface DarkModeContextValue {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  isDark: boolean;
}

const DarkModeContext = createContext<DarkModeContextValue>({
  colorScheme: "system",
  setColorScheme: () => {},
  isDark: false,
});

const STORAGE_KEY = "hasad-color-scheme";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ColorScheme | null;
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch {}
    return "system";
  });

  const [systemDark, setSystemDark] = useState(() => {
    try { return getSystemDark(); } catch { return false; }
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isDark = colorScheme === "dark" || (colorScheme === "system" && systemDark);

  useEffect(() => {
    applyDark(isDark);
  }, [isDark]);

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    try { localStorage.setItem(STORAGE_KEY, scheme); } catch {}
  };

  return (
    <DarkModeContext.Provider value={{ colorScheme, setColorScheme, isDark }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode(): DarkModeContextValue {
  return useContext(DarkModeContext);
}
