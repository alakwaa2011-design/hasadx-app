import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvatarDisplay } from "@/components/avatar-display";
import { ILLUSTRATED_AVATARS } from "@/lib/avatars";
import { applyOptimisticRewardPoints, useGrantRewards } from "./api";
import { CelebrationAvatar, getRewardAvatarFallback } from "./reward-celebration";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function queryClientWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: React.PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

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

  it("updates the full classroom roster without changing group scores", () => {
    const selected = new Set([1, 2, 3]);
    const boardData = applyOptimisticRewardPoints({
      students: [
        { id: 1, points: 2 },
        { id: 2, points: 5 },
        { id: 3, points: 0 },
      ],
      groups: [{ id: 7, score: 18 }],
    }, selected, 2);

    expect(boardData.students.map((student: any) => student.points)).toEqual([4, 7, 2]);
    expect(boardData.groups).toEqual([{ id: 7, score: 18 }]);
  });

  it("shows full-class points before the grant request finishes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const classKey = ["classroom-rewards", "classes", "5A"];
    const boardKey = ["classroom-rewards", "board", "5A"];
    const initialStudents = [
      { id: 1, points: 1 },
      { id: 2, points: 4 },
      { id: 3, points: 9 },
    ];
    queryClient.setQueryData(classKey, { students: initialStudents });
    queryClient.setQueryData(boardKey, { students: initialStudents, groups: [{ id: 7, score: 18 }] });

    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      finishRequest = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockReturnValue(request);
    const { result } = renderHook(() => useGrantRewards(), {
      wrapper: queryClientWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        className: "5A",
        studentIds: [1, 2, 3],
        optimisticPoints: 2,
        idempotencyKey: "full-class-test",
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(classKey)).toEqual({
        students: [
          { id: 1, points: 3 },
          { id: 2, points: 6 },
          { id: 3, points: 11 },
        ],
      });
    });
    expect(queryClient.getQueryData(boardKey)).toEqual({
      students: [
        { id: 1, points: 3 },
        { id: 2, points: 6 },
        { id: 3, points: 11 },
      ],
      groups: [{ id: 7, score: 18 }],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      finishRequest(new Response("{}", { status: 200 }));
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("restores full-class balances if the grant request fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const classKey = ["classroom-rewards", "classes", "5A"];
    const boardKey = ["classroom-rewards", "board", "5A"];
    const initialStudents = [{ id: 1, points: 1 }, { id: 2, points: 4 }];
    const initialClassData = { students: initialStudents };
    const initialBoardData = { students: initialStudents, groups: [{ id: 7, score: 18 }] };
    queryClient.setQueryData(classKey, initialClassData);
    queryClient.setQueryData(boardKey, initialBoardData);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Grant rejected" }), { status: 500 }),
    );
    const { result } = renderHook(() => useGrantRewards(), {
      wrapper: queryClientWrapper(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync({
        className: "5A",
        studentIds: [1, 2],
        optimisticPoints: 3,
        idempotencyKey: "failed-full-class-test",
      })).rejects.toThrow("Grant rejected");
    });

    expect(queryClient.getQueryData(classKey)).toEqual(initialClassData);
    expect(queryClient.getQueryData(boardKey)).toEqual(initialBoardData);
  });
});