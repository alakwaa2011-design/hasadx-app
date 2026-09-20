// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scrollIntoView = vi.fn();
let nextAudioPlayerInstance = 0;

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/quran-reader/2", vi.fn()],
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

vi.mock("@workspace/api-client-react", () => ({
  getGetQuranJourneyQueryKey: () => ["quran-journey"],
  getGetQuranSurahContentQueryKey: (surah: number) => ["quran-surah", surah],
  getGetCurrentTeacherQueryKey: () => ["current-teacher"],
  useGetCurrentTeacher: () => ({ data: null }),
  useGetQuranSurahContent: () => ({ data: { ayahs: [] }, isFetching: false }),
  useRecordMyQuranIndependentSession: () => ({ mutateAsync: vi.fn() }),
  useUpdateMyQuranIndependentPosition: () => ({ mutate: vi.fn() }),
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
    pageNumber,
    selectedVerseKey,
    playingVerseKey,
  }: {
    pageNumber: number;
    selectedVerseKey: string | null;
    playingVerseKey: string | null;
  }) => (
    <div
      data-testid={`mushaf-page-${pageNumber}`}
      data-selected-verse={selectedVerseKey ?? ""}
      data-playing-verse={playingVerseKey ?? ""}
    >
      {pageNumber === 2 && <span data-verse-key="2:5">الآية الخامسة</span>}
      {pageNumber === 49 && <span data-verse-key="2:286">آخر آية من البقرة</span>}
      {pageNumber === 50 && (
        <span
          data-verse-key="3:1"
          ref={(element) => {
            if (element) element.scrollIntoView = scrollIntoView;
          }}
        >
          أول آية من آل عمران
        </span>
      )}
      {pageNumber === 3 && (
        <span
          data-verse-key="2:6"
          ref={(element) => {
            if (element) {
              element.scrollIntoView = scrollIntoView;
              element.getBoundingClientRect = () => ({
                x: 0,
                y: 900,
                top: 900,
                right: 100,
                bottom: 940,
                left: 0,
                width: 100,
                height: 40,
                toJSON: () => ({}),
              });
            }
          }}
        >
          الآية السادسة
        </span>
      )}
    </div>
  ),
}));

vi.mock("@/components/quran/quran-guided-memorization-panel", () => ({
  QuranGuidedMemorizationPanel: () => null,
}));

vi.mock("@/components/quran/quran-education-panel", () => ({
  QuranEducationPanel: () => null,
}));

vi.mock("@/components/quran/quran-audio-player", () => ({
  QuranAudioPlayer: ({
    selectedAyah,
    isPlaying,
    onIsPlayingChange,
    onPlayingAyahChange,
    onAudibleAyahChange,
    onPlaybackLocationChange,
    surahNumber,
  }: {
    selectedAyah: number;
    isPlaying: boolean;
    onIsPlayingChange: (playing: boolean) => void;
    onPlayingAyahChange: (ayah: number) => void;
    onAudibleAyahChange: (surah: number, ayah: number) => void;
    onPlaybackLocationChange: (surah: number, ayah: number) => void;
    surahNumber: number;
  }) => {
    const [instance] = React.useState(() => ++nextAudioPlayerInstance);
    return (
    <div
      data-testid="audio-player"
      data-playing={String(isPlaying)}
      data-instance={String(instance)}
      data-surah={String(surahNumber)}
    >
      <button
        type="button"
        onClick={() => {
          onPlayingAyahChange(selectedAyah);
          onIsPlayingChange(true);
          onAudibleAyahChange(2, selectedAyah);
        }}
      >
        تشغيل
      </button>
      <button
        type="button"
        onClick={() => {
          onPlayingAyahChange(6);
        }}
      >
        عبور الصفحة
      </button>
      <button
        type="button"
        onClick={() => onAudibleAyahChange(2, 6)}
      >
        بدأ صوت الصفحة الجديدة
      </button>
      <button
        type="button"
        onClick={() => onAudibleAyahChange(2, 5)}
      >
        بدأ تكرار المقطع
      </button>
      <button
        type="button"
        onClick={() => {
          onIsPlayingChange(true);
          onPlaybackLocationChange(3, 1);
          onAudibleAyahChange(3, 1);
        }}
      >
        بدء السورة التالية
      </button>
    </div>
    );
  },
}));

import { QuranPagesView } from "./quran-pages-view";

beforeEach(() => {
  scrollIntoView.mockClear();
  nextAudioPlayerInstance = 0;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe.each([
  ["عرض الصفحة الواحدة", "single"],
  ["العرض المتصل", "continuous"],
] as const)("QuranPagesView playback following in %s", (_label, layout) => {
  it("keeps the audible ayah visible above the playing audio dock across page boundaries and repeats", async () => {
    render(
      <QuranPagesView
        initialSurah={2}
        initialAyah={5}
        initialPage={2}
        onNavigate={vi.fn()}
        isTaskAyah={() => false}
        startAyah={null}
        endAyah={null}
        mode={null}
        liveRecitationAvailable={false}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("button-mobile-audio")).toBeTruthy());
    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("2");
      expect(screen.getByTestId("mushaf-page-2").getAttribute("data-selected-verse")).toBe("2:5");
    });
    fireEvent.change(screen.getByTestId("select-page-layout"), { target: { value: layout } });
    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    fireEvent.click(screen.getByRole("button", { name: "تشغيل" }));
    fireEvent.click(screen.getByRole("button", { name: "عبور الصفحة" }));
    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت الصفحة الجديدة" }));

    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe(
        layout === "continuous" ? "2" : "3",
      );
      expect(screen.getByTestId("mushaf-page-3").getAttribute("data-selected-verse")).toBe("2:6");
      expect(screen.getByTestId("mushaf-page-3").getAttribute("data-playing-verse")).toBe("2:6");
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    });

    const page = screen.getByTestId("mushaf-page-3").closest("[data-quran-page]");
    const dock = screen.getByTestId("audio-player").closest("[data-testid='quran-bottom-dock']");
    expect(page?.compareDocumentPosition(dock as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "بدأ تكرار المقطع" }));
    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("2");
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
    });
    fireEvent.click(screen.getByRole("button", { name: "عبور الصفحة" }));
    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت الصفحة الجديدة" }));

    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe(
        layout === "continuous" ? "2" : "3",
      );
      expect(screen.getByTestId("mushaf-page-3").getAttribute("data-selected-verse")).toBe("2:6");
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("follows playback across a surah and page boundary without reinitializing the player", async () => {
    render(
      <QuranPagesView
        initialSurah={2}
        initialAyah={286}
        initialPage={49}
        onNavigate={vi.fn()}
        isTaskAyah={() => false}
        startAyah={null}
        endAyah={null}
        mode={null}
        liveRecitationAvailable={false}
      />,
    );

    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("49");
      expect(screen.getByTestId("mushaf-page-49").getAttribute("data-selected-verse")).toBe("2:286");
    });
    fireEvent.change(screen.getByTestId("select-page-layout"), { target: { value: layout } });
    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    const playerInstance = screen.getByTestId("audio-player").getAttribute("data-instance");
    fireEvent.click(screen.getByRole("button", { name: "تشغيل" }));
    await waitFor(() => {
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
    });
    fireEvent.click(screen.getByRole("button", { name: "بدء السورة التالية" }));

    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("50");
      expect(screen.getByTestId("mushaf-page-50").getAttribute("data-selected-verse")).toBe("3:1");
      expect(screen.getByTestId("mushaf-page-50").getAttribute("data-playing-verse")).toBe("3:1");
      expect(screen.getByTestId("audio-player").getAttribute("data-surah")).toBe("3");
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
      expect(screen.getByTestId("audio-player").getAttribute("data-instance")).toBe(playerInstance);
    });
  });
});

describe("QuranPagesView playback following in desktop spread view", () => {
  it("moves to the next page pair while keeping repeated audio visible and playing", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });

    render(
      <QuranPagesView
        initialSurah={2}
        initialAyah={5}
        initialPage={2}
        onNavigate={vi.fn()}
        isTaskAyah={() => false}
        startAyah={null}
        endAyah={null}
        mode={null}
        liveRecitationAvailable={false}
      />,
    );

    await waitFor(() => {
      expect((screen.getByTestId("select-page-layout") as HTMLSelectElement).value).toBe("spread");
      expect(screen.getByTestId("mushaf-page-1")).toBeTruthy();
      expect(screen.getAllByTestId("mushaf-page-2").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    fireEvent.click(screen.getByRole("button", { name: "تشغيل" }));
    fireEvent.click(screen.getByRole("button", { name: "عبور الصفحة" }));
    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت الصفحة الجديدة" }));

    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("3");
      expect(screen.getAllByTestId("mushaf-page-3").length).toBeGreaterThan(0);
      expect(screen.getByTestId("mushaf-page-4")).toBeTruthy();
      expect(screen.getAllByTestId("mushaf-page-3").some(
        page => page.getAttribute("data-selected-verse") === "2:6"
          && page.getAttribute("data-playing-verse") === "2:6",
      )).toBe(true);
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    });

    const audiblePage = screen.getAllByTestId("mushaf-page-3").find(
      page => page.getAttribute("data-playing-verse") === "2:6",
    );
    const dock = screen.getByTestId("audio-player").closest("[data-testid='quran-bottom-dock']");
    expect(audiblePage?.closest("[data-quran-page]")?.compareDocumentPosition(dock as Node)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    scrollIntoView.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "بدأ تكرار المقطع" }));
    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("2");
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "عبور الصفحة" }));
    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت الصفحة الجديدة" }));

    await waitFor(() => {
      expect((screen.getByTestId("select-page") as HTMLSelectElement).value).toBe("3");
      expect(screen.getAllByTestId("mushaf-page-3").some(
        page => page.getAttribute("data-selected-verse") === "2:6"
          && page.getAttribute("data-playing-verse") === "2:6",
      )).toBe(true);
      expect(screen.getByTestId("mushaf-page-4")).toBeTruthy();
      expect(screen.getByTestId("audio-player").getAttribute("data-playing")).toBe("true");
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });
});
