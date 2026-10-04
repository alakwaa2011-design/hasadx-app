import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

// Only generation is simulated. Authentication, autosave, reload and printing
// use the real isolated servers; this suite must never spend teacher credits.
test.setTimeout(180_000);
let teacher: TestTeacher;
let fixtureTeacherId: number | undefined;
const kinds = ["concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task"] as const;
const activities = [
  { kind: "concept_map", center: "الماء", branches: ["المصادر", "الاستخدامات"], spaceHeight: 100 },
  { kind: "drawing", spaceHeight: 120 },
  { kind: "coloring", spaceHeight: 80 },
  { kind: "sorting", items: ["صخر", "شجرة", "ماء"], categories: ["حي", "غير حي"], spaceHeight: 100 },
  { kind: "sequencing", items: ["تبخر", "تكاثف", "هطول"], spaceHeight: 100 },
  { kind: "group_task", roles: ["قارئ", "كاتب"], steps: ["ناقش", "اتفق"], spaceHeight: 100 },
];
const questions = activities.map((activity, index) => ({
  id: `activity-e2e-${index}`,
  type: "short_answer",
  prompt: `نشاط تجريبي ${index + 1}`,
  lines: 2,
  answer: `TEACHER-ONLY-ANSWER-${index}`,
  activity,
  ...(activity.kind === "coloring" ? {
    visual: {
      caption: "لوّن الدائرة",
      shapes: [{ kind: "circle", x: 100, y: 20, width: 60, height: 60, shaded: false }],
    },
  } : {}),
}));

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL || process.env.E2E_DATABASE_ISOLATED !== "1") throw new Error("Isolated E2E setup required");
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-activity-${suffix}@example.invalid`;
  const otp = "994000";
  const [row] = await db.insert(teachersTable).values({
    name: `Activity fixture ${suffix}`, email, passwordHash: "unused-e2e",
    verificationOtp: otp, otpExpiresAt: new Date(Date.now() + 600_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  fixtureTeacherId = row.id;
  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp } });
    expect(response.ok(), `OTP status ${response.status()}`).toBeTruthy();
    const cookieHeader = response.headersArray()
      .filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0])
      .find(h => h.startsWith("connect.sid=") || h.startsWith("session="));
    if (!cookieHeader) throw new Error("OTP did not establish a session");
    teacher = { id: row.id, email, password: "unused", cookieHeader };
  } finally { await api.dispose(); }
});

test.afterAll(async () => {
  if (fixtureTeacherId) {
    await pool.query("DELETE FROM worksheets WHERE teacher_id = $1", [fixtureTeacherId]);
    await pool.query("DELETE FROM teachers WHERE id = $1", [fixtureTeacherId]);
  }
  await pool.end();
});

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() =>
    document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test("activity setup, real autosave/reload and A4 export safety", async ({ page, context, baseURL }, testInfo) => {
  if (!baseURL) throw new Error("baseURL required");
  await attachSession(context, baseURL, teacher);
  await page.addInitScript(() => {
    localStorage.setItem("hw_lang", "ar");
    localStorage.setItem("hasad:worksheet:prefs", JSON.stringify({
      aiCounts: { mcq: 3, true_false: 1, short_answer: 2, fill_blank: 0, matching: 0, tic_tac_toe: 1 },
    }));
    (window as any).__printCalls = 0;
    window.print = () => { (window as any).__printCalls += 1; };
  });
  const requests: any[] = [];
  let returnedQuestions: typeof questions = questions.slice(2, 3);
  await context.route("**/api/worksheets/ai/generate", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { language: "ar", questions: returnedQuestions } });
  });
  const pageErrors: string[] = [];
  const downloads: string[] = [];
  page.on("pageerror", e => pageErrors.push(e.message));
  page.on("download", d => downloads.push(d.suggestedFilename()));

  const width = page.viewportSize()!.width;
  {
    await page.goto("/teacher/worksheets/create");
    await expect(page.getByTestId("worksheet-quick-setup")).toBeVisible();
    await page.getByTestId("quick-subject").fill("العلوم");
    await page.getByTestId("quick-grade").fill("الصف الرابع");
    const suggestions = page.getByTestId("suggested-activities");
    await expect(suggestions.locator("button")).toHaveCount(3);
    await expect(suggestions.getByTestId("style-concept_map")).toBeVisible();
    await page.getByTestId("quick-subject").fill("التربية الفنية");
    await page.getByTestId("quick-grade").fill("الصف الأول");
    await expect(suggestions.getByTestId("style-coloring")).toBeVisible();
    await expect(suggestions.getByTestId("style-drawing")).toBeVisible();
    await page.getByTestId("button-browse-styles").click();
    for (const kind of kinds) {
      await expect(page.getByTestId(`style-${kind}`)).toBeVisible();
      await page.getByTestId(`style-${kind}`).click();
      await expect(page.getByTestId(`style-${kind}`)).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByTestId("style-coloring").click();
    await page.getByTestId("quick-mode-group").click();
    expect(await page.getByTestId("quick-group-size").locator("option").evaluateAll(
      options => options.map(o => (o as HTMLOptionElement).value),
    )).toEqual(["", "2", "3", "4", "5", "6"]);
    await page.getByTestId("quick-group-size").selectOption("6");
    await page.getByTestId("quick-mode-individual").click();
    await page.getByTestId("quick-pages-1").click();
    await page.getByTestId("button-advanced-constraints").click();
    for (const field of ["difficulty", "skill", "duration", "count", "differentiation", "assessment"]) {
      await expect(page.getByTestId(`constraint-${field}`)).toHaveValue("");
    }
    await assertNoOverflow(page);

    // Subject + grade only: no topic, implicit constraints or cached board flag.
    returnedQuestions = questions.slice(2, 3);
    const saved = page.waitForResponse(r => r.url().endsWith("/api/worksheets") && r.request().method() === "POST");
    await page.getByRole("button", { name: "أنشئ النشاط", exact: true }).click();
    const savedResponse = await saved;
    expect(savedResponse.ok()).toBeTruthy();
    const savedRow = await savedResponse.json();
    await expect(page.getByTestId("status-worksheet-autosave")).toContainText("تم حفظ");
    expect(requests.at(-1)).toMatchObject({
      topic: "التربية الفنية — الصف الأول", activityStyle: "coloring",
      questionSelection: "auto", generationConstraints: {}, pages: 1,
    });
    expect(requests.at(-1)).not.toHaveProperty("counts");
    expect(requests.at(-1)).not.toHaveProperty("groupSize");
    expect(savedRow.settings.targetPages).toBe(1);
    await page.goto(`/teacher/worksheets/${savedRow.id}/print`);
    await expect(page.locator("#ws-printable-root")).toHaveCount(1);
    await expect(page.locator('#ws-printable-root [data-activity="coloring"]')).toBeVisible();
    await expect(page.locator("#ws-printable-root svg ellipse")).toHaveCount(1);
    await expect(page.locator("#ws-printable-root")).not.toContainText("TEACHER-ONLY-ANSWER");
    await page.reload();
    await expect(page.locator('#ws-printable-root [data-activity="coloring"]')).toBeVisible();
    await documentReady(page);
    await assertNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`activity-${width}.png`), fullPage: true });
    const printablePages = await page.locator("#ws-printable-root [data-worksheet-page]").count();
    expect(printablePages).toBe(1);
    await page.getByTestId("btn-pdf-export").click();
    await expect.poll(() => page.evaluate(() => (window as any).__printCalls)).toBe(1);
    if (width === 1280) {
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length).toBe(printablePages);
    }
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    if (width === 1280) {
      for (const mode of ["visual", "editable"]) {
        await page.getByTestId("btn-word-export").click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByTestId(`word-export-${mode}`).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/\.docx$/);
        const downloadPath = await download.path();
        if (!downloadPath) throw new Error("Word download has no path");
        const zip = await JSZip.loadAsync(await readFile(downloadPath));
        expect(zip.file("word/document.xml")).not.toBeNull();
      }
    }

    // All six student workspaces persist with explicit teacher constraints.
    await page.goto("/teacher/worksheets/create");
    await page.getByTestId("quick-subject").fill("العلوم");
    await page.getByTestId("quick-grade").fill("الصف الرابع");
    await page.getByTestId("quick-mode-group").click();
    await page.getByTestId("quick-group-size").selectOption("2");
    await page.getByTestId("button-advanced-constraints").click();
    await page.getByTestId("constraint-count").selectOption("6");
    await page.getByTestId("constraint-difficulty").selectOption("easy");
    await page.getByTestId("constraint-objective").fill("تمييز مراحل دورة الماء");
    await page.getByTestId("constraint-type-short_answer").click(); // blur commits objective
    returnedQuestions = questions;
    const saveAll = page.waitForResponse(r => r.url().endsWith("/api/worksheets") && r.request().method() === "POST");
    await page.getByRole("button", { name: "أنشئ النشاط", exact: true }).click();
    const allResponse = await saveAll;
    expect(allResponse.ok()).toBeTruthy();
    const allRow = await allResponse.json();
    expect(requests.at(-1)).toMatchObject({
      executionMode: "group", groupSize: 2,
      generationConstraints: { itemCount: 6, difficulty: "easy", allowedTypes: ["short_answer"], learningObjective: "تمييز مراحل دورة الماء" },
    });
    expect(allRow.questions).toEqual(questions);
    expect(allRow.settings.generationConstraints).toEqual(requests.at(-1).generationConstraints);
    await page.goto(`/teacher/worksheets/${allRow.id}/print`);
    for (const kind of kinds) await expect(page.locator(`#ws-printable-root [data-activity="${kind}"]`)).toBeVisible();
    await documentReady(page);
    await expect(page.locator("#ws-printable-root")).not.toContainText("TEACHER-ONLY-ANSWER");
    expect(await page.locator("#ws-printable-root [data-worksheet-page]").count()).toBeGreaterThan(1);
    const before = await page.locator("#ws-printable-root .ws-q").count();
    const downloadsBefore = downloads.length;
    await page.getByTestId("btn-pdf-export").click();
    await expect(page.getByText(/الورقة .* صفحات والمستهدف/).first()).toBeVisible();
    expect(await page.evaluate(() => (window as any).__printCalls)).toBe(0);
    await page.getByTestId("btn-word-export").click();
    await page.getByTestId("word-export-visual").click();
    await expect(page.getByText(/الورقة .* صفحات والمستهدف/).first()).toBeVisible();
    await page.getByTestId("btn-word-export").click();
    await page.getByTestId("word-export-editable").click();
    await expect(page.getByText(/الورقة .* صفحات والمستهدف/).first()).toBeVisible();
    await expect(page.getByTestId("btn-word-export")).toBeEnabled();
    expect(downloads).toHaveLength(downloadsBefore);
    expect(await page.locator("#ws-printable-root .ws-q").count()).toBe(before);
    await assertNoOverflow(page);

    // Manual selection retains cached teacher-controlled formats and counts.
    await page.goto("/teacher/worksheets/create");
    await page.getByTestId("quick-subject").fill("العلوم");
    await page.getByTestId("quick-grade").fill("الصف الرابع");
    await page.getByTestId("worksheet-question-selection").getByRole("button", { name: "يدوي — أحدد الأنواع والأعداد", exact: true }).click();
    returnedQuestions = questions.slice(2, 3);
    const saveManual = page.waitForResponse(r => r.url().endsWith("/api/worksheets") && r.request().method() === "POST");
    // Manual requests require a topic; use the generator's topic input.
    await page.getByPlaceholder("عن ماذا تتحدث الورقة؟ (مثال: أركان الصلاة، ضرب الكسور...)").fill("دورة الماء");
    await page.getByRole("button", { name: "توليد الأسئلة", exact: false }).click();
    expect((await saveManual).ok()).toBeTruthy();
    expect(requests.at(-1)).toMatchObject({
      questionSelection: "manual",
      counts: { mcq: 3, true_false: 1, short_answer: 2, tic_tac_toe: 0 },
    });
  }
  expect(pageErrors).toEqual([]);
});

async function documentReady(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Give the rendered overflow guard a chance to redistribute A4 pages.
  await page.waitForTimeout(400);
}