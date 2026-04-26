export const NORMAL_AVATARS: string[] = [
  "🧕🏽",
  "👳🏽‍♂️",
  "🤵🏽‍♂️",
  "👰🏽‍♀️",
  "👨🏽‍🎓",
  "👩🏽‍🎓",
  "👨🏽‍🏫",
  "👩🏽‍🏫",
  "👨🏽‍💼",
  "👩🏽‍💼",
  "👨🏽‍⚕️",
  "👩🏽‍⚕️",
  "👨🏽‍💻",
  "👩🏽‍💻",
  "🧑🏽‍🚀",
  "🧑🏽‍🔬",
  "🏃🏽‍♂️",
  "🏃🏽‍♀️",
  "⛹🏽‍♂️",
  "🤸🏽‍♀️",
  "👦🏽",
  "👧🏽",
  "🧒🏽",
  "🧑🏽",
  "👨🏽",
  "👩🏽",
  "🦁", "🐯", "🦊", "🐻", "🐼", "🐸", "🦄", "🐨", "🐺", "🦅",
];

export const HACK_ICONS: string[] = [
  "⬛", "░", "▒", "▓", "█", "01", "10", "//",
  "##", ">>", "<<", "[]", "{}", "()", "$$", "&&",
  "||", "!!", "??", "::", ";;", "**", "++", "--",
];

export const DEFAULT_AVATAR = "🧒🏽";

export function isAvatarUrl(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:");
}
