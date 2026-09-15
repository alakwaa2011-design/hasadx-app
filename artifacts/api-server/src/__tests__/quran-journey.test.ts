import { describe, expect, it } from "vitest";
import { calculateQuranJourney } from "../lib/quran-journey";

const profile = {
  currentSurahNumber: 2,
  currentAyah: 10,
  progressPercent: 12,
  masteredAyahCount: 300,
  lastRecitedDate: "2025-01-04",
};

const ward = (id: number, status = "assigned", dueDate: string | null = "2025-01-10") => ({
  id,
  mode: "memorization",
  surahNumber: 1,
  surahName: "الفاتحة",
  startAyah: 1,
  endAyah: 7,
  assignedDate: "2025-01-01",
  dueDate,
  status,
});

describe("Quran journey calculation", () => {
  it("counts streaks only across consecutive completed-recitation dates", () => {
    const result = calculateQuranJourney({
      profile,
      wards: [ward(1), ward(2), ward(3), ward(4)],
      recitations: [
        { id: 1, wardId: 1, status: "completed", memorizationScore: null, recitationScore: null, recitedDate: "2025-01-01" },
        { id: 2, wardId: 2, status: "completed", memorizationScore: null, recitationScore: null, recitedDate: "2025-01-02" },
        { id: 3, wardId: 3, status: "completed", memorizationScore: null, recitationScore: null, recitedDate: "2025-01-04" },
        { id: 4, wardId: 4, status: "completed", memorizationScore: null, recitationScore: null, recitedDate: "2025-01-05" },
      ],
      submissions: [],
      today: "2025-01-05",
    });
    expect(result.streak).toEqual({ current: 2, longest: 2 });
  });

  it("does not invent score averages when all scores are null", () => {
    const result = calculateQuranJourney({
      profile,
      wards: [ward(1)],
      recitations: [{
        id: 1,
        wardId: 1,
        status: "completed",
        memorizationScore: null,
        recitationScore: null,
        recitedDate: "2025-01-05",
      }],
      submissions: [],
      today: "2025-01-05",
    });
    expect(result.summary.averageMemorizationScore).toBeNull();
    expect(result.summary.averageRecitationScore).toBeNull();
  });

  it("prefers a review action, then in-progress work, over assigned work", () => {
    const result = calculateQuranJourney({
      profile,
      wards: [
        ward(1, "assigned"),
        ward(2, "in_progress"),
        ward(3, "needs_review"),
      ],
      recitations: [],
      submissions: [],
      today: "2025-01-05",
    });
    expect(result.nextWard?.id).toBe(3);
  });

  it("does not double-count a reviewed submission when its recitation exists", () => {
    const result = calculateQuranJourney({
      profile,
      wards: [ward(1)],
      recitations: [{
        id: 9,
        wardId: 1,
        status: "completed",
        memorizationScore: 80,
        recitationScore: 90,
        recitedDate: "2025-01-05",
      }],
      submissions: [{
        id: 4,
        wardId: 1,
        status: "reviewed",
        memorizationScore: 80,
        recitationScore: 90,
        createdAt: "2025-01-05T08:00:00.000Z",
      }],
      today: "2025-01-05",
    });
    expect(result.summary.completedWardCount).toBe(1);
    expect(result.summary.averageMemorizationScore).toBe(80);
    expect(result.recentActivities).toHaveLength(1);
    expect(result.recentActivities[0].type).toBe("recitation");
  });

  it("counts only the completed ayahs in a non-contiguous range", () => {
    const result = calculateQuranJourney({
      profile: { ...profile, masteredAyahCount: 999 },
      wards: [{
        ...ward(10),
        surahNumber: 2,
        surahName: "البقرة",
        startAyah: 100,
        endAyah: 105,
      }],
      recitations: [{
        id: 10,
        wardId: 10,
        status: "completed",
        memorizationScore: null,
        recitationScore: null,
        recitedDate: "2025-01-05",
      }],
      submissions: [],
      today: "2025-01-05",
    });
    expect(result.profile.masteredAyahCount).toBe(6);
    expect(result.summary.masteredAyahCount).toBe(6);
    expect(result.profile.currentAyah).toBe(10);
  });

  it("merges overlapping completed ranges without double counting", () => {
    const wards = [
      { ...ward(11), surahNumber: 2, surahName: "البقرة", startAyah: 100, endAyah: 105 },
      { ...ward(12), surahNumber: 2, surahName: "البقرة", startAyah: 103, endAyah: 110 },
    ];
    const result = calculateQuranJourney({
      profile,
      wards,
      recitations: wards.map((assignedWard, index) => ({
        id: index + 11,
        wardId: assignedWard.id,
        status: "completed",
        memorizationScore: null,
        recitationScore: null,
        recitedDate: `2025-01-0${index + 1}`,
      })),
      submissions: [],
      today: "2025-01-05",
    });
    expect(result.summary.masteredAyahCount).toBe(11);
  });

  it("sums completed ranges across surahs", () => {
    const wards = [
      { ...ward(13), surahNumber: 1, surahName: "الفاتحة", startAyah: 1, endAyah: 7 },
      { ...ward(14), surahNumber: 2, surahName: "البقرة", startAyah: 100, endAyah: 105 },
    ];
    const result = calculateQuranJourney({
      profile,
      wards,
      recitations: wards.map((assignedWard, index) => ({
        id: index + 13,
        wardId: assignedWard.id,
        status: "completed",
        memorizationScore: null,
        recitationScore: null,
        recitedDate: `2025-01-0${index + 1}`,
      })),
      submissions: [],
      today: "2025-01-05",
    });
    expect(result.summary.masteredAyahCount).toBe(13);
  });

  it("reports zero mastery when there are no completed recitations", () => {
    const result = calculateQuranJourney({
      profile: { ...profile, masteredAyahCount: 999 },
      wards: [ward(15)],
      recitations: [{
        id: 15,
        wardId: 15,
        status: "needs_review",
        memorizationScore: null,
        recitationScore: null,
        recitedDate: "2025-01-05",
      }],
      submissions: [{
        id: 15,
        wardId: 15,
        status: "submitted",
        memorizationScore: null,
        recitationScore: null,
        createdAt: "2025-01-05T08:00:00.000Z",
      }],
      today: "2025-01-05",
    });
    expect(result.profile.masteredAyahCount).toBe(0);
    expect(result.summary.masteredAyahCount).toBe(0);
  });

  it("keeps independent practice dates and positions separate from teacher mastery", () => {
    const result = calculateQuranJourney({
      profile: { ...profile, masteredAyahCount: 99 },
      wards: [],
      recitations: [],
      submissions: [],
      independentPractice: {
        dates: ["2025-01-04", "2025-01-04", "2025-01-05"],
        latestPosition: {
          textSurahNumber: 2,
          textAyah: 10,
          pageNumber: 42,
          updatedAt: "2025-01-05T10:00:00.000Z",
        },
      },
      today: "2025-01-05",
    });
    expect(result.independentPractice.dates).toEqual(["2025-01-04", "2025-01-05"]);
    expect(result.independentPractice.latestPosition?.pageNumber).toBe(42);
    expect(result.summary.masteredAyahCount).toBe(0);
    expect(result.summary.completedWardCount).toBe(0);
  });
});