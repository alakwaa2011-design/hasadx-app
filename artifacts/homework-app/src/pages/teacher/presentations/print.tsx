/**
 * Print view for the deck → PDF export flow.
 *
 * Two modes:
 *  - Default (manual): teacher opens the page in their browser; we
 *    fetch via the authed `useGetPresentation` and render a "Print"
 *    button that invokes `window.print()` on click so they can save
 *    via the system dialog.
 *  - SSR mode (`?ssr=1&exportToken=…`): used by the server-side
 *    puppeteer worker. We fetch via the tokenized read endpoint
 *    (no session cookie required), do NOT call `window.print()`
 *    (puppeteer prints via `page.pdf()` instead), and signal layout
 *    completion through `window.__SLIDES_READY__ = true` so the
 *    headless browser knows when to capture.
 *
 * Both modes render exactly the same `SlideRender` component used by
 * present mode, guaranteeing pixel-for-pixel parity with the editor.
 *
 * Route: `/teacher/presentations/:id/print`
 */
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useGetPresentation, getGetPresentationQueryKey } from "@workspace/api-client-react";
import type { Slide } from "@workspace/api-client-react";
import { SlideRender } from "@/lib/slide-render";

declare global {
  interface Window { __SLIDES_READY__?: boolean }
}

interface DeckShape {
  title?: string;
  language?: "ar" | "en";
  theme?: string;
  pattern?: string;
  slides?: Slide[];
}

function DownloadPdfButton({ id, isAr }: { id: number; isAr: boolean }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy || !Number.isFinite(id)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/presentations/${id}/export/pdf`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string })?.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      const filename = m ? decodeURIComponent(m[1]) : `presentation-${id}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(
        (isAr ? "تعذّر التصدير: " : "Export failed: ") + (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };
  const label = busy
    ? (isAr ? "جارٍ التجهيز…" : "Preparing…")
    : (isAr ? "تنزيل PDF" : "Download PDF");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        color: "white",
        background: busy ? "#6b7280" : "#1d4ed8",
        border: "none",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,.3)",
        cursor: busy ? "wait" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default function PresentationPrint() {
  const [, params] = useRoute<{ id: string }>("/teacher/presentations/:id/print");
  const id = parseInt(params?.id ?? "", 10);

  const search = typeof window !== "undefined" ? window.location.search : "";
  const qp = new URLSearchParams(search);
  const exportToken = qp.get("exportToken");
  const ssrMode = qp.get("ssr") === "1";

  /* Tokenized fetch for SSR mode — bypasses the authed hook so the
     puppeteer worker (which has no session cookie) can still read. */
  const [tokenDeck, setTokenDeck] = useState<DeckShape | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  useEffect(() => {
    if (!exportToken || !Number.isFinite(id)) return;
    let cancelled = false;
    fetch(`/api/presentations/${id}/export-data?token=${encodeURIComponent(exportToken)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DeckShape>;
      })
      .then((d) => { if (!cancelled) setTokenDeck(d); })
      .catch((e: Error) => { if (!cancelled) setTokenError(e.message); });
    return () => { cancelled = true; };
  }, [exportToken, id]);

  /* Authed fetch for the manual flow. Disabled in SSR mode to avoid
     a redundant 401-prone request from the unauthenticated worker. */
  const { data: authedData, isLoading } = useGetPresentation(id, {
    query: {
      queryKey: getGetPresentationQueryKey(id),
      enabled: Number.isFinite(id) && !exportToken,
    },
  });

  const deck: DeckShape | undefined = exportToken
    ? (tokenDeck ?? undefined)
    : (authedData as DeckShape | undefined);

  /* Signal readiness to the headless browser once slides have
     mounted. Two RAFs ensures layout + paint have committed.
     Also signal on token error so puppeteer doesn't hang the full
     15s wait on a deck that will never render. */
  useEffect(() => {
    if (!deck?.slides && !tokenError) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__SLIDES_READY__ = true;
      });
    });
  }, [deck?.slides?.length, tokenError]);

  if (tokenError) {
    return <div style={{ padding: 24, fontFamily: "sans-serif", color: "#b91c1c" }}>Export error: {tokenError}</div>;
  }
  if ((!exportToken && isLoading) || !deck) return null;
  const isAr = deck.language === "ar";
  const slides = deck.slides ?? [];
  return (
    <div dir={isAr ? "rtl" : "ltr"} lang={isAr ? "ar" : "en"} className="bg-white">
      <style>{`
        @page { size: 1280px 720px; margin: 0; }
        html, body { background: white; margin: 0; padding: 0; }
        .print-slide {
          width: 1280px; height: 720px; page-break-after: always;
          break-after: page; overflow: hidden; position: relative;
        }
        .print-slide:last-child { page-break-after: auto; break-after: auto; }
        @media screen {
          body { background: ${ssrMode ? "white" : "#1a1a1a"}; padding: ${ssrMode ? "0" : "24px"}; }
          .print-slide {
            margin: ${ssrMode ? "0" : "0 auto 24px"};
            box-shadow: ${ssrMode ? "none" : "0 8px 24px rgba(0,0,0,.4)"};
            transform-origin: top left;
          }
        }
        @media print {
          body { background: white !important; padding: 0 !important; }
          .print-slide { margin: 0 !important; box-shadow: none !important; }
          .print-trigger { display: none !important; }
        }
      `}</style>
      {!ssrMode && (
        <div
          className="print-trigger"
          style={{
            position: "fixed",
            top: 16,
            insetInlineEnd: 16,
            zIndex: 50,
            display: "flex",
            gap: 8,
          }}
        >
          <DownloadPdfButton id={id} isAr={isAr} />
          <button
            type="button"
            onClick={() => { try { window.print(); } catch { /* noop */ } }}
            style={{
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              color: "white",
              background: "#0f766e",
              border: "none",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,.3)",
              cursor: "pointer",
            }}
          >
            {isAr ? "طباعة" : "Print"}
          </button>
        </div>
      )}
      {slides.map((s, i) => (
        <div key={s.id ?? i} className="print-slide">
          <SlideRender lang={deck.language}
            slide={s}
            theme={deck.theme ?? "harvest"}
            pattern={deck.pattern ?? "solid"}
          />
        </div>
      ))}
    </div>
  );
}
