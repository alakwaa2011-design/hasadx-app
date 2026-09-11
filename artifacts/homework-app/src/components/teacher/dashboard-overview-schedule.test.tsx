import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bulkMutate = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  getListTeacherScheduleQueryKey: () => ["teacher-schedule"],
  useListTeacherSchedule: () => ({ data: [], isLoading: false }),
  useBulkCreateTeacherSchedule: () => ({ mutate: bulkMutate, isPending: false }),
  useCreateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
}));

import {
  buildTeacherScheduleBulkInput,
  normalizeImportedDaySchedules,
  TeacherScheduleCard,
} from "./DashboardOverview";

let container: HTMLDivElement;
let root: Root;

function button(testId: string) {
  return document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement;
}

async function click(testId: string) {
  await act(async () => button(testId).click());
}

async function typeInto(testId: string, value: string) {
  const input = document.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T09:00:00Z"));
  bulkMutate.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TeacherScheduleCard isAr user={{ id: 101 }} />
      </QueryClientProvider>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TeacherScheduleCard full schedule drafts", () => {
  it("keeps the save action visible while the schedule rows scroll", async () => {
    await click("button-add-bulk-schedule");

    const scrollRegion = document.querySelector('[data-testid="bulk-schedule-scroll-region"]');
    const actions = document.querySelector('[data-testid="bulk-schedule-fixed-actions"]');

    expect(scrollRegion?.className).toContain("overflow-y-auto");
    expect(actions?.className).toContain("shrink-0");
    expect(actions?.contains(button("button-save-bulk-schedule"))).toBe(true);
    expect(scrollRegion?.contains(button("button-save-bulk-schedule"))).toBe(false);
  });

  it("keeps each day independent, removes an accidental day, and saves every remaining day once", async () => {
    await click("button-add-bulk-schedule");

    await typeInto("input-bulk-lesson-title-1", "رياضيات الأحد");
    await click("button-bulk-day-1");
    await typeInto("input-bulk-lesson-title-1", "علوم الاثنين");

    await click("button-bulk-day-0");
    expect((document.querySelector('[data-testid="input-bulk-lesson-title-1"]') as HTMLInputElement).value)
      .toBe("رياضيات الأحد");

    await click("button-bulk-day-1");
    expect((document.querySelector('[data-testid="input-bulk-lesson-title-1"]') as HTMLInputElement).value)
      .toBe("علوم الاثنين");

    await click("button-bulk-day-2");
    await typeInto("input-bulk-lesson-title-1", "يوم أضيف بالخطأ");
    await click("button-remove-active-bulk-day");

    expect(button("button-bulk-day-2").style.background).not.toBe("rgb(30, 77, 53)");

    await click("button-save-bulk-schedule");

    expect(bulkMutate).toHaveBeenCalledTimes(1);
    expect(bulkMutate).toHaveBeenCalledWith(
      {
        data: {
          daySchedules: [
            expect.objectContaining({
              dayOfWeek: 0,
              lessons: expect.arrayContaining([
                expect.objectContaining({ lessonNumber: 1, title: "رياضيات الأحد" }),
              ]),
            }),
            expect.objectContaining({
              dayOfWeek: 1,
              lessons: expect.arrayContaining([
                expect.objectContaining({ lessonNumber: 1, title: "علوم الاثنين" }),
              ]),
            }),
          ],
        },
      },
      expect.any(Object),
    );
  });
});

describe("teacher schedule image draft normalization", () => {
  it("keeps a third lesson as lesson three when the second lesson was unreadable", () => {
    const { schedules, hasNumberingGaps } = normalizeImportedDaySchedules([{
      dayOfWeek: 0,
      lessons: [
        {
          lessonNumber: 1,
          title: "",
          subject: "رياضيات",
          className: null,
          startTime: "08:00",
          endTime: "08:45",
          confidence: "high",
        },
        {
          lessonNumber: 3,
          title: "",
          subject: "علوم",
          className: null,
          startTime: "10:00",
          endTime: "10:45",
          confidence: "medium",
        },
      ],
    }]);

    expect(hasNumberingGaps).toBe(true);
    expect(schedules[0].map((lesson) => lesson.lessonNumber)).toEqual([1, 3]);
    expect(schedules[0][1].subject).toBe("علوم");

    const payload = buildTeacherScheduleBulkInput(schedules, true, {
      0: Array.from({ length: 4 }, (_, index) => ({
        title: index === 0 ? "سناك" : `استراحة ${index + 1}`,
        breakAfterLesson: index + 1,
        startTime: `09:${String(index * 10).padStart(2, "0")}`,
        endTime: `09:${String((index + 1) * 10).padStart(2, "0")}`,
        confidence: "high" as const,
      })),
    });
    expect(payload.daySchedules?.[0].lessons.map((lesson) => lesson.lessonNumber)).toEqual([1, 3]);
    expect(payload.daySchedules?.[0].breaks).toHaveLength(4);
    expect(payload.daySchedules?.[0].breaks?.[0]).toEqual({
      title: "سناك",
      breakAfterLesson: 1,
      startTime: "09:00",
      endTime: "09:10",
    });
  });

  it("builds a day containing only named non-lesson periods", () => {
    const payload = buildTeacherScheduleBulkInput({ 4: [] }, true, {
      4: [{
        title: "تطوير مهني",
        breakAfterLesson: 0,
        startTime: "08:00",
        endTime: "10:00",
        confidence: "high",
      }],
    });

    expect(payload.daySchedules?.[0]).toEqual({
      dayOfWeek: 4,
      lessons: [],
      breaks: [{
        title: "تطوير مهني",
        breakAfterLesson: 0,
        startTime: "08:00",
        endTime: "10:00",
      }],
    });
  });
});