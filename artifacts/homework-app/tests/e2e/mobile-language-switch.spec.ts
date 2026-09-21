import { test, expect } from "@playwright/test";

test.describe("Mobile language switch", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("announces the target language before and after switching", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("hw_lang", "ar"));
    await page.goto("/terms");

    const switchToEnglish = page.getByRole("button", {
      name: "Switch to English",
      exact: true,
    });
    await expect(switchToEnglish).toBeVisible();
    await switchToEnglish.click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("button", {
        name: "التبديل إلى العربية",
        exact: true,
      }),
    ).toBeVisible();
  });
});