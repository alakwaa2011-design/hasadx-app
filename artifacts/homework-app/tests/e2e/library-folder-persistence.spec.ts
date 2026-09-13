import { expect, test } from "@playwright/test";
import {
  db,
  pool,
  teachersTable,
} from "../../../../lib/db/src/index.ts";
import { attachSession, newApi, type TestTeacher } from "./helpers";

test.setTimeout(120_000);

type LibraryFixture = {
  teacher: TestTeacher;
  rootName: string;
  childName: string;
  fileName: string;
};

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function createVerifiedTeacher(
  baseURL: string,
): Promise<TestTeacher> {
  const suffix = uniqueSuffix();
  const email = `e2e-library-${suffix}@example.com`;
  const otp = "995000";
  const [teacher] = await db
    .insert(teachersTable)
    .values({
      name: `E2E Library ${suffix}`,
      email,
      passwordHash: "e2e-library-fixture",
      verificationOtp: otp,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      emailVerified: false,
      role: "teacher",
      isBlocked: false,
    })
    .returning({ id: teachersTable.id });
  if (!teacher) throw new Error("Could not create library teacher fixture");

  const api = await newApi(baseURL);
  try {
    const response = await api.post("/api/auth/verify-otp", {
      data: { identifier: email, otp },
    });
    if (!response.ok()) {
      throw new Error(
        `Could not verify library teacher: ${response.status()} ${await response.text()}`,
      );
    }
    const cookieHeader = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split(";")[0])
      .find(
        (value) =>
          value.startsWith("connect.sid=") || value.startsWith("session="),
      );
    if (!cookieHeader) {
      throw new Error("OTP verification did not establish a teacher session");
    }
    return {
      id: teacher.id,
      email,
      password: "not-used-after-otp-verification",
      cookieHeader,
    };
  } finally {
    await api.dispose();
  }
}

async function createFolder(
  api: Awaited<ReturnType<typeof newApi>>,
  teacher: TestTeacher,
  name: string,
  parentGroupId: number | null = null,
): Promise<{ id: number }> {
  const response = await api.post("/api/library/groups", {
    headers: { Cookie: teacher.cookieHeader },
    data: { name, parentGroupId },
  });
  if (!response.ok()) {
    throw new Error(`Could not create folder: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

test.describe("teacher library folder persistence", () => {
  let fixture: LibraryFixture | undefined;
  let teacherId: number | undefined;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error("baseURL is required");
    if (
      !process.env.TEST_DATABASE_URL ||
      process.env.E2E_DATABASE_ISOLATED !== "1" ||
      process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL
    ) {
      throw new Error("Library E2E fixtures require the isolated TEST_DATABASE_URL");
    }

    const teacher = await createVerifiedTeacher(baseURL);
    teacherId = teacher.id;
    const suffix = uniqueSuffix();
    fixture = {
      teacher,
      rootName: `مجلد المكتبة ${suffix}`,
      childName: `ملفات الدرس ${suffix}`,
      fileName: `درس محفوظ ${suffix}.pdf`,
    };
  });

  test.afterAll(async () => {
    if (teacherId) {
      await pool.query("DELETE FROM teachers WHERE id = $1", [teacherId]);
    }
    await pool.end();
  });

  test("keeps nested folders and an uploaded file in place after navigation and reload", async ({
    page,
    context,
    baseURL,
  }) => {
    if (!fixture || !baseURL) throw new Error("Library fixture is unavailable");
    await attachSession(context, baseURL, fixture.teacher);

    await page.goto("/teacher/library");
    await page.getByRole("tab", { name: "الملفات", exact: true }).click();
    await expect(page.getByTestId("btn-add-group")).toBeVisible();

    const rootResponse = await page.request.post("/api/library/groups", {
      headers: { Cookie: fixture.teacher.cookieHeader },
      data: { name: fixture.rootName, parentGroupId: null },
    });
    expect(rootResponse.ok()).toBeTruthy();
    const root = await rootResponse.json() as { id: number };

    const child = await createFolder(
      page.request,
      fixture.teacher,
      fixture.childName,
      root.id,
    );

    const uploadReservation = await page.request.post("/api/library/uploads/request-url", {
      headers: { Cookie: fixture.teacher.cookieHeader },
      data: {
        name: fixture.fileName,
        size: 4,
        contentType: "application/pdf",
      },
    });
    expect(uploadReservation.ok()).toBeTruthy();
    const reservation = await uploadReservation.json() as {
      uploadURL: string;
      objectPath: string;
    };
    const upload = await page.request.put(reservation.uploadURL, {
      headers: { "Content-Type": "application/pdf" },
      data: Buffer.from("%PDF"),
    });
    expect(upload.ok()).toBeTruthy();

    const finalize = await page.request.post("/api/library/files", {
      headers: { Cookie: fixture.teacher.cookieHeader },
      data: {
        name: fixture.fileName,
        objectPath: reservation.objectPath,
        groupId: child.id,
      },
    });
    expect(finalize.ok()).toBeTruthy();
    const finalizedFile = await finalize.json() as { id: number };

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "الملفات", exact: true }).click();
    await expect(page.getByTestId(`open-group-${root.id}`)).toBeVisible();
    await expect(page.getByTestId(`file-name-${finalizedFile.id}`)).toHaveCount(0);

    await page.getByTestId(`open-group-${root.id}`).click();
    await expect(page.getByTestId(`open-group-${child.id}`)).toBeVisible();
    await expect(page.getByTestId(`file-name-${finalizedFile.id}`)).toHaveCount(0);

    await page.getByTestId(`open-group-${child.id}`).click();
    await expect(page.getByTestId(`file-name-${finalizedFile.id}`)).toHaveText(fixture.fileName);

    await page.getByRole("button", { name: fixture.rootName, exact: true }).last().click();
    await expect(page.getByTestId(`open-group-${child.id}`)).toBeVisible();
    await expect(page.getByTestId(`file-name-${finalizedFile.id}`)).toHaveCount(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "الملفات", exact: true }).click();
    await expect(page.getByTestId(`open-group-${root.id}`)).toBeVisible();
    await expect(page.getByTestId(`open-group-${child.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`file-name-${finalizedFile.id}`)).toHaveCount(0);

    await page.getByTestId(`open-group-${root.id}`).click();
    await page.getByTestId(`open-group-${child.id}`).click();
    await expect(page.getByTestId(`file-name-${finalizedFile.id}`)).toHaveText(fixture.fileName);
  });
});