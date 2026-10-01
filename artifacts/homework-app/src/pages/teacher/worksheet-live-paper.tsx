import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil, FileText } from "lucide-react";
import { WorksheetPrintView, type WorksheetData, type LayoutSnapshot } from "@/pages/teacher/worksheet-print";

const A4_PX = 793.7; // 210mm at 96dpi

/**
 * Real paper beside the generator. It reuses WorksheetPrintView (the same
 * renderer as print/PDF) scaled to fit its column. Mount at most one at a
 * time: the owner unmounts it while the full preview overlay is open so only
 * a single #ws-printable-root exists.
 */
export function WorksheetLivePaper({
  ar, data, flushRef, onDraftChange, onEnlarge, onRequestEdit,
}: {
  onRequestEdit?: (questionId: string) => void;
  ar: boolean;
  data: WorksheetData;
  flushRef: { current: (() => LayoutSnapshot) | null };
  onDraftChange: (snapshot: LayoutSnapshot) => void;
  onEnlarge: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [innerH, setInnerH] = useState(1123);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const w = host.clientWidth;
      if (w > 0) setScale(Math.min(1, w / A4_PX));
      if (innerRef.current) setInnerH(innerRef.current.scrollHeight);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (innerRef.current) setInnerH(innerRef.current.scrollHeight); }, [data]);

  const empty = data.questions.length === 0;
  return (
    <section data-testid="panel-live-paper" aria-label={ar ? "الورقة الحية" : "Live paper"} className="rounded-2xl border border-border/70 bg-muted/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-black text-foreground">
          <FileText className="w-3.5 h-3.5 text-primary" />
          {ar ? "ورقتك كما ستُطبع" : "Your paper, as printed"}
        </span>
        <button type="button" data-testid="button-enlarge-paper" onClick={onEnlarge} disabled={empty}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/5 disabled:opacity-40">
          <Pencil className="w-3.5 h-3.5" />{ar ? "فتح الورقة" : "Open worksheet"}
        </button>
      </div>
      <div ref={hostRef} className="p-2 max-h-[58dvh] overflow-y-auto lg:max-h-none lg:overflow-visible" dir={data.language === "ar" ? "rtl" : "ltr"}>
        <div style={{ height: innerH * scale, overflow: "hidden" }}>
            <div ref={innerRef} className="bg-white shadow-md" style={{ ["--ws-inv-scale" as string]: String(Math.max(1, 1 / scale)), width: A4_PX, transform: `scale(${scale})`, transformOrigin: ar ? "top right" : "top left", marginInlineStart: 0 }}>
              <WorksheetPrintView data={data} flushRef={flushRef} onDraftChange={onDraftChange} onRequestEdit={onRequestEdit} />
            </div>
          </div>
      </div>
    </section>
  );
}
