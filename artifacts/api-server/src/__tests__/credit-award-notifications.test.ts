import { describe, expect, it } from "vitest";
import { buildCreditAwardMessage } from "../lib/credit-award-notifications";

describe("credit award notification copy", () => {
  it("يصيغ إشعار النقاط بصيغة مفرحة ويعرض الرصيد الجديد", () => {
    const message = buildCreditAwardMessage({
      kind: "credits",
      amount: 250,
      newBalance: 1_250,
      reason: "مكافأة نشاط",
    });

    expect(message.type).toBe("credit_award");
    expect(message.title).toContain("هدية");
    expect(message.body).toContain("٢٥٠");
    expect(message.body).toContain("١٬٢٥٠");
    expect(message.body).toContain("مكافأة نشاط");
  });

  it("يصيغ إشعار الباقة مع نقاطها وتاريخ انتهائها", () => {
    const message = buildCreditAwardMessage({
      kind: "plan",
      planNameAr: "الاحترافية",
      credits: 1_000,
      expiresAt: new Date("2026-09-30T00:00:00.000Z"),
    });

    expect(message.type).toBe("plan_award");
    expect(message.title).toContain("الاحترافية");
    expect(message.body).toContain("١٬٠٠٠");
    expect(message.body).toContain("٢٠٢٦");
  });

  it("يصيغ إشعار تفعيل غير محدود فقط كخبر إيجابي", () => {
    const message = buildCreditAwardMessage({
      kind: "unlimited",
      reason: "هدية خاصة",
    });

    expect(message.type).toBe("unlimited_award");
    expect(message.title).toContain("غير محدود");
    expect(message.body).toContain("تفعيل");
    expect(message.body).not.toContain("إلغاء");
  });
});