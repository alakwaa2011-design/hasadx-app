import { expect, test, type Page, type Route } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi } from "./helpers";

test.setTimeout(120_000);

type Fixture = {
  accountId: number;
  cookieHeader: string;
};

let fixture: Fixture | undefined;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function registerStudent(baseURL: string): Promise<Fixture> {
  const api = await newApi(baseURL);
  const suffix = uniqueSuffix();
  const response = await api.post("/api/student-auth/register", {
    data: {
      username: `quranposition${suffix}`,
      displayName: `طالب موضع القرآن ${suffix}`,
      password: "QuranPosition123!",
    },
  });
  if (!response.ok()) {
    throw new Error(`Could not create student fixture: ${response.status()} ${await response.text()}`);
  }

  const body = await response.json();
  const cookieHeader = response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === "set-cookie")
    .map((header) => header.value.split(";")[0])
    .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
  if (!cookieHeader) throw new Error("Student registration did not establish a session");

  return { accountId: Number(body.student.id), cookieHeader };
}

async function holdJourney(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestSeen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const handler = async (route: Route) => {
    requested();
    await gate;
    await route.continue();
  };
  await page.route("**/api/quran/me/journey", handler);
  return { release, requestSeen, handler };
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  if (
    !process.env.TEST_DATABASE_URL ||
    process.env.E2E_DATABASE_ISOLATED !== "1" ||
    process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Quran position E2E fixtures require the isolated TEST_DATABASE_URL");
  }

  fixture = await registerStudent(baseURL);
  await pool.query(
    `INSERT INTO quran_independent_positions(
       student_account_id, text_surah_number, text_ayah, page_number
     ) VALUES ($1, 2, 5, 42)`,
    [fixture.accountId],
  );
});

test.beforeEach(async () => {
  if (!fixture) return;
  await pool.query(
    "UPDATE quran_independent_positions SET page_number = 42 WHERE student_account_id = $1",
    [fixture.accountId],
  );
});

test.afterAll(async () => {
  if (!fixture) return;
  await pool.query("DELETE FROM student_accounts WHERE id = $1", [fixture.accountId]);
});

test("restores delayed text and page positions before allowing later saves", async ({
  page,
  context,
  baseURL,
}) => {
  if (!fixture || !baseURL) throw new Error("Quran position fixture is unavailable");
  await attachSession(context, baseURL, {
    id: fixture.accountId,
    email: "",
    password: "",
    cookieHeader: fixture.cookieHeader,
  });

  const writes: Array<Record<string, number>> = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === "/api/quran/me/independent-position"
    ) {
      writes.push(request.postDataJSON() as Record<string, number>);
    }
  });

  const textJourney = await holdJourney(page);
  const textNavigation = page.goto("/student/quran-practice/1");
  await textJourney.requestSeen;
  await page.waitForTimeout(300);
  expect(writes).toEqual([]);
  textJourney.release();
  await textNavigation;

  await expect(page.locator("#ayah-5")).toBeVisible();
  await expect(page).toHaveURL(/\/student\/quran-practice\/1$/);
  await expect.poll(() => writes).toContainEqual({ textSurahNumber: 2, textAyah: 5 });
  await page.locator("#ayah-6").click();
  await expect.poll(() => writes).toContainEqual({ textSurahNumber: 2, textAyah: 6 });
  expect(writes).not.toContainEqual({ textSurahNumber: 1, textAyah: 1 });

  await page.unroute("**/api/quran/me/journey", textJourney.handler);
  writes.length = 0;

  const pageJourney = await holdJourney(page);
  const pagesNavigation = page.goto("/student/quran-practice/1?view=pages");
  await pageJourney.requestSeen;
  await page.waitForTimeout(300);
  expect(writes).toEqual([]);
  pageJourney.release();
  await pagesNavigation;

  await expect(page.getByAltText("صفحة المصحف رقم 42")).toBeVisible();
  await expect.poll(() => writes).toContainEqual({ pageNumber: 42 });
  await page.getByRole("button", { name: "الصفحة التالية" }).click();
  await expect.poll(() => writes).toContainEqual({ pageNumber: 44 });
  expect(writes).not.toContainEqual({ pageNumber: 1 });
});

test("page-side clicks turn the Mushaf while Quran words do not", async ({
  page,
  context,
  baseURL,
}) => {
  if (!fixture || !baseURL) throw new Error("Quran position fixture is unavailable");
  await attachSession(context, baseURL, {
    id: fixture.accountId,
    email: "",
    password: "",
    cookieHeader: fixture.cookieHeader,
  });

  await page.goto("/student/quran-practice/1?view=pages");

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("A viewport is required");
  const isDesktopSpread = viewport.width >= 1024;
  const visiblePage = (pageNumber: number, physicalPage = isDesktopSpread ? "left" : "single") => page.locator(
    `[data-testid="quran-mushaf-page"][data-page-number="${pageNumber}"][data-physical-page="${physicalPage}"]`,
  );

  await expect(visiblePage(42)).toBeVisible();
  await visiblePage(42).getByTestId("quran-page-turn-next-zone").click();
  const pageAfterNext = isDesktopSpread ? 44 : 43;
  await expect(visiblePage(pageAfterNext)).toBeVisible();
  await expect(page).toHaveURL(/(?:\?|&)page=43(?:&|$)/);
  await page.reload();
  await expect(visiblePage(pageAfterNext)).toBeVisible();

  const previousPage = isDesktopSpread
    ? visiblePage(43, "right")
    : visiblePage(43);
  await previousPage.getByTestId("quran-page-turn-previous-zone").click();
  const pageAfterPrevious = 42;
  await expect(visiblePage(pageAfterPrevious)).toBeVisible();

  const quranWord = visiblePage(pageAfterPrevious).locator('button[title]').first();
  await expect(quranWord).toBeVisible();
  await quranWord.click();
  await expect(visiblePage(pageAfterPrevious)).toBeVisible();
});