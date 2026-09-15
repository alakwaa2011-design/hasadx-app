export type ContentDirection = "rtl" | "ltr";

const RTL_CHARACTER = /[\u0590-\u08ff\u200f\ufb1d-\ufefc]/;
const LTR_CHARACTER = /[A-Za-z\u00c0-\u02af]/;

export function contentDirection(
  value: string | null | undefined,
  fallback: ContentDirection = "rtl",
): ContentDirection {
  const text = value?.trimStart() || "";

  for (const character of text) {
    if (RTL_CHARACTER.test(character)) return "rtl";
    if (LTR_CHARACTER.test(character)) return "ltr";
  }

  return text ? "ltr" : fallback;
}