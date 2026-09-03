export interface TrendingRankable {
  totalUses: number;
  recentUses: number;
  createdAt: string;
  isEligible: boolean;
}

interface TrendingSelectionOptions {
  recentUsageAvailable: boolean;
  minimumUses?: number;
  maximumItems?: number;
}

export function selectTrendingActivities<T extends TrendingRankable>(
  candidates: T[],
  {
    recentUsageAvailable,
    minimumUses = 5,
    maximumItems = 3,
  }: TrendingSelectionOptions,
): T[] {
  const qualifyingUses = (candidate: T) =>
    recentUsageAvailable ? candidate.recentUses : candidate.totalUses;

  return candidates
    .filter(candidate => candidate.isEligible && qualifyingUses(candidate) >= minimumUses)
    .sort((a, b) => {
      if (recentUsageAvailable && b.recentUses !== a.recentUses) {
        return b.recentUses - a.recentUses;
      }
      if (b.totalUses !== a.totalUses) {
        return b.totalUses - a.totalUses;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, maximumItems);
}