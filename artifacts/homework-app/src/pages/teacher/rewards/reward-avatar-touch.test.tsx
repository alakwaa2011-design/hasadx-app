import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvatarDisplay } from "@/components/avatar-display";
import { ILLUSTRATED_AVATARS } from "@/lib/avatars";
import { applyOptimisticRewardPoints } from "./api";

describe("reward avatars and optimistic balances", () => {
  it("renders a saved uploaded photo without replacing it", () => {
    const photo = "/api/classroom-rewards/students/42/avatar";
    const html = renderToStaticMarkup(<AvatarDisplay avatar={photo} fallback="س" />);
    expect(html).toContain(`src="${photo}"`);
    expect(html).not.toContain("adventurer-boy");
  });

  it("uses the student's initial as a neutral missing-avatar fallback", () => {
    const html = renderToStaticMarkup(<AvatarDisplay avatar={null} fallback="س" />);
    expect(html).toContain(">س</span>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("adventurer-boy");
  });

  it("makes general characters available in both explicit sections", () => {
    const general = ILLUSTRATED_AVATARS.filter((avatar) => avatar.audience === "all");
    expect(general.length).toBeGreaterThan(0);
    for (const section of ["boys", "girls"] as const) {
      const visible = ILLUSTRATED_AVATARS.filter(
        (avatar) => avatar.audience === section || avatar.audience === "all",
      );
      expect(general.every((avatar) => visible.includes(avatar))).toBe(true);
    }
  });

  it("updates only selected class and profile balances optimistically", () => {
    const selected = new Set([2]);
    const classData = applyOptimisticRewardPoints({
      students: [{ id: 1, points: 4 }, { id: 2, points: 7 }],
    }, selected, 3);
    const profileData = applyOptimisticRewardPoints({
      student: { id: 2 },
      rewards: { balance: 7, ledger: [] },
    }, selected, 3);

    expect(classData.students).toEqual([{ id: 1, points: 4 }, { id: 2, points: 10 }]);
    expect(profileData.rewards).toEqual({ balance: 10, ledger: [] });
  });
});