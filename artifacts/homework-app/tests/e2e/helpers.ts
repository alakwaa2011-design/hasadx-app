import { request, type APIRequestContext, type BrowserContext } from "@playwright/test";

/**
 * Helpers that seed a teacher account + a fresh presentation via the
 * platform's HTTP API and hand the browser context a logged-in session
 * cookie so each spec can jump straight to the editor.
 *
 * The dev DB is shared with the user, so every run uses a unique email
 * (nanoid-ish suffix) to avoid collisions and stay idempotent.
 */
export type TestTeacher = {
  id: number;
  email: string;
  password: string;
  cookieHeader: string;
};

export type TestPresentation = {
  id: number;
  title: string;
};

function randomSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function extractSessionCookie(setCookie: string[] | undefined): Promise<string> {
  if (!setCookie || setCookie.length === 0) {
    throw new Error("API did not return a session cookie");
  }
  const sid = setCookie
    .map((line) => line.split(";")[0])
    .find((kv) => kv.startsWith("connect.sid=") || kv.startsWith("session="));
  if (!sid) throw new Error(`Unexpected Set-Cookie payload: ${setCookie.join(" | ")}`);
  return sid;
}

export async function registerTeacher(api: APIRequestContext): Promise<TestTeacher> {
  const suffix = randomSuffix();
  const email = `e2e-mobile-${suffix}@example.com`;
  const password = "Test1234!";

  const res = await api.post("/api/auth/register", {
    data: {
      name: `E2E Mobile ${suffix}`,
      email,
      password,
      role: "teacher",
    },
  });
  if (!res.ok()) {
    throw new Error(`Register failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();

  // The set-cookie header is on the same response (auto-login on register).
  const headers = res.headersArray();
  const setCookie = headers
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value);
  const cookieHeader = await extractSessionCookie(setCookie);

  return { id: body.teacher.id, email, password, cookieHeader };
}

export async function createPresentation(
  api: APIRequestContext,
  teacher: TestTeacher,
): Promise<TestPresentation> {
  const title = `E2E mobile deck ${randomSuffix()}`;
  const res = await api.post("/api/presentations", {
    headers: { Cookie: teacher.cookieHeader },
    data: { title, language: "ar" },
  });
  if (!res.ok()) {
    throw new Error(`Create presentation failed: ${res.status()} ${await res.text()}`);
  }
  const row = await res.json();

  // Replace the seed (single cover slide) with three plain slides so the
  // present-mode tap-zone test has somewhere to navigate.
  const slides = [1, 2, 3].map((n) => ({
    id: `e2e-s${n}`,
    layout: "blank",
    background: "#ffffff",
    elements: [
      {
        id: `e2e-t${n}`,
        kind: "text" as const,
        x: 80,
        y: 240,
        w: 1120,
        h: 120,
        text: `Slide ${n}`,
        fontSize: 56,
        fontWeight: "700",
        color: "#0f172a",
        align: "center",
      },
    ],
  }));
  const upd = await api.put(`/api/presentations/${row.id}`, {
    headers: { Cookie: teacher.cookieHeader },
    data: { slides },
  });
  if (!upd.ok()) {
    throw new Error(`Seed slides failed: ${upd.status()} ${await upd.text()}`);
  }

  return { id: row.id, title };
}

export async function attachSession(
  context: BrowserContext,
  baseURL: string,
  teacher: TestTeacher,
): Promise<void> {
  const url = new URL(baseURL);
  const [name, value] = teacher.cookieHeader.split("=");
  await context.addCookies([
    {
      name,
      value,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    },
  ]);
}

export async function newApi(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL, ignoreHTTPSErrors: true });
}
