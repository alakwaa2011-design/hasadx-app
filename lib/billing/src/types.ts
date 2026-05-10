/**
 * Catalog of features that go through `featureAccess.check()`.
 * Add a new feature here, then map it in feature-access.ts.
 */
export const FEATURES = [
  "create_homework",
  "use_ai",
  "add_student",
  "create_class",
  "add_user",
] as const;

export type Feature = (typeof FEATURES)[number];

export interface FeatureAccessResult {
  /** Whether the action is permitted right now. */
  allowed: boolean;
  /** Remaining quota (null = unlimited). */
  remaining: number | null;
  /** Hard limit on this feature for the user's plan (null = unlimited). */
  limit: number | null;
  /** Current count consumed in the relevant window. */
  used: number;
  /** Reason the action is blocked, if any. */
  reason: string | null;
}

export interface PlanLimits {
  maxStudents: number | null;
  maxClasses: number | null;
  maxHomeworksPerMonth: number | null;
  aiUsageDailyLimit: number | null;
  maxUsers: number | null;
}

export interface SubscriptionView {
  subscriptionId: number;
  planId: number;
  planCode: string;
  planNameAr: string;
  planNameEn: string;
  priceMinor: number;
  currency: string;
  status: string;
  expiresAt: Date | null;
  limits: PlanLimits;
}
