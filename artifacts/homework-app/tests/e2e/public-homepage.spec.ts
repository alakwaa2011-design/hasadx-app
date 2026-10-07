import { test, expect } from "@playwright/test";

test.describe("Public homepage", () => {
  test("keeps the Arabic join flow accessible without submitting a code", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("أكثر تفاعلاً");
    await expect(page.getByRole("link", { name: "ابدأ الآن مجاناً", exact: true }).first()).toHaveAttribute(
      "href",
      "/register?role=teacher",
    );

    await page.locator("#join").scrollIntoViewIfNeeded();
    const pinInputs = page.locator('#join input[inputmode="numeric"]');
    await expect(pinInputs).toHaveCount(6);
    await expect(pinInputs.nth(0)).toHaveAttribute("maxlength", "1");
    await expect(page.getByRole("link", { name: "ابدأ تجربتك كضيف", exact: true })).toHaveAttribute(
      "href",
      "/guest/create",
    );
  });

  test("renders the redesigned landing in English LTR", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hw_lang", "en"));
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("more interactive class");
    await expect(page.getByRole("link", { name: "Start free now", exact: true }).first()).toHaveAttribute(
      "href",
      "/register?role=teacher",
    );
    await expect(page.getByRole("link", { name: "Try it as a guest", exact: true })).toHaveAttribute(
      "href",
      "/guest/create",
    );
    await expect(page.locator('#join input[inputmode="numeric"]')).toHaveCount(6);
  });
});
