import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/activity-cover", () => ({
  ActivityCover: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  formatUseCount: (value: number | undefined) => String(value ?? 0),
  resolveCoverKind: () => "assignment",
  resolveSubjectTheme: () => "science",
}));

import {
  ActivitiesLibraryMarketplace,
  type ActivitiesLibraryMarketplaceProps,
} from "./activities-library-marketplace";

const assignment = {
  id: 1,
  title: "نشاط العلوم",
  type: "mcq",
  questionCount: 12,
  teacherId: 2,
  teacherName: "معلم",
  subject: "علوم",
  targetClass: "السادس",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeProps(overrides: Partial<ActivitiesLibraryMarketplaceProps> = {}): ActivitiesLibraryMarketplaceProps {
  return {
    embedded: true,
    lang: "ar",
    dir: "rtl",
    assignments: [assignment],
    questions: [],
    videoLessons: [],
    gameActivities: [],
    presentations: [],
    filteredAssignments: [assignment],
    filteredQuestions: [],
    filteredVideos: [],
    filteredGameActivities: [],
    filteredPresentations: [],
    popularIds: new Set(),
    newIds: new Set(),
    currentTeacherId: 1,
    preferredSubjects: [],
    onPreferredSubjectsChange: vi.fn(async () => {}),
    isAdmin: false,
    showHidden: false,
    onShowHiddenChange: vi.fn(),
    search: "",
    onSearchChange: vi.fn(),
    subjectFilter: "",
    onSubjectFilterChange: vi.fn(),
    gradeFilter: "",
    onGradeFilterChange: vi.fn(),
    sortBy: "newest",
    onSortByChange: vi.fn(),
    allSubjects: ["علوم"],
    allGrades: ["السادس"],
    activeTab: "assignments",
    onActiveTabChange: vi.fn(),
    onClearFilters: vi.fn(),
    openPresentation: vi.fn(),
    launchAsGame: vi.fn(),
    openGameActivity: vi.fn(),
    importAssignment: vi.fn(),
    copyLink: vi.fn(),
    dismissAssignment: vi.fn(),
    importQuestion: vi.fn(),
    dismissQuestion: vi.fn(),
    importVideo: vi.fn(),
    launchingIds: new Set(),
    importingIds: new Set(),
    importedIds: new Set(),
    importingQIds: new Set(),
    importedQIds: new Set(),
    importingVIds: new Set(),
    importedVIds: new Set(),
    dismissingIds: new Set(),
    t: {
      sharedContent: {
        tabAssignments: "الواجبات",
        tabQuestions: "الأسئلة",
        searchPlaceholder: "بحث",
        importAssignment: "استيراد",
        copyLink: "نسخ الرابط",
      },
    },
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      totalActivities: 1,
      contributingTeachers: 1,
      totalUses: 6,
      newThisWeek: 0,
      assignmentUses: { 1: 6 },
      assignmentUsesLast14Days: { 1: 6 },
      videoUses: {},
      videoUsesLast14Days: {},
      usageWindowDays: 14,
      presentationUses: 0,
      questionUsesTracked: false,
    }),
  }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function buttonWithText(root: ParentNode, text: string) {
  return Array.from(root.querySelectorAll("button")).find(
    button => button.textContent?.trim() === text,
  ) as HTMLButtonElement;
}

describe("ActivitiesLibraryMarketplace mobile controls", () => {
  it("يزيل العمود الداخلي ويعرض أدوات المكتبة أعلى المحتوى بنفس الحالات", async () => {
    const props = makeProps();
    await act(async () => {
      root.render(<ActivitiesLibraryMarketplace {...props} />);
    });

    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector('input[aria-label="البحث في مكتبة الأنشطة"]')).not.toBeNull();
    expect(container.querySelector('select[aria-label="الترتيب"]')).not.toBeNull();
    expect(container.textContent).toContain("واجبات واختبارات");
    expect(container.textContent).toContain("عروض تفاعلية");

    const search = container.querySelector('input[aria-label="البحث في مكتبة الأنشطة"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(search, "علوم");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onSearchChange).toHaveBeenCalledWith("علوم");

    const subject = container.querySelector('select[aria-label="المادة الدراسية"]') as HTMLSelectElement;
    await act(async () => {
      subject.value = "علوم";
      subject.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(props.onSubjectFilterChange).toHaveBeenCalledWith("علوم");

    const assignmentsGrid = Array.from(container.querySelectorAll("div")).find(
      element => element.className.includes("grid-cols-2") && element.querySelector("article"),
    );
    expect(assignmentsGrid).not.toBeUndefined();
    expect(container.textContent).toContain("رائج الآن");

    await act(async () => buttonWithText(container, "ابدأ").click());
    expect(props.launchAsGame).toHaveBeenCalledWith(assignment.id);

    const importButton = container.querySelector(`button[aria-label="${props.t.sharedContent.importAssignment}"]`) as HTMLButtonElement;
    await act(async () => importButton.click());
    expect(props.importAssignment).toHaveBeenCalledWith(assignment.id);

    const copyButton = container.querySelector(`button[aria-label="${props.t.sharedContent.copyLink}"]`) as HTMLButtonElement;
    await act(async () => copyButton.click());
    expect(props.copyLink).toHaveBeenCalledWith(assignment.id);

    const saveButton = container.querySelector('button[aria-label="حفظ النشاط"]') as HTMLButtonElement;
    await act(async () => saveButton.click());
    expect(container.querySelector('button[aria-label="إزالة من المحفوظات"]')).not.toBeNull();

    const sort = container.querySelector('select[aria-label="الترتيب"]') as HTMLSelectElement;
    await act(async () => {
      sort.value = "questions";
      sort.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(props.onSortByChange).toHaveBeenCalledWith("questions");

    await act(async () => buttonWithText(container, "فيديو").click());
    expect(props.onActiveTabChange).toHaveBeenCalledWith("videos");

    await act(async () => buttonWithText(container, "عروض تفاعلية").click());
    expect(props.onActiveTabChange).toHaveBeenCalledWith("presentations");

    const grade = container.querySelector('input[aria-label="المرحلة أو الصف"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(grade, "السادس");
      grade.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onGradeFilterChange).toHaveBeenCalledWith("السادس");
  });

  it("يعرض المادة المخصصة المحفوظة في فلتر المواد حتى دون نشاط مطابق", async () => {
    const props = makeProps({
      preferredSubjects: ["الفلك"],
      allSubjects: ["علوم"],
    });
    await act(async () => {
      root.render(<ActivitiesLibraryMarketplace {...props} />);
    });

    const subject = container.querySelector('select[aria-label="المادة الدراسية"]') as HTMLSelectElement;
    expect(Array.from(subject.options).map(option => option.value)).toEqual(["", "الفلك", "علوم"]);
  });
});