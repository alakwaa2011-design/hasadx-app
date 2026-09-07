import { test, expect, type Page } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";
import { migrateKidsSchema, seedKidsCatalogV1 } from "../../../api-server/src/kids-catalog.ts";
import { newApi, attachSession } from "./helpers";

test.setTimeout(120_000);

type KidsMediaActivity = {
  id: number;
  slug: string;
  title: string;
  assetKey: string;
  content: unknown;
  media: CatalogMedia[];
};

type MediaKind = "image" | "audio" | "video";
type CatalogMedia = {
  kind: MediaKind;
  assetKey: string;
  source: string;
};

type KidsMediaFixture = {
  studentId: number;
  profileId: number;
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
      SELECT id, slug, title_ar, asset_key, content
      FROM kids_activities
      WHERE is_published = TRUE
      ORDER BY id
    `);
    const rows = activityResult.rows as Array<{
      id: number;
      slug: string;
      title_ar: string;
      asset_key: string;
      content: unknown;
    }>;
    if (rows.length === 0) throw new Error("The published Kids activity catalog is empty");

    const activities: KidsMediaActivity[] = rows.map((row) => ({
      id: Number(row.id),
      slug: row.slug,
      title: row.title_ar,
      assetKey: row.asset_key,
      content: row.content,
      media: collectCatalogMedia({
        slug: row.slug,
        assetKey: row.asset_key,
        content: row.content,
      }),
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

    return { studentId: student.id, profileId, cookieHeader, activities };
  } finally {
    await api.dispose();
  }
}

function assertApprovedAssetKey(assetKey: unknown, source: string): string {
  if (typeof assetKey !== "string" || !/^kids\/[a-z0-9][a-z0-9/_-]*$/.test(assetKey)) {
    throw new Error(`Unapproved Kids asset origin at ${source}: ${JSON.stringify(assetKey)}`);
  }
  return assetKey;
}

function collectCatalogMedia(
  activity: Pick<KidsMediaActivity, "slug" | "assetKey" | "content">,
): CatalogMedia[] {
  const media: CatalogMedia[] = [{
    kind: "image",
    assetKey: assertApprovedAssetKey(activity.assetKey, `${activity.slug}.asset_key`),
    source: `${activity.slug}.asset_key`,
  }];

  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    if ("kind" in record || "assetKey" in record) {
      const kind = record.kind;
      if (kind !== "image" && kind !== "audio" && kind !== "video") {
        throw new Error(`Unsupported Kids media kind at ${path}: ${JSON.stringify(kind)}`);
      }
      media.push({
        kind,
        assetKey: assertApprovedAssetKey(record.assetKey, `${path}.assetKey`),
        source: path,
      });
    }
    Object.entries(record).forEach(([key, entry]) => visit(entry, `${path}.${key}`));
  };

  visit(activity.content, `${activity.slug}.content`);
  return media;
}

async function assertLoadedImages(page: Page, activity: KidsMediaActivity): Promise<void> {
  const expected = activity.media.filter((item) => item.kind === "image");
  await expect(page.getByText("الأصل غير معتمد", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/تعذر تحميل الصورة|تعذر تحميل الصوت|تعذر تحميل الفيديو/)).toHaveCount(0);

  await expect(page.locator("img"), `${activity.slug} must render every catalog image`).toHaveCount(expected.length);
  await expect
    .poll(
      () =>
        page.locator("img").evaluateAll((images) =>
          images.length > 0 &&
          images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
        ),
      {
        timeout: 15_000,
        message: `Could not decode images for ${activity.slug}: ${expected.map((item) => item.source).join(", ")}`,
      },
    )
    .toBe(true);
}

async function assertPlayableAudio(page: Page, activity: KidsMediaActivity): Promise<void> {
  const expected = activity.media.filter((item) => item.kind === "audio");
  const audios = page.locator("audio");
  const audioCount = await audios.count();
  expect(audioCount, `${activity.slug} must render every catalog audio`).toBe(expected.length);

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
        { timeout: 15_000, message: `Could not decode audio ${expected[index]?.source}` },
      )
      .toBe(true);

    const playButton = page.getByRole("button", { name: "تشغيل الصوت" }).nth(index);
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

async function assertPlayableVideo(page: Page, activity: KidsMediaActivity): Promise<void> {
  const expected = activity.media.filter((item) => item.kind === "video");
  const videos = page.locator("video");
  const videoCount = await videos.count();
  expect(videoCount, `${activity.slug} must render every catalog video`).toBe(expected.length);

  for (let index = 0; index < videoCount; index += 1) {
    const video = videos.nth(index);
    await expect
      .poll(
        () =>
          video.evaluate((element) =>
            element.readyState >= HTMLMediaElement.HAVE_METADATA &&
            Number.isFinite(element.duration) &&
            element.duration > 0 &&
            element.videoWidth > 0 &&
            element.videoHeight > 0,
          ),
        { timeout: 15_000, message: `Could not decode video ${expected[index]?.source}` },
      )
      .toBe(true);
  }
}

async function openActivityFromDailyJourney(
  page: Page,
  activity: KidsMediaActivity,
): Promise<void> {
  if (!fixture) throw new Error("Kids media fixture is unavailable");
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    `UPDATE kids_daily_adventures
     SET activity_ids = $1::jsonb, completed_ids = '[]'::jsonb
     WHERE profile_id = $2 AND adventure_date = $3`,
    [JSON.stringify([activity.id]), fixture.profileId, today],
  );
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
  test("loads and decodes every published activity asset in the child's daily journey", async ({
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
      const activityFailures: string[] = [];
      const failureOffset = mediaFailures.length;
      await openActivityFromDailyJourney(page, activity);
      await assertLoadedImages(page, activity);
      await assertPlayableAudio(page, activity);
      await assertPlayableVideo(page, activity);

      await expect(page.getByText("الأصل غير معتمد", { exact: true })).toHaveCount(0);
      await expect(page.getByText(/تعذر تحميل الصورة|تعذر تحميل الصوت|تعذر تحميل الفيديو/)).toHaveCount(0);

      activityFailures.push(...mediaFailures.slice(failureOffset));
      expect(
        activityFailures,
        `${activity.slug} has invalid media network responses:\n${activityFailures.join("\n")}`,
      ).toEqual([]);
    }

    expect(mediaFailures, "the browser must not report a failed image, audio, or video request").toEqual([]);
  });
});