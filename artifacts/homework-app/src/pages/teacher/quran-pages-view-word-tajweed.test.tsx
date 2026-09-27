// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { personalQuranStorageKey, QURAN_PERSONAL_PLAN_KEY, readQuranPersonalState } from "@/components/quran/quran-personal-plan";
import type { GuidedMemorizationStage } from "@/components/quran/quran-guided-memorization-panel";
import type { MemoSessionState } from "@/components/quran/use-quran-memo-session";

const { navigateMock, teacherIdentity } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  teacherIdentity: {
    current: { data: { id: 10 }, isFetching: false, isError: false, isFetchedAfterMount: true },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/quran-reader/1", navigateMock],
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar", dir: "rtl" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const DOCUMENTED_RULES = [
  {
    class: "ham_wasl",
    letters: "ٱ",
    nameAr: "همزة الوصل",
    descriptionAr: "همزة تُنطق عند البدء بالكلمة، وتسقط لفظًا إذا وُصلت القراءة بما قبلها.",
    color: "#a5a5a5",
    colorNameAr: "رمادي",
  },
];

vi.mock("@workspace/api-client-react", () => ({
  getGetQuranJourneyQueryKey: () => ["quran-journey"],
  getGetQuranSurahContentQueryKey: (surah: number) => ["quran-surah", surah],
  getGetCurrentTeacherQueryKey: () => ["current-teacher"],
  getGetQuranWordTajweedQueryKey: (surahNumber: number, ayahNumber: number, wordPosition: number) => [
    "quran-word-tajweed", surahNumber, ayahNumber, wordPosition,
  ],
  useGetCurrentTeacher: () => teacherIdentity.current,
  useGetQuranSurahContent: () => ({ data: { ayahs: [] }, isFetching: false }),
  useRecordMyQuranIndependentSession: () => ({ mutateAsync: vi.fn() }),
  useUpdateMyQuranIndependentPosition: () => ({ mutate: vi.fn() }),
  // Word 1 has a documented, verified Tajweed rule; word 2 has none. This
  // never depends on whether Tajweed color rendering is enabled.
  useGetQuranWordTajweed: (_surahNumber: number, _ayahNumber: number, wordPosition: number) => ({
    data: {
      verseKey: "1:1",
      wordId: wordPosition,
      position: wordPosition,
      text: wordPosition === 1 ? "ٱللَّهِ" : "بِسْمِ",
      rules: wordPosition === 1 ? DOCUMENTED_RULES : [],
      source: {
        id: null,
        name: "أحكام التجويد المعتمدة (مجمع الملك فهد)",
        provider: "Quran Foundation",
        version: "Content API v4 · text_uthmani_tajweed",
      },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/components/quran/quran-audio-host", () => ({
  useQuranAudioHost: () => ({ audioRef: { current: null } }),
}));

vi.mock("@/components/quran/use-quran-reader-state", () => ({
  useQuranReaderState: () => ({
    readerState: null,
    localStatePosition: null,
    savePosition: vi.fn(),
    toggleBookmark: vi.fn(),
    bookmarksMap: new Map(),
    isMutatingBookmark: false,
    canSync: false,
    syncEnabled: false,
    syncActive: false,
    isSyncing: false,
    setSyncEnabled: vi.fn(),
  }),
}));

vi.mock("@/components/quran/use-quran-word-audio", () => ({
  useQuranWordAudio: () => ({ playWord: vi.fn(), stopWordAudio: vi.fn() }),
}));

vi.mock("./quran-madani-page", () => ({
  QuranMadaniPageRenderer: ({
    tajweedEnabled,
    onVerseAction,
  }: {
    tajweedEnabled: boolean;
    onVerseAction: (selection: {
      verseKey: string;
      wordId: number | null;
      wordPosition: number | null;
      wordText: string | null;
      anchorRect: { top: number; left: number; right: number; bottom: number; width: number; height: number } | null;
    }) => void;
  }) => (
    <div data-testid="mushaf-page" data-tajweed-color-enabled={tajweedEnabled ? "true" : "false"}>
      <button
        type="button"
        data-testid="tap-word-with-rule"
        onClick={() => onVerseAction({
          verseKey: "1:1",
          wordId: 1,
          wordPosition: 1,
          wordText: "ٱللَّهِ",
          anchorRect: { top: 10, left: 10, right: 60, bottom: 30, width: 50, height: 20 },
        })}
      >
        كلمة بحكم موثق
      </button>
      <button
        type="button"
        data-testid="tap-word-without-rule"
        onClick={() => onVerseAction({
          verseKey: "1:1",
          wordId: 2,
          wordPosition: 2,
          wordText: "بِسْمِ",
          anchorRect: { top: 10, left: 10, right: 60, bottom: 30, width: 50, height: 20 },
        })}
      >
        كلمة بلا حكم موثق
      </button>
    </div>
  ),
}));

vi.mock("@/components/quran/quran-guided-memorization-panel", () => ({
  QuranGuidedMemorizationPanel: ({ open, stage, onAssess, onStageChange, onClose }: {
    open: boolean;
    stage: GuidedMemorizationStage;
    onAssess: (result: "mastered" | "review") => void;
    onStageChange: (stage: GuidedMemorizationStage) => void;
    onClose: () => void;
  }) => open ? <div data-testid="guided-stage" data-stage={stage}>
    <button type="button" data-testid="assess-personal-mastered" onClick={() => onAssess("mastered")}>أتقنتها</button>
    <button type="button" data-testid="guided-link" onClick={() => onStageChange(4)}>اربط</button>
    <button type="button" data-testid="guided-close" onClick={onClose}>إغلاق</button>
  </div> : null,
}));

vi.mock("@/components/quran/quran-audio-player", () => ({
  QuranAudioPlayer: ({ memoSession, surahNumber, playingAyah }: {
    memoSession: MemoSessionState;
    surahNumber: number;
    playingAyah: number | null;
  }) => <div data-testid="mock-audio-range"
    data-start-surah={memoSession.rangeStartSurah}
    data-start-ayah={memoSession.rangeStart}
    data-end-surah={memoSession.rangeEndSurah}
    data-end-ayah={memoSession.rangeEnd}
    data-scope={memoSession.repeatScope}
    data-playing-surah={surahNumber}
    data-playing-ayah={playingAyah}
  />,
}));

vi.mock("@/components/quran/quran-education-panel", () => ({
  QuranEducationPanel: () => null,
}));

import { QuranPagesView } from "./quran-pages-view";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  teacherIdentity.current = { data: { id: 10 }, isFetching: false, isError: false, isFetchedAfterMount: true };
});

function pagesView(extra: Partial<React.ComponentProps<typeof QuranPagesView>> = {}) {
  return (
    <QuranPagesView
      initialSurah={1}
      initialAyah={1}
      onNavigate={vi.fn()}
      isTaskAyah={() => false}
      startAyah={null}
      endAyah={null}
      mode={null}
      liveRecitationAvailable={false}
      {...extra}
    />
  );
}
function renderPagesView(extra: Partial<React.ComponentProps<typeof QuranPagesView>> = {}) {
  return render(pagesView(extra));
}
async function openPersonalPlan() {
  fireEvent.click(await screen.findByTestId("button-memo-session"));
  fireEvent.click(screen.getByTestId("button-open-personal-plan"));
}

describe("personal Quran plans in authenticated readers", () => {
  it("offers the current ayah and plan from حفظني, and closes the choice with Escape", async () => {
    renderPagesView({ embedded: true });
    fireEvent.click(await screen.findByTestId("button-memo-session"));
    expect(screen.getByTestId("button-start-current-memo")).toBeTruthy();
    expect(screen.getByTestId("button-open-personal-plan")).toBeTruthy();
    expect(screen.getByTestId("count-personal-quran-due").textContent).toBe("0");
    expect(screen.queryByTestId("guided-stage")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("button-open-personal-plan")).toBeNull();
    fireEvent.click(screen.getByTestId("button-memo-session"));
    fireEvent.click(screen.getByTestId("button-start-current-memo"));
    expect(screen.getByTestId("guided-stage")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-memo-session"));
    expect(screen.queryByTestId("guided-stage")).toBeNull();
  });

  it("continues to the next ayah without opening or writing to the plan when current ayah was chosen", async () => {
    renderPagesView({ embedded: true });
    await openPersonalPlan();
    fireEvent.change(screen.getByTestId("select-personal-plan-end-ayah"), { target: { value: "3" } });
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    fireEvent.click(screen.getByTestId("button-close-personal-plan"));
    fireEvent.click(screen.getByTestId("button-memo-session"));
    fireEvent.click(screen.getByTestId("button-start-current-memo"));

    vi.mocked(toast.success).mockClear();
    fireEvent.click(screen.getByTestId("assess-personal-mastered"));

    expect(screen.getByTestId("guided-stage")).toBeTruthy();
    expect(screen.queryByTestId("quran-personal-plan-panel")).toBeNull();
    expect(screen.getByTestId("mock-audio-range").dataset).toMatchObject({
      startSurah: "1", startAyah: "2", endSurah: "1", endAyah: "2", scope: "ayah",
    });
    const saved = readQuranPersonalState(personalQuranStorageKey("teacher", 10));
    expect(saved.plan).not.toBeNull();
    expect(saved.session).toBeNull();
    expect(saved.assessments["1:1"]).toBeUndefined();
    expect(toast.success).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("guided-close"));
    await openPersonalPlan();
    expect(screen.getByTestId("quran-personal-plan-panel")).toBeTruthy();
  });

  it("still opens the plan after mastery when practice was started from خطتي", async () => {
    renderPagesView({ embedded: true });
    await openPersonalPlan();
    fireEvent.change(screen.getByTestId("input-personal-plan-daily-goal"), { target: { value: "1" } });
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    fireEvent.click(screen.getByTestId("button-start-next-personal-ayah"));
    fireEvent.click(screen.getByTestId("assess-personal-mastered"));

    expect(screen.getByTestId("quran-personal-plan-panel")).toBeTruthy();
    expect(readQuranPersonalState(personalQuranStorageKey("teacher", 10)).assessments["1:1"]?.result).toBe("mastered");
  });

  it("keeps secondary reader tools inside an overlay disclosure", async () => {
    renderPagesView();
    const more = await screen.findByTestId("button-mobile-more-tools");
    expect(screen.queryByTestId("button-tajweed-toggle")).toBeNull();
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("button-tajweed-toggle")).toBeTruthy();
    fireEvent.click(more);
    expect(screen.queryByTestId("button-tajweed-toggle")).toBeNull();
  });

  it("links from the first selected ayah through the current ayah and restores the range on resume", async () => {
    renderPagesView({ embedded: true });
    await openPersonalPlan();
    fireEvent.change(screen.getByTestId("select-personal-plan-end-ayah"), { target: { value: "3" } });
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    fireEvent.click(screen.getByTestId("button-start-next-personal-ayah"));
    fireEvent.click(screen.getByTestId("assess-personal-mastered"));

    await waitFor(() => expect(readQuranPersonalState(personalQuranStorageKey("teacher", 10)).session?.verse).toEqual({ surah: 1, ayah: 2 }));
    fireEvent.click(screen.getByTestId("guided-link"));
    const audio = screen.getByTestId("mock-audio-range");
    expect(audio.dataset).toMatchObject({
      startSurah: "1", startAyah: "1", endSurah: "1", endAyah: "2",
      scope: "range", playingSurah: "1", playingAyah: "1",
    });

    fireEvent.click(screen.getByTestId("guided-close"));
    await openPersonalPlan();
    fireEvent.click(screen.getByTestId("button-resume-personal-session"));
    expect(screen.getByTestId("guided-stage").dataset.stage).toBe("4");
    expect(screen.getByTestId("mock-audio-range").dataset).toMatchObject({
      startSurah: "1", startAyah: "1", endSurah: "1", endAyah: "2",
      scope: "range", playingSurah: "1", playingAyah: "1",
    });
  });

  it("keeps the first selected surah when the linked range crosses into the next surah", async () => {
    renderPagesView({ embedded: true });
    await openPersonalPlan();
    fireEvent.change(screen.getByTestId("select-personal-plan-start-ayah"), { target: { value: "7" } });
    fireEvent.change(screen.getByTestId("select-personal-plan-end-surah"), { target: { value: "2" } });
    fireEvent.change(screen.getByTestId("select-personal-plan-end-ayah"), { target: { value: "2" } });
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    fireEvent.click(screen.getByTestId("button-start-next-personal-ayah"));
    fireEvent.click(screen.getByTestId("assess-personal-mastered"));
    await waitFor(() => expect(readQuranPersonalState(personalQuranStorageKey("teacher", 10)).session?.verse).toEqual({ surah: 2, ayah: 1 }));
    fireEvent.click(screen.getByTestId("guided-link"));
    expect(screen.getByTestId("mock-audio-range").dataset).toMatchObject({
      startSurah: "1", startAyah: "7", endSurah: "2", endAyah: "1",
      scope: "range", playingSurah: "1", playingAyah: "7",
    });
  });

  it("shows the teacher's own plan in the embedded teacher Mushaf without writing to the public reader", async () => {
    renderPagesView({ embedded: true });
    await openPersonalPlan();
    expect(screen.getByTestId("quran-personal-plan-panel")).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    expect(readQuranPersonalState(personalQuranStorageKey("teacher", 10)).plan?.start).toEqual({ surah: 1, ayah: 1 });
    expect(localStorage.getItem(QURAN_PERSONAL_PLAN_KEY)).toBeNull();
    fireEvent.click(screen.getByTestId("button-start-next-personal-ayah"));
    fireEvent.click(screen.getByTestId("assess-personal-mastered"));
    expect(readQuranPersonalState(personalQuranStorageKey("teacher", 10)).assessments["1:1"]?.result).toBe("mastered");
    expect(localStorage.getItem(QURAN_PERSONAL_PLAN_KEY)).toBeNull();
  });

  it("shows a separate plan in the student's independent practice reader", async () => {
    const studentKey = personalQuranStorageKey("student", 25);
    renderPagesView({
      isStudentReader: true,
      studentPersonalPlanKey: studentKey,
      readerBasePath: "/student/quran-practice",
      isIndependentPractice: true,
    });
    await openPersonalPlan();
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    expect(readQuranPersonalState(studentKey).plan?.dailyGoal).toBe(3);
    expect(localStorage.getItem(personalQuranStorageKey("teacher", 10))).toBeNull();
    fireEvent.click(screen.getByTestId("button-start-next-personal-ayah"));
    fireEvent.click(screen.getByTestId("assess-personal-mastered"));
    expect(readQuranPersonalState(studentKey).assessments["1:1"]?.result).toBe("mastered");
    expect(localStorage.getItem(personalQuranStorageKey("teacher", 10))).toBeNull();
  });

  it("opens the student's independent practice before showing the personal plan from an assigned ward", async () => {
    navigateMock.mockClear();
    renderPagesView({
      isStudentReader: true,
      studentPersonalPlanKey: personalQuranStorageKey("student", 25),
      personalPlanRedirectHref: "/student/quran-practice/1?personalPlan=1",
      mode: "memorization",
      startAyah: 1,
      endAyah: 2,
    });
    await openPersonalPlan();
    expect(navigateMock).toHaveBeenCalledWith("/student/quran-practice/1?personalPlan=1");
    expect(screen.queryByTestId("quran-personal-plan-panel")).toBeNull();
  });

  it("hides the old plan and closes its guided session when identity verification fails or changes", async () => {
    const { rerender } = renderPagesView({ embedded: true });
    await openPersonalPlan();
    fireEvent.click(screen.getByTestId("button-save-personal-plan"));
    fireEvent.click(screen.getByTestId("button-start-next-personal-ayah"));
    expect(screen.getByTestId("assess-personal-mastered")).toBeTruthy();

    teacherIdentity.current = { data: { id: 10 }, isFetching: true, isError: false, isFetchedAfterMount: true };
    rerender(pagesView({ embedded: true }));
    expect(screen.queryByTestId("button-open-personal-plan")).toBeNull();
    expect(screen.queryByTestId("assess-personal-mastered")).toBeNull();

    teacherIdentity.current = { data: { id: 10 }, isFetching: false, isError: false, isFetchedAfterMount: true };
    rerender(pagesView({ embedded: true }));
    expect(await screen.findByTestId("assess-personal-mastered")).toBeTruthy();

    teacherIdentity.current = { data: { id: 10 }, isFetching: false, isError: true, isFetchedAfterMount: true };
    rerender(pagesView({ embedded: true }));
    expect(screen.queryByTestId("button-open-personal-plan")).toBeNull();
    expect(screen.queryByTestId("assess-personal-mastered")).toBeNull();

    teacherIdentity.current = { data: { id: 11 }, isFetching: false, isError: false, isFetchedAfterMount: true };
    rerender(pagesView({ embedded: true }));
    await openPersonalPlan();
    expect(readQuranPersonalState(personalQuranStorageKey("teacher", 10)).plan).not.toBeNull();
    expect(readQuranPersonalState(personalQuranStorageKey("teacher", 11)).plan).toBeNull();
    expect(readQuranPersonalState(personalQuranStorageKey("teacher", 11)).assessments).toEqual({});
    expect(screen.queryByTestId("assess-personal-mastered")).toBeNull();
  });
});

// Multiple physical Mushaf pages (single/duo/continuous layouts) can mount
// simultaneously; only the first one needs to be exercised for these checks.
function firstTapWordWithRule() {
  fireEvent.click(screen.getAllByTestId("tap-word-with-rule")[0]);
}
function firstTapWordWithoutRule() {
  fireEvent.click(screen.getAllByTestId("tap-word-without-rule")[0]);
}

describe("QuranPagesView word Tajweed action", () => {
  it("shows the compact one-row Tajweed action only for a word with a documented, verified rule", async () => {
    renderPagesView();

    await waitFor(() => expect(screen.getAllByTestId("mushaf-page").length).toBeGreaterThan(0));
    firstTapWordWithRule();
    await waitFor(() => {
      expect(screen.getByTestId("word-action-tajweed")).toBeTruthy();
    });
    expect(screen.getByTestId("word-action-pronounce")).toBeTruthy();
    expect(screen.getByTestId("word-action-meaning")).toBeTruthy();
    expect(screen.getByTestId("word-action-translation")).toBeTruthy();
    expect(screen.getByText("تجويد")).toBeTruthy();
    const actionRow = screen.getByTestId("word-action-pronounce").parentElement;
    expect(actionRow?.className).toContain("grid-cols-4");
    for (const testId of ["word-action-meaning", "word-action-translation", "word-action-tajweed"]) {
      expect(screen.getByTestId(testId).parentElement).toBe(actionRow);
    }
  });

  it("hides the Tajweed action when no verified rule is documented for the word", async () => {
    renderPagesView();

    await waitFor(() => expect(screen.getAllByTestId("mushaf-page").length).toBeGreaterThan(0));
    firstTapWordWithoutRule();
    await waitFor(() => {
      expect(screen.getByTestId("word-action-pronounce")).toBeTruthy();
    });
    expect(screen.queryByTestId("word-action-tajweed")).toBeNull();
  });

  it("opens a rule card with the name, explanation, and matching color swatch when tapped", async () => {
    renderPagesView();

    await waitFor(() => expect(screen.getAllByTestId("mushaf-page").length).toBeGreaterThan(0));
    firstTapWordWithRule();
    await waitFor(() => expect(screen.getByTestId("word-action-tajweed")).toBeTruthy());
    fireEvent.click(screen.getByTestId("word-action-tajweed"));

    await waitFor(() => expect(screen.getByTestId("quran-tajweed-rule-card")).toBeTruthy());
    expect(screen.getByText("همزة الوصل")).toBeTruthy();
    expect(screen.getByText(DOCUMENTED_RULES[0].descriptionAr)).toBeTruthy();
    const swatch = screen.getByTestId("tajweed-rule-color-swatch") as HTMLElement;
    expect(swatch.style.backgroundColor).toBeTruthy();

    fireEvent.click(screen.getByTestId("tajweed-card-close"));
    expect(screen.queryByTestId("quran-tajweed-rule-card")).toBeNull();
  });

  it("keeps the Tajweed action available identically whether color rendering is on or off", async () => {
    renderPagesView();

    await waitFor(() => expect(screen.getAllByTestId("mushaf-page").length).toBeGreaterThan(0));
    // Color rendering starts disabled by default.
    expect(screen.getAllByTestId("mushaf-page")[0].getAttribute("data-tajweed-color-enabled")).toBe("false");
    firstTapWordWithRule();
    await waitFor(() => expect(screen.getByTestId("word-action-tajweed")).toBeTruthy());
    fireEvent.click(screen.getByTestId("word-action-tajweed"));
    await waitFor(() => expect(screen.getByTestId("quran-tajweed-rule-card")).toBeTruthy());
    fireEvent.click(screen.getByTestId("tajweed-card-close"));

    // Toggling Tajweed color rendering on must not change rule availability.
    fireEvent.click(screen.getByTestId("button-desktop-more-tools"));
    fireEvent.click(screen.getByTestId("button-tajweed-toggle"));
    await waitFor(() => {
      expect(screen.getAllByTestId("mushaf-page")[0].getAttribute("data-tajweed-color-enabled")).toBe("true");
    });

    firstTapWordWithRule();
    await waitFor(() => expect(screen.getByTestId("word-action-tajweed")).toBeTruthy());

    firstTapWordWithoutRule();
    await waitFor(() => expect(screen.getByTestId("word-action-pronounce")).toBeTruthy());
    expect(screen.queryByTestId("word-action-tajweed")).toBeNull();
  });
});
