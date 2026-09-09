export function formatRewardPoints(points: number | string | null | undefined): string {
  const normalized = String(points ?? "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660));
  const value = Number(normalized);
  return new Intl.NumberFormat("en-US").format(Number.isFinite(value) ? value : 0);
}