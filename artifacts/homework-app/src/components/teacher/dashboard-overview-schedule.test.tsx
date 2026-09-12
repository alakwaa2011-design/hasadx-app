import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bulkMutate = vi.fn();
const deleteAllMutate = vi.fn();
const scheduleRefetch = vi.fn();
let scheduleRows: Array<Record<string, unknown>> = [];
let scheduleIsError = false;
let scheduleIsFetching = false;

vi.mock("@workspace/api-client-react", () => ({
  getListTeacherScheduleQueryKey: () => ["teacher-schedule"],
  useListTeacherSchedule: () => ({
    data: scheduleRows,
    isLoading: false,
    isError: scheduleIsError,
    isFetching: scheduleIsFetching,
    refetch: scheduleRefetch,
  }),
  useBulkCreateTeacherSchedule: () => ({ mutate: bulkMutate, isPending: false }),
  useCreateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTeacherSchedule: () => ({ mutate: deleteAllMutate, isPending: false }),
  useDeleteTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
}));

import {
  TeacherScheduleCard,
} from "./DashboardOverview";
import {
  SCHEDULE_DAYS,
  breakPositionLabel,
  buildTeacherScheduleBulkInput,
  lessonNumberLabel,
  normalizeImportedDaySchedules,
  scheduleDateLabel,
  schedulePosition,
} from "@/lib/schedule-labels";

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

async function renderSchedule(isAr: boolean) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <TeacherScheduleCard isAr={isAr} user={{ id: 101 }} />
      </QueryClientProvider>,
    );
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-13T09:00:00Z"));
  bulkMutate.mockReset();
  deleteAllMutate.mockReset();
  scheduleRefetch.mockReset();
  scheduleRows = [];
  scheduleIsError = false;
  scheduleIsFetching = false;
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
  it("defines the complete Arabic and English schedule label contract", () => {
    expect(SCHEDULE_DAYS).toEqual([
      { value: 0, ar: "الأحد", shortAr: "أحد", en: "Sun" },
      { value: 1, ar: "الاثنين", shortAr: "إثنين", en: "Mon" },
      { value: 2, ar: "الثلاثاء", shortAr: "ثلاثاء", en: "Tue" },
      { value: 3, ar: "الأربعاء", shortAr: "أربعاء", en: "Wed" },
      { value: 4, ar: "الخميس", shortAr: "خميس", en: "Thu" },
      { value: 5, ar: "الجمعة", shortAr: "جمعة", en: "Fri" },
      { value: 6, ar: "السبت", shortAr: "سبت", en: "Sat" },
    ]);
    expect([lessonNumberLabel(1, true), lessonNumberLabel(10, true)]).toEqual([
      "الحصة الأولى",
      "الحصة العاشرة",
    ]);
    expect([lessonNumberLabel(1, false), lessonNumberLabel(10, false)]).toEqual([
      "Lesson 1",
      "Lesson 10",
    ]);
    expect([breakPositionLabel(1, true), breakPositionLabel(1, false)]).toEqual([
      "الفترة الأولى",
      "Period 1",
    ]);
    expect([
      schedulePosition({ kind: "weekly", lessonNumber: 1 } as never),
      schedulePosition({ kind: "break", breakAfterLesson: 1 } as never),
      schedulePosition({ kind: "weekly", lessonNumber: 2 } as never),
    ]).toEqual([1, 1.5, 2]);
    expect([
      scheduleDateLabel("2026-09-20", true),
      scheduleDateLabel("2026-09-20", false),
    ]).toEqual(["٢٠ سبتمبر", "Sep 20"]);
  });

  it.each([
    { timeZone: "Pacific/Honolulu", date: "2026-01-01", ar: "١ يناير", en: "Jan 1" },
    { timeZone: "Pacific/Kiritimati", date: "2026-12-31", ar: "٣١ ديسمبر", en: "Dec 31" },
  ])("keeps $date on the same calendar day in $timeZone", ({ timeZone, date, ar, en }) => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      expect(scheduleDateLabel(date, true)).toBe(ar);
      expect(scheduleDateLabel(date, false)).toBe(en);
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });

  it("stays compact and shows one selected day without management controls", async () => {
    scheduleRows.push({
      id: 1,
      kind: "weekly",
      title: "رياضيات",
      subject: null,
      className: null,
      dayOfWeek: 0,
      lessonNumber: 1,
      breakAfterLesson: null,
      appointmentDate: null,
      startTime: "08:00",
      endTime: "09:00",
      location: null,
      notes: null,
    });
    scheduleRows.push({
      id: 2,
      kind: "weekly",
      title: "علوم",
      subject: null,
      className: null,
      dayOfWeek: 1,
      lessonNumber: 1,
      breakAfterLesson: null,
      appointmentDate: null,
      startTime: "09:00",
      endTime: "10:00",
      location: null,
      notes: null,
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TeacherScheduleCard isAr user={{ id: 101 }} />
        </QueryClientProvider>,
      );
    });

    const scrollRegion = document.querySelector('[data-testid="schedule-summary-scroll"]') as HTMLElement;
    expect(scrollRegion.style.maxHeight).toBe("300px");
    expect(scrollRegion.style.overflowY).toBe("auto");
    expect(document.querySelector('[data-testid="button-delete-whole-schedule"]')).toBeNull();
    expect(document.querySelector('[data-testid="button-add-schedule-entry"]')).toBeNull();
    expect(document.querySelector('[data-testid="button-import-schedule-image"]')).toBeNull();

    await click("button-summary-schedule-day-1");
    expect(document.body.textContent).toContain("علوم");
    expect(document.body.textContent).not.toContain("رياضيات");
  });

  it("shows sparse lessons, a non-lesson period, and the saved appointment after reopening", async () => {
    scheduleRows = [
      { id: 1, kind: "weekly", title: "رياضيات", dayOfWeek: 0, lessonNumber: 1, startTime: "08:00", endTime: "09:00" },
      { id: 2, kind: "break", title: "نشاط صباحي", dayOfWeek: 0, breakAfterLesson: 1, startTime: "09:00", endTime: "09:30" },
      { id: 3, kind: "weekly", title: "علوم", dayOfWeek: 0, lessonNumber: 3, startTime: "10:00", endTime: "11:00" },
      { id: 4, kind: "appointment", title: "اجتماع ولي الأمر", appointmentDate: "2030-01-15", startTime: "12:00", endTime: "12:30" },
    ];
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TeacherScheduleCard isAr user={{ id: 101 }} />
        </QueryClientProvider>,
      );
    });

    await click("button-summary-schedule-day-0");
    expect(document.body.textContent).toContain("الحصة الأولى");
    expect(document.body.textContent).toContain("الحصة الثالثة");
    expect(document.body.textContent).toContain("نشاط صباحي");
    expect(document.body.textContent).toContain("اجتماع ولي الأمر");
  });

  it("retries a failed schedule load and shows recovered data in place", async () => {
    scheduleIsError = true;
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <TeacherScheduleCard isAr user={{ id: 101 }} />
        </QueryClientProvider>,
      );
    });
    expect(document.body.textContent).toContain("تعذر تحميل الجدول");
    await click("button-retry-dashboard-schedule");
    expect(scheduleRefetch).toHaveBeenCalledOnce();

    scheduleIsError = false;
    scheduleRows = [{
      id: 1,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: new Date().getDay(),
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    }];
    await renderSchedule(true);
    expect(document.querySelector('[data-testid="status-dashboard-schedule-load-error"]')).toBeNull();
    expect(document.body.textContent).toContain("رياضيات");
  });

  it.each([
    { isAr: true, dayLabels: SCHEDULE_DAYS.map((day) => day.shortAr) },
    { isAr: false, dayLabels: SCHEDULE_DAYS.map((day) => day.en) },
  ])("uses the shared schedule display contract when isAr=$isAr", async ({ isAr, dayLabels }) => {
    scheduleRows = [
      ...SCHEDULE_DAYS.map((day, index) => ({
        id: 100 + index,
        kind: "weekly",
        title: `day-${day.value}`,
        dayOfWeek: day.value,
        lessonNumber: 1,
        startTime: "12:00",
        endTime: "12:30",
      })),
      {
        id: 2,
        kind: "weekly",
        title: "second-lesson",
        dayOfWeek: 0,
        lessonNumber: 2,
        startTime: "08:00",
        endTime: "08:45",
      },
      {
        id: 3,
        kind: "break",
        title: "first-break",
        dayOfWeek: 0,
        breakAfterLesson: 1,
        startTime: "08:00",
        endTime: "08:15",
      },
      {
        id: 4,
        kind: "weekly",
        title: "first-lesson",
        dayOfWeek: 0,
        lessonNumber: 1,
        startTime: "08:00",
        endTime: "08:45",
      },
      {
        id: 5,
        kind: "appointment",
        title: "appointment",
        appointmentDate: "2026-09-20",
        startTime: "10:00",
        endTime: "10:30",
      },
    ];

    await renderSchedule(isAr);

    const dayButtons = SCHEDULE_DAYS.map((day) =>
      button(`button-summary-schedule-day-${day.value}`),
    );
    expect(dayButtons.map((dayButton) => dayButton.firstElementChild?.textContent)).toEqual(dayLabels);
    await click("button-summary-schedule-day-1");
    await click("button-summary-schedule-day-0");

    const orderedEntries = Array.from(
      document.querySelectorAll('[data-testid="schedule-summary-scroll"] [data-schedule-position]'),
    ) as HTMLElement[];
    expect(orderedEntries.slice(0, 3).map((entry) => entry.dataset.schedulePosition)).toEqual(
      [4, 3, 2].map((id) => String(schedulePosition(scheduleRows.find((entry) => entry.id === id) as never))),
    );
    expect(document.body.textContent).toContain(lessonNumberLabel(1, isAr));
    expect(document.body.textContent).toContain(lessonNumberLabel(2, isAr));
    expect(document.body.textContent).toContain(breakPositionLabel(1, isAr));
    expect(document.body.textContent).toContain(scheduleDateLabel("2026-09-20", isAr));
  });
});

describe("teacher schedule image draft normalization", () => {
  it("preserves the source cell order and any non-lesson label's column position", () => {
    const { schedules, breaks } = normalizeImportedDaySchedules([{
      dayOfWeek: 0,
      lessons: [
        {
          lessonNumber: 4,
          title: "5A",
          subject: null,
          className: null,
          startTime: "09:05",
          endTime: "09:45",
          confidence: "high",
        },
        {
          lessonNumber: 2,
          title: "5B",
          subject: null,
          className: null,
          startTime: "08:00",
          endTime: "08:40",
          confidence: "high",
        },
      ],
      breaks: [{
        title: "ملاحظة إدارية",
        breakAfterLesson: 3,
        startTime: "08:40",
        endTime: "09:00",
        confidence: "high",
      }],
    }]);

    expect(schedules[0].map((lesson) => lesson.lessonNumber)).toEqual([4, 2]);
    expect(breaks[0]?.[0]).toMatchObject({
      title: "ملاحظة إدارية",
      breakAfterLesson: 3,
    });
  });

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
    expect(schedules[0][0].title).toBe("رياضيات");
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
