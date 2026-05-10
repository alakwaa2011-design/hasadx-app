/* Lightweight per-page SEO hook.
   Updates <title>, meta description, canonical, and the core
   Open Graph / Twitter tags on mount and whenever the inputs change.
   We resolve canonical against window.location at runtime so it works
   for both the .replit.app preview and the production hasadx.com
   domain without hard-coding the host. */

import { useEffect } from "react";

const SITE_ORIGIN = "https://hasadx.com";

interface SeoInput {
  /** Full page title — appears verbatim in the browser tab and in
      search-result snippets. Keep ≤ 60 chars. */
  title: string;
  /** Meta description shown beneath the title in Google. ≤ 160 chars. */
  description: string;
  /** Path-only canonical (e.g. "/about"). Defaults to current path. */
  canonicalPath?: string;
  /** Absolute URL or path to a 1200×630 social card. */
  ogImage?: string;
  /** Override Open Graph type — defaults to "website". */
  ogType?: "website" | "article" | "profile";
  /** When true, emits `<meta name="robots" content="noindex, follow">` so
      the page is excluded from search results (e.g. auth pages). */
  noindex?: boolean;
}

function setMeta(attr: "name" | "property", key: string, value: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function resolveCanonical(path?: string): string {
  /* In production we always pin canonical to the apex domain so
     duplicate previews/staging hosts don't dilute the signal. */
  const p = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  /* Strip query/hash for the canonical — they aren't part of the
     resource identity for SEO purposes. */
  return SITE_ORIGIN + (p.startsWith("/") ? p : `/${p}`);
}

export function useSeo({ title, description, canonicalPath, ogImage, ogType = "website", noindex = false }: SeoInput): void {
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = title;
    setMeta("name", "description", description);
    /* Per-page robots directive. Default page-level robots come from
       index.html (index, follow); we only override here when explicitly
       asked to noindex. */
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1");
    const canonical = resolveCanonical(canonicalPath);
    setLink("canonical", canonical);
    /* Open Graph + Twitter for richer share/embed cards. */
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonical);
    if (ogImage) {
      const img = ogImage.startsWith("http") ? ogImage : SITE_ORIGIN + (ogImage.startsWith("/") ? ogImage : `/${ogImage}`);
      setMeta("property", "og:image", img);
      setMeta("name", "twitter:image", img);
    }
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
  }, [title, description, canonicalPath, ogImage, ogType]);
}
