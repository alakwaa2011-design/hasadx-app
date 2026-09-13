import { test, expect } from "@playwright/test";
import { db, teachersTable } from "../../../../lib/db/src/index.ts";
import {
  attachSession,
  createPresentation,
  newApi,
  type TestPresentation,
  type TestTeacher,
} from "./helpers";

let teacher: TestTeacher;
let deck: TestPresentation;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  const api = await newApi(baseURL);
  try {
    const suffix = uniqueSuffix();
    const email = `e2e-presentation-theme-${suffix}@example.com`;
    const otp = "996000";
    const [teacherRow] = await db.insert(teachersTable).values({
      name: `E2E Presentation Theme ${suffix}`,
      email,
      passwordHash: "e2e-presentation-theme-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    }).returning({ id: teachersTable.id });
    if (!teacherRow) throw new Error("Could not create presentation theme teacher fixture");

    const verify = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!verify.ok()) {
      throw new Error(`Could not verify presentation theme teacher: ${verify.status()} ${await verify.text()}`);
    }
    const cookieHeader = verify.headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find((value) => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP verification did not establish a teacher session");
    teacher = {
      id: teacherRow.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };
    deck = await createPresentation(api, teacher);

    /* These are legacy per-slide colors. They intentionally override the
       deck theme in the renderer, which is the regression this flow covers. */
    const slides = [1, 2, 3].map((n) => ({
      id: `theme-e2e-s${n}`,
      layout: "blank",
      background: n === 1 ? "#112233" : n === 2 ? "#445566" : "#778899",
      elements: [
        {
          id: `theme-e2e-t${n}`,
          kind: "text" as const,
          x: 80,
          y: 240,
          w: 1120,
          h: 120,
          text: `Theme slide ${n}`,
          fontSize: 56,
          fontWeight: "700",
          color: "#ffffff",
          align: "center",
        },
      ],
    }));
    const res = await api.put(`/api/presentations/${deck.id}`, {
      headers: { Cookie: teacher.cookieHeader },
      data: { theme: "harvest", slides },
    });
    if (!res.ok()) {
      throw new Error(`Seed themed slides failed: ${res.status()} ${await res.text()}`);
    }
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ context, baseURL, page }) => {
  await attachSession(context, baseURL!, teacher);
  /* Use the desktop workbench so the inspector's theme picker is directly
     available while keeping the same test runnable in the mobile project. */
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("changing the theme repaints every legacy slide and survives reload", async ({ page }) => {
  await page.goto(`/teacher/presentations/${deck.id}`);

  const canvas = page.locator("[data-slide-canvas]");
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-slide-thumbnail]")).toHaveCount(3);

  const oldBackgrounds = ["rgb(17, 34, 51)", "rgb(68, 85, 102)", "rgb(119, 136, 153)"];
  const before = await page.locator("[data-slide-thumbnail]").evaluateAll((items) =>
    items.map((item) => {
      const style = getComputedStyle(item);
      return `${style.backgroundImage} ${style.backgroundColor}`;
    }),
  );
  expect(before.some((background) => oldBackgrounds.some((color) => background.includes(color)))).toBe(true);

  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes(`/api/presentations/${deck.id}`) &&
      response.request().method() === "PUT" &&
      response.ok(),
    ),
    page.getByTitle("المحيط").click(),
  ]);

  await expect
    .poll(async () => {
      const response = await page.evaluate(async (id) => {
        const result = await fetch(`/api/presentations/${id}`);
        return result.json();
      }, deck.id);
      return response.theme;
    })
    .toBe("ocean");

  await expect
    .poll(async () => {
      const response = await page.evaluate(async (id) => {
        const result = await fetch(`/api/presentations/${id}`);
        return result.json();
      }, deck.id);
      return response.slides.map((slide: { background?: string }) => slide.background ?? null);
    })
    .toEqual([null, null, null]);
  const repaint = await page.locator("[data-slide-thumbnail]").evaluateAll((items) =>
    items.map((item) => ({
      backgroundImage: getComputedStyle(item).backgroundImage,
      backgroundColor: getComputedStyle(item).backgroundColor,
    })),
  );
  expect(repaint).toHaveLength(3);
  for (const slide of repaint) {
    expect(slide.backgroundImage).toMatch(/gradient/);
    const styles = `${slide.backgroundImage} ${slide.backgroundColor}`;
    expect(styles).not.toContain("rgb(17, 34, 51)");
    expect(styles).not.toContain("rgb(68, 85, 102)");
    expect(styles).not.toContain("rgb(119, 136, 153)");
  }

  await page.reload();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  const afterReload = await page.locator("[data-slide-thumbnail]").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).backgroundImage),
  );
  expect(afterReload).toHaveLength(3);
  expect(afterReload.every((background) => background.includes("gradient"))).toBe(true);
  const canvasAfterReload = await canvas.evaluate((item) => getComputedStyle(item).backgroundImage);
  expect(canvasAfterReload).toMatch(/rgb\(6,\s*26,\s*58\)/);
});