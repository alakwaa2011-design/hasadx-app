import {
  ChevronRight,
  MoreVertical,
  Eye,
  Play,
  Plus,
  Type,
  Image as ImageIcon,
  Shapes,
  Sparkles,
  Smile,
  CheckCircle2,
  Trash2,
  Copy,
  Layers,
  Palette,
} from "lucide-react";
import { useState } from "react";

const BRAND = "#225739";
const BRAND_SOFT = "#EAF2EC";
const BG = "#F6F4EE";

type Sheet = "none" | "add" | "text" | "image" | "activity";

export function MobileEditor() {
  const [sheet, setSheet] = useState<Sheet>("none");
  const [activeSlide, setActiveSlide] = useState(2);

  return (
    <div
      dir="rtl"
      className="flex h-screen w-full flex-col font-['Tajawal']"
      style={{ background: BG }}
    >
      {/* ============ TOP BAR (compact, 52px) ============ */}
      <header
        className="flex shrink-0 items-center gap-2 border-b bg-white px-3"
        style={{ height: 52, borderColor: "#E7E2D6" }}
      >
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 active:bg-slate-100"
          aria-label="رجوع"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <button className="flex min-w-0 flex-1 flex-col items-start text-right">
          <span className="w-full truncate text-sm font-semibold text-slate-800">
            درس الكسور — الصف الخامس
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            تم الحفظ
          </span>
        </button>

        {/* Preview — always visible (icon-only, brand-soft) */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: BRAND_SOFT, color: BRAND }}
          aria-label="معاينة"
        >
          <Eye className="h-[18px] w-[18px]" />
        </button>

        {/* Present — always visible, primary (label visible) */}
        <button
          className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white shadow-sm active:scale-95"
          style={{ background: BRAND }}
        >
          <Play className="h-4 w-4 fill-white" />
          تقديم
        </button>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
          aria-label="المزيد"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </header>

      {/* ============ CANVAS (large, ~70%) ============ */}
      <main className="relative flex-1 overflow-hidden px-4 py-4">
        {/* Slide card */}
        <div
          className="mx-auto flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-2xl bg-white shadow-md"
          style={{ aspectRatio: "9 / 12", border: `1px solid ${BRAND}1A` }}
        >
          {/* Slide header band */}
          <div
            className="px-5 pb-3 pt-6 text-right"
            style={{
              background: `linear-gradient(180deg, ${BRAND_SOFT} 0%, transparent 100%)`,
            }}
          >
            <div
              className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: BRAND, color: "white" }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              شريحة #{activeSlide + 1}
            </div>
            <h2
              className="text-xl font-bold leading-snug"
              style={{ color: BRAND }}
            >
              ما هو الكسر؟
            </h2>
          </div>

          {/* Slide content */}
          <div className="flex-1 space-y-3 px-5 py-3 text-right">
            <p className="text-[13px] leading-relaxed text-slate-700">
              الكسر هو جزء من الكل. يتكوّن من بَسط ومقام يفصل بينهما خط.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="flex aspect-square items-center justify-center rounded-xl text-2xl font-bold"
                  style={{ background: BRAND_SOFT, color: BRAND }}
                >
                  {n}/4
                </div>
              ))}
            </div>
            <div
              className="rounded-xl border-2 border-dashed p-3 text-center text-[11px]"
              style={{ borderColor: `${BRAND}40`, color: BRAND }}
            >
              🎯 نشاط تفاعلي — اضغط للإعداد
            </div>
          </div>
        </div>

        {/* FAB — Add element (large, brand, always visible) */}
        <button
          onClick={() => setSheet("add")}
          className="absolute bottom-4 left-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg active:scale-95"
          style={{ background: BRAND, color: "white" }}
          aria-label="إضافة عنصر"
        >
          <Plus className="h-7 w-7" strokeWidth={2.5} />
        </button>

        {/* Quick contextual hint (when nothing selected) */}
        {sheet === "none" && (
          <div className="absolute bottom-6 right-4 max-w-[180px] rounded-lg bg-slate-900/85 px-3 py-1.5 text-[11px] text-white shadow-lg">
            اضغط على عنصر لتعديله، أو + لإضافة
          </div>
        )}
      </main>

      {/* ============ SLIDE STRIP (horizontal, 76px) ============ */}
      <div
        className="shrink-0 border-t bg-white px-3 py-2"
        style={{ borderColor: "#E7E2D6" }}
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className="relative flex h-14 w-20 shrink-0 flex-col items-center justify-center rounded-lg text-[10px] font-medium transition-all"
              style={{
                background: i === activeSlide ? BRAND_SOFT : "#F8F6F0",
                border:
                  i === activeSlide
                    ? `2px solid ${BRAND}`
                    : "1px solid #E7E2D6",
                color: i === activeSlide ? BRAND : "#94A3B8",
              }}
            >
              <span className="text-[9px] opacity-60">#{i + 1}</span>
              <span className="mt-0.5 line-clamp-1 px-1 text-center">
                {["مقدمة", "تعريف", "أمثلة", "نشاط", "تمارين", "خاتمة"][i]}
              </span>
            </button>
          ))}
          <button
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-dashed"
            style={{ borderColor: `${BRAND}66`, color: BRAND }}
            aria-label="شريحة جديدة"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ============ BOTTOM SHEET — contextual ============ */}
      {sheet !== "none" && (
        <>
          <div
            className="absolute inset-0 z-10 bg-black/30"
            onClick={() => setSheet("none")}
          />
          <div
            className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-white shadow-2xl"
            style={{ animation: "slideUp 0.2s ease-out" }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="text-sm font-bold text-slate-800">
                {sheet === "add" && "إضافة عنصر"}
                {sheet === "text" && "تنسيق النص"}
                {sheet === "image" && "أدوات الصورة"}
                {sheet === "activity" && "النشاط التفاعلي"}
              </h3>
              <button
                onClick={() => setSheet("none")}
                className="text-xs font-medium text-slate-500 active:text-slate-800"
              >
                تم
              </button>
            </div>

            {/* Sheet body */}
            {sheet === "add" && (
              <div className="grid grid-cols-4 gap-3 px-5 pb-6">
                {[
                  { icon: Type, label: "نص", color: "#0EA5E9" },
                  { icon: ImageIcon, label: "صورة", color: "#A855F7" },
                  { icon: Shapes, label: "شكل", color: "#F59E0B" },
                  { icon: Smile, label: "أيقونة", color: "#EC4899" },
                  { icon: Sparkles, label: "نشاط", color: BRAND },
                  { icon: Palette, label: "ثيم", color: "#475569" },
                  { icon: Layers, label: "تخطيط", color: "#0891B2" },
                  { icon: Plus, label: "المزيد", color: "#94A3B8" },
                ].map((item, i) => (
                  <button
                    key={i}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-3 active:bg-slate-50"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{ background: `${item.color}1A`, color: item.color }}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-700">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {sheet === "text" && (
              <div className="space-y-3 px-5 pb-6">
                <div className="flex gap-1.5">
                  {["B", "I", "U"].map((s) => (
                    <button
                      key={s}
                      className="h-10 flex-1 rounded-lg bg-slate-100 text-sm font-bold active:bg-slate-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {["يمين", "وسط", "يسار"].map((s) => (
                    <button
                      key={s}
                      className="h-10 flex-1 rounded-lg bg-slate-100 text-xs font-medium active:bg-slate-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-xs text-slate-500">الحجم</span>
                  <div className="flex-1 rounded-full bg-slate-100 p-1">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: "60%", background: BRAND }}
                    />
                  </div>
                  <span className="w-8 text-xs font-mono">24</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-1.5">
                    {["#225739", "#0EA5E9", "#F59E0B", "#EC4899", "#1E293B"].map(
                      (c) => (
                        <button
                          key={c}
                          className="h-9 w-9 rounded-full border-2 border-white shadow-sm"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                  <button className="flex h-9 w-9 items-center justify-center rounded-full text-rose-500 active:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {sheet === "image" && (
              <div className="grid grid-cols-3 gap-2 px-5 pb-6">
                {[
                  { icon: ImageIcon, label: "استبدال" },
                  { icon: Copy, label: "تكرار" },
                  { icon: Layers, label: "طبقة" },
                  { icon: Palette, label: "حافة" },
                  { icon: CheckCircle2, label: "ملء" },
                  { icon: Trash2, label: "حذف", danger: true },
                ].map((item, i) => (
                  <button
                    key={i}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 py-4 active:bg-slate-100"
                  >
                    <item.icon
                      className={`h-5 w-5 ${item.danger ? "text-rose-500" : "text-slate-700"}`}
                    />
                    <span
                      className={`text-[11px] font-medium ${item.danger ? "text-rose-500" : "text-slate-700"}`}
                    >
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
