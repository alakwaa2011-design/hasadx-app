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
  QuranMadaniPageRenderer: () => <div data-testid="mushaf-page" />,
}));

vi.mock("@/components/quran/quran-guided-memorization-panel", () => ({
  QuranGuidedMemorizationPanel: () => null,
}));

vi.mock("@/components/quran/quran-audio-player", () => ({
  QuranAudioPlayer: ({
    selectedAyah,
    onPlayingAyahChange,
    onIsPlayingChange,
    onPlaybackLocationChange,
    onClose,
  }: {
    selectedAyah: number;
    onPlayingAyahChange: (ayah: number) => void;
    onIsPlayingChange: (playing: boolean) => void;
    onPlaybackLocationChange: (surah: number, ayah: number) => void;
    onClose: () => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          onPlayingAyahChange(selectedAyah);
          onIsPlayingChange(true);
        }}
      >
        تشغيل الآية
      </button>
      <button type="button" onClick={() => onPlayingAyahChange(selectedAyah + 1)}>
        الآية التالية
      </button>
      <button type="button" onClick={() => onPlaybackLocationChange(2, 1)}>
        السورة التالية
      </button>
      <button type="button" onClick={onClose}>
        إغلاق المشغل
      </button>
    </div>
  ),
}));

vi.mock("@/components/quran/quran-education-panel", () => ({
  QuranEducationPanel: ({
    selection,
    locked,
    onToggleLock,
  }: {
    selection: { verseKey: string };
    locked: boolean;
    onToggleLock: () => void;
  }) => (
    <section aria-label="لوحة التفسير">
      <output data-testid="tafsir-verse">{selection.verseKey}</output>
      <button type="button" aria-pressed={locked} onClick={onToggleLock}>
        {locked ? "فتح القفل" : "قفل التفسير"}
      </button>
    </section>
  ),
}));

import { QuranPagesView } from "./quran-pages-view";

afterEach(() => cleanup());

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
    await waitFor(() => expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:2"));

    fireEvent.click(screen.getByRole("button", { name: "قفل التفسير" }));
    expect(screen.getByRole("button", { name: "فتح القفل" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "السورة التالية" }));
    expect(screen.getByTestId("tafsir-verse").textContent).toBe("1:2");

    fireEvent.click(screen.getByRole("button", { name: "فتح القفل" }));
    await waitFor(() => expect(screen.getByTestId("tafsir-verse").textContent).toBe("2:1"));

    fireEvent.click(screen.getByRole("button", { name: "قفل التفسير" }));
    fireEvent.click(screen.getByRole("button", { name: "إغلاق المشغل" }));
    expect(screen.queryByLabelText("لوحة التفسير")).toBeNull();

    fireEvent.click(screen.getByTestId("button-mobile-audio"));
    fireEvent.click(screen.getByRole("button", { name: "تشغيل الآية" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "قفل التفسير" }).getAttribute("aria-pressed")).toBe("false"));
  });
});