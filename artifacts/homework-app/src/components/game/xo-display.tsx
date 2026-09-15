import type { HTMLAttributes } from "react";

export const XO_DISPLAY_NAME = "X O";

const LEGACY_XO_TITLES = new Set([
  "إكس أو",
  "إكس أو الصف",
  "إعداد إكس أو",
  "إنشاء لعبة إكس أو",
  "XO",
  "XO Class",
  "XO setup",
  "Create XO game",
]);

export type XoLanguage = "ar" | "en";

export function getDefaultXoTeamName(team: "x" | "o", lang: XoLanguage): string {
  return lang === "ar" ? `فريق ${team.toUpperCase()}` : `Team ${team.toUpperCase()}`;
}

export function getDefaultXoTitle(lang: XoLanguage, classroom = false): string {
  if (!classroom) return XO_DISPLAY_NAME;
  return lang === "ar" ? `${XO_DISPLAY_NAME} الصف` : `${XO_DISPLAY_NAME} Class`;
}

export function normalizeXoTeamName(
  name: string | null | undefined,
  team: "x" | "o",
  lang: XoLanguage,
): string {
  const value = typeof name === "string" ? name.trim() : "";
  const legacy = team === "x"
    ? new Set(["فريق إكس", "Team X"])
    : new Set(["فريق أو", "Team O"]);
  return !value || legacy.has(value) ? getDefaultXoTeamName(team, lang) : name ?? "";
}

/**
 * Legacy default titles are display-only compatibility values. Exact custom
 * teacher titles are deliberately left untouched.
 */
export function normalizeXoTitle(title: string | null | undefined, lang: XoLanguage): string {
  const value = typeof title === "string" ? title.trim() : "";
  if (!LEGACY_XO_TITLES.has(value)) return title ?? "";
  return value === "إكس أو الصف" || value === "XO Class"
    ? getDefaultXoTitle(lang, true)
    : XO_DISPLAY_NAME;
}

export function XoTitle({
  title,
  lang,
}: {
  title: string | null | undefined;
  lang: XoLanguage;
}) {
  const displayTitle = normalizeXoTitle(title, lang) || getDefaultXoTitle(lang);
  if (displayTitle === getDefaultXoTitle(lang)) return <XoName />;
  if (displayTitle === getDefaultXoTitle(lang, true)) {
    return lang === "ar" ? <><XoName /> الصف</> : <><XoName /> Class</>;
  }
  return <>{displayTitle}</>;
}

export function XoName({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, "dir"> & { className?: string }) {
  return (
    <span
      {...props}
      dir="ltr"
      className={className ? `inline-block ${className}` : "inline-block"}
      style={{ unicodeBidi: "isolate", ...props.style }}
    >
      {XO_DISPLAY_NAME}
    </span>
  );
}