import { expect, test } from "@playwright/test";
import { assignmentsTable, db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createAdmin(baseURL: string): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-admin-student-preview-${suffix}@example.com`;
  const otp = "996410";
  const [adminRow] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Admin Student Preview ${suffix}`,
      email,
      passwordHash: "e2e-admin-student-preview-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      isAdmin: true,
      role: "admin",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!adminRow) throw new Error("Could not create the admin student preview fixture");
  await db.insert(assignmentsTable).values({
    title: `نشاط معاينة اللعب ${suffix}`,
    teacherId: adminRow.id,
    accessMode: "public",
    isShared: true,
  });

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(`Could not verify admin fixture: ${response.status()} ${await response.text()}`);
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("Admin verification did not establish a session");

    return {
      id: adminRow.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };
  } finally {
    await api.dispose();
  }
}

test.describe("admin student preview", () => {
  let admin: TestTeacher | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL ||
      process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Admin student preview E2E requires the isolated TEST_DATABASE_URL");
    }
    admin = await createAdmin(baseURL);
  });

  test.beforeEach(async ({ context, baseURL }) => {
    if (!admin || !baseURL) throw new Error("Admin student preview fixture is unavailable");
    await attachSession(context, baseURL, admin);
  });

  test.afterAll(async () => {
    if (admin) await pool.query("DELETE FROM teachers WHERE id = $1", [admin.id]);
    await pool.end();
  });

  test("opens student preview, blocks saving actions, and returns to teacher without logout", async ({
    page,
  }) => {
    const blockedMutations: string[] = [];
    const logoutRequests: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      const pathname = new URL(request.url()).pathname;
      if (
        pathname.startsWith("/api/public/start-wameeth/") ||
        pathname === "/api/kids/motivation/redemptions"
      ) {
        blockedMutations.push(pathname);
      }
      if (pathname === "/api/auth/logout" || pathname === "/api/student-auth/logout") {
        logoutRequests.push(pathname);
      }
    });

    await page.goto("/teacher", { waitUntil: "domcontentloaded" });
    const roleSwitcher = page.getByRole("button", { name: /الدور الحالي:/ });
    await expect(roleSwitcher).toBeVisible();
    await roleSwitcher.click();
    await page.getByRole("menuitem", { name: "طالب (معاينة)", exact: true }).click();

    await expect(page).toHaveURL(/\/student\/dashboard\?preview=1$/);
    await expect(page.getByText("أنت الآن في معاينة صفحة الطالب", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: /مرحباً، طالب تجريبي/ })).toBeVisible();

    const startGame = page.getByRole("button", { name: "ابدأ اللعبة", exact: true });
    await expect(startGame).toBeVisible();
    await startGame.click();
    await expect(page.getByRole("button", { name: /نعم، العب مع/ })).toBeVisible();
    await page.getByRole("button", { name: /نعم، العب مع/ }).click();
    await page.getByRole("button", { name: "لا، العب بمفردك", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/dashboard\?preview=1$/);

    const redeemReward = page.getByRole("button", { name: "استبدال", exact: true });
    await expect(redeemReward).toBeVisible();
    await expect(redeemReward).toBeDisabled();
    await redeemReward.evaluate((element) => (element as HTMLButtonElement).click());

    await expect.poll(() => blockedMutations).toEqual([]);
    await expect.poll(() => logoutRequests).toEqual([]);

    await page.locator("div.fixed.inset-0.z-50").click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("button", { name: "لا، العب بمفردك", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /الدور الحالي: طالب/ }).click();
    await page.getByRole("menuitem", { name: "معلّم", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher$/);
    await expect(page.getByRole("button", { name: /الدور الحالي: معلّم/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /E E2E Admin Student Preview/ })).toBeVisible();
  });
});