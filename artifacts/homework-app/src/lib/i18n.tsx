import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ar } from "@/locales/ar";
import { en } from "@/locales/en";

export type Language = "ar" | "en";
export type Translations = typeof ar;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  dir: "rtl" | "ltr";
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = "hw_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved === "en" || saved === "ar") ? saved : "ar";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  };

  const t = lang === "ar" ? ar : en;
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
