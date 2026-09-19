import { expect, test, type Page } from "@playwright/test";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

const PENDING_RECITATION_ID = 2_000_114;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

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

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-quran-pending-${suffix}@example.com`;
  const otp = "995410";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Quran Pending ${suffix}`,
      email,
      passwordHash: "e2e-quran-pending-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
      preferredQuranRecitationId: 7,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create pending-reciter teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(`Could not verify Quran teacher: ${response.status()} ${await response.text()}`);
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");

    return {
      id: teacher.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };
  } finally {
    await api.dispose();
  }
}

async function installTimingAndAudioFixtures(page: Page): Promise<string[]> {
  const audio = createWavFixture();
  const timingRequests: string[] = [];

  await page.route("**/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.includes("/api/quran/audio/")) {
      await route.continue();
      return;
    }
    if (path.endsWith("/timings")) {
      timingRequests.push(path);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          synchronized: true,
          audioUrl: "/e2e-quran/an-nas-ayah-3.wav",
          verseStartMs: 0,
          verseEndMs: 1_200,
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

  await page.route("**/e2e-quran/an-nas-ayah-3.wav", async (route) => {
    await route.fulfill({
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
      body: audio,
    });
  });

  return timingRequests;
}

test.describe("pending Quran reciter in a real reader session", () => {
  let teacher: TestTeacher | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL
      || process.env.E2E_DATABASE_ISOLATED !== "1"
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Pending-reciter E2E requires the isolated TEST_DATABASE_URL");
    }
    teacher = await createVerifiedTeacher(baseURL);
  });

  test.afterAll(async () => {
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
    await pool.end();
  });

  test("shows the pending reciter only to a reader session and starts An-Nas at ayah 3 after timings load", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    if (!teacher || !baseURL) throw new Error("Pending-reciter fixture is unavailable");

    await attachSession(context, baseURL, teacher);
    const authenticatedCatalog = await page.request.get("/api/quran/reciters");
    expect(authenticatedCatalog.ok()).toBe(true);
    const authenticatedBody = await authenticatedCatalog.json();
    expect(authenticatedBody.reciters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: PENDING_RECITATION_ID,
        name: "صادق النظام",
        available: false,
      }),
    ]));
    const playableRecitationId = authenticatedBody.reciters.find(
      (reciter: { id: number; available?: boolean }) =>
        reciter.available !== false && reciter.id !== 1_000_159,
    )?.id;
    if (!playableRecitationId) throw new Error("Authenticated catalog has no synchronized reciter fixture");

    const guestContext = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const guestPage = await guestContext.newPage();
      const guestCatalog = await guestPage.request.get("/api/quran/reciters");
      expect(guestCatalog.ok()).toBe(true);
      const guestBody = await guestCatalog.json();
      expect(guestBody.reciters).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: PENDING_RECITATION_ID }),
      ]));

      await guestPage.goto("/quran/114?ayah=3");
      await expect(guestPage.getByTestId("button-mobile-audio")).toBeVisible();
      await guestPage.getByTestId("button-mobile-audio").click();
      await guestPage.getByTestId("button-audio-options").click();
      await expect(guestPage.getByTestId(`button-reciter-${PENDING_RECITATION_ID}`)).toHaveCount(0);
    } finally {
      await guestContext.close();
    }

    const readerContext = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    try {
      await attachSession(readerContext, baseURL, teacher);
      const readerPage = await readerContext.newPage();
      const timingRequests = await installTimingAndAudioFixtures(readerPage);
      await readerPage.route("**/api/quran/reciters", async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            reciters: [
              { id: playableRecitationId, name: "قارئ التوقيت", style: "Murattal" },
              { id: PENDING_RECITATION_ID, name: "صادق النظام", style: "Murattal", available: false },
            ],
            preferredRecitationId: playableRecitationId,
          }),
        });
      });
      await readerPage.goto("/quran/114?ayah=3");
      await readerPage.getByTestId("button-mobile-audio").click();
      await expect(readerPage.getByTestId("button-play-pause")).toBeVisible();
      await expect(readerPage.getByTestId("text-surah-info")).toContainText("آية 3");
      await readerPage.getByTestId("button-audio-options").click();

      const pendingReciter = readerPage.getByTestId(`button-reciter-${PENDING_RECITATION_ID}`);
      await expect(pendingReciter).toBeVisible();
      await expect(pendingReciter).toContainText("صادق النظام");
      await expect(pendingReciter).toContainText("قيد التحقق");
      await expect(pendingReciter).toBeDisabled();

      const audioOptions = readerPage.getByTestId("button-audio-options");
      await audioOptions.click({ force: true });
      await expect(audioOptions).toHaveAttribute("aria-expanded", "false");
      await expect(readerPage.getByTestId("panel-settings")).toHaveCount(0);
      const playButton = readerPage.getByTestId("button-play-pause");
      await playButton.click({ force: true });
      await expect(playButton).toHaveAttribute("aria-label", "إيقاف مؤقت");
      await expect.poll(() => timingRequests).toEqual(expect.arrayContaining([
        expect.stringMatching(/\/api\/quran\/audio\/\d+\/114\/3\/timings$/),
      ]));
      await expect.poll(() => readerPage.locator("audio").evaluate((element: HTMLAudioElement) => !element.paused))
        .toBe(true);
    } finally {
      await readerContext.close();
    }
  });
});