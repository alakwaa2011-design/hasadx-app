import { test, expect } from "@playwright/test";

test.describe("Public homepage", () => {
  test("keeps the Arabic join flow accessible without submitting a code", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(
      page.getByRole("heading", {
        name: "من فكرة الدرس إلى تجربة تعليمية كاملة",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "ابدأ مجاناً كمعلم", exact: true }),
    ).toHaveAttribute("href", "/register?role=teacher");

    await page.locator('a[href="/#join"]:visible').click();
    await expect(page).toHaveURL(/#join$/);

    const pinInputs = page.locator('#join input[inputmode="numeric"]');
    await expect(pinInputs).toHaveCount(6);
    await expect(pinInputs.nth(0)).toHaveAttribute("maxlength", "1");
    await expect(
      page.getByText("لديك رمز لعبة أو مسابقة؟", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "أو ابدأ تجربة كضيف", exact: true }),
    ).toHaveAttribute("href", "/guest/create");
  });

  test("renders the redesigned landing in English LTR", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hw_lang", "en"));
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(
      page.getByRole("heading", {
        name: "From lesson idea to a complete learning experience",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start free as a teacher", exact: true }),
    ).toHaveAttribute("href", "/register?role=teacher");
    await expect(
      page.getByText("Have a game or quiz code?", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Or start as a guest", exact: true }),
    ).toHaveAttribute("href", "/guest/create");

    const pinInputs = page.locator('#join input[inputmode="numeric"]');
    await expect(pinInputs).toHaveCount(6);
  });
});