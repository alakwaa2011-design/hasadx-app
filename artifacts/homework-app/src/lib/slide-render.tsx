/**
 * Shared read-only slide rendering used by present mode (`/teacher/
 * presentations/:id/present`), the public viewer (`/p/:id`), and any
 * future export pipeline (T412). The editor (`pages/teacher/
 * presentations/editor.tsx`) ships its own interactive renderer so it
 * can keep selection / drag / contentEditable logic in one place — but
 * it intentionally mirrors the same constants & helpers below so both
 * surfaces produce visually identical output.
 *
 * Keep this file dependency-light: no react-query, no socket, no
 * @dnd-kit. It only needs lucide-react for icon resolution and the
 * shared theme/pattern catalog.
 */
import * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Square } from "lucide-react";
import type { Slide, SlideElement } from "@workspace/api-client-react";
import { getTheme, getPattern, defaultTextColorForSlide } from "@/lib/slide-themes";

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

type IconCmp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
export type PresentActivityState = {
  elementId: string | null;
  questionIndex: number;
  selectedIndex: number | null;
  completed?: boolean;
};
export type PresentActivityHandlers = {
  onSelectAnswer?: (elementId: string, answerIndex: number) => void;
  onNextQuestion?: (elementId: string) => void;
  onFinishActivity?: (elementId: string) => void;
};

export function getLucideIcon(name: string | null | undefined): IconCmp {
  if (!name) return Square as unknown as IconCmp;
  const Comp = (LucideIcons as unknown as Record<string, IconCmp>)[name];
  return (Comp ?? (Square as unknown as IconCmp));
}

export function slideBgStyle(
  slide: Slide,
  theme: string,
  pattern: string,
): React.CSSProperties {
  const p = getPattern(pattern);
  if (slide.background && slide.background !== "#ffffff" && slide.background !== "#fff") {
    return { background: slide.background, ...p.style };
  }
  const t = getTheme(theme);
  return {
    background: t.cssGrad ?? "#ffffff",
    ...p.style,
  };
}

function ShapeRenderer({ el }: { el: SlideElement }) {
  if (el.kind !== "shape") return null;
  const stroke = el.borderColor ?? "#1f2937";
  const sw = Math.max(1, el.borderWidth ?? 4);
  const fill = el.bgColor ?? "transparent";
  if (el.shape === "circle") {
    return (
      <div style={{
        width: "100%", height: "100%", background: fill,
        border: el.borderWidth ? `${sw}px solid ${stroke}` : undefined,
        borderRadius: "50%",
      }} />
    );
  }
  if (el.shape === "line" || el.shape === "divider") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (el.shape === "arrow") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id={`ah_${el.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
          </marker>
        </defs>
        <line x1="0" y1="50" x2="92" y2="50" stroke={stroke} strokeWidth={sw} markerEnd={`url(#ah_${el.id})`} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <div style={{
      width: "100%", height: "100%", background: fill,
      border: el.borderWidth ? `${sw}px solid ${stroke}` : undefined,
      borderRadius: 6,
    }} />
  );
}

/**
 * Read-only render of an embedded activity element (Phase 2A). The
 * interactive answering runtime ships in Phase 2B; for now we render
 * a styled brand card so the slide is presentable + exports cleanly.
 * Falls back gracefully when `prompt` is missing (e.g. mid-edit). */
function ActivityRenderer({
  el, lang, stageMode, revealAnswers, presentActivityState, presentActivityHandlers,
}: {
  el: SlideElement;
  lang?: "ar" | "en";
  stageMode?: boolean;
  revealAnswers?: boolean;
  presentActivityState?: PresentActivityState;
  presentActivityHandlers?: PresentActivityHandlers;
}) {
  if (el.kind !== "activity") return null;
  const isAr = lang !== "en";
  const accent = el.accentColor ?? "#225739";
  const gold = "#D9A521";
  const kindLabel: Record<string, { ar: string; en: string }> = {
    mcq: { ar: "اختيار من متعدد", en: "Multiple choice" },
    true_false: { ar: "صح / خطأ", en: "True / False" },
    open: { ar: "إجابة مفتوحة", en: "Open answer" },
    poll: { ar: "تصويت", en: "Poll" },
    word_cloud: { ar: "سحابة الكلمات", en: "Word Cloud" },
    open_wall: { ar: "جدار الردود", en: "Response Wall" },
  };
  const label = (kindLabel[el.activityKind ?? "open"] ?? { ar: "نشاط", en: "Activity" })[isAr ? "ar" : "en"];
  const activityKind = el.activityKind as string | undefined;
  const opts = (el.options ?? []).slice(0, 8);
  const showOpts =
    el.activityKind === "mcq" ||
    el.activityKind === "poll" ||
    el.activityKind === "true_false";
  const tfOpts = el.activityKind === "true_false" && opts.length === 0
    ? (isAr ? ["صح", "خطأ"] : ["True", "False"])
    : opts;
  const interactiveState = presentActivityState?.elementId === el.id ? presentActivityState : undefined;
  const selectedIndex = interactiveState?.selectedIndex ?? null;
  const answered = selectedIndex !== null;
  const completed = !!interactiveState?.completed;
  const showFeedback = answered || !!revealAnswers;
  const optionPalette = [
    { bg: "#ef4444", fg: "#ffffff", soft: "#fee2e2" },
    { bg: "#2563eb", fg: "#ffffff", soft: "#dbeafe" },
    { bg: "#f59e0b", fg: "#1f2937", soft: "#fef3c7" },
    { bg: "#16a34a", fg: "#ffffff", soft: "#dcfce7" },
    { bg: "#7c3aed", fg: "#ffffff", soft: "#ede9fe" },
    { bg: "#0891b2", fg: "#ffffff", soft: "#cffafe" },
  ];
  const renderTextAnswerCard = (labelText: string, helper: string, icon: string) => (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minHeight: 0,
    }}>
      <div style={{
        flex: 1,
        minHeight: 92,
        border: `2.5px dashed ${accent}55`,
        borderRadius: 18,
        background: `linear-gradient(135deg, ${accent}0f 0%, #ffffff 70%)`,
        color: "#64748b",
        fontSize: 18,
        fontWeight: 800,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}>
        <span style={{ fontSize: 30, marginInlineEnd: 10 }}>{icon}</span>
        {labelText}
      </div>
      <div style={{
        borderRadius: 14,
        background: "#f8fafc",
        border: "1.5px solid #e2e8f0",
        padding: "10px 14px",
        color: "#64748b",
        fontSize: 14,
        fontWeight: 700,
        textAlign: "center",
      }}>
        {helper}
      </div>
    </div>
  );
  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 68%, #fff7db 100%)",
        border: `3px solid ${accent}`,
        borderRadius: 22,
        boxShadow: "0 14px 34px rgba(34,87,57,0.16)",
        padding: "22px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8,
      }}>
        <span style={{
          background: accent, color: "white",
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          padding: "4px 10px", borderRadius: 999,
        }}>{label}</span>
        <span style={{
          background: gold, color: "#1f2937",
          fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
          opacity: 0.9,
        }}>{isAr ? "نشاط" : "Activity"}</span>
      </div>
      {/* Stage Mode: title appears first (0.15 s), then options stagger at 200 ms intervals. */}
      <div style={{
        color: "#0f172a", fontWeight: 900, fontSize: 30, lineHeight: 1.25,
        wordBreak: "break-word",
        animation: stageMode ? "_stageElIn 0.4s ease-out 0.15s both" : undefined,
      }}>
        {el.prompt || (isAr ? "نص السؤال…" : "Question text…")}
      </div>
      {showOpts && tfOpts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 2 }}>
          {tfOpts.map((opt, i) => {
            const isTf = el.activityKind === "true_false";
            const color = isTf
              ? (i === 0 ? { bg: "#16a34a", fg: "#ffffff", soft: "#dcfce7" } : { bg: "#dc2626", fg: "#ffffff", soft: "#fee2e2" })
              : optionPalette[i % optionPalette.length];
            const isCorrect = typeof el.correctIndex === "number" && i === el.correctIndex;
            const isSelected = selectedIndex === i;
            const revealedCorrect = showFeedback && isCorrect;
            const revealedWrong = answered && isSelected && !isCorrect;
            const dimmedAfterAnswer = showFeedback && !isCorrect;
            return (
              <button
                key={i}
                type="button"
                disabled={answered || !presentActivityHandlers?.onSelectAnswer}
                onClick={(ev) => {
                  ev.stopPropagation();
                  presentActivityHandlers?.onSelectAnswer?.(el.id, i);
                }}
                style={{
                border: `${revealedCorrect ? 4 : 2.5}px solid ${revealedCorrect ? "#16a34a" : revealedWrong ? "#dc2626" : color.bg}`,
                borderRadius: 18,
                padding: "14px 16px",
                fontSize: 22,
                color: dimmedAfterAnswer ? "#94a3b8" : "#0f172a",
                background: revealedCorrect ? "#dcfce7" : revealedWrong ? "#fee2e2" : color.soft,
                fontWeight: 900,
                minHeight: 72,
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "start",
                cursor: answered || !presentActivityHandlers?.onSelectAnswer ? "default" : "pointer",
                opacity: dimmedAfterAnswer ? 0.38 : 1,
                filter: dimmedAfterAnswer ? "grayscale(0.75) saturate(0.35)" : undefined,
                boxShadow: revealedCorrect
                  ? "0 0 0 5px rgba(22,163,74,0.24), 0 0 34px rgba(22,163,74,0.56)"
                  : revealedWrong
                    ? "0 0 0 4px rgba(220,38,38,0.14), 0 0 20px rgba(220,38,38,0.28)"
                    : `0 10px 20px ${color.bg}22`,
                animation: (revealedCorrect || revealedWrong) ? "_answerReveal 0.75s ease-out both" : (stageMode ? `_stageElIn 0.35s ease-out ${0.35 + i * 0.2}s both` : undefined),
              }}
              >
                <span style={{
                  flex: "none",
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: color.bg,
                  color: color.fg,
                  fontSize: 18,
                  fontWeight: 950,
                }}>
                  {isTf ? (i === 0 ? "✓" : "✕") : (isAr ? ["أ", "ب", "ج", "د", "هـ", "و"][i] : String.fromCharCode(65 + i))}
                </span>
                <span style={{ minWidth: 0, wordBreak: "break-word" }}>{opt}</span>
                {revealedCorrect ? (
                  <span style={{
                    marginInlineStart: "auto",
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: "#16a34a",
                    color: "white",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 950,
                    fontSize: 30,
                    boxShadow: "0 10px 22px rgba(22,163,74,0.34)",
                  }}>✓</span>
                ) : null}
                {revealedWrong ? (
                  <span style={{ marginInlineStart: "auto", color: "#dc2626", fontWeight: 950, fontSize: 24 }}>✕</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {answered && typeof el.correctIndex === "number" && (
        <div style={{
          marginTop: 2,
          borderRadius: 16,
          padding: "12px 14px",
          background: selectedIndex === el.correctIndex ? "#dcfce7" : "#fff7ed",
          border: `2px solid ${selectedIndex === el.correctIndex ? "#16a34a" : "#fb923c"}`,
          color: selectedIndex === el.correctIndex ? "#166534" : "#9a3412",
          fontSize: 17,
          fontWeight: 950,
          textAlign: "center",
          animation: "_answerReveal 0.55s ease-out both",
        }}>
          {selectedIndex === el.correctIndex
            ? (isAr ? "إجابة صحيحة" : "Correct answer")
            : (isAr ? "إجابة غير صحيحة - ظهرت الإجابة الصحيحة" : "Not correct - the correct answer is shown")}
        </div>
      )}
      {completed ? (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            presentActivityHandlers?.onFinishActivity?.(el.id);
          }}
          style={{
            marginTop: 2,
            border: "none",
            borderRadius: 18,
            padding: "13px 16px",
            background: "linear-gradient(135deg, #225739 0%, #16a34a 100%)",
            color: "white",
            fontSize: 17,
            fontWeight: 950,
            cursor: "pointer",
            boxShadow: "0 12px 26px rgba(34,87,57,0.24)",
            animation: "_answerReveal 0.55s ease-out both",
          }}
        >
          {isAr ? "انتهى النشاط - انتقل للشريحة التالية" : "Activity complete - next slide"}
        </button>
      ) : null}
      {activityKind === "open" && renderTextAnswerCard(
        isAr ? "مساحة كتابة إجابة الطالب" : "Student answer writing space",
        isAr ? "إجابة مفتوحة للشرح أو النقاش داخل الصف" : "Open answer for class discussion or explanation",
        "✍️",
      )}
      {activityKind === "word_cloud" && renderTextAnswerCard(
        isAr ? "كل طالب يكتب كلمة أو عبارة قصيرة" : "Each student writes one word or short phrase",
        isAr ? "تظهر الكلمات المتكررة أكبر في الجلسة التفاعلية" : "Repeated words grow larger in an interactive session",
        "☁️",
      )}
      {activityKind === "open_wall" && renderTextAnswerCard(
        isAr ? "ردود الطلاب تظهر كبطاقات" : "Student responses appear as cards",
        isAr ? "مناسب للمشاركة الجماعية والنقاش" : "Best for shared reflection and discussion",
        "💬",
      )}
    </div>
  );
}

/* Phase 7 — Activity card. We deliberately do NOT label the slide
   with the underlying platform game's brand name (Kahoot, Wheel, …).
   Per teacher feedback the slide should just present the questions
   and answers cleanly so they're readable in projection mode, not
   only when running live. The first question is shown large; the
   rest are listed compactly so the teacher can see what's coming.
   The correct answer is highlighted on the slide itself — this is
   the teacher's projector view, not the student device. */
export function HasadGameRenderer({
  el, lang, revealAnswers, presentActivityState, presentActivityHandlers,
}: {
  el: SlideElement;
  lang?: "ar" | "en";
  revealAnswers?: boolean;
  presentActivityState?: PresentActivityState;
  presentActivityHandlers?: PresentActivityHandlers;
}) {
  if (el.kind !== "hasad-game") return null;
  const isAr = lang !== "en";
  const accent = el.accentColor ?? "#225739";
  const gold = "#D9A521";
  const questions = Array.isArray(el.questions) ? el.questions : [];
  const total = questions.length;
  const headTitle = el.topic || el.prompt || (isAr ? "نشاط الصف" : "Class activity");
  const interactiveState = presentActivityState?.elementId === el.id ? presentActivityState : undefined;
  const questionIndex = Math.max(0, Math.min(interactiveState?.questionIndex ?? 0, Math.max(0, total - 1)));
  const first = questions[questionIndex];
  const remainingCount = Math.max(0, total - questionIndex - 1);
  const selectedIndex = interactiveState?.selectedIndex ?? null;
  const answered = selectedIndex !== null;
  const completed = !!interactiveState?.completed;
  const showFeedback = answered || !!revealAnswers;
  const letters = isAr ? ["أ", "ب", "ج", "د", "هـ", "و"] : ["A", "B", "C", "D", "E", "F"];
  const optionPalette = [
    { bg: "#ef4444", fg: "#ffffff", soft: "#fee2e2" },
    { bg: "#2563eb", fg: "#ffffff", soft: "#dbeafe" },
    { bg: "#f59e0b", fg: "#1f2937", soft: "#fef3c7" },
    { bg: "#16a34a", fg: "#ffffff", soft: "#dcfce7" },
    { bg: "#7c3aed", fg: "#ffffff", soft: "#ede9fe" },
    { bg: "#0891b2", fg: "#ffffff", soft: "#cffafe" },
  ];
  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #fff7db 100%)",
        border: `3px solid ${accent}`,
        borderRadius: 24,
        boxShadow: "0 16px 40px rgba(34,87,57,0.18)",
        padding: "24px 30px",
        display: "flex", flexDirection: "column", gap: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{
          background: accent, color: "white",
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
          padding: "5px 12px", borderRadius: 999,
        }}>{isAr ? "نشاط تفاعلي" : "Activity"}</span>
        {total > 0 ? (
          <span style={{
            background: gold, color: "#1f2937",
            fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 8,
          }}>{isAr ? `${total} سؤال` : `${total} question${total === 1 ? "" : "s"}`}</span>
        ) : null}
      </div>

      <div style={{ color: accent, fontWeight: 950, fontSize: 24, lineHeight: 1.2, wordBreak: "break-word" }}>
        {headTitle}
      </div>

      {first ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
          <div style={{ color: "#0f172a", fontWeight: 950, fontSize: 32, lineHeight: 1.22, wordBreak: "break-word" }}>
            {total > 1 ? <span style={{ color: accent, marginInlineEnd: 8 }}>{isAr ? `س${questionIndex + 1}.` : `Q${questionIndex + 1}.`}</span> : null}
            {first.prompt}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: first.options.length > 2 ? "1fr 1fr" : "1fr", gap: 12 }}>
            {first.options.map((opt, i) => {
              const isCorrect = i === first.correctIndex;
              const isSelected = selectedIndex === i;
              const revealedCorrect = showFeedback && isCorrect;
              const revealedWrong = answered && isSelected && !isCorrect;
              const dimmedAfterAnswer = showFeedback && !isCorrect;
              const color = optionPalette[i % optionPalette.length];
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered || !presentActivityHandlers?.onSelectAnswer}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    presentActivityHandlers?.onSelectAnswer?.(el.id, i);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "14px 16px",
                    background: revealedCorrect ? "#dcfce7" : revealedWrong ? "#fee2e2" : color.soft,
                    border: `${revealedCorrect ? 4 : 2.5}px solid ${revealedCorrect ? "#16a34a" : revealedWrong ? "#dc2626" : color.bg}`,
                    borderRadius: 18,
                    color: dimmedAfterAnswer ? "#94a3b8" : "#0f172a", fontSize: 22, fontWeight: 900,
                    minWidth: 0,
                    width: "100%",
                    textAlign: "start",
                    cursor: answered || !presentActivityHandlers?.onSelectAnswer ? "default" : "pointer",
                    opacity: dimmedAfterAnswer ? 0.38 : 1,
                    filter: dimmedAfterAnswer ? "grayscale(0.75) saturate(0.35)" : undefined,
                    boxShadow: revealedCorrect
                      ? "0 0 0 5px rgba(22,163,74,0.24), 0 0 34px rgba(22,163,74,0.56)"
                      : revealedWrong
                        ? "0 0 0 4px rgba(220,38,38,0.14), 0 0 20px rgba(220,38,38,0.28)"
                        : `0 10px 22px ${color.bg}22`,
                    animation: (revealedCorrect || revealedWrong) ? "_answerReveal 0.75s ease-out both" : undefined,
                  }}
                >
                  <span style={{
                    flex: "none",
                    width: 38, height: 38, borderRadius: 12,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: revealedCorrect ? "#16a34a" : color.bg,
                    color: revealedCorrect ? "white" : color.fg, fontWeight: 950, fontSize: 18,
                  }}>{letters[i] ?? String(i + 1)}</span>
                  <span style={{ wordBreak: "break-word", minWidth: 0 }}>{opt}</span>
                  {revealedCorrect ? (
                    <span style={{
                      marginInlineStart: "auto",
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      background: "#16a34a",
                      color: "white",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 950,
                      fontSize: 30,
                      boxShadow: "0 10px 22px rgba(22,163,74,0.34)",
                    }}>✓</span>
                  ) : null}
                  {revealedWrong ? (
                    <span style={{ marginInlineStart: "auto", color: "#dc2626", fontWeight: 950, fontSize: 24 }}>✕</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {answered ? (
            <div style={{
              marginTop: 2,
              borderRadius: 16,
              padding: "12px 14px",
              background: selectedIndex === first.correctIndex ? "#dcfce7" : "#fff7ed",
              border: `2px solid ${selectedIndex === first.correctIndex ? "#16a34a" : "#fb923c"}`,
              color: selectedIndex === first.correctIndex ? "#166534" : "#9a3412",
              fontSize: 17,
              fontWeight: 950,
              textAlign: "center",
              animation: "_answerReveal 0.55s ease-out both",
            }}>
              {selectedIndex === first.correctIndex
                ? (isAr ? "إجابة صحيحة" : "Correct answer")
                : (isAr ? "إجابة غير صحيحة - ظهرت الإجابة الصحيحة" : "Not correct - the correct answer is shown")}
            </div>
          ) : null}
          {remainingCount > 0 || completed ? (
            <div style={{
              marginTop: 4, padding: "8px 12px",
              background: completed ? "linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)" : "#f1f5f9",
              border: completed ? "2px solid #16a34a" : "none",
              borderRadius: 12,
              color: completed ? "#166534" : "#475569", fontSize: 13, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              boxShadow: completed ? "0 10px 24px rgba(22,163,74,0.18)" : undefined,
              animation: completed ? "_answerReveal 0.55s ease-out both" : undefined,
            }}>
              <span>
                {completed
                  ? (isAr ? "انتهى النشاط - انتقل للشريحة التالية" : "Activity complete - move to next slide")
                  : isAr
                    ? `+ ${remainingCount} ${remainingCount === 1 ? "سؤال إضافي" : "أسئلة إضافية"}`
                    : `+ ${remainingCount} more question${remainingCount === 1 ? "" : "s"}`}
              </span>
              {completed && presentActivityHandlers?.onFinishActivity ? (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    presentActivityHandlers.onFinishActivity?.(el.id);
                  }}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 12px",
                    background: "#16a34a",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {isAr ? "التالي" : "Next"}
                </button>
              ) : answered && presentActivityHandlers?.onNextQuestion ? (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    presentActivityHandlers.onNextQuestion?.(el.id);
                  }}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 12px",
                    background: accent,
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {isAr ? "السؤال التالي" : "Next question"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#64748b", fontSize: 16, fontWeight: 600, textAlign: "center",
        }}>
          {el.prompt
            ? el.prompt
            : (isAr ? "أضف أسئلة لهذا النشاط من لوحة التحرير." : "Add questions for this activity from the editor.")}
        </div>
      )}
    </div>
  );
}

/* ── HasadActivityRenderer ─────────────────────────────────────────────
   Editor + present-mode placeholder for `kind=hasad-activity` elements.
   Renders a branded card showing the linked assignment. During live
   presentation a future phase will launch the game inline; for now it
   displays a clear "will launch here" indicator so teachers know where
   the activity sits on the slide. */
const HASAD_GAME_META: Record<string, { emoji: string; nameAr: string; nameEn: string }> = {
  knowledge_race: { emoji: "⚡", nameAr: "وميض", nameEn: "Wameeth" },
  tug_of_war: { emoji: "🪢", nameAr: "شد الحبل", nameEn: "Tug of War" },
  quiz:     { emoji: "🏆", nameAr: "مسابقة تفاعلية",   nameEn: "Interactive Quiz" },
  wheel:    { emoji: "🎡", nameAr: "عجلة التحدي",         nameEn: "Wheel of Challenge" },
  million:  { emoji: "💰", nameAr: "من سيربح المليون",  nameEn: "Who Wants a Million" },
  flags:    { emoji: "🚩", nameAr: "اختبار الأعلام",    nameEn: "Flag Quiz" },
  matching: { emoji: "🔗", nameAr: "مطابقة",            nameEn: "Matching" },
};

export function HasadActivityRenderer({ el, lang }: { el: SlideElement; lang?: "ar" | "en" }) {
  if (el.kind !== "hasad-activity") return null;
  const isAr = lang !== "en";
  const accent = "#225739";
  const gold   = "#D9A521";
  const elAny  = el as unknown as { assignmentId?: number; assignmentTitle?: string; gameType?: string };
  const title  = elAny.assignmentTitle ?? (isAr ? "نشاط من حصاد" : "Hasad Activity");
  const game   = elAny.gameType ? HASAD_GAME_META[elAny.gameType] : null;

  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%)",
        border: `2.5px solid ${accent}`,
        borderRadius: 18,
        boxShadow: "0 8px 32px rgba(34,87,57,0.12)",
        padding: "28px 32px",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16,
        overflow: "hidden",
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* Subtle background watermark */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 180, opacity: 0.04, pointerEvents: "none", userSelect: "none",
        lineHeight: 1,
      }}>
        {game?.emoji ?? "🎮"}
      </div>

      {/* Top badge row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: gold, color: "#1f2937",
          padding: "5px 14px", borderRadius: 999,
          fontSize: 12, fontWeight: 800, letterSpacing: 0.3,
        }}>
          🎮 {isAr ? "نشاط حصاد" : "Hasad Activity"}
        </div>
        {game && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: `${accent}12`, color: accent,
            border: `1.5px solid ${accent}30`,
            padding: "5px 12px", borderRadius: 999,
            fontSize: 12, fontWeight: 700,
          }}>
            <span>{game.emoji}</span>
            {isAr ? game.nameAr : game.nameEn}
          </div>
        )}
      </div>

      {/* Assignment title */}
      <div style={{
        color: accent, fontWeight: 900,
        fontSize: 26, lineHeight: 1.3,
        wordBreak: "break-word", maxWidth: "85%",
      }}>
        {title}
      </div>

      {/* Game type big display */}
      {game && (
        <div style={{
          fontSize: 52, lineHeight: 1,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.10))",
        }}>
          {game.emoji}
        </div>
      )}

      {/* Launch hint */}
      <div style={{
        color: "#64748b", fontSize: 13, fontWeight: 500,
        border: `1.5px dashed ${accent}35`,
        borderRadius: 10, padding: "8px 18px",
        background: `${accent}06`,
      }}>
        {isAr
          ? "سيُطلق هذا النشاط تلقائياً أثناء العرض المباشر"
          : "This activity will launch automatically during the live presentation"}
      </div>
    </div>
  );
}

/* ── VideoEmbedRenderer ────────────────────────────────────────────────
   Present-mode renderer for video-embed elements. Renders a live iframe
   so the teacher can play the video directly from the slide. For YouTube
   it uses the standard embed URL; for Hasad interactive video lessons it
   points at the student player route (/video/:id) which handles auth-
   free viewing via the lesson's accessMode. */
function VideoEmbedRenderer({ el }: { el: SlideElement }) {
  if (el.kind !== "video-embed") return null;
  const { videoKind, videoId, url, title } = el as {
    kind: "video-embed";
    videoKind?: string;
    videoId?: string;
    url?: string;
    title?: string;
  };

  let embedSrc = "";
  if (videoKind === "youtube" && videoId) {
    embedSrc = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  } else if (videoKind === "hasad-video" && videoId) {
    embedSrc = `/video/${videoId}`;
  } else {
    embedSrc = url ?? "";
  }

  if (!embedSrc) {
    return (
      <div style={{
        width: "100%", height: "100%",
        background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: 12,
      }}>
        <span style={{ color: "#64748b", fontSize: 14 }}>
          {videoKind === "hasad-video" ? "فيديو تفاعلي" : "Video"}
        </span>
      </div>
    );
  }

  return (
    <iframe
      src={embedSrc}
      title={title ?? (videoKind === "hasad-video" ? "فيديو تفاعلي" : "Video")}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        width: "100%", height: "100%",
        border: "none",
        borderRadius: 12,
        display: "block",
      }}
    />
  );
}

/**
 * Render a single slide at the canonical 1280×720 ratio. Parent
 * controls the outer size — we just lay the elements out at percentage
 * coordinates so it scales letterboxed inside any container.
 */
export function SlideRender({
  slide, theme, pattern, lang, stageMode, revealAnswers, presentActivityState, presentActivityHandlers,
}: {
  slide: Slide;
  theme: string;
  pattern: string;
  lang?: "ar" | "en";
  stageMode?: boolean;
  revealAnswers?: boolean;
  presentActivityState?: PresentActivityState;
  presentActivityHandlers?: PresentActivityHandlers;
}) {
  const bg = slideBgStyle(slide, theme, pattern);
  const slideDir = (slide as unknown as { dir?: string }).dir;
  const dir = (slideDir === "rtl" || slideDir === "ltr") ? slideDir : (lang === "ar" ? "rtl" : "ltr");
  /* Per-slide default text color is contrast-aware: a slide with a
     light custom background must NOT inherit the dark theme's white
     default (that produced the white-on-white bug teachers reported).
     `defaultTextColorForSlide` resolves this by inspecting the actual
     slide.background luminance before falling back to the theme. */
  const defaultTextColor = defaultTextColorForSlide(slide, theme);
  /* When the slide has its own image, override the theme background.
     CRITICAL: do NOT include `backgroundImage / backgroundSize /
     backgroundPosition: undefined` in the style object — `bg` uses
     the `background` shorthand to set the theme gradient, and React
     applies undefined longhand values as empty strings on hydration/
     update, which CLEARS the gradient set by the shorthand. The
     symptom was a "fully black" preview/present surface where only
     text/elements rendered. Build the style conditionally instead. */
  const finalStyle: React.CSSProperties = slide.backgroundImage
    ? {
        ...bg,
        backgroundImage: `url(${slide.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : bg;
  return (
    <div
      dir={dir}
      lang={lang}
      className="relative w-full h-full overflow-hidden"
      style={finalStyle}
    >
      {/* Stage Mode: inject keyframe for element stagger animation.
          Using a <style> tag is the simplest way to define @keyframes
          without adding a motion library dependency to this utility. */}
      {(stageMode || revealAnswers) && (
        <style>{`@keyframes _stageElIn{from{opacity:0;transform:translateY(16px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes _answerReveal{0%{transform:scale(.98);filter:saturate(.8)}45%{transform:scale(1.025);filter:saturate(1.25)}100%{transform:scale(1);filter:saturate(1)}}`}</style>
      )}
      {(slide.elements ?? []).map((el: SlideElement, i: number) => {
        const left = `${(el.x / CANVAS_W) * 100}%`;
        const top = `${(el.y / CANVAS_H) * 100}%`;
        const w = `${(el.w / CANVAS_W) * 100}%`;
        const h = `${(el.h / CANVAS_H) * 100}%`;
        const stageAnim: React.CSSProperties = stageMode
          ? { animation: `_stageElIn 0.45s ease-out ${i * 0.2}s both` }
          : {};
        const style: React.CSSProperties = {
          position: "absolute",
          left, top, width: w, height: h,
          ...stageAnim,
        };
        if (el.kind === "text") {
          const elTextDirection = (el as unknown as { textDirection?: string }).textDirection;
          return (
            <div
              key={el.id}
              style={{
                ...style,
                color: el.color ?? defaultTextColor,
                fontFamily: el.fontFamily ?? undefined,
                fontSize: `${el.fontSize ?? 28}px`,
                fontWeight: el.fontWeight ?? "400",
                textAlign: (el.align as React.CSSProperties["textAlign"]) ?? "start",
                direction: (elTextDirection === "rtl" || elTextDirection === "ltr") ? elTextDirection : undefined,
                background: el.bgColor ?? undefined,
                lineHeight: 1.2,
                wordBreak: "break-word",
                overflowWrap: "break-word",
                whiteSpace: "pre-wrap",
                overflow: "hidden",
              }}
            >
              {el.text ?? ""}
            </div>
          );
        }
        if (el.kind === "image") {
          const imgEl = el as typeof el & {
            objectFit?: "cover" | "contain" | "fill" | "none";
            objectPositionX?: number;
            objectPositionY?: number;
            cropPct?: { x: number; y: number; w: number; h: number };
            imageOpacity?: number;
            imageBorderRadius?: number;
            flipH?: boolean;
            flipV?: boolean;
            brightness?: number;
            contrast?: number;
            saturation?: number;
          };
          const transforms: string[] = [];
          if (imgEl.flipH) transforms.push("scaleX(-1)");
          if (imgEl.flipV) transforms.push("scaleY(-1)");
          const filters: string[] = [];
          if (imgEl.brightness !== undefined && imgEl.brightness !== 100) filters.push(`brightness(${imgEl.brightness}%)`);
          if (imgEl.contrast   !== undefined && imgEl.contrast   !== 100) filters.push(`contrast(${imgEl.contrast}%)`);
          if (imgEl.saturation !== undefined && imgEl.saturation !== 100) filters.push(`saturate(${imgEl.saturation}%)`);
          const crop = imgEl.cropPct;
          const transformStr = transforms.length ? transforms.join(" ") : undefined;
          const filterStr   = filters.length ? filters.join(" ") : undefined;
          return (
            <div key={el.id} style={{ ...style, borderRadius: imgEl.imageBorderRadius ? `${imgEl.imageBorderRadius}px` : undefined, overflow: "hidden", opacity: imgEl.imageOpacity ?? 1 }}>
              {el.url
                ? crop
                  ? (
                    <div style={{
                      width: `${100 / crop.w}%`,
                      height: `${100 / crop.h}%`,
                      transform: `translate(${-(crop.x / crop.w) * 100}%, ${-(crop.y / crop.h) * 100}%)`,
                    }}>
                      <img src={el.url} alt="" draggable={false}
                        style={{ display: "block", width: "100%", height: "100%", objectFit: "fill",
                          transform: transformStr, filter: filterStr }} />
                    </div>
                  )
                  : (
                    <img
                      src={el.url}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: imgEl.objectFit ?? "cover",
                        objectPosition: `${imgEl.objectPositionX ?? 50}% ${imgEl.objectPositionY ?? 50}%`,
                        transform: transformStr,
                        filter: filterStr,
                      }}
                      draggable={false}
                    />
                  )
                : null}
            </div>
          );
        }
        if (el.kind === "icon") {
          const Icon = getLucideIcon(el.iconName);
          const size = Math.max(16, Math.min(el.w, el.h) * 0.85);
          return (
            <div key={el.id} style={{ ...style, color: el.color ?? defaultTextColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={size} strokeWidth={1.75} />
            </div>
          );
        }
        if (el.kind === "activity") {
          return <div key={el.id} style={style}><ActivityRenderer el={el} lang={lang} stageMode={stageMode} revealAnswers={revealAnswers} presentActivityState={presentActivityState} presentActivityHandlers={presentActivityHandlers} /></div>;
        }
        if (el.kind === "hasad-game") {
          return <div key={el.id} style={style}><HasadGameRenderer el={el} lang={lang} revealAnswers={revealAnswers} presentActivityState={presentActivityState} presentActivityHandlers={presentActivityHandlers} /></div>;
        }
        if (el.kind === "hasad-activity") {
          return <div key={el.id} style={style}><HasadActivityRenderer el={el} lang={lang} /></div>;
        }
        if (el.kind === "video-embed") {
          return <div key={el.id} style={style}><VideoEmbedRenderer el={el} /></div>;
        }
        return <div key={el.id} style={style}><ShapeRenderer el={el} /></div>;
      })}
    </div>
  );
}

/**
 * A slide rendered into a 16:9 box that scales-to-fit the parent while
 * preserving the canonical aspect ratio (letterboxed). Used by present
 * mode and the public viewer.
 */
export function SlideStage({
  slide, theme, pattern, lang, stageMode, revealAnswers, presentActivityState, presentActivityHandlers,
}: {
  slide: Slide;
  theme: string;
  pattern: string;
  lang?: "ar" | "en";
  stageMode?: boolean;
  revealAnswers?: boolean;
  presentActivityState?: PresentActivityState;
  presentActivityHandlers?: PresentActivityHandlers;
}) {
  /* Letterbox a 16:9 stage inside any parent (full-screen present
     mode OR a constrained modal). We render the inner frame at its
     canonical pixel size (1280×720) and use a JS-driven `transform:
     scale(...)` to fit the parent — the same approach reveal.js,
     impress.js, and most slide engines use.

     Why not pure CSS: we tried both `width:100% + aspect-ratio +
     max-h-full` (landscape OK, portrait collapses) and container-
     query sizing with `containerType: size` + `100cqw / 100cqh`
     math (mathematically correct but observed to collapse to 0×0
     in production inside flex / animated / `position:absolute inset-0`
     ancestors, leaving only the parent's `bg-black`). A measured
     scale is robust regardless of parent layout, animation, or
     ancestor `containerType` quirks, and the inner content lays out
     once at a fixed pixel canvas so children never re-flow on
     resize. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const r = wrap.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const s = Math.min(r.width / CANVAS_W, r.height / CANVAS_H);
      if (s > 0 && Number.isFinite(s)) setScale(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      data-slide-stage=""
    >
      <div
        className="relative shadow-2xl"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          flex: "none",
        }}
        data-slide-stage-frame=""
      >
        <SlideRender slide={slide} theme={theme} pattern={pattern} lang={lang} stageMode={stageMode} revealAnswers={revealAnswers} presentActivityState={presentActivityState} presentActivityHandlers={presentActivityHandlers} />
      </div>
    </div>
  );
}
