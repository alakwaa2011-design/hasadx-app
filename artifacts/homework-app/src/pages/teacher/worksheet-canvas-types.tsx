/**
 * Shared canvas layout types and the CanvasLayerRenderer component.
 *
 * Kept separate so worksheet-print.tsx can import the renderer without
 * creating a circular dependency with worksheet-canvas-editor.tsx.
 */
import React from "react";
import type {
  WorksheetCanvasElement,
  WorksheetCanvasLayout,
} from "@workspace/api-zod";

const BRAND_PRIMARY = "#225739";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CanvasElement = WorksheetCanvasElement;
export type CanvasElementKind = CanvasElement["kind"];
export type CanvasLayout = WorksheetCanvasLayout;

// ─── Canvas layer renderer (used in print view) ──────────────────────────────

/**
 * Renders canvas elements as absolutely-positioned overlays on top of a
 * worksheet page. Used by WorksheetPrintView for both screen and print.
 */
export function CanvasLayerRenderer({ layout }: { layout?: CanvasLayout }) {
  if (!layout?.elements?.length) return null;
  return (
    <>
      {layout.elements.map(el => {
        const base: React.CSSProperties = {
          position: "absolute",
          left: `${el.x}%`,
          top: `${el.y}%`,
          width: `${el.width}%`,
          height: el.kind === "line" ? `${el.strokeWidth ?? 2}px` : `${el.height}%`,
          pointerEvents: "none",
          boxSizing: "border-box",
          zIndex: 2,
          opacity: el.opacity ?? 1,
        };
        if (el.kind === "text") {
          return (
            <div key={el.id} style={{
              ...base,
              fontSize: `${el.fontSize ?? 14}pt`,
              fontWeight: el.bold ? 800 : 400,
              fontStyle: el.italic ? "italic" : "normal",
              color: el.fontColor ?? "#1a2421",
              textAlign: el.align ?? "right",
              padding: "2px 4px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflow: "hidden",
            }}>
              {el.text ?? ""}
            </div>
          );
        }
        if (el.kind === "rect") {
          return (
            <div key={el.id} style={{
              ...base,
              border: `${el.strokeWidth ?? 2}px ${el.strokeStyle ?? "solid"} ${el.strokeColor ?? BRAND_PRIMARY}`,
              background: el.fillColor === "transparent" ? "transparent" : (el.fillColor ?? "transparent"),
              borderRadius: `${el.borderRadius ?? 2}px`,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties} />
          );
        }
        if (el.kind === "circle") {
          return (
            <div key={el.id} style={{
              ...base,
              border: `${el.strokeWidth ?? 2}px ${el.strokeStyle ?? "solid"} ${el.strokeColor ?? BRAND_PRIMARY}`,
              background: el.fillColor === "transparent" ? "transparent" : (el.fillColor ?? "transparent"),
              borderRadius: "50%",
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties} />
          );
        }
        if (el.kind === "line") {
          return (
            <div key={el.id} style={{
              ...base,
              background: el.strokeColor ?? BRAND_PRIMARY,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            } as React.CSSProperties} />
          );
        }
        return null;
      })}
    </>
  );
}
