import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);

const CHAPTER_RECITER_ID = 7;
const AYAH_RECITER_ID = 1_000_159;

type SourceMode = "chapter" | "ayah";

function createWavFixture(durationSeconds = 1.6): Buffer {
  const sampleRate = 8_000;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 2_500;
    wav.writeInt16LE(Math.round(sample), 44 + index * 2);
  }
  return wav;
}

async function installRecitationFixtures(page: Page, sourceMode: SourceMode) {
  const audio = createWavFixture();
  const requestedAudio: string[] = [];

  await page.route("**/api/quran/reciters", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        reciters: [
          { id: CHAPTER_RECITER_ID, name: "قارئ السورة الكاملة", style: "Murattal" },
          { id: AYAH_RECITER_ID, name: "قارئ ملفات الآيات", style: "Murattal" },
        ],
        preferredRecitationId: sourceMode === "chapter" ? CHAPTER_RECITER_ID : AYAH_RECITER_ID,
      }),
    });
  });

  await page.route("**/api/quran/audio/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requestedAudio.push(path);

    if (path.endsWith("/timings")) {
      if (sourceMode === "ayah") {
        await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
        return;
      }
      const match = path.match(/\/audio\/\d+\/(\d+)\/(\d+)\/timings$/);
      if (!match) throw new Error(`Unexpected Quran timing path: ${path}`);
      const surah = Number(match[1]);
      const ayah = Number(match[2]);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          synchronized: true,
          audioUrl: `/e2e-quran/chapter-${surah}.wav`,
          verseStartMs: ayah === 1 ? 900 : 0,
          verseEndMs: ayah === 1 ? 1_400 : 350,
          segments: [],
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
      body: audio,
    });
  });

  await page.route("**/e2e-quran/*.wav", async (route) => {
    requestedAudio.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
      body: audio,
    });
  });

  return requestedAudio;
}

async function playLastAyah(page: Page, surah: number, lastAyah: number) {
  await page.goto(`/quran/${surah}?ayah=${lastAyah}`);
  await expect(page.getByTestId("select-mobile-surah")).toHaveValue(String(surah));
  await page.getByTestId("button-mobile-audio").click();
  await page.getByTestId("button-play-pause").click();
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => !element.paused))
    .toBe(true);
}

async function expectBoundary(
  page: Page,
  sourceMode: SourceMode,
  fromSurah: number,
  lastAyah: number,
  nextSurah: number,
  nextPage: number,
  expectedName: string,
) {
  const requestedAudio = await installRecitationFixtures(page, sourceMode);
  await playLastAyah(page, fromSurah, lastAyah);

  await expect(page.getByTestId("select-mobile-surah")).toHaveValue(String(nextSurah), {
    timeout: 20_000,
  });
  await expect(page.getByTestId("select-mobile-page")).toHaveValue(String(nextPage));
  await expect(page.getByTestId("select-mobile-surah").locator("..").locator("span").first())
    .toContainText(expectedName);
  await expect(page.getByTestId("text-surah-info")).toContainText("آية 1");
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => !element.paused))
    .toBe(true);

  const state = await page.locator("audio").evaluate((element: HTMLAudioElement) => ({
    currentTime: element.currentTime,
    src: element.src,
  }));
  if (sourceMode === "chapter") {
    expect(state.src).toContain(`/e2e-quran/chapter-${nextSurah}.wav`);
  } else {
    expect(state.src).toContain(`/api/quran/audio/${AYAH_RECITER_ID}/${nextSurah}/1`);
  }

  return { requestedAudio, state };
}

for (const sourceMode of ["chapter", "ayah"] as const) {
  test(`${sourceMode} reciter continues into the next surah without another tap and includes its basmalah`, async ({
    page,
  }) => {
    const { requestedAudio, state } = await expectBoundary(
      page,
      sourceMode,
      1,
      7,
      2,
      2,
      "البقرة",
    );

    if (sourceMode === "chapter") {
      // The first timed ayah starts at 900ms. Remaining before that timestamp
      // proves the chapter introduction (the recorded basmalah) was not skipped.
      expect(state.currentTime).toBeLessThan(0.9);
    }
    expect(requestedAudio.some((path) => path.includes(`/${sourceMode === "chapter" ? CHAPTER_RECITER_ID : AYAH_RECITER_ID}/2/1`)))
      .toBe(true);
  });

  test(`${sourceMode} reciter continues from Al-Anfal to At-Tawbah without a basmalah`, async ({
    page,
  }) => {
    const { state } = await expectBoundary(
      page,
      sourceMode,
      8,
      75,
      9,
      187,
      "التوبة",
    );

    if (sourceMode === "chapter") {
      // At-Tawbah is the exception: playback seeks directly to ayah 1 rather
      // than playing the chapter-introduction window used for a basmalah.
      expect(state.currentTime).toBeGreaterThanOrEqual(0.9);
    }
  });
}