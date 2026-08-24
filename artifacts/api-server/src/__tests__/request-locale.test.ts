import { describe, expect, it } from "vitest";
import { localizeApiMessages, resolveRequestLocale } from "../lib/request-locale";

function request(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    body: {},
    headers: {},
    ...overrides,
  } as any;
}

describe("resolveRequestLocale", () => {
  it("uses an explicit request language before browser preferences", () => {
    expect(resolveRequestLocale(request({
      body: { language: "en" },
      headers: { "accept-language": "ar-SA,ar;q=0.9" },
    }))).toBe("en");
  });

  it("uses Accept-Language and remains Arabic-first by default", () => {
    expect(resolveRequestLocale(request({ headers: { "accept-language": "en-US,en;q=0.9" } }))).toBe("en");
    expect(resolveRequestLocale(request())).toBe("ar");
  });

  it("localizes feedback fields without changing response contracts", () => {
    let responseBody: unknown;
    const headers: Record<string, string> = {};
    const res = {
      json: (body: unknown) => { responseBody = body; return res; },
      setHeader: (name: string, value: string) => { headers[name] = value; },
    } as any;

    localizeApiMessages(
      request({ headers: { "accept-language": "en" } }),
      res,
      () => res.json({ message: "يجب تسجيل الدخول", limitReached: true, code: "AUTH_REQUIRED" }),
    );

    expect(responseBody).toEqual({
      message: "You must sign in",
      limitReached: true,
      code: "AUTH_REQUIRED",
    });
    expect(headers["Content-Language"]).toBe("en");
  });

  it.each([
    { locale: "en", expected: "Unauthorized request" },
    { locale: "ar", expected: "طلب غير مصرح" },
  ])("localizes CSRF/origin rejection feedback in $locale", ({ locale, expected }) => {
    let responseBody: unknown;
    let responseStatus: number | undefined;
    const headers: Record<string, string> = {};
    const res = {
      status: (status: number) => { responseStatus = status; return res; },
      json: (body: unknown) => { responseBody = body; return res; },
      setHeader: (name: string, value: string) => { headers[name] = value; },
    } as any;

    localizeApiMessages(
      request({ headers: { "accept-language": locale } }),
      res,
      () => res.status(403).json({ message: "طلب غير مصرح" }),
    );

    expect(responseBody).toEqual({ message: expected });
    expect(responseStatus).toBe(403);
    expect(headers["Content-Language"]).toBe(locale);
  });

  it.each([
    {
      locale: "en",
      expected: "Unsupported file type. Allowed: PDF, PPTX, Word, Excel, and images",
    },
    {
      locale: "ar",
      expected: "نوع الملف غير مدعوم. المقبول: PDF، PPTX، Word، Excel، وصور",
    },
  ])("returns presentation upload validation feedback in $locale", ({ locale, expected }) => {
    let responseBody: unknown;
    let responseStatus: number | undefined;
    const headers: Record<string, string> = {};
    const res = {
      status: (status: number) => { responseStatus = status; return res; },
      json: (body: unknown) => { responseBody = body; return res; },
      setHeader: (name: string, value: string) => { headers[name] = value; },
    } as any;

    localizeApiMessages(
      request({ headers: { "accept-language": locale } }),
      res,
      () => res.status(400).json({
        message: "Unsupported file type. Allowed: PDF, PPTX, Word, Excel, and images",
      }),
    );

    expect(responseBody).toEqual({ message: expected });
    expect(responseStatus).toBe(400);
    expect(headers["Content-Language"]).toBe(locale);
  });
});