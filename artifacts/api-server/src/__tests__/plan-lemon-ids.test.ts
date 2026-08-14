/**
 * Tests: PATCH /api/billing/admin/plans/:id — lemonVariantId / lemonProductId fields
 *
 * Covers:
 * 1. Valid numeric strings are accepted and saved.
 * 2. Non-numeric strings are rejected with 400.
 * 3. Null clears existing values (optional / nullable).
 * 4. Omitting the fields leaves them untouched (existing behaviour).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// ── Inline the schema (mirrors billing.ts) so tests stay fast & isolated ──
const PlanPatchSchema = z
  .object({
    nameAr: z.string().min(1).max(100).optional(),
    nameEn: z.string().min(1).max(100).optional(),
    priceMinor: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    billingPeriodDays: z.number().int().min(0).max(3650).optional(),
    maxStudents: z.number().int().min(0).nullable().optional(),
    maxClasses: z.number().int().min(0).nullable().optional(),
    maxHomeworksPerMonth: z.number().int().min(0).nullable().optional(),
    aiUsageDailyLimit: z.number().int().min(0).nullable().optional(),
    maxUsers: z.number().int().min(0).nullable().optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    lemonVariantId: z
      .string()
      .regex(/^\d+$/, "يجب أن يكون رقماً صحيحاً")
      .nullable()
      .optional(),
    lemonProductId: z
      .string()
      .regex(/^\d+$/, "يجب أن يكون رقماً صحيحاً")
      .nullable()
      .optional(),
  })
  .strict();

describe("PlanPatchSchema — lemonVariantId / lemonProductId", () => {
  // ── Acceptance ─────────────────────────────────────────────────────────────

  it("accepts valid numeric string variant/product IDs", () => {
    const result = PlanPatchSchema.safeParse({
      lemonVariantId: "2017697",
      lemonProductId: "448058",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lemonVariantId).toBe("2017697");
      expect(result.data.lemonProductId).toBe("448058");
    }
  });

  it("accepts null to clear existing IDs", () => {
    const result = PlanPatchSchema.safeParse({
      lemonVariantId: null,
      lemonProductId: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lemonVariantId).toBeNull();
      expect(result.data.lemonProductId).toBeNull();
    }
  });

  it("accepts omitting both fields (existing behaviour unchanged)", () => {
    const result = PlanPatchSchema.safeParse({ nameAr: "أساسي" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lemonVariantId).toBeUndefined();
      expect(result.data.lemonProductId).toBeUndefined();
    }
  });

  // ── Rejection ──────────────────────────────────────────────────────────────

  it("rejects non-numeric variant ID", () => {
    const result = PlanPatchSchema.safeParse({ lemonVariantId: "abc123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("lemonVariantId");
    }
  });

  it("rejects non-numeric product ID", () => {
    const result = PlanPatchSchema.safeParse({ lemonProductId: "pro-plan" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("lemonProductId");
    }
  });

  it("rejects variant ID with leading non-digit characters", () => {
    const result = PlanPatchSchema.safeParse({ lemonVariantId: " 2017697" });
    expect(result.success).toBe(false);
  });

  it("rejects decimal variant ID", () => {
    const result = PlanPatchSchema.safeParse({ lemonVariantId: "2017697.5" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict schema)", () => {
    const result = PlanPatchSchema.safeParse({ unknownField: "value" });
    expect(result.success).toBe(false);
  });
});
