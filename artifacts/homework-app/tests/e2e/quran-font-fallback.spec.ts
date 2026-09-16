import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { pool } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi } from "./helpers";

test.setTimeout(120_000);

const TEST_PAGES = [1, 300, 604] as const;

type StudentFixture = {
  accountId: number;
  cookieHeader: string;
};

let fixture: StudentFixture | undefined;

async function registerStudent(baseURL: string): Promise<StudentFixture> {
  const api = await newApi(baseURL);
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const response = await api.post("/api/student-auth/register", {
    data: {
      username: `quranfont${suffix}`,
      displayName: `طالب اختبار خط المصحف ${suffix}`,
      password: "QuranFont123!",
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
  await api.dispose();

  return { accountId: Number(body.student.id), cookieHeader };
}

async function openStudentMushaf(
  page: Page,
  context: BrowserContext,
  baseURL: string,
) {
  if (!fixture) throw new Error("Quran font fixture is unavailable");
  await attachSession(context, baseURL, {
    id: fixture.accountId,
    email: "",
    password: "",
    cookieHeader: fixture.cookieHeader,
  });
  await page.goto("/student/quran-practice/1?view=pages");
}

async function choosePage(page: Page, pageNumber: number) {
  await page.getByLabel("اختيار الصفحة").selectOption(String(pageNumber));
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  if (
    !process.env.TEST_DATABASE_URL
    || process.env.E2E_DATABASE_ISOLATED !== "1"
    || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
  ) {
    throw new Error("Quran font E2E fixtures require the isolated TEST_DATABASE_URL");
  }

  fixture = await registerStudent(baseURL);
});

test.afterAll(async () => {
  if (!fixture) return;
  await pool.query("DELETE FROM student_accounts WHERE id = $1", [fixture.accountId]);
});

test("uses page images only after local and CDN fonts all fail", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL is required");

  await context.route(/\.woff2(?:\?.*)?$/, (route) => route.abort());
  await openStudentMushaf(page, context, baseURL);

  for (const pageNumber of TEST_PAGES) {
    await choosePage(page, pageNumber);
    await expect(page.getByTestId(`quran-page-fallback-${pageNumber}`).filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId(`quran-page-qcf-${pageNumber}`)).toHaveCount(0);
  }
});

test("uses local QCF V2 glyphs when the Quran Foundation font network is blocked", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("baseURL is required");

  const localFontRequests = new Set<number>();
  await context.route(
    /https:\/\/(?:verses\.quran\.foundation|static\.qurancdn\.com)\/.*\.woff2(?:\?.*)?$/,
    (route) => route.abort(),
  );
  page.on("response", (response) => {
    const match = new URL(response.url()).pathname.match(/\/quran\/qcf-v2\/p(\d+)\.woff2$/);
    if (match && response.ok()) localFontRequests.add(Number(match[1]));
  });

  await openStudentMushaf(page, context, baseURL);

  for (const pageNumber of TEST_PAGES) {
    await choosePage(page, pageNumber);
    await expect(page.getByTestId(`quran-page-qcf-${pageNumber}`).filter({ visible: true })).toBeVisible();
    await expect(page.getByTestId(`quran-page-fallback-${pageNumber}`)).toHaveCount(0);
    await expect.poll(() => localFontRequests.has(pageNumber)).toBe(true);
  }
});