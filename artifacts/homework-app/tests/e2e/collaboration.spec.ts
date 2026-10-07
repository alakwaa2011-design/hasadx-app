import { expect, test } from "@playwright/test";
import { db, pool, teachersTable } from "../../../../lib/db/src/index.ts";
import { attachSession, type TestTeacher, newApi } from "./helpers";

test.setTimeout(120_000);
let teacher: TestTeacher | undefined;

async function createVerifiedTeacher(baseURL: string): Promise<TestTeacher> {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const email = `e2e-collaboration-${suffix}@example.com`;
  const [row] = await db.insert(teachersTable).values({
    name: `E2E Collaboration ${suffix}`, email, passwordHash: "fixture-only",
    verificationOtp: "995000", otpExpiresAt: new Date(Date.now() + 600_000),
    emailVerified: false, role: "teacher", isBlocked: false,
  }).returning({ id: teachersTable.id });
  if (!row) throw new Error("Could not create isolated collaboration teacher");
  const api = await newApi(baseURL);
  try {
    const res = await api.post("/api/auth/verify-otp", { data: { identifier: email, otp: "995000" } });
    if (!res.ok()) throw new Error(`Teacher verification failed: ${res.status()} ${await res.text()}`);
    const cookieHeader = res.headersArray().filter(h => h.name.toLowerCase() === "set-cookie")
      .map(h => h.value.split(";")[0])
      .find(v => v.startsWith("connect.sid=") || v.startsWith("session="));
    if (!cookieHeader) throw new Error("Teacher verification returned no session cookie");
    return { id: row.id, email, password: "unused", cookieHeader };
  } finally { await api.dispose(); }
}

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  if (!process.env.TEST_DATABASE_URL || process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Collaboration fixtures require isolated TEST_DATABASE_URL");
  }
  teacher = await createVerifiedTeacher(baseURL);
});

test.afterAll(async () => {
  try {
    if (teacher) await pool.query("DELETE FROM teachers WHERE id = $1", [teacher.id]);
  } finally { await pool.end(); }
});

test("focused collaboration moderation, reaction, silent reveal, display and close", async ({ page, context, browser, baseURL }) => {
  if (!teacher || !baseURL) throw new Error("Isolated teacher fixture unavailable");
  await attachSession(context, baseURL, teacher);
  const absolute = (path: string) => new URL(path, baseURL).toString();
  const api = await newApi(baseURL);
  const title = `تعاون تحقق ${Date.now()}`;
  const postText = `مساهمة معلنة ${Date.now()}`;
  let studentA: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let studentB: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const created = await api.post("/api/collaboration", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        clientId: crypto.randomUUID(), title, prompt: "شارك فكرة للصف",
        settings: { moderation: true, allowComments: true, allowImages: true, allowReactions: true, showNames: false, silent: false, revealed: false, maxPosts: 3, voteBudget: 3 },
        columns: [{ id: "main", title: "الأفكار" }],
      },
    });
    expect(created.status()).toBe(201);
    const board = await created.json();
    const id: string = board.id;
    const pin: string = board.pin;
    const ownerAction = (data: unknown) => api.post(`/api/collaboration/${id}/actions`, {
      headers: { Cookie: teacher!.cookieHeader }, data,
    });
    expect((await ownerAction({ type: "board.status", status: "open" })).ok()).toBe(true);
    const joinedA = await api.post(`/api/collaboration/join/${pin}`, { data: { name: "طالب مجهول" } });
    const joinedB = await api.post(`/api/collaboration/join/${pin}`, { data: { name: "طالب مجهول" } });
    expect(joinedA.ok() && joinedB.ok()).toBe(true);
    const sa = await joinedA.json();
    const sb = await joinedB.json();
    expect(sa.participantId).not.toBe(sb.participantId);
    const seedPost = await api.post(`/api/collaboration/${id}/actions`, {
      headers: { "X-Collaboration-Token": sa.token },
      data: { type: "post.create", clientId: crypto.randomUUID(), text: postText },
    });
    expect(seedPost.ok()).toBe(true);

    const ownerResponse = await context.request.get(absolute(`/api/collaboration/${id}`));
    expect(ownerResponse.ok()).toBe(true);
    expect((await ownerResponse.json()).owner).toBe(true);
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto(`/teacher/collaboration/${id}`);
    const teacherCard = page.locator('[data-testid^="card-post-"]').filter({ hasText: postText });
    await expect(teacherCard).toBeVisible();
    await expect(teacherCard).toContainText("طالب مجهول");
    await expect(teacherCard.getByRole("button", { name: "اعتماد" })).toBeVisible();
    await page.screenshot({ path: "test-results/collaboration-focused-teacher-review.png", fullPage: true });
    await teacherCard.getByRole("button", { name: "اعتماد" }).click();
    await expect.poll(async () => {
      const r = await context.request.get(absolute(`/api/collaboration/${id}`));
      const v = await r.json();
      return v.posts.find((p: { text: string }) => p.text === postText)?.status;
    }).toBe("approved");

    const seedSession = async (ctx: typeof studentB, guest: typeof sb) => {
      await ctx!.addInitScript((s) => {
        localStorage.setItem(`hasaad-collab:${s.id}`, JSON.stringify({
          token: s.token, participantId: s.participantId, name: s.name,
        }));
      }, { id, token: guest.token, participantId: guest.participantId, name: guest.name });
    };
    studentA = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    studentB = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    await seedSession(studentA, sa);
    await seedSession(studentB, sb);
    const guestB = await studentB.newPage();
    await guestB.goto(`/collaboration/board/${id}`);
    const peerCard = guestB.locator('[data-testid^="card-post-"]').filter({ hasText: postText });
    await expect(peerCard).toBeVisible();
    await expect(peerCard).toContainText("مشارك");
    await expect(peerCard).not.toContainText("طالب مجهول");
    await peerCard.getByRole("button", { name: "إعجاب" }).click();
    await expect.poll(async () => {
      const r = await studentB!.request.get(absolute(`/api/collaboration/${id}`), { headers: { "X-Collaboration-Token": sb.token } });
      const v = await r.json();
      return v.posts.find((p: { text: string }) => p.text === postText)?.reactions.find((x: { kind: string }) => x.kind === "like")?.count;
    }).toBe(1);
    await guestB.screenshot({ path: "test-results/collaboration-focused-student-peer.png", fullPage: true });

    await page.getByTestId("button-board-more").click();
    await page.getByTestId("button-settings").click();
    const settings = page.getByRole("dialog");
    const silentSwitch = settings.getByRole("switch", { name: "وضع الصمت (المعرض المخفي)" });
    await expect(silentSwitch).toHaveAttribute("aria-checked", "false");
    await silentSwitch.click();
    await settings.getByRole("button", { name: "حفظ الإعدادات" }).click();
    await expect(page.getByTestId("button-board-more")).toBeVisible();
    await guestB.reload();
    await expect(guestB.getByText("وضع الصمت: ترى مشاركاتك فقط حتى يكشف المعلم المعرض.")).toBeVisible();
    await expect(guestB.getByText(postText, { exact: true })).toHaveCount(0);

    await page.getByTestId("button-display").click();
    await expect(page.getByText("بانتظار المشاركات...")).toBeVisible();
    await expect(page.getByText(postText, { exact: true })).toHaveCount(0);
    await page.screenshot({ path: "test-results/collaboration-focused-teacher-concealed-display.png", fullPage: true });
    await page.getByRole("button", { name: "خروج" }).click();
    await page.getByTestId("button-board-more").click();
    await page.getByRole("button", { name: "كشف المعرض للطلاب" }).click();
    await guestB.reload();
    await expect(guestB.getByText(postText, { exact: true })).toBeVisible();
    await expect(guestB.locator('[data-testid^="card-post-"]').filter({ hasText: postText })).toContainText("مشارك");

    const fitsPhone = await guestB.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fitsPhone, "guest board should fit 390px viewport without horizontal overflow").toBe(true);
    await page.getByRole("button", { name: "إغلاق المشاركة" }).click();
    await guestB.reload();
    await expect(guestB.getByText("المشاركة مغلقة، يمكنك القراءة فقط")).toBeVisible();
    await expect(guestB.getByTestId("button-new-post")).toHaveCount(0);
  } finally {
    await api.dispose();
    await studentA?.close();
    await studentB?.close();
  }
});
