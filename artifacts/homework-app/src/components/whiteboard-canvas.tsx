import { useRef, useState, useEffect, useCallback } from "react";
import { Pen, Eraser, Trash2, Undo2, Minus, Plus, Type, Move, MousePointer } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: "pen" | "eraser" | "text";
  text?: string;
  fontSize?: number;
  isTeacher?: boolean;
}

interface WhiteboardCanvasProps {
  boardStyle: "blank" | "lined";
  width?: number;
  height?: number;
  readOnly?: boolean;
  locked?: boolean;
  strokes?: Stroke[];
  injectedStrokes?: Stroke[];
  onStroke?: (stroke: Stroke) => void;
  onClear?: () => void;
  onUndo?: () => void;
  onStrokesUpdate?: (strokes: Stroke[]) => void;
  className?: string;
  showToolbar?: boolean;
  thumbnailMode?: boolean;
  canvasId?: string;
}

const COLORS = ["#000000", "#1e40af", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];
const LINE_SPACING = 36;
const FONT_SIZES = [14, 18, 24, 32, 40];

export function WhiteboardCanvas({
  boardStyle,
  width = 800,
  height = 500,
  readOnly = false,
  locked = false,
  strokes: externalStrokes,
  injectedStrokes,
  onStroke,
  onClear,
  onUndo,
  onStrokesUpdate,
  className = "",
  showToolbar = true,
  canvasId,
  thumbnailMode = false,
}: WhiteboardCanvasProps) {
  const { t, lang } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [tool, setTool] = useState<"pen" | "eraser" | "text" | "select">("pen");
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [textValue, setTextValue] = useState("");

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  const baseStrokes = externalStrokes !== undefined ? externalStrokes : strokes;
  const displayStrokes = (isDragging && selectedIndex !== null && dragPos && selectedIndex < baseStrokes.length)
    ? baseStrokes.map((s, i) => i === selectedIndex ? { ...s, points: [{ ...dragPos }] } : s)
    : baseStrokes;
  const allStrokes = injectedStrokes && injectedStrokes.length > 0
    ? [...displayStrokes, ...injectedStrokes]
    : displayStrokes;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const cw = container.clientWidth;
      setCanvasScale(Math.min(cw / width, 1));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [width]);

  const measureTextBounds = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.tool !== "text" || !stroke.text || stroke.points.length === 0) return null;
    const fs = stroke.fontSize || 24;
    ctx.font = `${stroke.isTeacher ? "bold " : ""}${fs}px sans-serif`;
    const lines = stroke.text.split("\n");
    let maxW = 0;
    lines.forEach(line => {
      const m = ctx.measureText(line);
      if (m.width > maxW) maxW = m.width;
    });
    const totalH = lines.length * fs * 1.3;
    const px = stroke.points[0].x;
    const py = stroke.points[0].y;
    const isRtl = lang === "ar";
    const bx = isRtl ? px - maxW - 4 : px - 4;
    return { x: bx, y: py - 4, w: maxW + 8, h: totalH + 8 };
  }, [lang]);

  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    if (boardStyle === "lined") {
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      for (let y = LINE_SPACING; y < height; y += LINE_SPACING) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width - 60, 0);
      ctx.lineTo(width - 60, height);
      ctx.stroke();
    }
  }, [boardStyle, width, height]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.tool === "text") {
      if (!stroke.text || stroke.points.length === 0) return;
      const fs = stroke.fontSize || 24;
      ctx.font = `${stroke.isTeacher ? "bold " : ""}${fs}px sans-serif`;
      ctx.fillStyle = stroke.color;
      ctx.textAlign = lang === "ar" ? "right" : "left";
      ctx.textBaseline = "top";
      ctx.globalCompositeOperation = "source-over";
      const lines = stroke.text.split("\n");
      lines.forEach((line, i) => {
        ctx.fillText(line, stroke.points[0].x, stroke.points[0].y + i * (fs * 1.3));
      });
      if (stroke.isTeacher) {
        ctx.fillStyle = stroke.color;
        ctx.font = `bold 10px sans-serif`;
        ctx.textAlign = lang === "ar" ? "right" : "left";
        const label = lang === "ar" ? "المعلم" : "Teacher";
        const labelX = stroke.points[0].x;
        const labelY = stroke.points[0].y - 14;
        ctx.fillText(`[${label}]`, labelX, labelY);
      }
      return;
    }
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    ctx.lineWidth = stroke.tool === "eraser" ? stroke.width * 4 : stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    if (stroke.isTeacher && stroke.tool === "pen") {
      const lastPt = stroke.points[stroke.points.length - 1];
      ctx.fillStyle = stroke.color;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "left";
      const label = lang === "ar" ? "المعلم" : "Teacher";
      ctx.fillText(`[${label}]`, lastPt.x + 4, lastPt.y - 4);
    }
  }, [lang]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBackground(ctx);
    allStrokes.forEach((s, i) => {
      drawStroke(ctx, s);
      if (selectedIndex === i && tool === "select") {
        const bounds = measureTextBounds(ctx, s);
        if (bounds) {
          ctx.save();
          ctx.setLineDash([6, 3]);
          ctx.strokeStyle = "#6366f1";
          ctx.lineWidth = 2;
          ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
          ctx.setLineDash([]);

          const handleSize = 16;
          const hx = bounds.x + bounds.w - handleSize / 2;
          const hy = bounds.y - handleSize / 2;
          ctx.fillStyle = "#6366f1";
          ctx.beginPath();
          ctx.arc(hx + handleSize / 2, hy + handleSize / 2, handleSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("⤡", hx + handleSize / 2, hy + handleSize / 2);
          ctx.restore();
        }
      }
    });
    if (currentStroke) drawStroke(ctx, currentStroke);
    if (locked && !thumbnailMode) {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t.whiteboard.locked, width / 2, height / 2);
    }
  }, [allStrokes, currentStroke, drawBackground, drawStroke, locked, thumbnailMode, width, height, t, selectedIndex, tool, measureTextBounds]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const commitText = useCallback(() => {
    if (!textValue.trim()) {
      setTextInput({ x: 0, y: 0, visible: false });
      setTextValue("");
      return;
    }
    const stroke: Stroke = {
      points: [{ x: textInput.x, y: textInput.y }],
      color,
      width: 1,
      tool: "text",
      text: textValue,
      fontSize,
    };
    if (externalStrokes === undefined) {
      setStrokes(prev => [...prev, stroke]);
    }
    onStroke?.(stroke);
    setTextInput({ x: 0, y: 0, visible: false });
    setTextValue("");
  }, [textValue, textInput, color, fontSize, externalStrokes, onStroke]);

  const updateStrokeAt = useCallback((index: number, updatedStroke: Stroke) => {
    if (externalStrokes === undefined) {
      setStrokes(prev => {
        const next = [...prev];
        next[index] = updatedStroke;
        return next;
      });
    }
    onStrokesUpdate?.(baseStrokes.map((s, i) => i === index ? updatedStroke : s));
  }, [externalStrokes, baseStrokes, onStrokesUpdate]);

  const hitTestText = useCallback((point: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return -1;
    for (let i = allStrokes.length - 1; i >= 0; i--) {
      const s = allStrokes[i];
      if (s.tool !== "text") continue;
      const bounds = measureTextBounds(ctx, s);
      if (!bounds) continue;
      if (point.x >= bounds.x && point.x <= bounds.x + bounds.w && point.y >= bounds.y && point.y <= bounds.y + bounds.h) {
        return i;
      }
    }
    return -1;
  }, [allStrokes, measureTextBounds]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly || locked) return;
    e.preventDefault();
    const point = getCanvasPoint(e);

    if (tool === "select") {
      const hitIdx = hitTestText(point);
      if (hitIdx >= 0) {
        setSelectedIndex(hitIdx);
        const s = allStrokes[hitIdx];
        setDragOffset({ x: point.x - s.points[0].x, y: point.y - s.points[0].y });
        setIsDragging(true);
      } else {
        setSelectedIndex(null);
      }
      return;
    }

    if (tool === "text") {
      if (textInput.visible) {
        commitText();
      }
      setTextInput({ x: point.x, y: point.y, visible: true });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    const newStroke: Stroke = {
      points: [point],
      color,
      width: strokeWidth,
      tool,
    };
    setCurrentStroke(newStroke);
    setIsDrawing(true);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly || locked) return;

    if (tool === "select" && isDragging && selectedIndex !== null) {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const newX = point.x - dragOffset.x;
      const newY = point.y - dragOffset.y;
      setDragPos({ x: newX, y: newY });
      return;
    }

    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, point],
    });
  };

  const handleEnd = () => {
    if (tool === "select" && isDragging && selectedIndex !== null) {
      if (dragPos && selectedIndex < baseStrokes.length) {
        const updated = { ...baseStrokes[selectedIndex], points: [{ x: dragPos.x, y: dragPos.y }] };
        updateStrokeAt(selectedIndex, updated);
      }
      setIsDragging(false);
      setDragPos(null);
      return;
    }

    if (!currentStroke || !isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.points.length > 1) {
      if (externalStrokes === undefined) {
        setStrokes(prev => [...prev, currentStroke]);
      }
      onStroke?.(currentStroke);
    }
    setCurrentStroke(null);
  };

  const handleUndo = () => {
    if (externalStrokes === undefined) {
      setStrokes(prev => prev.slice(0, -1));
    }
    setSelectedIndex(null);
    onUndo?.();
  };

  const handleClear = () => {
    if (externalStrokes === undefined) {
      setStrokes([]);
    }
    setSelectedIndex(null);
    onClear?.();
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitText();
    }
    if (e.key === "Escape") {
      setTextInput({ x: 0, y: 0, visible: false });
      setTextValue("");
    }
  };

  const changeSelectedFontSize = (newSize: number) => {
    if (selectedIndex === null || selectedIndex >= baseStrokes.length) return;
    const s = baseStrokes[selectedIndex];
    if (s.tool !== "text") return;
    const updated = { ...s, fontSize: newSize };
    updateStrokeAt(selectedIndex, updated);
  };

  const getDataURL = () => {
    return canvasRef.current?.toDataURL("image/png") || "";
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    (canvas as any).getWhiteboardData = () => ({
      strokes: baseStrokes,
      dataURL: getDataURL(),
    });
  }, [baseStrokes]);

  if (thumbnailMode) {
    return (
      <div className={`overflow-hidden rounded border border-border ${className}`}>
        <canvas
          ref={canvasRef}
          id={canvasId}
          width={width}
          height={height}
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    );
  }

  const selectedStroke = selectedIndex !== null ? allStrokes[selectedIndex] : null;

  return (
    <div ref={containerRef} className={`space-y-2 ${className}`}>
      {showToolbar && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 bg-muted/50 rounded-lg p-2">
          <button
            type="button"
            onClick={() => { setTool("select"); setSelectedIndex(null); if (textInput.visible) commitText(); }}
            className={`p-2 rounded-md transition-all ${tool === "select" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
            title={t.whiteboard.selectTool}
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setTool("pen"); setSelectedIndex(null); if (textInput.visible) commitText(); }}
            className={`p-2 rounded-md transition-all ${tool === "pen" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
            title={t.whiteboard.pen}
          >
            <Pen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setTool("eraser"); setSelectedIndex(null); if (textInput.visible) commitText(); }}
            className={`p-2 rounded-md transition-all ${tool === "eraser" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
            title={t.whiteboard.eraser}
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setTool("text"); setSelectedIndex(null); }}
            className={`p-2 rounded-md transition-all ${tool === "text" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
            title={t.whiteboard.textTool}
          >
            <Type className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <div className="flex items-center gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c && tool !== "eraser" ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:border-muted-foreground/30"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {tool === "text" ? (
            <div className="flex items-center gap-1">
              <select
                value={fontSize}
                onChange={e => setFontSize(parseInt(e.target.value))}
                className="px-1.5 py-1 rounded text-xs bg-background border border-border text-foreground"
              >
                {FONT_SIZES.map(s => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
            </div>
          ) : tool === "select" && selectedStroke?.tool === "text" ? (
            <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-md px-2 py-1">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{t.whiteboard.fontSize}</span>
              <button
                type="button"
                onClick={() => changeSelectedFontSize(Math.max(10, (selectedStroke.fontSize || 24) - 2))}
                className="p-0.5 rounded text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 w-8 text-center">{selectedStroke.fontSize || 24}px</span>
              <button
                type="button"
                onClick={() => changeSelectedFontSize(Math.min(72, (selectedStroke.fontSize || 24) + 2))}
                className="p-0.5 rounded text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
                className="p-1 rounded text-muted-foreground hover:bg-muted"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-bold w-5 text-center">{strokeWidth}</span>
              <button
                type="button"
                onClick={() => setStrokeWidth(Math.min(12, strokeWidth + 1))}
                className="p-1 rounded text-muted-foreground hover:bg-muted"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="w-px h-6 bg-border mx-1" />

          <button
            type="button"
            onClick={handleUndo}
            disabled={allStrokes.length === 0}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 transition-all"
            title={t.whiteboard.undo}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={allStrokes.length === 0}
            className="p-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 transition-all"
            title={t.whiteboard.clear}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative rounded-lg overflow-hidden border-2 border-border shadow-sm bg-white">
        <canvas
          ref={canvasRef}
          id={canvasId}
          width={width}
          height={height}
          style={{
            width: `${width * canvasScale}px`,
            height: `${height * canvasScale}px`,
            touchAction: "none",
            cursor: readOnly || locked ? "default" : tool === "eraser" ? "cell" : tool === "text" ? "text" : tool === "select" ? (isDragging ? "grabbing" : "pointer") : "crosshair",
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />

        {textInput.visible && !readOnly && !locked && (
          <div
            className="absolute"
            style={{
              left: `${textInput.x * canvasScale}px`,
              top: `${textInput.y * canvasScale}px`,
              zIndex: 10,
            }}
          >
            <textarea
              ref={textInputRef}
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onKeyDown={handleTextKeyDown}
              onBlur={() => { setTimeout(() => commitText(), 150); }}
              className="bg-white/90 border-2 border-primary rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none shadow-lg"
              style={{
                fontSize: `${fontSize * canvasScale}px`,
                minWidth: "120px",
                maxWidth: `${(width - textInput.x) * canvasScale}px`,
                minHeight: `${fontSize * canvasScale * 1.6}px`,
                color,
                direction: lang === "ar" ? "rtl" : "ltr",
              }}
              placeholder={t.whiteboard.typePlaceholder}
              dir={lang === "ar" ? "rtl" : "ltr"}
              rows={1}
            />
            <div className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => commitText()}
                className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-[10px] font-bold"
              >
                {lang === "ar" ? "تم" : "OK"}
              </button>
              <button
                type="button"
                onClick={() => { setTextInput({ x: 0, y: 0, visible: false }); setTextValue(""); }}
                className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-bold"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function useWhiteboardExport(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  return useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return (canvas as any).getWhiteboardData?.()?.dataURL || canvas.toDataURL("image/png");
  }, [canvasRef]);
}
