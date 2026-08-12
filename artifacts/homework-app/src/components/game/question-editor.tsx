/**
 * Shared manual/AI question editing UI.
 * Originally built for the solo-challenge creator; also reused by وميض (Wameedh)'s
 * question-prep step for all three play modes. `allowedTypes`/`showDifficulty`/
 * `showAudio` let a caller trim the editor down for contexts with fewer needs.
 */
import { useState } from "react";
import {
  Check, Trash2, Edit3, Save, PenLine, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AudioPicker from "@/components/AudioPicker";

export type Correct = "A" | "B" | "C" | "D";
export type QuestionType = "mcq" | "tf" | "fill_blank";

export interface Question {
  text: string;
  /** "mcq" = اختيار متعدد (A/B/C/D), "tf" = صح أو خطأ, "fill_blank" = أملأ الفراغ */
  type: QuestionType;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: Correct;
  /** For fill_blank: the primary correct answer text */
  fillAnswer: string;
  /** For fill_blank: comma-separated alternative accepted answers */
  closeAnswers: string;
  /** 1=easy, 2=medium, 3=hard. null = not tagged. */
  difficulty?: 1 | 2 | 3 | null;
  /** Optional audio: object-storage path or "yt:VIDEO_ID" for YouTube audio */
  audioUrl?: string | null;
}

export function emptyQuestion(type: QuestionType = "mcq"): Question {
  return { text: "", type, optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", fillAnswer: "", closeAnswers: "", difficulty: null, audioUrl: null };
}

/** A question is valid when it has text + enough options for its type */
export function isValidQ(q: Question): boolean {
  if (!q.text.trim()) return false;
  if (q.type === "tf") return true;
  if (q.type === "fill_blank") return q.fillAnswer.trim().length > 0;
  return !!(q.optionA && q.optionB && q.optionC && q.optionD);
}

export function QuestionCard({
  q, index, onChange, onDelete,
  allowedTypes = ["mcq", "tf", "fill_blank"],
  showDifficulty = true,
  showAudio = true,
  audioUploadEndpoint = "/api/solo-challenges/uploads/audio-url",
}: {
  q: Question;
  index: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
  /** Restrict which question types can be picked (e.g. ["mcq"] for وميض) */
  allowedTypes?: QuestionType[];
  showDifficulty?: boolean;
  showAudio?: boolean;
  audioUploadEndpoint?: string;
}) {
  const [editing, setEditing] = useState(q.text === "");
  const opts: Correct[] = ["A", "B", "C", "D"];
  const labels = ["أ", "ب", "ج", "د"];
  const canPickType = allowedTypes.length > 1;

  if (!editing) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl p-5 lg:p-6 hover:border-primary/30 transition-colors shadow-sm group" dir="rtl">
        <div className="flex items-start justify-between gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-3 lg:mb-3.5 flex-wrap">
              <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs lg:text-sm font-black shrink-0 mt-0.5 border border-primary/20">{index + 1}</span>
              <span className="text-sm lg:text-base font-bold text-foreground leading-relaxed flex-1">{q.text}</span>
              {q.type === "fill_blank" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 flex-shrink-0 flex items-center gap-1 mt-1">
                  <PenLine className="w-3 h-3" /> أملأ الفراغ
                </span>
              )}
              {showAudio && q.audioUrl && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex-shrink-0 flex items-center gap-1 mt-1">
                  <Volume2 className="w-3 h-3" /> صوت
                </span>
              )}
              {showDifficulty && q.difficulty && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 border mt-1",
                  q.difficulty === 1 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                  q.difficulty === 2 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                  "bg-red-500/10 text-red-600 border-red-500/20"
                )}>
                  {q.difficulty === 1 ? "سهل" : q.difficulty === 2 ? "متوسط" : "صعب"}
                </span>
              )}
            </div>
            {q.type === "fill_blank" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-black shadow-sm">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{q.fillAnswer}</span>
                </div>
                {q.closeAnswers.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {q.closeAnswers.split(",").map(s => s.trim()).filter(Boolean).map((ans, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted border border-border/50 text-muted-foreground">
                        {ans}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : q.type === "tf" ? (
              <div className="flex gap-2 lg:gap-3">
                {([
                  { val: "A" as Correct, label: "✓ صح",  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 font-black shadow-sm" },
                  { val: "B" as Correct, label: "✗ خطأ", active: "bg-red-500/10 text-red-700 border-red-500/30 font-black shadow-sm" },
                ] as const).map(o => (
                  <div key={o.val} className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-sm lg:text-base border",
                    q.correctAnswer === o.val ? o.active : "bg-muted border-border/50 text-muted-foreground font-medium",
                  )}>
                    {o.label}
                    {q.correctAnswer === o.val && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                {opts.map((opt, oi) => (
                  <div
                    key={opt}
                    className={cn(
                      "flex items-center gap-2 px-3 lg:px-3.5 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm border transition-colors",
                      q.correctAnswer === opt
                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-black shadow-sm"
                        : "bg-muted border-border/50 text-muted-foreground font-medium",
                    )}
                  >
                    <span className={cn(
                      "w-5 h-5 lg:w-6 lg:h-6 rounded-md flex items-center justify-center text-[10px] lg:text-xs shrink-0",
                      q.correctAnswer === opt ? "bg-emerald-500/20 text-emerald-700" : "bg-background border border-border/50"
                    )}>{labels[oi]}</span>
                    <span className="truncate flex-1">{q[`option${opt}` as keyof Question]}</span>
                    {q.correctAnswer === opt && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 lg:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/20">
              <Edit3 className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
            <button onClick={onDelete} className="p-2 lg:p-2.5 rounded-xl bg-muted/60 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors border border-transparent hover:border-red-500/20">
              <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border-2 border-primary/40 rounded-2xl p-5 lg:p-7 shadow-sm relative overflow-hidden" dir="rtl">
      <div className="absolute top-0 start-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary/20" />
      <div className="flex items-center justify-between mb-4 lg:mb-5">
        <span className="text-xs lg:text-sm font-black text-primary bg-primary/10 px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-md border border-primary/20">سؤال {index + 1}</span>
        <div className="flex gap-2">
          {q.text.trim() && (
            <button onClick={() => setEditing(false)} className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl bg-primary/10 text-primary font-bold text-xs lg:text-sm hover:bg-primary hover:text-primary-foreground transition-colors flex items-center gap-1.5 border border-primary/20 hover:border-primary">
              <Save className="w-3.5 h-3.5" /> حفظ
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 lg:p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>
        </div>
      </div>
      <textarea
        value={q.text}
        onChange={e => onChange({ ...q, text: e.target.value })}
        placeholder="اكتب نص السؤال هنا..."
        rows={2}
        className="w-full text-sm lg:text-base font-bold rounded-xl px-4 lg:px-5 py-3 lg:py-3.5 bg-muted/50 border border-border/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none mb-4 lg:mb-5 text-foreground placeholder:text-muted-foreground transition-all shadow-sm"
      />

      {/* Question type toggle */}
      {canPickType && (
        <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 mb-4 lg:mb-5">
          {([
            { val: "mcq"        as const, label: "اختيار متعدد" },
            { val: "tf"         as const, label: "صح أو خطأ" },
            { val: "fill_blank" as const, label: "أملأ الفراغ" },
          ]).filter(t => allowedTypes.includes(t.val)).map(t => (
            <button
              key={t.val}
              onClick={() => onChange({ ...q, type: t.val, correctAnswer: t.val === "tf" ? "A" : q.correctAnswer })}
              className={cn(
                "flex-1 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-bold transition-all",
                q.type === t.val
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {q.type === "fill_blank" ? (
        <div className="space-y-3 lg:space-y-4 mb-4 lg:mb-5">
          <div>
            <label className="block text-[11px] lg:text-xs font-black text-foreground mb-1.5 lg:mb-2">
              الإجابة الصحيحة <span className="text-red-500">*</span>
            </label>
            <input
              value={q.fillAnswer}
              onChange={e => onChange({ ...q, fillAnswer: e.target.value })}
              placeholder="اكتب الإجابة الصحيحة هنا..."
              className="w-full text-sm lg:text-base font-bold rounded-xl px-4 lg:px-5 py-3 lg:py-3.5 bg-emerald-500/5 border-2 border-emerald-500/30 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-foreground placeholder:text-muted-foreground transition-all"
              dir="rtl"
            />
          </div>
          <div>
            <label className="block text-[11px] lg:text-xs font-black text-muted-foreground mb-1.5 lg:mb-2">
              إجابات مقبولة أخرى (اختياري — افصل بفاصلة)
            </label>
            <input
              value={q.closeAnswers}
              onChange={e => onChange({ ...q, closeAnswers: e.target.value })}
              placeholder="مثال: كلمة بديلة، كلمة قريبة، اختصار..."
              className="w-full text-sm lg:text-base rounded-xl px-4 lg:px-5 py-3 lg:py-3.5 bg-muted/40 border border-border/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground transition-all"
              dir="rtl"
            />
            <p className="text-[10px] lg:text-xs text-muted-foreground mt-1 font-medium">
              التصحيح تلقائي — يقبل الإجابة الصحيحة وأي بديل مدرج هنا (غير حساس لحالة الأحرف)
            </p>
          </div>
        </div>
      ) : q.type === "tf" ? (
        <div className="flex gap-3 lg:gap-4 mb-4 lg:mb-5">
          {([
            { val: "A" as Correct, label: "✓ صح",  activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-700 shadow-sm" },
            { val: "B" as Correct, label: "✗ خطأ", activeClass: "border-red-500 bg-red-500/10 text-red-700 shadow-sm" },
          ] as const).map(o => (
            <button
              key={o.val}
              onClick={() => onChange({ ...q, correctAnswer: o.val })}
              className={cn(
                "flex-1 py-3 lg:py-4 rounded-xl border-2 font-black text-sm lg:text-base transition-colors",
                q.correctAnswer === o.val ? o.activeClass : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:gap-4 mb-4 lg:mb-5">
          {opts.map((opt, oi) => (
            <div key={opt} className={cn(
              "flex items-center gap-2 p-1.5 lg:p-2 rounded-xl border-2 transition-all",
              q.correctAnswer === opt ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 bg-card"
            )}>
              <button
                onClick={() => onChange({ ...q, correctAnswer: opt })}
                className={cn(
                  "w-8 h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center shrink-0 text-xs lg:text-sm font-black transition-colors shadow-sm",
                  q.correctAnswer === opt
                    ? "bg-emerald-500 text-white"
                    : "bg-muted border border-border/60 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-600",
                )}
              >
                {labels[oi]}
              </button>
              <input
                value={q[`option${opt}` as keyof Question] as string}
                onChange={e => onChange({ ...q, [`option${opt}`]: e.target.value })}
                placeholder={`الخيار ${labels[oi]}`}
                className="flex-1 text-xs lg:text-sm font-bold rounded-lg px-2 lg:px-2.5 py-1.5 lg:py-2 bg-transparent border-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          ))}
        </div>
      )}

      {/* Difficulty tag */}
      {showDifficulty && (
        <div className="flex items-center gap-2 mb-4 lg:mb-5 bg-muted/30 p-2 lg:p-2.5 rounded-xl border border-border/40">
          <span className="text-[10px] lg:text-xs font-bold text-muted-foreground ms-1 shrink-0">مستوى الصعوبة:</span>
          <div className="flex gap-1.5">
            {([
              { val: null, label: "غير محدد" },
              { val: 1,    label: "سهل" },
              { val: 2,    label: "متوسط" },
              { val: 3,    label: "صعب" },
            ] as const).map(o => (
              <button
                key={String(o.val)}
                onClick={() => onChange({ ...q, difficulty: o.val })}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors shadow-sm",
                  q.difficulty === o.val
                    ? (o.val === 1 ? "bg-emerald-500 border-emerald-500 text-white"
                       : o.val === 2 ? "bg-amber-500 border-amber-500 text-white"
                       : o.val === 3 ? "bg-red-500 border-red-500 text-white"
                       : "bg-muted-foreground border-muted-foreground text-white")
                    : "bg-card border-border/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio attachment */}
      {showAudio && (
        <div className="border-t border-border/40 pt-3">
          <p className="text-[11px] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" /> مرفق صوتي (اختياري)
          </p>
          <AudioPicker
            value={q.audioUrl ?? null}
            onChange={(url) => onChange({ ...q, audioUrl: url })}
            uploadEndpoint={audioUploadEndpoint}
          />
        </div>
      )}
    </div>
  );
}
