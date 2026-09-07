import { test, expect, type Page } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";
import { migrateKidsSchema, seedKidsCatalogV1 } from "../../../api-server/src/kids-catalog.ts";
import { newApi, attachSession } from "./helpers";

test.setTimeout(120_000);

type KidsMediaActivity = {
  id: number;
  slug: "english-sound-a" | "numbers-choose-zero";
  title: string;
  choice: "A" | "0";
};

type KidsMediaFixture = {
  studentId: number;
  cookieHeader: string;
  activities: KidsMediaActivity[];
};

let fixture: KidsMediaFixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createKidsMediaFixture(baseURL: string): Promise<KidsMediaFixture> {
  // Keep this guard close to the fixture because this test writes and deletes
  // records. playwright.config.ts also enforces the same contract before the
  // worker starts the API and Vite servers.
  if (
    !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Kids media E2E fixtures require the isolated TEST_DATABASE_URL");
  }

  await migrateKidsSchema();
  await seedKidsCatalogV1();

  const suffix = uniqueSuffix();
  const username = `e2ekids${suffix}`;
  const password = "KidsTest123!";
  const api = await newApi(baseURL);

  try {
    const registration = await api.post("/api/student-auth/register", {
      data: {
        username,
        displayName: `طفل اختبار ${suffix}`,
        password,
      },
    });
    if (!registration.ok()) {
      throw new Error(`Could not create the test child: ${registration.status()} ${await registration.text()}`);
    }

    const student = (await registration.json()).student as { id: number };
    const cookieHeader = registration
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value)
      .map((line) => line.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("Child registration did not establish a session");

    const activityResult = await pool.query(`
      SELECT id, slug, title_ar
      FROM kids_activities
      WHERE slug IN ('english-sound-a', 'numbers-choose-zero')
      ORDER BY CASE slug
        WHEN 'english-sound-a' THEN 1
        WHEN 'numbers-choose-zero' THEN 2
      END
    `);
    const rows = activityResult.rows as Array<{ id: number; slug: string; title_ar: string }>;
    if (rows.length !== 2) throw new Error("The seeded Kids media activities are unavailable");

    const activities: KidsMediaActivity[] = rows.map((row) => ({
      id: Number(row.id),
      slug: row.slug as KidsMediaActivity["slug"],
      title: row.title_ar,
      choice: row.slug === "english-sound-a" ? "A" : "0",
    }));

    const profileResult = await pool.query(
      `INSERT INTO kids_profiles(student_account_id, display_name, avatar_key, age_band, locale)
       VALUES ($1, $2, 'kids/avatars/star', '4-5', 'ar')
       RETURNING id`,
      [student.id, `طفل اختبار ${suffix}`],
    );
    const profileId = Number(profileResult.rows[0]?.id);
    if (!profileId) throw new Error("Could not create the test child's Kids profile");

    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO kids_daily_adventures(profile_id, adventure_date, activity_ids, completed_ids)
       VALUES ($1, $2, $3::jsonb, '[]'::jsonb)
       ON CONFLICT (profile_id, adventure_date)
       DO UPDATE SET activity_ids = EXCLUDED.activity_ids, completed_ids = '[]'::jsonb,
         started_at = NULL, completed_at = NULL`,
      [profileId, today, JSON.stringify(activities.map((activity) => activity.id))],
    );

    return { studentId: student.id, cookieHeader, activities };
  } finally {
    await api.dispose();
  }
}

async function assertLoadedImages(page: Page): Promise<void> {
  await expect(page.getByText("الأصل غير معتمد", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/تعذر تحميل الصورة|تعذر تحميل الصوت/)).toHaveCount(0);

  await expect
    .poll(
      () =>
        page.locator("img").evaluateAll((images) =>
          images.length > 0 &&
          images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

async function assertPlayableAudio(page: Page): Promise<void> {
  const audios = page.locator("audio");
  const audioCount = await audios.count();
  expect(audioCount, "every media activity should render its audio element").toBeGreaterThan(0);

  for (let index = 0; index < audioCount; index += 1) {
    const audio = audios.nth(index);
    await expect
      .poll(
        () =>
          audio.evaluate((element) =>
            element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA &&
            Number.isFinite(element.duration) &&
            element.duration > 0,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const playButton = page.getByRole("button", { name: "تشغيل الصوت" });
    await expect(playButton).toBeEnabled();
    await playButton.click();
    await expect
      .poll(
        () =>
          audio.evaluate(
            (element) => !element.paused || (element.ended && element.currentTime > 0),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  }
}

async function openActivityFromDailyJourney(
  page: Page,
  activity: KidsMediaActivity,
): Promise<void> {
  await page.goto("/kids/adventure");
  await expect(page.getByRole("heading", { name: "رحلة التعلم", exact: true })).toBeVisible({
    timeout: 20_000,
  });

  const activityLink = page.locator(`a[href="/kids/activity/${activity.id}"]`);
  await expect(activityLink).toBeVisible({ timeout: 15_000 });
  await activityLink.getByRole("button").click();
  await expect(page).toHaveURL(new RegExp(`/kids/activity/${activity.id}$`));
  await expect(page.getByRole("heading", { name: activity.title, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  fixture = await createKidsMediaFixture(baseURL);
});

test.beforeEach(async ({ context, baseURL }) => {
  if (!fixture || !baseURL) throw new Error("Kids media fixture is unavailable");
  await attachSession(context, baseURL, {
    id: fixture.studentId,
    email: "",
    password: "",
    cookieHeader: fixture.cookieHeader,
  });
});

test.afterAll(async () => {
  try {
    if (fixture) {
      await pool.query("DELETE FROM student_accounts WHERE id = $1", [fixture.studentId]);
    }
  } finally {
    await pool.end();
  }
});

test.describe("Kids daily media journey", () => {
  test("loads every image and plays every audio asset in the child's daily journey", async ({
    page,
  }) => {
    if (!fixture) throw new Error("Kids media fixture is unavailable");

    const mediaFailures: string[] = [];
    page.on("response", (response) => {
      const resourceType = response.request().resourceType();
      if ((resourceType === "image" || resourceType === "media") && !response.ok()) {
        mediaFailures.push(`${resourceType} ${response.status()} ${response.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      if (request.resourceType() === "image" || request.resourceType() === "media") {
        mediaFailures.push(`${request.resourceType()} ${request.failure()?.errorText ?? "request failed"} ${request.url()}`);
      }
    });

    for (const activity of fixture.activities) {
      await openActivityFromDailyJourney(page, activity);
      await assertLoadedImages(page);
      await assertPlayableAudio(page);

      await expect(page.getByText("الأصل غير معتمد", { exact: true })).toHaveCount(0);
      await expect(page.getByText(/تعذر تحميل الصورة|تعذر تحميل الصوت/)).toHaveCount(0);

      const correctChoice = page
        .getByText(activity.choice, { exact: true })
        .locator("xpath=ancestor::button");
      await expect(correctChoice).toBeVisible();
      await correctChoice.click();
      await expect(page).toHaveURL(/\/kids\/activity\/\d+\/complete$/, { timeout: 15_000 });
    }

    expect(mediaFailures, "the browser must not report a failed image or audio request").toEqual([]);
  });
});