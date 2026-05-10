import { db, plansTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

const PLANS = [
  { code: "free",   nameAr: "مجاني",      nameEn: "Free",   priceMinor: 0,     billingPeriodDays: 0,  maxHomeworksPerMonth: 3,    aiUsageDailyLimit: 20, maxUsers: 1,    sortOrder: 10 },
  { code: "basic",  nameAr: "الأساسي",   nameEn: "Basic",  priceMinor: 2500,  billingPeriodDays: 30, maxHomeworksPerMonth: 20,   aiUsageDailyLimit: 50, maxUsers: 1,    sortOrder: 20 },
  { code: "pro",    nameAr: "الاحترافي", nameEn: "Pro",    priceMinor: 6500,  billingPeriodDays: 30, maxHomeworksPerMonth: null, aiUsageDailyLimit: null, maxUsers: 1,  sortOrder: 30 },
  { code: "school", nameAr: "مدرسة",     nameEn: "School", priceMinor: 25000, billingPeriodDays: 30, maxHomeworksPerMonth: null, aiUsageDailyLimit: null, maxUsers: null, sortOrder: 40 },
];

export async function seedPlansIfMissing(): Promise<void> {
  try {
    const existing = await db.select({ code: plansTable.code }).from(plansTable);
    const have = new Set(existing.map((r) => r.code));
    const missing = PLANS.filter((p) => !have.has(p.code));
    if (missing.length === 0) return;
    for (const p of missing) {
      await db.execute(sql`
        INSERT INTO plans (code, name_ar, name_en, price_minor, currency, billing_period_days,
                           max_students, max_classes, max_homeworks_per_month, ai_usage_daily_limit,
                           max_users, sort_order, is_active, created_at, updated_at)
        VALUES (${p.code}, ${p.nameAr}, ${p.nameEn}, ${p.priceMinor}, 'KWD', ${p.billingPeriodDays},
                NULL, NULL, ${p.maxHomeworksPerMonth}, ${p.aiUsageDailyLimit},
                ${p.maxUsers}, ${p.sortOrder}, true, NOW(), NOW())
        ON CONFLICT (code) DO NOTHING
      `);
    }
    logger.info({ seeded: missing.map((p) => p.code) }, "[seedPlans] plans seeded");
  } catch (err) {
    logger.error({ err }, "[seedPlans] failed");
  }
}
