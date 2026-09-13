export type RewardLang = "ar" | "en";

export function rewardText(lang: RewardLang, arabic: string, english: string): string {
  return lang === "ar" ? arabic : english;
}

export function rewardNumber(lang: RewardLang, value: number): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-US").format(value);
}

export function rewardDate(lang: RewardLang, value: Date): string {
  return value.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US");
}