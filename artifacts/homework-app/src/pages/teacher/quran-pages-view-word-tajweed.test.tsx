// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/quran-reader/1", vi.fn()],
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
  useGetCurrentTeacher: () => ({ data: null }),
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
  QuranGuidedMemorizationPanel: () => null,
}));

vi.mock("@/components/quran/quran-audio-player", () => ({
  QuranAudioPlayer: () => null,
}));

vi.mock("@/components/quran/quran-education-panel", () => ({
  QuranEducationPanel: () => null,
}));

import { QuranPagesView } from "./quran-pages-view";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderPagesView() {
  return render(
    <QuranPagesView
      initialSurah={1}
      initialAyah={1}
      onNavigate={vi.fn()}
      isTaskAyah={() => false}
      startAyah={null}
      endAyah={null}
      mode={null}
      liveRecitationAvailable={false}
    />,
  );
}

// Multiple physical Mushaf pages (single/duo/continuous layouts) can mount
// simultaneously; only the first one needs to be exercised for these checks.
function firstTapWordWithRule() {
  fireEvent.click(screen.getAllByTestId("tap-word-with-rule")[0]);
}
function firstTapWordWithoutRule() {
  fireEvent.click(screen.getAllByTestId("tap-word-without-rule")[0]);
}

describe("QuranPagesView word Tajweed action", () => {
  it("shows the Tajweed action only for a word with a documented, verified rule", async () => {
    renderPagesView();

    await waitFor(() => expect(screen.getAllByTestId("mushaf-page").length).toBeGreaterThan(0));
    firstTapWordWithRule();
    await waitFor(() => {
      expect(screen.getByTestId("word-action-tajweed")).toBeTruthy();
    });
    expect(screen.getByTestId("word-action-pronounce")).toBeTruthy();
    expect(screen.getByTestId("word-action-meaning")).toBeTruthy();
    expect(screen.getByTestId("word-action-translation")).toBeTruthy();
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
