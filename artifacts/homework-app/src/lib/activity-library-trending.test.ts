import { describe, expect, it } from "vitest";
import { selectTrendingActivities, type TrendingRankable } from "./activity-library-trending";

type Candidate = TrendingRankable & { id: number };

const candidate = (
  id: number,
  recentUses: number,
  totalUses = recentUses,
  createdAt = `2026-08-${String(id).padStart(2, "0")}T00:00:00.000Z`,
): Candidate => ({
  id,
  recentUses,
  totalUses,
  createdAt,
  isEligible: true,
});

const select = (items: Candidate[], recentUsageAvailable = true) =>
  selectTrendingActivities(items, { recentUsageAvailable });

describe("selectTrendingActivities", () => {
  it("يخفي القسم عندما لا توجد أنشطة مؤهلة", () => {
    expect(select([candidate(1, 1), candidate(2, 2)])).toEqual([]);
  });

  it("يعرض نشاطًا واحدًا فقط عندما يكون وحده مؤهلًا", () => {
    expect(select([candidate(1, 7), candidate(2, 2)]).map(item => item.id)).toEqual([1]);
  });

  it("يعرض نشاطين فقط عندما يكونان المؤهلين الوحيدين", () => {
    expect(select([candidate(1, 6), candidate(2, 8), candidate(3, 1)]).map(item => item.id)).toEqual([2, 1]);
  });

  it("يعرض ثلاثة أنشطة كحد أقصى ويرتبها بالحديث ثم الإجمالي ثم التاريخ", () => {
    const items = [
      candidate(1, 7, 40),
      candidate(2, 9, 12),
      candidate(3, 7, 50),
      candidate(4, 7, 50, "2026-08-30T00:00:00.000Z"),
    ];

    expect(select(items).map(item => item.id)).toEqual([2, 4, 3]);
  });

  it("يستبعد النشاط غير المتاح حتى لو تجاوز الحد الأدنى", () => {
    expect(select([{ ...candidate(1, 20), isEligible: false }])).toEqual([]);
  });

  it("يستخدم الإجمالي مؤقتًا عندما لا تتوفر بيانات النافذة الزمنية", () => {
    expect(select([candidate(1, 0, 8), candidate(2, 0, 4)], false).map(item => item.id)).toEqual([1]);
  });
});