import { useState } from "react";
import { Crop, ImagePlus, Search, Layers, Move, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, FlipHorizontal, FlipVertical, RotateCcw, X, Check, Gif } from "lucide-react";

const BRAND = "#225739";
const BORDER = "#e2e8f0";

function Slider({ label, value, min, max, step, unit = "%" }: { label: string; value: number; min: number; max: number; step: number; unit?: string }) {
  const [v, setV] = useState(value);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="text-slate-700 font-semibold">{v}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={e => setV(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-emerald-700 cursor-pointer" />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100 my-1" />;
}

export function ImageInspectorMockup() {
  const [fit, setFit] = useState<"cover" | "contain" | "fill" | "none">("cover");
  const [cropMode, setCropMode] = useState(false);
  const [cropApplied, setCropApplied] = useState(false);

  const fitOpts = [
    { v: "cover", ar: "تملأ الإطار" },
    { v: "contain", ar: "داخل الإطار" },
    { v: "fill", ar: "تمتد" },
    { v: "none", ar: "بلا تغيير" },
  ] as const;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-start justify-center p-4">
      <div className="w-72 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#e8f4ed" }}>
            <ImagePlus className="w-4 h-4" style={{ color: BRAND }} />
          </div>
          <span className="font-bold text-sm" style={{ color: BRAND }}>إعدادات الصورة</span>
        </div>

        <div className="p-4 space-y-4">

          {/* ── Section: الطبقات ── */}
          <Section title="ترتيب الطبقات">
            <div className="flex items-center gap-1">
              {[
                { Icon: ChevronsDown, t: "للخلف" },
                { Icon: ChevronDown, t: "خطوة خلف" },
                { Icon: ChevronUp, t: "خطوة أمام" },
                { Icon: ChevronsUp, t: "للأمام" },
              ].map(({ Icon, t }) => (
                <button key={t} className="flex-1 p-1.5 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </Section>

          <Divider />

          {/* ── Section: ملاءمة الصورة ── */}
          <Section title="ملاءمة الصورة">
            <div className="grid grid-cols-2 gap-1.5">
              {fitOpts.map(opt => (
                <button key={opt.v} onClick={() => setFit(opt.v)}
                  className="px-2 py-2 text-xs rounded-xl border font-medium transition-all"
                  style={{
                    background: fit === opt.v ? BRAND : "transparent",
                    color: fit === opt.v ? "#fff" : "#475569",
                    borderColor: fit === opt.v ? BRAND : BORDER,
                  }}>
                  {opt.ar}
                </button>
              ))}
            </div>
          </Section>

          {/* Object-position — only when cover */}
          {fit === "cover" && (
            <>
              <Section title="موضع الصورة داخل الإطار">
                <div className="space-y-2.5 bg-slate-50 rounded-xl p-3">
                  <Slider label="أفقي ←→" value={50} min={0} max={100} step={1} />
                  <Slider label="رأسي ↑↓" value={50} min={0} max={100} step={1} />
                </div>
              </Section>
            </>
          )}

          <Divider />

          {/* ── Section: القص ── */}
          <Section title="قص الصورة">
            {!cropMode ? (
              <button
                onClick={() => setCropMode(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed text-sm font-bold transition-all hover:border-emerald-400 hover:bg-emerald-50"
                style={{ borderColor: cropApplied ? BRAND : BORDER, color: cropApplied ? BRAND : "#64748b", background: cropApplied ? "#e8f4ed" : undefined }}>
                <Crop className="w-4 h-4" />
                {cropApplied ? "✓ تم القص — تعديل" : "قص الصورة"}
              </button>
            ) : (
              <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: BRAND }}>
                {/* Crop preview area */}
                <div className="relative bg-slate-200 h-32 overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80"
                    className="w-full h-full object-cover opacity-50" alt="" />
                  {/* Crop frame */}
                  <div className="absolute inset-3 border-2 border-white rounded-sm shadow-lg">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-r-2 border-white -translate-y-0.5 translate-x-0.5 rounded-sm" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-l-2 border-white -translate-y-0.5 -translate-x-0.5 rounded-sm" />
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-r-2 border-white translate-y-0.5 translate-x-0.5 rounded-sm" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-l-2 border-white translate-y-0.5 -translate-x-0.5 rounded-sm" />
                  </div>
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">اسحب لتحريك الإطار</div>
                </div>
                <div className="flex gap-2 p-2">
                  <button
                    onClick={() => { setCropMode(false); setCropApplied(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg text-white"
                    style={{ background: BRAND }}>
                    <Check className="w-3.5 h-3.5" /> تطبيق القص
                  </button>
                  <button
                    onClick={() => setCropMode(false)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-600 bg-white">
                    <X className="w-3.5 h-3.5" /> إلغاء
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Divider />

          {/* ── Section: تعديل الصورة ── */}
          <Section title="تعديل الصورة">
            <div className="space-y-3">
              <Slider label="الشفافية" value={100} min={0} max={100} step={5} />
              <Slider label="السطوع" value={100} min={0} max={200} step={5} />
              <Slider label="التباين" value={100} min={0} max={200} step={5} />
              <Slider label="التشبّع" value={100} min={0} max={200} step={5} />
            </div>
            <button className="w-full text-xs py-1.5 rounded-lg border border-dashed text-slate-400 hover:text-slate-600 mt-1">
              ↺ إعادة ضبط
            </button>
          </Section>

          <Divider />

          {/* ── Section: قلب وتدوير ── */}
          <Section title="قلب">
            <div className="grid grid-cols-2 gap-1.5">
              <button className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                <FlipHorizontal className="w-3.5 h-3.5" /> أفقي
              </button>
              <button className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
                <FlipVertical className="w-3.5 h-3.5" /> رأسي
              </button>
            </div>
          </Section>

          <Divider />

          {/* ── Radius ── */}
          <Section title="تدوير الزوايا">
            <Slider label="نصف القطر" value={0} min={0} max={200} step={4} unit="px" />
          </Section>

          <Divider />

          {/* ── Replace ── */}
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-700 bg-white hover:bg-slate-50">
              <ImagePlus className="w-3.5 h-3.5" /> استبدال
            </button>
            <button className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-700 bg-white hover:bg-slate-50">
              <Search className="w-3.5 h-3.5" /> من الويب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
