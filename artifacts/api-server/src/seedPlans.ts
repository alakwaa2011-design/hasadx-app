import { db, plansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

/**
 * Plan definitions — single source of truth for the seeder.
 *
 * monthlyCredits: credits granted each billing renewal
 * rolloverCap:    max accumulated subscription credits (NULL = no cap / no rollover)
 * currency:       USD for Lemon Squeezy subscriptions
 * priceMinor:     cents USD (0 for free)
 *
 * lemonVariantId / lemonProductId are left NULL here; admins set them via
 * the Lemon Squeezy dashboard and the admin panel after deployment.
 */
const PLANS = [
  {
    code: "free",
    nameAr: "مجاني",
    nameEn: "Free",
    priceMinor: 0,
    currency: "USD",
    billingPeriodDays: 0,
    maxUsers: 1,
    monthlyCredits: 50,
    rolloverCap: null as number | null,
    sortOrder: 10,
  },
  {
    code: "basic",
    nameAr: "الأساسي",
    nameEn: "Basic",
    priceMinor: 499,
    currency: "USD",
    billingPeriodDays: 30,
    maxUsers: 1,
    monthlyCredits: 250,
    rolloverCap: 500,
    sortOrder: 20,
  },
  {
    code: "pro",
    nameAr: "الاحترافي",
    nameEn: "Pro",
    priceMinor: 999,
    currency: "USD",
    billingPeriodDays: 30,
    maxUsers: 1,
    monthlyCredits: 600,
    rolloverCap: 1200,
    sortOrder: 30,
  },
];

const ANNUAL_BILLING_OPTIONS = [
  { planCode: "basic", lemonVariantId: "2019525", priceMinor: 4990 },
  { planCode: "pro", lemonVariantId: "2092611", priceMinor: 8990 },
] as const;

export async function seedPlansIfMissing(): Promise<void> {
  try {
    for (const p of PLANS) {
      // INSERT new plans only. Existing rows are administrator-managed via the
      // admin panel (PATCH /api/billing/admin/plans/:id) — the seeder must never
      // overwrite price/credits there. COALESCE only backfills columns that are
      // still NULL (plans seeded before the credits system existed).
      await db.execute(sql`
        INSERT INTO plans (
          code, name_ar, name_en, price_minor, currency, billing_period_days,
          max_students, max_classes, max_users, monthly_credits, rollover_cap,
          sort_order, is_active, created_at, updated_at
        ) VALUES (
          ${p.code}, ${p.nameAr}, ${p.nameEn}, ${p.priceMinor}, ${p.currency},
          ${p.billingPeriodDays}, NULL, NULL, ${p.maxUsers},
          ${p.monthlyCredits}, ${p.rolloverCap},
          ${p.sortOrder}, true, NOW(), NOW()
        )
        ON CONFLICT (code) DO UPDATE
          SET monthly_credits = COALESCE(plans.monthly_credits, EXCLUDED.monthly_credits),
              currency        = COALESCE(plans.currency, EXCLUDED.currency)
      `);
    }
    // Provider variant IDs are stable public identifiers, not credentials.
    // Seed only missing annual options so administrator changes remain authoritative.
    for (const option of ANNUAL_BILLING_OPTIONS) {
      await db.execute(sql`
        INSERT INTO plan_billing_options
          (plan_id, billing_interval, lemon_variant_id, price_minor, currency, is_active)
        SELECT id, 'year', ${option.lemonVariantId}, ${option.priceMinor}, 'USD', TRUE
        FROM plans
        WHERE code = ${option.planCode}
        ON CONFLICT DO NOTHING
      `);
    }
    logger.info("[seedPlans] plans seeded/updated");
  } catch (err) {
    logger.error({ err }, "[seedPlans] failed");
  }
}
