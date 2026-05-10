import type { Feature, FeatureAccessResult, SubscriptionView } from "./types";
type CachedSubscription = SubscriptionView & {
    isAdmin: boolean;
};
declare class FeatureAccessService {
    private subscriptionCache;
    private get paymentsEnabled();
    private currentMonth;
    private todayUtc;
    /** Public: invalidate cache when a subscription is changed. */
    invalidate(teacherId: number): void;
    /** Public: invalidate everyone (e.g. when a plan's limits change). */
    invalidateAll(): void;
    /**
     * Returns the teacher's current plan + subscription view. Auto-creates a
     * Free subscription if none exists.
     */
    getSubscription(teacherId: number): Promise<CachedSubscription>;
    private loadSubscription;
    private fetchSubscriptionRow;
    /** Idempotently subscribe a teacher to the Free plan. */
    ensureFreeSubscription(teacherId: number): Promise<void>;
    /** Read-only check. Does not consume any quota. */
    check(teacherId: number, feature: Feature): Promise<FeatureAccessResult>;
    /**
     * Atomically increment usage for `feature`. When the limit is non-NULL the
     * increment is conditional and returns null when the limit would be
     * exceeded; in that case the caller is denied.
     *
     * Resource-style features (add_student, create_class) are not stored in
     * subscription_usage — they're counted from their own tables — so for those
     * we simply re-check after the caller has inserted the row. To keep the API
     * uniform, callers should:
     *   1) call increment() BEFORE inserting flow-style rows (homework, ai)
     *   2) call check() BEFORE inserting resource-style rows (student, class)
     * Both produce the same FeatureAccessResult shape.
     */
    increment(teacherId: number, feature: Feature): Promise<FeatureAccessResult>;
    private measure;
    /**
     * Atomically increments subscription_usage.homeworks_count. If `limit` is
     * non-null the UPDATE is gated by `< limit`, so the row count tells us if
     * the increment succeeded.
     */
    private atomicMonthlyIncrement;
    private atomicDailyAiIncrement;
    /** Unconditional monthly counter bump (no limit check). */
    private bumpMonthly;
    /** Refund a previously incremented flow counter (e.g. AI call failed upstream). */
    refund(teacherId: number, feature: Feature): Promise<void>;
}
export declare const featureAccess: FeatureAccessService;
export type { FeatureAccessService };
//# sourceMappingURL=feature-access.d.ts.map