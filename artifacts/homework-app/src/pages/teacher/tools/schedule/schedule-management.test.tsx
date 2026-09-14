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
const { toastError, creditAwareFetch } = vi.hoisted(() => ({
  toastError: vi.fn(),
  creditAwareFetch: vi.fn(),
}));

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

vi.mock("@/lib/credit-aware-fetch", () => ({
  creditAwareFetch,
  isInsufficientCreditsResponse: () => false,
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
  creditAwareFetch.mockReset();
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
    await click("button-schedule-appearance");
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

    expect(button("button-toggle-schedule-timer-settings")).toBeTruthy();
    expect(document.querySelector('[data-testid="schedule-timer-alerts"]')).toBeNull();
    await click("button-toggle-schedule-timer-settings");
    expect(document.body.textContent).toContain("المؤقت والتنبيهات");
    expect(document.querySelectorAll('[data-testid="button-schedule-alerts-enabled"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="select-schedule-alert-minutes"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="select-schedule-end-alert-minutes"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="select-schedule-alert-sound"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="button-schedule-alert-sound"] svg')).toHaveLength(1);
    const scheduleGrid = document.querySelector('[data-testid="schedule-week-grid"]') as HTMLElement;
    const timerSettings = document.querySelector('[data-testid="schedule-timer-alerts"]') as HTMLElement;
    expect(timerSettings.compareDocumentPosition(scheduleGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await click("button-schedule-appearance");
    await click("button-schedule-appearance-tab-view");
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
    scheduleRows = [{ id: 10, kind: "weekly", title: "رياضيات", dayOfWeek: 0, lessonNumber: 1, startTime: "08:00", endTime: "09:00" }];
    await renderPage();
    await click("button-toggle-schedule-timer-settings");
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
    scheduleRows = [{ id: 11, kind: "weekly", title: "علوم", dayOfWeek: 0, lessonNumber: 1, startTime: "08:00", endTime: "09:00" }];
    await renderPage();
    await click("button-toggle-schedule-timer-settings");
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

  it("keeps the original grid style by default and saves another teacher choice", async () => {
    scheduleRows = [
      { id: 20, kind: "weekly", title: "رياضيات", dayOfWeek: 0, lessonNumber: 1, startTime: "08:00", endTime: "09:00" },
    ];
    await renderPage();

    expect(document.querySelector('[data-testid="schedule-week-grid"]')?.getAttribute("data-table-theme"))
      .toBe("classic");
    expect(document.querySelector('[data-testid="schedule-week-grid"] table')?.getAttribute("data-table-direction"))
      .toBe("rtl");

    await click("button-schedule-appearance");
    await click("button-schedule-appearance-tab-options");
    const themeSection = button("button-schedule-option-theme").closest("details") as HTMLDetailsElement;
    const directionSection = button("button-schedule-option-direction").closest("details") as HTMLDetailsElement;
    const daysSection = button("button-schedule-option-days").closest("details") as HTMLDetailsElement;
    expect(themeSection.open).toBe(false);
    expect(directionSection.open).toBe(false);
    expect(daysSection.open).toBe(false);
    await click("button-schedule-option-theme");
    expect(themeSection.open).toBe(true);
    await click("button-schedule-theme-soft");
    await click("button-schedule-option-theme");
    expect(themeSection.open).toBe(false);
    await click("button-schedule-option-direction");
    expect(directionSection.open).toBe(true);
    await click("button-schedule-direction-ltr");
    await click("button-schedule-option-direction");
    expect(directionSection.open).toBe(false);

    expect(document.querySelector('[data-testid="schedule-week-grid"]')?.getAttribute("data-table-theme"))
      .toBe("soft");
    expect(localStorage.getItem("hasaad_schedule_table_theme_v1_7")).toBe("soft");
    expect(document.querySelector('[data-testid="schedule-week-grid"] table')?.getAttribute("data-table-direction"))
      .toBe("ltr");
    expect(localStorage.getItem("hasaad_schedule_table_direction_v1_7")).toBe("ltr");
  });

  it("lets each teacher hide selected days without deleting their schedule entries", async () => {
    scheduleRows = [
      { id: 22, kind: "weekly", title: "رياضيات", dayOfWeek: 5, lessonNumber: 1, startTime: "08:00", endTime: "09:00" },
      { id: 23, kind: "weekly", title: "علوم", dayOfWeek: 6, lessonNumber: 2, startTime: "09:00", endTime: "10:00" },
    ];
    await renderPage();

    await click("button-schedule-appearance");
    await click("button-schedule-appearance-tab-options");
    await click("button-schedule-option-days");
    expect(button("button-schedule-day-visibility-5").getAttribute("aria-checked")).toBe("true");
    expect(button("button-schedule-day-visibility-6").getAttribute("aria-checked")).toBe("true");

    await click("button-schedule-day-visibility-5");
    await click("button-schedule-day-visibility-6");

    expect(button("button-schedule-day-visibility-5").getAttribute("aria-checked")).toBe("false");
    expect(button("button-schedule-day-visibility-6").getAttribute("aria-checked")).toBe("false");
    expect(JSON.parse(localStorage.getItem("hasaad_schedule_hidden_days_v1_7") || "[]")).toEqual([5, 6]);
    expect(scheduleRows).toHaveLength(2);
  });

  it("supports custom schedule colors with live preview, HEX input, cancel, and apply", async () => {
    scheduleRows = [{
      id: 21,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: 0,
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    }];
    await renderPage();

    await click("button-schedule-appearance");
    await click("button-schedule-colors");
    await click("button-schedule-custom-color");

    const customInput = document.querySelector('[data-testid="schedule-custom-hex"]') as HTMLInputElement;
    const lessonHeader = button("button-rename-lesson-column-1").closest("th") as HTMLElement;
    expect(customInput.value).toBe("#1E4D35");

    await typeInto("schedule-custom-hex", "#123456");
    expect(customInput.value).toBe("#123456");
    expect(lessonHeader.style.backgroundColor).not.toBe("");
    expect(localStorage.getItem("hasaad_schedule_table_header_color_v1_7")).toBeNull();

    await click("button-schedule-custom-cancel");
    expect(lessonHeader.style.backgroundColor).toBe("");
    expect(localStorage.getItem("hasaad_schedule_table_header_color_v1_7")).toBeNull();

    await click("button-schedule-custom-color");
    await typeInto("schedule-custom-hex", "#123456");
    await click("button-schedule-custom-apply");
    expect(localStorage.getItem("hasaad_schedule_table_header_color_v1_7")).toBe("#123456");
    expect(lessonHeader.style.backgroundColor).not.toBe("");

    await click("button-schedule-colors");
    await click("button-schedule-color-preset-0");
    expect(localStorage.getItem("hasaad_schedule_table_header_color_v1_7")).toBe("#D1FAE5");
  });

  it("lets the teacher color the complete days column", async () => {
    scheduleRows = [{
      id: 24,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: 0,
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    }];
    await renderPage();

    await click("button-schedule-appearance");
    await click("button-schedule-color-target-days");
    await click("button-schedule-color-preset-0");

    expect(JSON.parse(localStorage.getItem("hasaad_schedule_table_column_colors_v1_7") || "{}"))
      .toMatchObject({ days: "#D1FAE5" });
    const dayCell = document.querySelector('[data-testid="schedule-paper-day-0"] th') as HTMLElement;
    expect(dayCell.style.backgroundColor).not.toBe("");
  });

  it("lets the teacher hide other periods and add or remove empty lesson columns", async () => {
    scheduleRows = [{
      id: 25,
      kind: "weekly",
      title: "رياضيات",
      dayOfWeek: 0,
      lessonNumber: 1,
      startTime: "08:00",
      endTime: "09:00",
    }];
    await renderPage();

    expect(button("button-rename-other-periods-column")).not.toBeNull();
    expect(button("button-rename-lesson-column-2")).toBeNull();

    await click("button-schedule-appearance");
    await click("button-schedule-appearance-tab-options");
    const columnsSection = button("button-schedule-option-columns").closest("details") as HTMLDetailsElement;
    expect(columnsSection.open).toBe(false);
    await click("button-schedule-option-columns");
    expect(columnsSection.open).toBe(true);

    await click("button-toggle-other-periods-column");
    expect(button("button-rename-other-periods-column")).toBeNull();
    expect(localStorage.getItem("hasaad_schedule_show_other_periods_v1_7")).toBe("0");

    await click("button-add-schedule-lesson-column");
    expect(button("button-rename-lesson-column-2")).not.toBeNull();
    expect(localStorage.getItem("hasaad_schedule_min_lesson_columns_v1_7")).toBe("2");

    await click("button-remove-last-empty-schedule-column");
    expect(button("button-rename-lesson-column-2")).toBeNull();
    expect(localStorage.getItem("hasaad_schedule_min_lesson_columns_v1_7")).toBe("1");
  });

  it("shows a break after its lesson in a separate grid column", async () => {
    scheduleRows = [
      { id: 30, kind: "weekly", title: "5A", dayOfWeek: 0, lessonNumber: 3, startTime: "09:20", endTime: "10:05" },
      { id: 31, kind: "break", title: "SNACK", dayOfWeek: 0, breakAfterLesson: 2, startTime: "09:00", endTime: "09:15" },
    ];
    await renderPage();

    const breakColumn = document.querySelector('[data-testid="schedule-break-column-2"]') as HTMLElement;
    expect(breakColumn.textContent).toContain("بعد الثانية");
    const sundayRow = document.querySelector('[data-testid="schedule-paper-day-0"]') as HTMLElement;
    expect(sundayRow.textContent).toContain("SNACK");
  });

  it("lets each teacher rename schedule columns without changing their positions", async () => {
    scheduleRows = [
      { id: 32, kind: "weekly", title: "5A", dayOfWeek: 0, lessonNumber: 2, startTime: "08:10", endTime: "08:55" },
      { id: 33, kind: "break", title: "SNACK", dayOfWeek: 0, breakAfterLesson: 2, startTime: "09:00", endTime: "09:15" },
    ];
    await renderPage();

    await click("button-rename-break-column-2");
    await typeInto("input-schedule-column-label", "استراحة خفيفة");
    await click("button-save-schedule-column-label");

    expect(button("button-rename-break-column-2").textContent).toContain("استراحة خفيفة");
    expect(JSON.parse(localStorage.getItem("hasaad_schedule_column_labels_v1_7") || "{}"))
      .toMatchObject({ "break-2": "استراحة خفيفة" });
    expect(document.querySelector('[data-testid="schedule-paper-day-0"]')?.textContent).toContain("SNACK");
  });

  it("shows three calm sound choices in the timer settings", async () => {
    scheduleRows = [{ id: 12, kind: "weekly", title: "لغة عربية", dayOfWeek: 0, lessonNumber: 1, startTime: "08:00", endTime: "09:00" }];
    await renderPage();
    await click("button-toggle-schedule-timer-settings");
    const soundSelect = document.querySelector('[data-testid="select-schedule-alert-sound"]') as HTMLSelectElement;
    expect(soundSelect.options).toHaveLength(3);
    expect(Array.from(soundSelect.options).map((option) => option.textContent)).toEqual([
      "نسمة هادئة",
      "نقرة خشبية",
      "رنين دافئ",
    ]);
    const endAlertSelect = document.querySelector('[data-testid="select-schedule-end-alert-minutes"]') as HTMLSelectElement;
    expect(endAlertSelect.value).toBe("5");
    expect(Array.from(endAlertSelect.options).map((option) => option.value)).toEqual(["0", "1", "2", "5", "10", "15"]);
  });

  it("shows the active manual-schedule day clearly and sends a selected lesson color", async () => {
    createMutate.mockImplementation(({ data }, { onSuccess }) => {
      expect(data).toEqual(expect.objectContaining({
        kind: "weekly",
        color: "#D1FAE5",
        startTime: "08:00",
      }));
      onSuccess();
    });

    await click("button-add-bulk-schedule");
    await click("button-bulk-day-1");
    expect(document.body.textContent).toContain("تعدّل الآن: الاثنين");
    await act(async () => {
      button("button-add-bulk-schedule").closest('[role="dialog"]')
        ?.querySelector<HTMLButtonElement>('[aria-label="Close"]')
        ?.click();
    });

    await click("button-add-schedule-entry");
    await typeInto("input-schedule-start-time", "08:00");
    await click("button-schedule-color-0");
    await click("button-save-schedule-entry");

    expect(createMutate).toHaveBeenCalledTimes(1);
  });

  it("preserves sparse lessons, a non-lesson period, and an appointment after reopening", async () => {
    bulkMutate.mockImplementation(({ data }, { onSuccess }) => {
      expect(data.daySchedules).toEqual([{
        dayOfWeek: 5,
        lessons: [
          expect.objectContaining({ lessonNumber: 1, title: "رياضيات", color: "#D1FAE5" }),
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
    await click("button-bulk-lesson-color-1-0");
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
    await click("button-schedule-appearance");
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
    await click("button-schedule-appearance");
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

  it("keeps unreadable-image guidance clear and does not open a partial schedule review", async () => {
    const guidance = "تعذّرت قراءة محاذاة الأيام والحصص بأمان. صوّر الصفحة كاملة من الأعلى مباشرة، بإضاءة متساوية ومن دون ظلال أو وهج.";
    creditAwareFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        message: guidance,
        warnings: ["تعذر ربط عناوين الأيام بأعمدة الحصص"],
      }),
    });

    const input = document.querySelector('[data-testid="input-import-schedule-image"]') as HTMLInputElement;
    const file = new File(["unreadable-timetable"], "unreadable-timetable.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));

    await click("button-confirm-extract-schedule");

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(guidance);
    });
    expect(document.body.textContent).toContain("استيراد جدول معلم");
    expect(document.querySelector('img[alt="معاينة صورة الجدول"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="bulk-schedule-scroll-region"]')).toBeNull();
    expect(document.querySelector('[data-testid^="input-bulk-lesson-title-"]')).toBeNull();
    expect(bulkMutate).not.toHaveBeenCalled();
  });

  it("shows each imported weekday's distinct times in review and saves them unchanged", async () => {
    creditAwareFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        daySchedules: [
          {
            dayOfWeek: 0,
            lessons: [
              { lessonNumber: 1, title: "رياضيات الأحد", subject: null, className: null, startTime: "07:30", endTime: "08:10", confidence: "high" },
              { lessonNumber: 2, title: "علوم الأحد", subject: null, className: null, startTime: "08:20", endTime: "09:00", confidence: "high" },
            ],
          },
          {
            dayOfWeek: 1,
            lessons: [
              { lessonNumber: 1, title: "عربي الاثنين", subject: null, className: null, startTime: "09:15", endTime: "10:00", confidence: "high" },
              { lessonNumber: 2, title: "إسلامية الاثنين", subject: null, className: null, startTime: "10:10", endTime: "10:55", confidence: "high" },
            ],
          },
        ],
        warnings: [],
      }),
    });
    bulkMutate.mockImplementation(({ data }, { onSuccess }) => {
      expect(data.daySchedules).toEqual([
        expect.objectContaining({
          dayOfWeek: 0,
          lessons: [
            expect.objectContaining({ lessonNumber: 1, startTime: "07:30", endTime: "08:10" }),
            expect.objectContaining({ lessonNumber: 2, startTime: "08:20", endTime: "09:00" }),
          ],
        }),
        expect.objectContaining({
          dayOfWeek: 1,
          lessons: [
            expect.objectContaining({ lessonNumber: 1, startTime: "09:15", endTime: "10:00" }),
            expect.objectContaining({ lessonNumber: 2, startTime: "10:10", endTime: "10:55" }),
          ],
        }),
      ]);
      onSuccess([]);
    });

    const input = document.querySelector('[data-testid="input-import-schedule-image"]') as HTMLInputElement;
    const file = new File(["timetable"], "weekday-specific-times.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    await click("button-confirm-extract-schedule");
    await vi.waitFor(() => {
      expect((document.querySelector('[data-testid="input-bulk-lesson-title-1"]') as HTMLInputElement).value)
        .toBe("رياضيات الأحد");
    });

    expect((document.querySelector('[data-testid="input-bulk-lesson-start-1"]') as HTMLInputElement).value).toBe("07:30");
    expect((document.querySelector('[data-testid="input-bulk-lesson-end-1"]') as HTMLInputElement).value).toBe("08:10");
    await click("button-bulk-day-1");
    expect((document.querySelector('[data-testid="input-bulk-lesson-title-1"]') as HTMLInputElement).value).toBe("عربي الاثنين");
    expect((document.querySelector('[data-testid="input-bulk-lesson-start-1"]') as HTMLInputElement).value).toBe("09:15");
    expect((document.querySelector('[data-testid="input-bulk-lesson-end-1"]') as HTMLInputElement).value).toBe("10:00");

    await click("button-save-bulk-schedule");
    expect(bulkMutate).toHaveBeenCalledOnce();
  });
});
