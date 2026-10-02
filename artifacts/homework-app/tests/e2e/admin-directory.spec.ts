import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { db, pool, teachersTable, studentsTable, assignmentsTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const marker = `E2E-DIR-${suffix}`;
const arabicTeacher = "مُعَلِّمُ الْقِمَّة";
const arabicStudent = "طَالِبُ الْقِمَّة";
const oldTitle = `نشاط قديم ${marker}`;
const otp = "996410";
let admin: TestTeacher;
let ordinary: TestTeacher;
let teacherIds: number[] = [];

async function createSessionTeacher(baseURL: string, name: string, email: string, isAdmin: boolean) {
  const [row] = await db.insert(teachersTable).values({
    name, email, passwordHash: "e2e-admin-directory-fixture", verificationOtp: otp,
    otpExpiresAt: new Date(Date.now() + 10 * 60_000), emailVerified: false,
    isAdmin, role: isAdmin ? "admin" : "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Unable to create E2E directory account");
  teacherIds.push(row.id);
  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp } });
    if (!response.ok()) throw new Error(`OTP session failed: ${response.status()} ${await response.text()}`);
    const cookieHeader = response.headersArray()
      .filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value.split(";")[0])
      .find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP response did not set a session cookie");
    return { id: row.id, email, password: "unused", cookieHeader };
  } finally { await api.dispose(); }
}

async function settleSearch(page: Page, value: string) {
  await page.getByTestId("input-directory-search").fill(value);
  await expect(page.getByTestId("input-directory-search")).toHaveValue(value);
}

test.describe("authenticated admin directory journey", () => {
  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL || !process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("Admin directory E2E requires isolated TEST_DATABASE_URL");
    }
    admin = await createSessionTeacher(baseURL, `E2E Directory Admin ${suffix}`, `admin-${suffix}@example.com`, true);
    ordinary = await createSessionTeacher(baseURL, `E2E Directory Teacher ${suffix}`, `ordinary-${suffix}@example.com`, false);
    const old = new Date("2001-01-01T00:00:00.000Z");
    const newest = new Date(Date.now() + 60_000);
    const fixtures = await db.insert(teachersTable).values(Array.from({ length: 27 }, (_, i) => ({
      name: i === 26 ? `${arabicTeacher} ${marker}` : `Teacher ${marker} ${String(i + 1).padStart(2, "0")}`,
      email: `directory-${suffix}-${i + 1}@example.com`,
      passwordHash: "e2e-admin-directory-fixture", role: "teacher", isAdmin: false, isBlocked: false,
      createdAt: i === 26 ? old : newest,
    }))).returning({ id: teachersTable.id });
    teacherIds.push(...fixtures.map(row => row.id));
    await db.insert(studentsTable).values(fixtures.map((teacher, i) => ({
      name: i === 26 ? `${arabicStudent} ${marker}` : `Student ${marker} ${String(i + 1).padStart(2, "0")}`,
      studentClass: "E2E", teacherId: teacher.id, createdAt: i === 26 ? old : newest,
    })));
    await db.insert(assignmentsTable).values(fixtures.map((teacher, i) => ({
      title: i === 26 ? oldTitle : `Activity ${marker} ${String(i + 1).padStart(2, "0")}`,
      teacherId: teacher.id, isShared: true, createdAt: i === 26 ? old : newest,
    })));
  });

  test.afterAll(async () => {
    if (teacherIds.length) await pool.query("DELETE FROM teachers WHERE id = ANY($1::int[])", [teacherIds]);
    await pool.end();
  });

  test("searches, pages, blocks, and scopes the authenticated admin directories", async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await attachSession(page.context(), baseURL, admin);
    await page.setViewportSize({ width: 1280, height: 900 });
    const requests: string[] = [];
    const directoryBodies: Array<{ url: string; body: any }> = [];
    const browserErrors: string[] = [];
    page.on("request", req => requests.push(new URL(req.url()).pathname + new URL(req.url()).search));
    page.on("pageerror", err => browserErrors.push(err.message));
    page.on("response", async response => {
      if (!new URL(response.url()).pathname.startsWith("/api/admin/directory/")) return;
      try { directoryBodies.push({ url: response.url(), body: await response.json() }); } catch {}
    });

    await page.goto("/teacher/admin?tab=teachers", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("directory-pager")).toBeVisible();
    await expect.poll(() => directoryBodies.some(r => r.url.includes("/directory/teachers?"))).toBe(true);
    expect(requests.some(u => /\/api\/admin\/directory\/(students|activities)\?/.test(u))).toBe(false);
    expect(requests.some(u => /\/api\/admin\/(stats|full-stats|content)/.test(u))).toBe(false);
    expect(requests.some(u => /^\/api\/admin\/teachers(?:\?|$)/.test(u))).toBe(false);
    expect(directoryBodies.find(r => r.url.includes("/directory/teachers?"))?.body.items).toHaveLength(25);
    await page.getByTestId("button-page-next").click();
    await expect(page.getByTestId("directory-pager")).toContainText("2 /");
    await page.getByTestId("input-directory-search").fill(marker);
    await expect.poll(() => directoryBodies.some(r => r.url.includes(encodeURIComponent(marker)))).toBe(true);
    await expect(page.getByTestId("directory-pager")).toContainText("27");
    await expect(directoryBodies.filter(r => r.url.includes(encodeURIComponent(marker))).at(-1)?.body.items).toHaveLength(25);
    await page.getByTestId("button-page-next").click();
    await expect(page.getByText(`${arabicTeacher} ${marker}`, { exact: true })).toBeVisible();

    await page.getByTestId("input-directory-search").fill(`${arabicTeacher.replace(/[\u064b-\u065f\u0670\u0640]/g, "")} ${marker}`);
    await expect(page.getByText(`${arabicTeacher} ${marker}`, { exact: true })).toBeVisible();
    await page.getByTestId("input-directory-search").fill(`directory-${suffix}-1@example.com`);
    await expect(page.getByText(`${arabicTeacher} ${marker}`, { exact: true })).toHaveCount(0);
    await expect(page.getByText(`Teacher ${marker} 01`, { exact: true })).toBeVisible();
    await page.getByTestId("input-directory-search").fill(marker);
    await expect(page.getByTestId("button-page-prev")).toBeVisible();
    await page.getByTestId("button-page-prev").click();
    await expect(page.getByTestId("directory-pager")).toContainText("1 /");

    await page.getByTestId("input-directory-search").fill(`directory-${suffix}-1@example.com`);
    await expect(page.getByText(`Teacher ${marker} 01`, { exact: true })).toBeVisible();
    await page.getByText(`Teacher ${marker} 01`, { exact: true }).click();
    const block = page.getByRole("button", { name: "حظر", exact: true }).or(page.getByRole("button", { name: "Block", exact: true }));
    await block.click();
    await expect(page.getByRole("button", { name: "رفع الحظر", exact: true }).or(page.getByRole("button", { name: "Unblock", exact: true }))).toBeVisible();
    const adminApi = await newApi(baseURL);
    try {
      const getTeacher = async () => adminApi.get(`/api/admin/directory/teachers?page=1&pageSize=25&q=${encodeURIComponent(`directory-${suffix}-1@example.com`)}`, { headers: { Cookie: admin.cookieHeader } });
      expect((await (await getTeacher()).json()).items[0].isBlocked).toBe(true);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("input-directory-search").fill(`directory-${suffix}-1@example.com`);
      await expect(page.getByText(`Teacher ${marker} 01`, { exact: true })).toBeVisible();
      await page.getByText(`Teacher ${marker} 01`, { exact: true }).click();
      await page.getByRole("button", { name: "رفع الحظر", exact: true }).or(page.getByRole("button", { name: "Unblock", exact: true })).click();
      expect((await (await getTeacher()).json()).items[0].isBlocked).toBe(false);
    } finally { await adminApi.dispose(); }

    const errorQuery = `transient-${suffix}`;
    let failures = 0;
    const failSearch = async (route: any) => {
      if (new URL(route.request().url()).searchParams.get("q") === errorQuery) {
        failures++;
        await route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"temporary"}' });
      } else await route.continue();
    };
    const temporaryErrorRoute = "**/*";
    await page.route(temporaryErrorRoute, failSearch);
    await page.getByTestId("input-directory-search").fill(errorQuery);
    await expect.poll(() => failures).toBe(2);
    await expect(page.getByTestId("directory-error")).toBeVisible();
    await expect(page.getByText(`Teacher ${marker} 01`, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "رفع الحظر", exact: true }).or(page.getByRole("button", { name: "Unblock", exact: true }))).toHaveCount(0);
    await page.unroute(temporaryErrorRoute, failSearch);
    await page.getByTestId("button-directory-retry").click();
    await expect(page.getByTestId("directory-empty")).toBeVisible();

    await page.getByRole("button", { name: "الطلاب", exact: true }).click();
    await expect(page.getByTestId("directory-pager")).toBeVisible();
    await expect.poll(() => requests.some(u => u.startsWith("/api/admin/directory/students?"))).toBe(true);
    await page.getByTestId("input-directory-search").fill(marker);
    await expect(page.getByTestId("directory-pager")).toContainText("27");
    await page.getByTestId("button-page-next").click();
    await expect(page.getByText(`${arabicStudent} ${marker}`, { exact: true })).toBeVisible();
    await page.getByTestId("input-directory-search").fill(arabicTeacher.replace(/[\u064b-\u065f\u0670\u0640]/g, ""));
    await expect(page.getByText(`${arabicStudent} ${marker}`, { exact: true })).toBeVisible();
    await page.getByTestId("input-directory-search").fill(`no-such-${suffix}`);
    await expect(page.getByTestId("directory-empty")).toBeVisible();
    await page.getByTestId("input-directory-search").fill("");
    await expect(page.getByTestId("directory-pager")).toBeVisible();

    await page.getByRole("button", { name: "الأنشطة", exact: true }).click();
    await expect(page.getByTestId("input-directory-search")).toBeVisible();
    await expect.poll(() => requests.some(u => u.includes("/api/admin/directory/activities?") && new URLSearchParams(u.split("?")[1]).get("section") === "assignments")).toBe(true);
    await page.getByTestId("input-directory-search").fill(marker);
    await expect(page.getByTestId("directory-pager")).toContainText("27");
    await page.getByTestId("button-page-next").click();
    await expect(page.getByText(oldTitle, { exact: true })).toBeVisible();
    await page.getByTestId("input-directory-search").fill(`${arabicTeacher.replace(/[\u064b-\u065f\u0670\u0640]/g, "")} ${marker}`);
    await expect(page.getByText(oldTitle, { exact: true })).toBeVisible();
    const categories = [
      { label: "ألعاب وميض", section: "games" }, { label: "دروس الفيديو", section: "video" },
      { label: "شد الحبل", section: "tug" }, { label: "تطابق الذاكرة", section: "memory" },
    ];
    for (const category of categories) {
      await page.getByRole("button").filter({ hasText: category.label }).first().click();
      await expect.poll(() => requests.some(u => u.includes("/api/admin/directory/activities?") &&
        new URLSearchParams(u.split("?")[1]).get("section") === category.section)).toBe(true);
      await page.getByTestId("input-directory-search").fill(marker);
      await expect(page.getByText(oldTitle, { exact: true })).toHaveCount(0);
      await expect(page.getByText(/^لا توجد .+ بعد$/)).toBeVisible();
    }

    await page.getByRole("button", { name: "الرسائل", exact: true }).click();
    const addMessage = page.getByRole("button", { name: /رسالة جديدة|New message/ });
    await addMessage.click();
    await expect.poll(() => requests.some(u => u.includes("/api/admin/directory/teachers?") &&
      new URLSearchParams(u.split("?")[1]).get("lookup") === "true")).toBe(true);
    expect(requests.some(u => /^\/api\/admin\/teachers(?:\?|$)/.test(u))).toBe(false);

    expect(browserErrors).toEqual([]);
  });

  test("keeps mobile search and pagination usable", async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    await attachSession(page.context(), baseURL, admin);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/teacher/admin?tab=teachers");
    await expect(page.getByTestId("input-directory-search")).toBeVisible();
    await page.getByTestId("input-directory-search").fill(marker);
    await expect(page.getByTestId("directory-pager")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth,
      search: document.querySelector('[data-testid="input-directory-search"]')?.getBoundingClientRect().right,
      pager: document.querySelector('[data-testid="directory-pager"]')?.getBoundingClientRect().right,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.search).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.pager).toBeLessThanOrEqual(dimensions.viewport);
    await page.getByTestId("button-page-next").click();
    await expect(page.getByText(`${arabicTeacher} ${marker}`, { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("admin-directory-mobile.png") });
  });

  test("directory endpoint rejects anonymous users and permits authenticated admins only", async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL required");
    const api = await newApi(baseURL);
    try {
      const path = "/api/admin/directory/teachers?page=1&pageSize=25";
      expect((await api.get(path)).status()).toBe(401);
      expect((await api.get(path, { headers: { Cookie: ordinary.cookieHeader } })).status()).toBe(403);
      expect((await api.get(path, { headers: { Cookie: admin.cookieHeader } })).status()).toBe(200);
    } finally { await api.dispose(); }
  });
});