/**
 * WorksheetCanvasEditor
 *
 * A free-form canvas layer on top of a worksheet page. Teachers can:
 *  - Add text boxes, rectangles, circles, and horizontal lines
 *  - Drag elements anywhere on the A4 page
 *  - Resize elements via corner handles
 *  - Edit text inline (double-click) with font size / color / bold / italic
 *  - Delete selected elements
 *  - Save the layout to settings.layout (persisted in DB via worksheet settings)
 *
 * Coordinates are stored as percentages (0–100) of the rendered A4 page
 * element so the layout is resolution-independent.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Type, Square, Circle, Minus, Trash2, MousePointer,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Check, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import type { WorksheetData } from "@/pages/teacher/worksheet-print";
import type { CanvasElement, CanvasElementKind, CanvasLayout } from "@/pages/teacher/worksheet-canvas-types";
export type { CanvasElement, CanvasElementKind, CanvasLayout };

const BRAND_PRIMARY = "#225739";
const BRAND_GOLD = "#D9A521";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => `ce_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function defaultElement(kind: CanvasElementKind, x = 30, y = 30): CanvasElement {
  const base = { id: uid(), kind, x, y };
  switch (kind) {
    case "text":
      return { ...base, width: 30, height: 8, text: "نص حر", fontSize: 14, fontColor: "#1a2421", bold: false, italic: false, align: "right" };
    case "rect":
      return { ...base, width: 30, height: 15, fillColor: "transparent", strokeColor: BRAND_PRIMARY, strokeWidth: 2 };
    case "circle":
      return { ...base, width: 20, height: 10, fillColor: "transparent", strokeColor: BRAND_PRIMARY, strokeWidth: 2 };
    case "line":
      return { ...base, width: 40, height: 2, fillColor: "transparent", strokeColor: BRAND_PRIMARY, strokeWidth: 2 };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  ar: boolean;
  data: WorksheetData;
  initialLayout: CanvasLayout;
  onSave: (layout: CanvasLayout) => void;
  onClose: () => void;
}

type Tool = "select" | CanvasElementKind;

export default function WorksheetCanvasEditor({ ar, data, initialLayout, onSave, onClose }: Props) {
  const dir = ar ? "rtl" : "ltr";
  const [elements, setElements] = useState<CanvasElement[]>(() =>
    initialLayout.elements.map(e => ({ ...e }))
  );
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  const selected = elements.find(e => e.id === selectedId) ?? null;

  // ── Convert page-relative px → % ──────────────────────────────────────────
  const toPercent = useCallback((pxX: number, pxY: number) => {
    const page = pageRef.current;
    if (!page) return { x: 0, y: 0 };
    const r = page.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((pxX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((pxY - r.top) / r.height) * 100)),
    };
  }, []);

  // ── Click on canvas background → add element or deselect ─────────────────
  const handlePagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-canvas-element]")) return;
      setSelectedId(null);
      setEditingTextId(null);
      if (activeTool === "select") return;
      const { x, y } = toPercent(e.clientX, e.clientY);
      const el = defaultElement(activeTool, x, y);
      setElements(prev => [...prev, el]);
      setSelectedId(el.id);
      setActiveTool("select");
    },
    [activeTool, toPercent],
  );

  // ── Drag element ──────────────────────────────────────────────────────────
  const dragState = useRef<{
    id: string;
    startX: number; startY: number;
    origX: number; origY: number;
  } | null>(null);

  const handleElementPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      if (editingTextId === id) return; // let textarea handle it
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelectedId(id);
      const el = elements.find(x => x.id === id);
      if (!el) return;
      dragState.current = {
        id, startX: e.clientX, startY: e.clientY,
        origX: el.x, origY: el.y,
      };
    },
    [elements, editingTextId],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ds = dragState.current;
      if (!ds || ds.id !== selectedId) return;
      const page = pageRef.current;
      if (!page) return;
      const r = page.getBoundingClientRect();
      const dx = ((e.clientX - ds.startX) / r.width) * 100;
      const dy = ((e.clientY - ds.startY) / r.height) * 100;
      setElements(prev => prev.map(el => el.id === ds.id
        ? { ...el, x: Math.max(0, Math.min(100 - el.width, ds.origX + dx)), y: Math.max(0, Math.min(100 - el.height, ds.origY + dy)) }
        : el
      ));
    },
    [selectedId],
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  // ── Resize element via corner handle ─────────────────────────────────────
  const resizeState = useRef<{
    id: string; corner: "br" | "bl" | "tr" | "tl";
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null>(null);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string, corner: "br" | "bl" | "tr" | "tl") => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const el = elements.find(x => x.id === id);
      if (!el) return;
      resizeState.current = {
        id, corner,
        startX: e.clientX, startY: e.clientY,
        origX: el.x, origY: el.y,
        origW: el.width, origH: el.height,
      };
    },
    [elements],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rs = resizeState.current;
      if (!rs) return;
      const page = pageRef.current;
      if (!page) return;
      const r = page.getBoundingClientRect();
      const dx = ((e.clientX - rs.startX) / r.width) * 100;
      const dy = ((e.clientY - rs.startY) / r.height) * 100;
      setElements(prev => prev.map(el => {
        if (el.id !== rs.id) return el;
        let { x, y, width, height } = el;
        const MIN_W = 5; const MIN_H = 2;
        if (rs.corner === "br") {
          width = Math.max(MIN_W, rs.origW + dx);
          height = Math.max(MIN_H, rs.origH + dy);
        } else if (rs.corner === "bl") {
          const newW = Math.max(MIN_W, rs.origW - dx);
          x = rs.origX + (rs.origW - newW);
          width = newW;
          height = Math.max(MIN_H, rs.origH + dy);
        } else if (rs.corner === "tr") {
          width = Math.max(MIN_W, rs.origW + dx);
          const newH = Math.max(MIN_H, rs.origH - dy);
          y = rs.origY + (rs.origH - newH);
          height = newH;
        } else { // tl
          const newW = Math.max(MIN_W, rs.origW - dx);
          const newH = Math.max(MIN_H, rs.origH - dy);
          x = rs.origX + (rs.origW - newW);
          y = rs.origY + (rs.origH - newH);
          width = newW; height = newH;
        }
        return { ...el, x, y, width, height };
      }));
    },
    [],
  );

  const handleResizeUp = useCallback(() => { resizeState.current = null; }, []);

  // ── Unified pointer handler for the canvas overlay ─────────────────────
  const onOverlayPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerMove(e);
    handleResizeMove(e);
  };
  const onOverlayPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    handlePointerUp();
    handleResizeUp();
  };

  // ── Property helpers ──────────────────────────────────────────────────────
  const patchSelected = (patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...patch } : el));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(e => e.id !== selectedId));
    setSelectedId(null);
    setEditingTextId(null);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingTextId) return; // let textarea handle
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if (e.key === "Escape") { setSelectedId(null); setActiveTool("select"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editingTextId]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    onSave({ elements });
    toast.success(ar ? "تم حفظ التخطيط" : "Layout saved");
    onClose();
  };

  const handleReset = () => {
    if (!confirm(ar ? "هل تريد حذف جميع العناصر؟" : "Clear all canvas elements?")) return;
    setElements([]);
    setSelectedId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-800"
      dir={dir}
      style={{ touchAction: "none" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border-b shadow-sm flex-wrap" dir={dir}>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-1.5"
          style={{ borderColor: `${BRAND_PRIMARY}55`, color: BRAND_PRIMARY }}
        >
          <X className="w-3.5 h-3.5" />
          {ar ? "إلغاء" : "Cancel"}
        </button>

        <div className="text-xs font-bold truncate" style={{ color: BRAND_PRIMARY }}>
          {ar ? "محرر التصميم الحر" : "Canvas Editor"} · {data.title}
        </div>

        <div className="flex-1" />

        {/* Tool buttons */}
        <ToolGroup>
          <ToolBtn active={activeTool === "select"} onClick={() => setActiveTool("select")} title={ar ? "تحديد / تحريك" : "Select / Move"}>
            <MousePointer className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={activeTool === "text"} onClick={() => setActiveTool("text")} title={ar ? "نص حر" : "Text"}>
            <Type className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={activeTool === "rect"} onClick={() => setActiveTool("rect")} title={ar ? "مستطيل" : "Rectangle"}>
            <Square className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={activeTool === "circle"} onClick={() => setActiveTool("circle")} title={ar ? "دائرة / بيضاوي" : "Oval"}>
            <Circle className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn active={activeTool === "line"} onClick={() => setActiveTool("line")} title={ar ? "خط أفقي" : "Line"}>
            <Minus className="w-4 h-4" />
          </ToolBtn>
        </ToolGroup>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={deleteSelected}
          disabled={!selectedId}
          className="px-2.5 py-1.5 rounded-lg border text-sm flex items-center gap-1.5 disabled:opacity-30"
          style={{ borderColor: "#dc262655", color: "#dc2626" }}
          title={ar ? "حذف العنصر المحدد" : "Delete selected"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleReset}
          className="px-2.5 py-1.5 rounded-lg border text-sm flex items-center gap-1.5"
          style={{ borderColor: `${BRAND_PRIMARY}44`, color: BRAND_PRIMARY }}
          title={ar ? "مسح الكل" : "Clear all"}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded-lg font-bold text-white text-sm flex items-center gap-1.5"
          style={{ background: BRAND_PRIMARY }}
        >
          <Check className="w-3.5 h-3.5" />
          {ar ? "حفظ التخطيط" : "Save Layout"}
        </button>
      </div>

      {/* ── Properties bar (shown when element is selected) ──────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id + selected.kind}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex-shrink-0 bg-neutral-100 border-b overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 items-center px-4 py-2" dir={dir}>
              {selected.kind === "text" && (
                <>
                  <PropsLabel ar={ar}>{ar ? "حجم الخط" : "Font size"}</PropsLabel>
                  <input
                    type="number" min={7} max={72} step={1}
                    value={selected.fontSize ?? 14}
                    onChange={e => patchSelected({ fontSize: Math.max(7, Math.min(72, parseInt(e.target.value) || 14)) })}
                    className="w-16 px-2 py-1 rounded border text-sm bg-white"
                  />
                  <div className="w-px h-5 bg-border" />
                  <PropsLabel ar={ar}>{ar ? "لون النص" : "Color"}</PropsLabel>
                  <input
                    type="color"
                    value={selected.fontColor ?? "#1a2421"}
                    onChange={e => patchSelected({ fontColor: e.target.value })}
                    className="w-7 h-7 rounded border cursor-pointer p-0"
                    style={{ padding: "1px" }}
                  />
                  <div className="w-px h-5 bg-border" />
                  <ToolBtn active={!!selected.bold} onClick={() => patchSelected({ bold: !selected.bold })} title="Bold">
                    <Bold className="w-3.5 h-3.5" />
                  </ToolBtn>
                  <ToolBtn active={!!selected.italic} onClick={() => patchSelected({ italic: !selected.italic })} title="Italic">
                    <Italic className="w-3.5 h-3.5" />
                  </ToolBtn>
                  <div className="w-px h-5 bg-border" />
                  <ToolBtn active={selected.align === "right"} onClick={() => patchSelected({ align: "right" })} title="Align right">
                    <AlignRight className="w-3.5 h-3.5" />
                  </ToolBtn>
                  <ToolBtn active={selected.align === "center" || !selected.align} onClick={() => patchSelected({ align: "center" })} title="Align center">
                    <AlignCenter className="w-3.5 h-3.5" />
                  </ToolBtn>
                  <ToolBtn active={selected.align === "left"} onClick={() => patchSelected({ align: "left" })} title="Align left">
                    <AlignLeft className="w-3.5 h-3.5" />
                  </ToolBtn>
                </>
              )}
              {(selected.kind === "rect" || selected.kind === "circle") && (
                <>
                  <PropsLabel ar={ar}>{ar ? "لون الإطار" : "Stroke"}</PropsLabel>
                  <input
                    type="color"
                    value={selected.strokeColor ?? BRAND_PRIMARY}
                    onChange={e => patchSelected({ strokeColor: e.target.value })}
                    className="w-7 h-7 rounded border cursor-pointer"
                    style={{ padding: "1px" }}
                  />
                  <PropsLabel ar={ar}>{ar ? "سمك الإطار" : "Thickness"}</PropsLabel>
                  <input
                    type="range" min={0} max={8} step={0.5}
                    value={selected.strokeWidth ?? 2}
                    onChange={e => patchSelected({ strokeWidth: parseFloat(e.target.value) })}
                    className="w-20"
                    style={{ accentColor: BRAND_PRIMARY }}
                  />
                  <PropsLabel ar={ar}>{ar ? "تعبئة" : "Fill"}</PropsLabel>
                  <input
                    type="color"
                    value={selected.fillColor === "transparent" ? "#ffffff" : (selected.fillColor ?? "#ffffff")}
                    onChange={e => patchSelected({ fillColor: e.target.value })}
                    className="w-7 h-7 rounded border cursor-pointer"
                    style={{ padding: "1px" }}
                  />
                  <button
                    onClick={() => patchSelected({ fillColor: "transparent" })}
                    className="text-[11px] border px-2 py-1 rounded"
                    style={{ borderColor: `${BRAND_PRIMARY}44`, color: BRAND_PRIMARY }}
                  >
                    {ar ? "بلا تعبئة" : "No fill"}
                  </button>
                </>
              )}
              {selected.kind === "line" && (
                <>
                  <PropsLabel ar={ar}>{ar ? "لون الخط" : "Color"}</PropsLabel>
                  <input
                    type="color"
                    value={selected.strokeColor ?? BRAND_PRIMARY}
                    onChange={e => patchSelected({ strokeColor: e.target.value })}
                    className="w-7 h-7 rounded border cursor-pointer"
                    style={{ padding: "1px" }}
                  />
                  <PropsLabel ar={ar}>{ar ? "سمك" : "Width"}</PropsLabel>
                  <input
                    type="range" min={0.5} max={8} step={0.5}
                    value={selected.strokeWidth ?? 2}
                    onChange={e => patchSelected({ strokeWidth: parseFloat(e.target.value) })}
                    className="w-20"
                    style={{ accentColor: BRAND_PRIMARY }}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Canvas area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto py-6 px-4 flex justify-center">
        {/* Hint */}
        {activeTool !== "select" && (
          <div
            className="absolute top-[120px] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-bold text-white shadow-lg pointer-events-none"
            style={{ background: BRAND_PRIMARY }}
          >
            {ar ? "انقر على الصفحة لإضافة عنصر" : "Click on the page to place element"}
          </div>
        )}

        {/* A4 page container */}
        <div
          ref={pageRef}
          data-canvas-page
          className="relative bg-white shadow-2xl"
          style={{
            width: "210mm",
            minHeight: "297mm",
            cursor: activeTool !== "select" ? "crosshair" : "default",
          }}
          onPointerDown={handlePagePointerDown}
          onPointerMove={onOverlayPointerMove}
          onPointerUp={onOverlayPointerUp}
        >
          {/* Page preview — worksheet first page rendered as static content */}
          <PagePreview data={data} />

          {/* Canvas elements overlay */}
          {elements.map(el => (
            <CanvasElementView
              key={el.id}
              el={el}
              selected={el.id === selectedId}
              editing={el.id === editingTextId}
              onPointerDown={e => handleElementPointerDown(e, el.id)}
              onDoubleClick={() => {
                if (el.kind === "text") {
                  setSelectedId(el.id);
                  setEditingTextId(el.id);
                }
              }}
              onTextChange={text => patchSelected({ text })}
              onBlurText={() => setEditingTextId(null)}
              onResizePointerDown={(e, corner) => handleResizePointerDown(e, el.id, corner)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page Preview (lightweight — just header + lines placeholder) ─────────────

function PagePreview({ data }: { data: WorksheetData }) {
  const ar = data.language === "ar";
  const tc = data.settings.themeColor ?? BRAND_PRIMARY;
  const headingFont = ar
    ? "'Cairo','Noto Naskh Arabic','Tajawal',sans-serif"
    : "'Inter','Source Sans Pro',sans-serif";
  const bodyFont = ar
    ? "'Cairo','Noto Naskh Arabic','Tajawal',Arial,sans-serif"
    : "'Inter','Source Sans Pro','Helvetica Neue',Arial,sans-serif";
  const fs = data.settings.fontSizePt ?? 12;

  return (
    <div
      style={{
        padding: "18mm 18mm 16mm 18mm",
        fontFamily: bodyFont,
        fontSize: `${fs}pt`,
        lineHeight: 1.85,
        color: "#1a2421",
        userSelect: "none",
        pointerEvents: "none",
      }}
      dir={ar ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "6mm" }}>
        {data.settings.schoolName && (
          <div style={{ fontSize: `${Math.max(8, fs - 2)}pt`, fontWeight: 700, color: tc, marginBottom: "2mm" }}>
            {data.settings.schoolName}
            {data.settings.section && ` · ${data.settings.section}`}
            {data.settings.teacherName && ` · ${data.settings.teacherName}`}
          </div>
        )}
        {data.settings.logoUrl && (
          <img src={data.settings.logoUrl} alt="" style={{ maxHeight: "14mm", objectFit: "contain", marginBottom: "3mm" }} />
        )}
        <h1 style={{ fontFamily: headingFont, fontSize: `${fs + 12}pt`, fontWeight: 800, color: tc, margin: 0, lineHeight: 1.2 }}>
          {data.title}
        </h1>
        {(data.subject || data.gradeLevel) && (
          <div style={{ fontSize: `${Math.max(8.5, fs - 2)}pt`, color: tc, background: `${tc}12`, display: "inline-block", padding: "2px 12px", borderRadius: 999, marginTop: "2mm" }}>
            {[data.subject, data.gradeLevel].filter(Boolean).join(" · ")}
          </div>
        )}
        <div style={{ height: "1px", background: BRAND_GOLD, width: "60%", margin: "3mm auto 0" }} />
      </div>

      {/* Student fields */}
      {(data.settings.includeName || data.settings.includeDate || data.settings.includeClass) && (
        <div style={{ display: "flex", gap: "6mm", marginBottom: "5mm" }}>
          {data.settings.includeName && <FieldPreview label={ar ? "الاسم:" : "Name:"} long />}
          {data.settings.includeClass && <FieldPreview label={ar ? "الصف:" : "Class:"} />}
          {data.settings.includeDate && <FieldPreview label={ar ? "التاريخ:" : "Date:"} />}
        </div>
      )}

      {/* Instructions */}
      {data.settings.instructions && (
        <div style={{ background: `${BRAND_GOLD}15`, borderInlineStart: `3px solid ${BRAND_GOLD}`, padding: "6px 10px", marginBottom: "4mm", fontSize: `${Math.max(9, fs - 1)}pt` }}>
          {data.settings.instructions}
        </div>
      )}

      {/* Question placeholders */}
      <div style={{ opacity: 0.45 }}>
        {data.questions.slice(0, 6).map((q, i) => (
          <div
            key={q.id}
            style={{
              borderInlineStart: `3px solid ${BRAND_GOLD}`,
              padding: "3mm 4mm",
              marginBottom: "4mm",
              borderRadius: "0 4px 4px 0",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ width: 22, height: 22, background: tc, color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: `${Math.max(8, fs - 2)}pt`, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, height: "1em", background: `${tc}22`, borderRadius: 4 }} />
            </div>
          </div>
        ))}
        {data.questions.length > 6 && (
          <div style={{ textAlign: "center", color: tc, fontSize: `${Math.max(8, fs - 2)}pt`, opacity: 0.6 }}>
            {ar ? `... و${data.questions.length - 6} أسئلة أخرى` : `... and ${data.questions.length - 6} more`}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldPreview({ label, long }: { label: string; long?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: long ? 2 : 1, borderBottom: "1px dashed #aaa", paddingBottom: "4px" }}>
      <span style={{ fontWeight: 700, fontSize: "0.85em", color: BRAND_PRIMARY, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ flex: 1 }} />
    </div>
  );
}

// ─── Canvas element view ──────────────────────────────────────────────────────

interface CevProps {
  el: CanvasElement;
  selected: boolean;
  editing: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onTextChange: (t: string) => void;
  onBlurText: () => void;
  onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>, corner: "br" | "bl" | "tr" | "tl") => void;
}

function CanvasElementView({
  el, selected, editing,
  onPointerDown, onDoubleClick, onTextChange, onBlurText, onResizePointerDown,
}: CevProps) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.width}%`,
    height: el.kind === "line" ? `${el.strokeWidth ?? 2}px` : `${el.height}%`,
    cursor: "move",
    userSelect: "none",
    boxSizing: "border-box",
    outline: selected ? `2px dashed ${BRAND_PRIMARY}` : "none",
    outlineOffset: "1px",
  };

  const innerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
  };

  let inner: React.ReactNode = null;

  if (el.kind === "text") {
    if (editing) {
      inner = (
        <textarea
          autoFocus
          value={el.text ?? ""}
          onChange={e => onTextChange(e.target.value)}
          onBlur={onBlurText}
          style={{
            ...innerStyle,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: `${el.fontSize ?? 14}pt`,
            fontWeight: el.bold ? 800 : 400,
            fontStyle: el.italic ? "italic" : "normal",
            color: el.fontColor ?? "#1a2421",
            textAlign: el.align ?? "right",
            padding: "2px 4px",
            overflow: "hidden",
          }}
          onPointerDown={e => e.stopPropagation()}
        />
      );
    } else {
      inner = (
        <div
          style={{
            ...innerStyle,
            fontSize: `${el.fontSize ?? 14}pt`,
            fontWeight: el.bold ? 800 : 400,
            fontStyle: el.italic ? "italic" : "normal",
            color: el.fontColor ?? "#1a2421",
            textAlign: el.align ?? "right",
            padding: "2px 4px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflow: "hidden",
          }}
        >
          {el.text || ""}
        </div>
      );
    }
  } else if (el.kind === "rect") {
    inner = (
      <div style={{
        ...innerStyle,
        border: `${el.strokeWidth ?? 2}px solid ${el.strokeColor ?? BRAND_PRIMARY}`,
        background: el.fillColor === "transparent" ? "transparent" : (el.fillColor ?? "transparent"),
        borderRadius: "2px",
      }} />
    );
  } else if (el.kind === "circle") {
    inner = (
      <div style={{
        ...innerStyle,
        border: `${el.strokeWidth ?? 2}px solid ${el.strokeColor ?? BRAND_PRIMARY}`,
        background: el.fillColor === "transparent" ? "transparent" : (el.fillColor ?? "transparent"),
        borderRadius: "50%",
      }} />
    );
  } else if (el.kind === "line") {
    inner = (
      <div style={{
        width: "100%",
        height: `${el.strokeWidth ?? 2}px`,
        background: el.strokeColor ?? BRAND_PRIMARY,
      }} />
    );
  }

  const HANDLE = 8;
  const hStyle: React.CSSProperties = {
    position: "absolute",
    width: HANDLE,
    height: HANDLE,
    background: "white",
    border: `2px solid ${BRAND_PRIMARY}`,
    borderRadius: "50%",
    cursor: "nwse-resize",
    zIndex: 10,
    touchAction: "none",
  };

  return (
    <div
      data-canvas-element
      style={style}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {inner}

      {/* Resize handles — only when selected and not editing text */}
      {selected && !editing && el.kind !== "line" && (
        <>
          <div style={{ ...hStyle, top: -HANDLE / 2, left: -HANDLE / 2, cursor: "nwse-resize" }}
            onPointerDown={e => onResizePointerDown(e, "tl")} />
          <div style={{ ...hStyle, top: -HANDLE / 2, right: -HANDLE / 2, cursor: "nesw-resize" }}
            onPointerDown={e => onResizePointerDown(e, "tr")} />
          <div style={{ ...hStyle, bottom: -HANDLE / 2, left: -HANDLE / 2, cursor: "nesw-resize" }}
            onPointerDown={e => onResizePointerDown(e, "bl")} />
          <div style={{ ...hStyle, bottom: -HANDLE / 2, right: -HANDLE / 2, cursor: "nwse-resize" }}
            onPointerDown={e => onResizePointerDown(e, "br")} />
        </>
      )}
      {selected && !editing && el.kind === "line" && (
        <>
          <div style={{ ...hStyle, top: -HANDLE / 2, left: -HANDLE / 2, cursor: "ew-resize" }}
            onPointerDown={e => onResizePointerDown(e, "bl")} />
          <div style={{ ...hStyle, top: -HANDLE / 2, right: -HANDLE / 2, cursor: "ew-resize" }}
            onPointerDown={e => onResizePointerDown(e, "br")} />
        </>
      )}
    </div>
  );
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 border rounded-lg overflow-hidden" style={{ borderColor: `${BRAND_PRIMARY}33` }}>
      {children}
    </div>
  );
}

function ToolBtn({ children, active, onClick, title }: {
  children: React.ReactNode; active?: boolean; onClick?: () => void; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 transition-colors"
      style={{
        background: active ? `${BRAND_PRIMARY}15` : "transparent",
        color: active ? BRAND_PRIMARY : "#555",
      }}
    >
      {children}
    </button>
  );
}

function PropsLabel({ children, ar }: { children: React.ReactNode; ar: boolean }) {
  void ar;
  return (
    <span className="text-[11px] font-bold" style={{ color: BRAND_PRIMARY }}>{children}</span>
  );
}

