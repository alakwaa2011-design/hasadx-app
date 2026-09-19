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
    selectedVerseKey,
    playingVerseKey,
  }: {
    selectedVerseKey: string | null;
    playingVerseKey: string | null;
  }) => (
    <div
      data-testid="mushaf-page"
      data-selected-verse={selectedVerseKey ?? ""}
      data-playing-verse={playingVerseKey ?? ""}
    />
  ),
}));

vi.mock("@/components/quran/quran-guided-memorization-panel", () => ({
  QuranGuidedMemorizationPanel: () => null,
}));

vi.mock("@/components/quran/quran-audio-player", () => ({
  QuranAudioPlayer: ({
    selectedAyah,
    onPlayingAyahChange,
    onAudibleAyahChange,
    onIsPlayingChange,
    onPlaybackLocationChange,
    onClose,
    showTafsirRestore,
    onShowTafsir,
  }: {
    selectedAyah: number;
    onPlayingAyahChange: (ayah: number) => void;
    onAudibleAyahChange: (surah: number, ayah: number | null) => void;
    onIsPlayingChange: (playing: boolean) => void;
    onPlaybackLocationChange: (surah: number, ayah: number) => void;
    onClose: () => void;
    showTafsirRestore?: boolean;
    onShowTafsir?: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          onPlayingAyahChange(selectedAyah);
          onIsPlayingChange(true);
          onAudibleAyahChange(1, selectedAyah);
        }}
      >
        تشغيل الآية
      </button>
      <button type="button" onClick={() => {
        onPlayingAyahChange(selectedAyah + 1);
      }}>
        الآية التالية
      </button>
      <button type="button" onClick={() => onAudibleAyahChange(1, selectedAyah + 1)}>
        بدأ صوت الآية التالية
      </button>
      <button type="button" onClick={() => {
        onPlaybackLocationChange(2, 1);
      }}>
        السورة التالية
      </button>
      <button type="button" onClick={() => onAudibleAyahChange(2, 1)}>
        بدأ صوت السورة التالية
      </button>
      <button type="button" onClick={onClose}>
        إغلاق المشغل
      </button>
      {showTafsirRestore && (
        <button type="button" aria-label="إظهار التفسير" onClick={onShowTafsir}>
          تفسير
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/quran/quran-education-panel", () => ({
  QuranEducationPanel: ({
    selection,
    locked,
    onToggleLock,
    onHide,
  }: {
    selection: { verseKey: string };
    locked: boolean;
    onToggleLock: () => void;
    onHide: () => void;
  }) => (
    <section aria-label="لوحة التفسير">
      <output data-testid="tafsir-verse">{selection.verseKey}</output>
      <button type="button" aria-pressed={locked} onClick={onToggleLock}>
        {locked ? "فتح القفل" : "قفل التفسير"}
      </button>
      <button type="button" onClick={onHide}>إخفاء التفسير</button>
    </section>
  ),
}));

import { QuranPagesView } from "./quran-pages-view";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("QuranPagesView tafsir playback following", () => {
  it("follows playback, stays fixed while locked, resyncs when unlocked, and resets on close", async () => {
    render(
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

    await waitFor(() => expect(screen.getByTestId("button-mobile-audio")).toBeTruthy());
    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    fireEvent.click(screen.getByRole("button", { name: "تشغيل الآية" }));

    await waitFor(() => expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:1"));

    fireEvent.click(screen.getByRole("button", { name: "الآية التالية" }));
    for (const page of screen.getAllByTestId("mushaf-page")) {
      expect(page.getAttribute("data-selected-verse")).toBe("1:1");
      expect(page.getAttribute("data-playing-verse")).toBe("1:1");
    }
    expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:1");

    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت الآية التالية" }));
    await waitFor(() => expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:2"));

    fireEvent.click(screen.getByRole("button", { name: "قفل التفسير" }));
    expect(screen.getByRole("button", { name: "فتح القفل" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "السورة التالية" }));
    expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:2");
    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت السورة التالية" }));

    fireEvent.click(screen.getByRole("button", { name: "فتح القفل" }));
    await waitFor(() => expect(screen.getByTestId("tafsir-verse").textContent).toBe("2:1"));

    fireEvent.click(screen.getByRole("button", { name: "قفل التفسير" }));
    fireEvent.click(screen.getByRole("button", { name: "إغلاق المشغل" }));
    expect(screen.queryByLabelText("لوحة التفسير")).toBeNull();

    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    fireEvent.click(screen.getByRole("button", { name: "تشغيل الآية" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "قفل التفسير" }).getAttribute("aria-pressed")).toBe("false"));
  });

  it("keeps tafsir hidden across ayah interactions until the user shows it again", async () => {
    render(
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

    await waitFor(() => expect(screen.getByTestId("button-mobile-audio")).toBeTruthy());
    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    fireEvent.click(screen.getByRole("button", { name: "تشغيل الآية" }));
    await waitFor(() => expect(screen.getByLabelText("لوحة التفسير")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "إخفاء التفسير" }));
    expect(screen.queryByLabelText("لوحة التفسير")).toBeNull();
    expect(window.localStorage.getItem("quran-education-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "الآية التالية" }));
    fireEvent.click(screen.getByRole("button", { name: "بدأ صوت الآية التالية" }));
    expect(screen.queryByLabelText("لوحة التفسير")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "إظهار التفسير" }));
    await waitFor(() => expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:2"));
    expect(window.localStorage.getItem("quran-education-hidden")).toBeNull();
  });
});