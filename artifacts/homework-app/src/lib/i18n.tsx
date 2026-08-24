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
const FETCH_LOCALE_PATCH = Symbol.for("hasad.locale-fetch-patched");

function isAppApiRequest(input: RequestInfo | URL) {
  const url = input instanceof Request
    ? new URL(input.url)
    : new URL(typeof input === "string" ? input : input.toString(), window.location.origin);
  const configuredApiUrl = import.meta.env.VITE_API_URL;
  const configuredApiOrigin = configuredApiUrl
    ? new URL(configuredApiUrl, window.location.origin).origin
    : window.location.origin;

  return (
    url.pathname.startsWith("/api/") &&
    (url.origin === window.location.origin || url.origin === configuredApiOrigin)
  );
}

function getStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

function installLocaleAwareFetch() {
  if (typeof window === "undefined" || (window as any)[FETCH_LOCALE_PATCH]) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (!isAppApiRequest(input)) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("Accept-Language", getStoredLanguage());
    return nativeFetch(input, { ...init, headers });
  }) as typeof window.fetch;
  (window as any)[FETCH_LOCALE_PATCH] = true;
}

installLocaleAwareFetch();

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    return getStoredLanguage();
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
