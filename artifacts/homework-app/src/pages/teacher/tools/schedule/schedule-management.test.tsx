import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bulkMutate = vi.fn();
const deleteAllMutate = vi.fn();
let scheduleRows: Array<Record<string, unknown>> = [];

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getListTeacherScheduleQueryKey: () => ["teacher-schedule"],
  useListTeacherSchedule: () => ({ data: scheduleRows, isLoading: false, isError: false }),
  useBulkCreateTeacherSchedule: () => ({ mutate: bulkMutate, isPending: false }),
  useCreateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTeacherSchedule: () => ({ mutate: deleteAllMutate, isPending: false }),
  useDeleteTeacherScheduleEntry: () => ({ mutate: vi.fn(), isPending: false }),
}));

import ScheduleManagementPage from "./index";

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

beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  bulkMutate.mockReset();
  deleteAllMutate.mockReset();
  scheduleRows = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <ScheduleManagementPage />
      </QueryClientProvider>,
    );
  });
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

    await click("button-add-schedule-entry");
    const entryScroll = document.querySelector('[data-testid="schedule-entry-scroll-region"]');
    const entryActions = document.querySelector('[data-testid="schedule-entry-fixed-actions"]');
    expect(entryScroll?.className).toContain("overflow-y-auto");
    expect(entryActions?.contains(button("button-save-schedule-entry"))).toBe(true);
    expect(entryScroll?.contains(button("button-save-schedule-entry"))).toBe(false);
    const cancelButton = entryActions?.querySelector("button") as HTMLButtonElement;
    await act(async () => cancelButton.click());

    await click("button-add-bulk-schedule");

    const scrollRegion = document.querySelector('[data-testid="bulk-schedule-scroll-region"]');
    const actions = document.querySelector('[data-testid="bulk-schedule-fixed-actions"]');
    expect(scrollRegion?.className).toContain("overflow-y-auto");
    expect(actions?.contains(button("button-save-bulk-schedule"))).toBe(true);
    expect(scrollRegion?.contains(button("button-save-bulk-schedule"))).toBe(false);
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
    await act(async () => {
      root.render(
        <QueryClientProvider client={new QueryClient()}>
          <ScheduleManagementPage />
        </QueryClientProvider>,
      );
    });

    expect(document.body.textContent).toContain("جميع المواعيد");
    expect(document.body.textContent).toContain("موعد 1");
    expect(document.body.textContent).toContain("موعد 5");
    const daySelector = document.querySelector('[data-testid="schedule-management-day-selector"]') as HTMLElement;
    expect(daySelector.className).toContain("grid-cols-4");
    expect(daySelector.className).toContain("sm:grid-cols-7");
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
});