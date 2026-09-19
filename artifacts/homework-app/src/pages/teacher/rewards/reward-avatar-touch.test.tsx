import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AvatarDisplay } from "@/components/avatar-display";
import { ILLUSTRATED_AVATARS } from "@/lib/avatars";
import { applyOptimisticRewardPoints } from "./api";
import { CelebrationAvatar, getRewardAvatarFallback } from "./reward-celebration";

afterEach(cleanup);

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

  it("replaces an unavailable saved image with the neutral fallback", () => {
    const view = render(
      <AvatarDisplay
        avatar="/api/classroom-rewards/students/42/avatar"
        fallback="س"
      />,
    );

    fireEvent.error(view.container.querySelector("img")!);

    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.textContent).toBe("س");
  });

  it("derives a neutral fallback from the first visible name character", () => {
    expect(getRewardAvatarFallback("  سارة")).toBe("س");
    expect(getRewardAvatarFallback(" Alice")).toBe("A");
    expect(getRewardAvatarFallback("")).toBe("•");
  });

  it.each(["full", "live"] as const)("keeps independent avatars and fallbacks in %s celebrations", (mode) => {
    const character = "/avatars/adventurer-girl.webp";
    const photo = "/api/classroom-rewards/students/42/avatar";
    const html = renderToStaticMarkup(
      <>
        <CelebrationAvatar student={{ id: 1, name: "سارة", avatar: character }} mode={mode} />
        <CelebrationAvatar student={{ id: 2, name: "ليان", avatar: photo }} mode={mode} />
        <CelebrationAvatar student={{ id: 3, name: "نور", avatar: null }} mode={mode} />
      </>,
    );

    expect(html).toContain(`src="${character}"`);
    expect(html).toContain(`src="${photo}"`);
    expect(html).toContain(">ن</span>");
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