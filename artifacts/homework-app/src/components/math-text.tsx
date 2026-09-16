import { useRef, type CSSProperties, type TextareaHTMLAttributes } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { contentDirection, isEquationOnly } from "@/lib/content-direction";

const INLINE_MATH = /\\\((.+?)\\\)/gs;
const PLAIN_NUMERIC_MATH =
  /(?<![\p{L}\p{N}])(?:\(\s*)?[+\-−]?[0-9\u0660-\u0669\u06f0-\u06f9]+(?:[.,٫٬][0-9\u0660-\u0669\u06f0-\u06f9]+)?\s*\)?(?:\s*[+\-−±×÷=*/%^≈≠≤≥<>]\s*(?:\(\s*)?[+\-−]?\s*[0-9\u0660-\u0669\u06f0-\u06f9]+(?:[.,٫٬][0-9\u0660-\u0669\u06f0-\u06f9]+)?\s*\)?)*(?![\p{L}\p{N}])/gu;

type MathPart = { value: string; kind: "text" | "katex" | "plain-math" };

function appendPlainTextParts(parts: MathPart[], value: string) {
  let cursor = 0;
  for (const match of value.matchAll(PLAIN_NUMERIC_MATH)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ value: value.slice(cursor, index), kind: "text" });
    parts.push({ value: match[0], kind: "plain-math" });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) parts.push({ value: value.slice(cursor), kind: "text" });
}

export function MathText({
  children,
  text,
  fallbackDirection = "rtl",
  className,
  style,
}: {
  children?: string;
  text?: string;
  fallbackDirection?: "rtl" | "ltr";
  className?: string;
  style?: CSSProperties;
}) {
  const value = text ?? children ?? "";
  const equationOnly = isEquationOnly(value);
  const parts: MathPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(INLINE_MATH)) {
    const index = match.index ?? 0;
    if (index > cursor) appendPlainTextParts(parts, value.slice(cursor, index));
    parts.push({ value: match[1], kind: "katex" });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) appendPlainTextParts(parts, value.slice(cursor));

  return (
    <span
      dir={equationOnly ? "ltr" : contentDirection(value, fallbackDirection)}
      style={{ ...style, unicodeBidi: "isolate" }}
      className={cn(
        "whitespace-pre-wrap break-words",
        equationOnly && "inline-block text-left",
        className,
      )}
    >
      {parts.map((part, index) => {
        if (part.kind === "text") return <span key={index}>{part.value}</span>;
        if (part.kind === "plain-math") {
          return <span key={index} dir="ltr" style={{ unicodeBidi: "isolate" }}>{part.value}</span>;
        }
        let html: string;
        try {
          html = katex.renderToString(part.value, { throwOnError: true, strict: false });
        } catch {
          return <span key={index} dir="ltr" data-math-latex={part.value}>{`\\(${part.value}\\)`}</span>;
        }
        return (
          <span
            key={index}
            dir="ltr"
            data-math-latex={part.value}
            className="mx-1 inline-block align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

type MathTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "dir"> & {
  value: string;
  onValueChange: (value: string) => void;
  language?: "ar" | "en";
};

export function MathTextarea({
  value,
  onValueChange,
  language = "ar",
  className,
  ...props
}: MathTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fallbackDirection = language === "ar" ? "rtl" : "ltr";

  const insert = (kind: "fraction" | "power" | "root") => {
    const textarea = ref.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const expression = kind === "fraction"
      ? `\\(\\frac{${selected || "a"}}{b}\\)`
      : kind === "power"
        ? `\\(${selected || "x"}^{2}\\)`
        : `\\(\\sqrt{${selected || "x"}}\\)`;
    const next = value.slice(0, start) + expression + value.slice(end);
    onValueChange(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      const editableValue = kind === "fraction"
        ? (selected ? "b" : "a")
        : kind === "power"
          ? "2"
          : (selected || "x");
      const editableStart = start + expression.indexOf(editableValue);
      textarea?.setSelectionRange(editableStart, editableStart + editableValue.length);
    });
  };

  const buttons = language === "ar"
    ? [
        ["fraction", "كسر", "إدراج كسر"] as const,
        ["power", "أس", "إدراج أس"] as const,
        ["root", "جذر", "إدراج جذر تربيعي"] as const,
      ]
    : [
        ["fraction", "Fraction", "Insert fraction"] as const,
        ["power", "Power", "Insert power"] as const,
        ["root", "Root", "Insert square root"] as const,
      ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={language === "ar" ? "أدوات المعادلات" : "Equation tools"}>
        {buttons.map(([kind, label, ariaLabel]) => (
          <button
            key={kind}
            type="button"
            onClick={() => insert(kind)}
            aria-label={ariaLabel}
            className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            <span dir="ltr">{kind === "fraction" ? "a⁄b" : kind === "power" ? "x²" : "√x"}</span>
            <span className="ms-1.5">{label}</span>
          </button>
        ))}
      </div>
      <textarea
        {...props}
        ref={ref}
        value={value}
        onChange={event => onValueChange(event.target.value)}
        dir={contentDirection(value, fallbackDirection)}
        style={{ ...props.style, unicodeBidi: "plaintext" }}
        className={className}
      />
      {value.includes("\\(") && (
        <div className="rounded-lg border border-dashed border-primary/25 bg-primary/5 px-3 py-2 text-sm" aria-label={language === "ar" ? "معاينة المعادلة" : "Equation preview"}>
          <MathText text={value} fallbackDirection={fallbackDirection} />
        </div>
      )}
    </div>
  );
}