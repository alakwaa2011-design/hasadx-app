/* Presenter window ("نافذة المقدّم"): the teacher's private view while the deck is projected in the other
   window. It shows the current slide's speaker notes in large type, the next slide's title and the slide
   counter, and its buttons drive the projected window. The two windows talk over a BroadcastChannel keyed
   by the deck id, so nothing leaves the browser. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

type El = { kind: string; text?: string; fontSize?: number; y?: number };
type PSlide = { id: string; notes?: string; elements?: El[] };
type Deck = { id: number; title: string; language: "ar" | "en"; slides: PSlide[] };

function slideTitle(s: PSlide | undefined, fallback: string): string {
  const texts = (s?.elements ?? []).filter((e) => e.kind === "text" && e.text?.trim());
  if (texts.length === 0) return fallback;
  texts.sort((a, b) => (b.fontSize ?? 0) - (a.fontSize ?? 0) || (a.y ?? 0) - (b.y ?? 0));
  return (texts[0].text ?? "").trim().slice(0, 90);
}

export default function PresenterWindow() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading, error } = useQuery<Deck>({
    queryKey: [`/api/presentations/${id}`],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/presentations/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    retry: 0,
  });
  const [idx, setIdx] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const chan = useRef<BroadcastChannel | null>(null);
  const isAr = (data?.language ?? "ar") === "ar";
  const slides = data?.slides ?? [];

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(`hasad-present-${id}`);
    chan.current = ch;
    ch.onmessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; idx?: number };
      if (m?.type === "slide" && typeof m.idx === "number") setIdx(m.idx);
    };
    ch.postMessage({ type: "hello" });
    return () => { ch.close(); chan.current = null; };
  }, [id]);

  const send = (cmd: "next" | "prev") => chan.current?.postMessage({ type: "cmd", cmd });
  const current = slides[Math.min(idx, Math.max(0, slides.length - 1))];
  const next = slides[idx + 1];
  const notes = useMemo(() => (current?.notes ?? "").trim(), [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); send(isAr ? "prev" : "next"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); send(isAr ? "next" : "prev"); }
      else if (e.key === " " || e.key === "PageDown") { e.preventDefault(); send("next"); }
      else if (e.key === "PageUp") { e.preventDefault(); send("prev"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAr]);

  if (isLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (error || !data) {
    return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-white">تعذّر تحميل العرض</div>;
  }

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="fixed inset-0 flex flex-col bg-slate-950 text-white" style={{ fontFamily: "Tajawal, Cairo, sans-serif" }}>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-amber-300">{isAr ? "نافذة المقدّم" : "Presenter view"}</div>
          <div className="truncate text-base font-black">{data.title}</div>
        </div>
        <div dir="ltr" className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-black tabular-nums">
          {Math.min(idx + 1, slides.length)} / {slides.length}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-3 text-sm font-bold text-white/60">{isAr ? "الشريحة الحالية" : "Current slide"}</div>
        <h1 className="mb-5 text-2xl font-black leading-snug">{slideTitle(current, isAr ? "(بدون عنوان)" : "(untitled)")}</h1>
        {notes ? (
          <p className="whitespace-pre-wrap font-bold leading-[1.9]" style={{ fontSize: `${22 * fontScale}px` }}>{notes}</p>
        ) : (
          <p className="rounded-xl border border-dashed border-white/20 p-5 text-white/55">
            {isAr ? "لا توجد ملاحظات لهذه الشريحة. أضفها من المحرر في «ملاحظات المعلم»." : "No notes for this slide. Add them in the editor."}
          </p>
        )}
      </main>

      <footer className="border-t border-white/10 bg-slate-900 px-5 py-3">
        <div className="mb-3 truncate text-sm text-white/70">
          <span className="font-black text-amber-300">{isAr ? "التالية: " : "Next: "}</span>
          {next ? slideTitle(next, isAr ? "(بدون عنوان)" : "(untitled)") : (isAr ? "نهاية العرض" : "End of deck")}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => send("prev")} className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-white px-4 font-black text-slate-950 hover:bg-slate-200">
            {isAr ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            {isAr ? "السابق" : "Previous"}
          </button>
          <button onClick={() => send("next")} className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl px-4 font-black hover:brightness-110" style={{ background: "#D9A521", color: "#1c1003" }}>
            {isAr ? "التالي" : "Next"}
            {isAr ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setFontScale((s) => Math.max(0.8, s - 0.15))} className="h-12 w-12 rounded-xl bg-white/10 text-lg font-black hover:bg-white/20" aria-label="A-">A−</button>
            <button onClick={() => setFontScale((s) => Math.min(1.9, s + 0.15))} className="h-12 w-12 rounded-xl bg-white/10 text-lg font-black hover:bg-white/20" aria-label="A+">A+</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
