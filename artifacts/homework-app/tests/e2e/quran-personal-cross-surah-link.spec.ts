import { devices, expect, test, type Page } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";

test.setTimeout(180_000);

const password = "QuranIsolation123!";
const reciter = 7;
const duration = 3.2;
const boundary = {
  112: { start: 0.3, end: 0.9 },
  113: { start: 0.45, end: 1.2 },
} as const;

function chapterWav(): Buffer {
  const rate = 8_000;
  const samples = Math.floor(rate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    wav.writeInt16LE(Math.round(2400 * Math.sin(2 * Math.PI * 440 * i / rate)), 44 + i * 2);
  }
  return wav;
}

async function installChapterAudio(page: Page) {
  const wav = chapterWav();
  const context = page.context();
  await context.route("**/api/quran/reciters", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      reciters: [{ id: reciter, name: "قارئ الاختبار", style: "Murattal" }],
      preferredRecitationId: reciter,
    }),
  }));
  await context.route("**/api/quran/audio/**", route => {
    const path = new URL(route.request().url()).pathname;
    const match = path.match(/\/audio\/\d+\/(112|113)\/(\d+)\/timings$/);
    if (!match) throw new Error(`Unexpected audio request: ${path}`);
    const surah = Number(match[1]) as 112 | 113;
    const ayah = Number(match[2]);
    if (ayah !== (surah === 112 ? 4 : 1)) throw new Error(`Playback escaped linked range: ${path}`);
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        synchronized: true,
        audioUrl: `/e2e-quran/link-${surah}.wav`,
        verseStartMs: boundary[surah].start * 1000,
        verseEndMs: boundary[surah].end * 1000,
        segments: [],
      }),
    });
  });
  await context.route("**/e2e-quran/link-*.wav", route => route.fulfill({
    contentType: "audio/wav",
    headers: { "Accept-Ranges": "bytes", "Cache-Control": "no-store" },
    body: wav,
  }));
}

async function openPersonalPlan(page: Page) {
  const tips = page.getByTestId("quran-reader-tips");
  if (await tips.isVisible()) await tips.getByRole("button", { name: "تخطي التعليمات" }).click();
  await page.getByTestId("button-mobile-memo-session").click();
  await page.getByTestId("button-open-personal-plan").click();
  await expect(page.getByTestId("quran-personal-plan-panel")).toBeVisible();
}

// Record actual media-clock entry into each ayah, not changes to the requested
// label: the latter can advance before the new chapter becomes audible.
async function observePasses(page: Page) {
  await page.locator("audio").evaluate((audio: HTMLAudioElement, timings) => {
    const win = window as Window & {
      __linkedAyahEvents?: string[];
      __stopLinkedAyahObserver?: () => void;
    };
    win.__stopLinkedAyahObserver?.();
    win.__linkedAyahEvents = [];
    let previous = "";
    const onTimeUpdate = () => {
      const surah = audio.src.match(/link-(112|113)\.wav/)?.[1];
      const windowForAyah = surah === "112" ? timings["112"] : surah === "113" ? timings["113"] : null;
      const inAyah = windowForAyah
        && audio.currentTime >= windowForAyah.start + 0.1
        && audio.currentTime < windowForAyah.end;
      const key = inAyah ? (surah === "112" ? "112:4" : "113:1") : "";
      // The previous listening step may still be finishing 113:1 when the
      // learner selects Link. Count only complete passes starting at 112:4.
      if (key && key !== previous && (win.__linkedAyahEvents!.length > 0 || key === "112:4")) {
        win.__linkedAyahEvents!.push(key);
      }
      if (key) previous = key;
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    win.__stopLinkedAyahObserver = () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, boundary);
}

async function expectThreePasses(page: Page) {
  const events = () => page.evaluate(() =>
    (window as Window & { __linkedAyahEvents?: string[] }).__linkedAyahEvents ?? []);
  await expect.poll(events, { timeout: 25_000 }).toEqual([
    "112:4", "113:1", "112:4", "113:1", "112:4", "113:1",
  ]);
  await expect.poll(() => page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.paused))
    .toBe(true);
  const state = await page.locator("audio").evaluate((audio: HTMLAudioElement) => ({
    paused: audio.paused, time: audio.currentTime, duration: audio.duration, src: audio.src,
  }));
  expect(state.paused).toBe(true);
  expect(state.src).toContain("link-113.wav");
  // Chapter 113 has audio beyond ayah 1: stopping at the WAV's end is a false pass.
  expect(state.time).toBeGreaterThanOrEqual(boundary[113].end);
  expect(state.time).toBeLessThan(state.duration - 1);
  await page.waitForTimeout(450);
  expect(await events()).toHaveLength(6);
}

test("personal link repeats 112:4 → 113:1 three times and resumes after reload and same-page close", async ({
  browser,
}) => {
  if (!process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_ISOLATED !== "1"
    || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Personal Quran browser fixtures require isolated TEST_DATABASE_URL");
  }
  const email = `quran-link-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const teacher = await pool.query(
    `INSERT INTO teachers(name, email, password_hash, email_verified)
     VALUES ($1, $2, $3, true) RETURNING id`,
    ["Quran link browser fixture", email, "$2b$10$kH8yOb76hIhYOS5qMaRxW.QYeVKm05nDD/34lKSBVXN2270B.vZAS"],
  );
  const context = await browser.newContext({
    ...devices["Pixel 5"],
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  try {
    const login = await context.request.post("/api/auth/login", { data: { email, password } });
    expect(login.ok(), await login.text()).toBe(true);
    await installChapterAudio(page);
    await page.goto("/teacher/quran-reader/112?ayah=4");
    await openPersonalPlan(page);
    await expect(page.getByTestId("form-personal-plan")).toBeVisible();
    await page.getByTestId("select-personal-plan-start-surah").selectOption("112");
    await page.getByTestId("select-personal-plan-start-ayah").selectOption("4");
    await page.getByTestId("select-personal-plan-end-surah").selectOption("113");
    await page.getByTestId("select-personal-plan-end-ayah").selectOption("1");
    await page.getByTestId("input-personal-plan-daily-goal").fill("2");
    await page.getByTestId("button-save-personal-plan").click();
    await page.getByTestId("button-start-next-personal-ayah").click();
    await page.getByRole("button", { name: "الانتقال إلى خطوة قيّم" }).click();
    await page.getByRole("button", { name: "أتقنتها" }).click();
    await expect(page.getByTestId("quran-guided-memorization-panel")).toContainText("الآية 1");

    await observePasses(page);
    await page.getByRole("button", { name: "الانتقال إلى خطوة اربط" }).click();
    await expect(page.getByTestId("quran-guided-memorization-panel")).toContainText("اربط الآيات");
    await expectThreePasses(page);

    await page.reload();
    await openPersonalPlan(page);
    await expect(page.getByTestId("button-resume-personal-session")).toBeVisible();
    await page.getByTestId("button-resume-personal-session").click();
    await expect(page.getByTestId("quran-guided-memorization-panel")).toContainText("اربط الآيات");
    await observePasses(page);
    await page.getByTestId("button-guided-play-pause").click();
    await expectThreePasses(page);

    await page.getByRole("button", { name: "إغلاق جلسة الحفظ" }).click();
    await expect(page.getByTestId("quran-guided-memorization-panel")).toHaveCount(0);
    await openPersonalPlan(page);
    await page.getByTestId("button-resume-personal-session").click();
    await observePasses(page);
    await page.getByTestId("button-guided-play-pause").click();
    await expectThreePasses(page);
  } finally {
    await context.close();
    await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.rows[0].id]);
  }
});