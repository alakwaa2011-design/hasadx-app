import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bulkMutate = vi.fn();
const createMutate = vi.fn();
const deleteAllMutate = vi.fn();
const heicConvert = vi.fn();
const scheduleRefetch = vi.fn();
let scheduleRows: Array<Record<string, unknown>> = [];

let language = "ar";
let scheduleIsError = false;
let scheduleIsFetching = false;
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("heic2any", () => ({
  default: heicConvert,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: language }),
}));

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: toastError },
}));

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
  useCreateTeacherScheduleEntry: () => ({ mutate: createMutate, isPending: false }),
  useUpdateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTeacherSchedule: () => ({ mutate: deleteAllMutate, isPending: false }),
  useDeleteTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useGetCurrentTeacher: () => ({ data: { id: 7 }, isLoading: false }),
}));

import ScheduleManagementPage from "./index";
import { scheduleDateLabel } from "@/lib/schedule-labels";

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
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <ScheduleManagementPage />
      </QueryClientProvider>,
    );
  });
}

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  bulkMutate.mockReset();
  createMutate.mockReset();
  deleteAllMutate.mockReset();
  heicConvert.mockReset();
  scheduleRefetch.mockReset();
  localStorage.clear();
  heicConvert.mockResolvedValue(new Blob(["jpeg-image"], { type: "image/jpeg" }));
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:converted-image"),
    revokeObjectURL: vi.fn(),
  });
  toastError.mockReset();
  language = "ar";
  scheduleRows = [];
  scheduleIsError = false;
  scheduleIsFetching = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await renderPage();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("schedule management tool", () => {
  it("keeps full-table controls and the fixed save action inside the tool", async () => {
    expect(button("button-import-schedule-image")).toBeTruthy();
    expect(button("button-add-schedule-entry")).toBeTruthy();
    expect(button("button-add-bulk-schedule").closest("details")).toBeTruthy();
    expect(button("button-add-bulk-schedule").textContent).toContain("إضافة جدول كامل يدويًا");

    await click("button-add-schedule-entry");
    const entryScroll = document.querySelector('[data-testid="schedule-entry-scroll-region"]');
    const entryActions = document.querySelector('[data-testid="schedule-entry-fixed-actions"]');

    const entryDialog = entryScroll?.closest('[role="dialog"]');
    const entryDescription = document.getElementById(entryDialog?.getAttribute("aria-describedby") || "");
    expect(entryDescription?.textContent).toContain("أدخل تفاصيل الحصة أو الموعد");
    expect(entryScroll?.className).toContain("overflow-y-auto");
    expect(entryActions?.contains(button("button-save-schedule-entry"))).toBe(true);
    expect(entryScroll?.contains(button("button-save-schedule-entry"))).toBe(false);
    const cancelButton = entryActions?.querySelector("button") as HTMLButtonElement;
    await act(async () => cancelButton.click());

    await click("button-add-bulk-schedule");
    expect((document.querySelector('[data-testid="input-bulk-lesson-start-1"]') as HTMLInputElement)?.value)
      .toBe("00:00");
    expect((document.querySelector('[data-testid="input-bulk-lesson-end-1"]') as HTMLInputElement)?.value)
      .toBe("00:00");

    const scrollRegion = document.querySelector('[data-testid="bulk-schedule-scroll-region"]');
    const actions = document.querySelector('[data-testid="bulk-schedule-fixed-actions"]');

    const bulkDialog = scrollRegion?.closest('[role="dialog"]');
    const bulkDescription = document.getElementById(bulkDialog?.getAttribute("aria-describedby") || "");
    expect(bulkDescription?.textContent).toContain("أدخل حصص الأسبوع وأوقاتها");
    expect(scrollRegion?.className).toContain("overflow-y-auto");
    expect(actions?.contains(button("button-save-bulk-schedule"))).toBe(true);
    expect(scrollRegion?.contains(button("button-save-bulk-schedule"))).toBe(false);
  });

  it("links English descriptions to both schedule entry dialogs", async () => {
    language = "en";
    await renderPage();

    await click("button-add-schedule-entry");
    const entryDialog = document.querySelector('[data-testid="schedule-entry-scroll-region"]')?.closest('[role="dialog"]');
    const entryDescription = document.getElementById(entryDialog?.getAttribute("aria-describedby") || "");
    expect(entryDescription?.textContent).toContain("Enter the lesson or appointment details");
    const cancelButton = document.querySelector('[data-testid="schedule-entry-fixed-actions"] button') as HTMLButtonElement;
    await act(async () => cancelButton.click());

    await click("button-add-bulk-schedule");
    const bulkDialog = document.querySelector('[data-testid="bulk-schedule-scroll-region"]')?.closest('[role="dialog"]');
    const bulkDescription = document.getElementById(bulkDialog?.getAttribute("aria-describedby") || "");
    expect(bulkDescription?.textContent).toContain("Enter the week's lessons and times");
  });

  it("lets the teacher edit every appointment, including past and later entries", async () => {
    scheduleRows = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      kind: "appointment",
      title: `موعد ${index + 1}`,
      appointmentDate: index === 0 ? "2020-01-01" : `2030-01-0${index + 1}`,
      startTime: "08:00",
      endTime: "09:00",
    }));
    await renderPage();

    expect(document.body.textContent).toContain("المواعيد");
    expect(document.body.textContent).toContain("موعد 1");
    expect(document.body.textContent).toContain("موعد 5");
    await click("button-schedule-view-day");
    const daySelector = document.querySelector('[data-testid="schedule-management-day-selector"]') as HTMLElement;
    const visibleDayLabels = Array.from(daySelector.querySelectorAll("button")).map(
      (dayButton) => dayButton.querySelector("span")?.textContent,
    );
    expect(visibleDayLabels).toContain("الأحد");
    expect(daySelector.className).toContain("overflow-x-auto");
  });

  it.each([
    { timeZone: "America/Adak", date: "2026-12-31", ar: "٣١ ديسمبر", en: "Dec 31" },
    { timeZone: "Pacific/Auckland", date: "2027-01-01", ar: "١ يناير", en: "Jan 1" },
  ])("shows the appointment date unchanged in $timeZone", ({ timeZone, date, ar, en }) => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      expect(scheduleDateLabel(date, true)).toBe(ar);
      expect(scheduleDateLabel(date, false)).toBe(en);
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });

  it("offers daily, weekly-list, and weekly-grid views with organized timer controls", async () => {
    scheduleRows = [{
      id: 1,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: 0,
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    }];
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ScheduleManagementPage />
        </QueryClientProvider>,
      );
    });

    expect(document.body.textContent).toContain("المؤقت والتنبيهات");
    expect(button("button-schedule-view-day")).toBeTruthy();
    expect(document.querySelector('[data-testid="schedule-week-grid"]')).toBeTruthy();
    expect(button("button-schedule-view-week-list")).toBeTruthy();
    await click("button-schedule-view-week-grid");
    expect(document.querySelector('[data-testid="schedule-week-grid"]')).toBeTruthy();
    expect(document.querySelectorAll('[data-testid^="schedule-paper-day-"]')).toHaveLength(5);
    expect(document.body.textContent).toContain("الحصة الأولى");

    await click("button-schedule-view-week-list");
    const weeklyScroller = document.querySelector('[data-testid="schedule-week-list-scroll"]') as HTMLElement;
    expect(weeklyScroller.className).toContain("overflow-y-auto");
    expect(weeklyScroller.className).toContain("snap-y");
  });

  it("stores timer settings using the same preference contract as the floating countdown", async () => {
    const alertSelect = document.querySelector('[data-testid="select-schedule-alert-minutes"]') as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;

    await act(async () => {
      setter?.call(alertSelect, "10");
      alertSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("button-schedule-alert-sound");

    expect(JSON.parse(localStorage.getItem("hasaad_schedule_countdown_v1_7") || "{}"))
      .toMatchObject({ alertMinutes: 10, soundEnabled: true });
  });

  it("lets the teacher disable all schedule timers and alerts", async () => {
    const toggle = button("button-schedule-alerts-enabled");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await click("button-schedule-alerts-enabled");

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector('[data-testid="select-schedule-alert-minutes"]')).toBeNull();
    expect(JSON.parse(localStorage.getItem("hasaad_schedule_countdown_v1_7") || "{}"))
      .toMatchObject({ enabled: false });
  });

  it("loads the failing day's draft without overwriting it during period validation", async () => {
    await click("button-add-bulk-schedule");
    await typeInto("input-bulk-lesson-title-1", "مسودة الأحد");
    await click("button-add-bulk-period");
    await click("button-bulk-day-1");
    await typeInto("input-bulk-lesson-title-1", "مسودة الاثنين");

    await click("button-save-bulk-schedule");

    expect((document.querySelector('[data-testid="input-bulk-lesson-title-1"]') as HTMLInputElement).value)
      .toBe("مسودة الأحد");
    expect(bulkMutate).not.toHaveBeenCalled();
  });

  it("preserves sparse lessons, a non-lesson period, and an appointment after reopening", async () => {
    bulkMutate.mockImplementation(({ data }, { onSuccess }) => {
      expect(data.daySchedules).toEqual([{
        dayOfWeek: 5,
        lessons: [
          expect.objectContaining({ lessonNumber: 1, title: "رياضيات" }),
          expect.objectContaining({ lessonNumber: 3, title: "علوم" }),
        ],
        breaks: [{
          title: "نشاط صباحي",
          breakAfterLesson: 1,
          startTime: "09:00",
          endTime: "09:30",
        }],
      }]);
      scheduleRows = [
        { id: 1, kind: "weekly", title: "رياضيات", dayOfWeek: 5, lessonNumber: 1, startTime: "08:00", endTime: "09:00" },
        { id: 2, kind: "break", title: "نشاط صباحي", dayOfWeek: 5, breakAfterLesson: 1, startTime: "09:00", endTime: "09:30" },
        { id: 3, kind: "weekly", title: "علوم", dayOfWeek: 5, lessonNumber: 3, startTime: "10:00", endTime: "11:00" },
      ];
      onSuccess(scheduleRows);
    });
    createMutate.mockImplementation(({ data }, { onSuccess }) => {
      expect(data).toEqual(expect.objectContaining({
        kind: "appointment",
        title: "اجتماع ولي الأمر",
        appointmentDate: "2030-01-15",
        startTime: "12:00",
        endTime: "12:30",
      }));
      scheduleRows = [...scheduleRows, { id: 4, ...data }];
      onSuccess();
    });

    await click("button-add-bulk-schedule");
    await click("button-bulk-day-5");
    for (const day of [0, 1, 2, 3, 4]) {
      await click(`button-bulk-day-${day}`);
      await click("button-remove-active-bulk-day");
    }
    await click("button-remove-bulk-lesson-5");
    await click("button-remove-bulk-lesson-4");
    await click("button-remove-bulk-lesson-2");
    await typeInto("input-bulk-lesson-title-1", "رياضيات");
    await typeInto("input-bulk-lesson-title-2", "علوم");
    await typeInto("input-bulk-lesson-start-1", "08:00");
    await typeInto("input-bulk-lesson-end-1", "09:00");
    await typeInto("input-bulk-lesson-start-2", "10:00");
    await typeInto("input-bulk-lesson-end-2", "11:00");
    await click("button-add-bulk-period");
    await typeInto("input-bulk-period-title-5-0", "نشاط صباحي");
    await typeInto("input-bulk-period-start-5-0", "09:00");
    await typeInto("input-bulk-period-end-5-0", "09:30");
    await click("button-save-bulk-schedule");

    await click("button-add-schedule-entry");
    await click("button-schedule-kind-appointment");
    await typeInto("input-schedule-title", "اجتماع ولي الأمر");
    await typeInto("input-schedule-appointment-date", "2030-01-15");
    await typeInto("input-schedule-start-time", "12:00");
    await typeInto("input-schedule-end-time", "12:30");
    await click("button-save-schedule-entry");

    await renderPage();
    await click("button-schedule-view-day");
    await click("button-management-schedule-day-5");
    expect(document.body.textContent).toContain("رياضيات");
    expect(document.body.textContent).toContain("الحصة الأولى");
    expect(document.body.textContent).toContain("علوم");
    expect(document.body.textContent).toContain("الحصة الثالثة");
    expect(document.body.textContent).toContain("نشاط صباحي");
    expect(document.body.textContent).toContain("اجتماع ولي الأمر");
  });

  it("keeps the draft visible on save failure and retries a failed reload in place", async () => {
    bulkMutate.mockImplementation((_variables, { onError }) => onError(new Error("تعذر الاتصال بالخادم")));
    await click("button-add-bulk-schedule");
    for (const day of [1, 2, 3, 4]) {
      await click(`button-bulk-day-${day}`);
      await click("button-remove-active-bulk-day");
    }
    await click("button-remove-bulk-lesson-5");
    await click("button-remove-bulk-lesson-4");
    await click("button-remove-bulk-lesson-3");
    await click("button-remove-bulk-lesson-2");
    await typeInto("input-bulk-lesson-title-1", "مسودة محفوظة محليًا");
    await typeInto("input-bulk-lesson-start-1", "08:00");
    await typeInto("input-bulk-lesson-end-1", "09:00");
    await click("button-save-bulk-schedule");
    expect((document.querySelector('[data-testid="input-bulk-lesson-title-1"]') as HTMLInputElement).value)
      .toBe("مسودة محفوظة محليًا");
    expect(toastError).toHaveBeenCalledWith("تعذر حفظ الجدول الكامل. صحح الأوقات وحاول مجددًا");
    const cancelButton = document.querySelector('[data-testid="bulk-schedule-fixed-actions"] button') as HTMLButtonElement;
    await act(async () => cancelButton.click());

    scheduleIsError = true;
    await renderPage();
    expect(document.body.textContent).toContain("تعذر تحميل الجدول");
    await click("button-retry-schedule");
    expect(scheduleRefetch).toHaveBeenCalledOnce();

    scheduleIsError = false;
    scheduleRows = [{
      id: 1,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: 0,
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    }];
    await renderPage();
    expect(document.querySelector('[data-testid="status-schedule-load-error"]')).toBeNull();
    await click("button-schedule-view-day");
    await click("button-management-schedule-day-0");
    expect(document.body.textContent).toContain("رياضيات");
  });

  it("requires confirmation before deleting the whole schedule", async () => {
    scheduleRows.push({
      id: 1,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: 0,
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ScheduleManagementPage />
        </QueryClientProvider>,
      );
    });

    await click("button-delete-whole-schedule");
    expect(deleteAllMutate).not.toHaveBeenCalled();
    await click("button-confirm-delete-whole-schedule");
    expect(deleteAllMutate).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it("accepts an iPhone HEIC file and converts it before extraction", async () => {
    const input = document.querySelector('[data-testid="input-import-schedule-image"]') as HTMLInputElement;
    const file = new File(["heic-image"], "IMG_3847.heic", { type: "image/heic" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(heicConvert).toHaveBeenCalledWith(expect.objectContaining({
        blob: file,
        toType: "image/jpeg",
      }));
      expect(document.querySelector('img[alt="معاينة صورة الجدول"]')?.getAttribute("src"))
        .toBe("blob:converted-image");
    });
    expect(button("button-confirm-extract-schedule").disabled).toBe(false);
  });
});
