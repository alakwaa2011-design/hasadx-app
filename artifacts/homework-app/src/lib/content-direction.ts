export type ContentDirection = "rtl" | "ltr";

const RTL_CHARACTER = /[\u0590-\u08ff\u200f\ufb1d-\ufefc]/;
const LTR_CHARACTER = /[A-Za-z\u00c0-\u02af]/;
const ARABIC_LETTER = /[\u0621-\u064a\u066e-\u06d3\u06fa-\u06fc]/;
const MATH_SIGNAL = /(?:\\[a-zA-Z]+|[0-9\u0660-\u0669\u06f0-\u06f9]|[+\-−±×÷=*/%^√∑∫≈≠≤≥()[\]{}<>])/;

export function isEquationOnly(value: string | null | undefined): boolean {
  const text = value?.trim() || "";
  return !!text && !ARABIC_LETTER.test(text) && MATH_SIGNAL.test(text);
}

export function contentDirection(
  value: string | null | undefined,
  fallback: ContentDirection = "rtl",
): ContentDirection {
  const text = value?.trimStart() || "";
  if (isEquationOnly(text)) return "ltr";

  for (const character of text) {
    if (RTL_CHARACTER.test(character)) return "rtl";
    if (LTR_CHARACTER.test(character)) return "ltr";
  }

  return text ? "ltr" : fallback;
}