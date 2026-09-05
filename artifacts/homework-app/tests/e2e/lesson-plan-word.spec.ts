import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import {
  attachSession,
  newApi,
  type TestTeacher,
} from "./helpers";

let teacher: TestTeacher;
let lessonPlanId: number;

const planTitle = "اختبار ثبات تنسيق خطة الدرس";
const expectedSectionTitles = [
  "الأهداف التعليمية",
  "المواد والأدوات",
  "المفردات الجديدة",
  "التهيئة (الإحماء)",
  "التمهيد",
  "الأنشطة الرئيسة",
  "التقويم",
  "الخاتمة",
  "الواجب المنزلي",
  "تنويع التعليم",
  "ملاحظات المعلم",
];

test.beforeAll(async ({ baseURL }) => {
  if (!baseURL) throw new Error("baseURL is required");
  const api = await newApi(baseURL);
  try {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const email = `e2e-lesson-plan-${suffix}@example.com`;
    const otp = "995000";
    const [teacherRow] = await db
      .insert(teachersTable)
      .values({
        name: `معلم خطة الدرس ${suffix}`,
        email,
        passwordHash: "e2e-lesson-plan-fixture",
        verificationOtp: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        emailVerified: false,
        role: "teacher",
        isBlocked: false,
      })
      .returning({ id: teachersTable.id });
    if (!teacherRow) throw new Error("Could not create the lesson plan teacher fixture");

    const verify = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!verify.ok()) {
      throw new Error(`Teacher verification failed: ${verify.status()} ${await verify.text()}`);
    }
    const cookieHeader = verify
      .headersArray()
      .filter(header => header.name.toLowerCase() === "set-cookie")
      .map(header => header.value.split(";")[0])
      .find(value => value.startsWith("connect.sid=") || value.startsWith("session="));
    if (!cookieHeader) throw new Error("Teacher verification did not establish a session");
    teacher = {
      id: teacherRow.id,
      email,
      password: "not-used",
      cookieHeader,
    };

    const response = await api.post("/api/lesson-plans", {
      headers: { Cookie: teacher.cookieHeader },
      data: {
        title: planTitle,
        language: "ar",
        gradeLevel: "الصف الخامس",
        subject: "العلوم",
        durationMinutes: 45,
        sections: {
          objectives: ["أن يفسّر الطالب دورة الماء"],
          materials: ["بطاقات تعليمية"],
          vocabulary: [{ term: "التبخر", definition: "تحول الماء إلى بخار" }],
          warmUp: { durationMinutes: 5, description: "مراجعة حالات المادة" },
          introduction: { durationMinutes: 5, description: "عرض صورة لدورة الماء" },
          activities: [{
            title: "ترتيب مراحل الدورة",
            durationMinutes: 20,
            description: "يرتب الطلاب بطاقات المراحل في مجموعات",
          }],
          assessment: {
            method: "بطاقة خروج",
            description: "يكتب الطالب مراحل دورة الماء بالترتيب",
          },
          closure: { description: "تلخيص المفاهيم الرئيسة" },
          homework: { description: "رسم دورة الماء وتسميتها" },
          differentiation: {
            support: "استخدام بطاقات مصورة",
            extension: "تفسير أثر الحرارة في سرعة التبخر",
          },
          notes: "مراجعة نتائج بطاقة الخروج",
        },
        settings: {
          includeObjectives: true,
          includeMaterials: true,
          includeVocabulary: true,
          includeWarmUp: true,
          includeIntroduction: true,
          includeActivities: true,
          includeAssessment: true,
          includeClosure: true,
          includeHomework: true,
          includeDifferentiation: true,
          includeNotes: true,
          headerNote: "الفصل الدراسي الأول",
          footerNote: "إعداد قسم العلوم",
          fontFamily: "cairo",
          fontSizePt: 13,
        },
      },
    });
    if (!response.ok()) {
      throw new Error(`Lesson plan seed failed: ${response.status()} ${await response.text()}`);
    }
    lessonPlanId = (await response.json()).id;
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await pool.end();
});

test.beforeEach(async ({ context, baseURL }) => {
  await attachSession(context, baseURL!, teacher);
});

test("saved Arabic lesson plan keeps direction, section order, and core styling in Word", async ({
  page,
}) => {
  await page.goto(`/teacher/lesson-plans/${lessonPlanId}/print`);
  const printable = page.locator("#lp-printable-root");
  await expect(printable).toBeVisible({ timeout: 20_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "وورد", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`${planTitle}.doc`);

  const wordPath = await download.path();
  expect(wordPath).not.toBeNull();
  const wordHtml = (await readFile(wordPath!)).toString("utf8").replace(/^\uFEFF/, "");
  const wordDocument = new JSDOM(wordHtml).window.document;

  expect(wordDocument.documentElement.getAttribute("lang")).toBe("ar");
  expect(wordDocument.documentElement.getAttribute("dir")).toBe("rtl");
  expect(wordDocument.body.getAttribute("dir")).toBe("rtl");
  expect(wordDocument.querySelector(".lp-page")?.getAttribute("dir")).toBe("rtl");

  const exportedSectionTitles = Array.from(
    wordDocument.querySelectorAll(".lp-section-name"),
    element => element.textContent?.trim(),
  );
  expect(exportedSectionTitles).toEqual(expectedSectionTitles);

  const styles = wordDocument.querySelector("style")?.textContent ?? "";
  expect(styles).toContain(".WordSection1 .lp-page");
  expect(styles).toContain(".lp-section");
  expect(styles).toContain(".lp-vocab");
  expect(styles).toContain(".lp-activity");
  expect(wordDocument.querySelector(".lp-title")?.getAttribute("style")).toContain("Cairo");
  expect(wordDocument.querySelectorAll(".lp-row-2 .lp-section")).toHaveLength(2);
  expect(wordDocument.querySelectorAll(".lp-vocab tbody tr")).toHaveLength(1);
  expect(wordDocument.querySelectorAll(".lp-activity")).toHaveLength(1);
});