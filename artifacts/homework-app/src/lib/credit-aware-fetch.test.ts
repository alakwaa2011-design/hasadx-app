import { afterEach, describe, expect, it, vi } from "vitest";
import {
  creditAwareFetch,
  INSUFFICIENT_CREDITS_EVENT,
  isInsufficientCreditsResponse,
} from "./credit-aware-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("creditAwareFetch", () => {
  it("يبلغ النافذة فقط عن عقد الخادم الصريح لنقص الرصيد ويحافظ على جسم الاستجابة", async () => {
    const response = new Response(
      JSON.stringify({
        code: "INSUFFICIENT_CREDITS",
        required: 12,
        balance: 4,
        message: "رصيد غير كافٍ",
      }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const listener = vi.fn();
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, listener);

    const result = await creditAwareFetch("/api/worksheets/ai/generate");

    expect(isInsufficientCreditsResponse(result)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      required: 12,
      balance: 4,
    });
    await expect(result.json()).resolves.toMatchObject({
      code: "INSUFFICIENT_CREDITS",
      required: 12,
      balance: 4,
    });

    window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, listener);
  });

  it("لا يبلغ النافذة عن 402 لا يحمل رمز نقص الرصيد", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "PAYMENT_REQUIRED" }), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const listener = vi.fn();
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, listener);

    const result = await creditAwareFetch("/api/example");

    expect(isInsufficientCreditsResponse(result)).toBe(false);
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, listener);
  });

  it("لا يبلغ النافذة عن استجابة ناجحة أو خطأ شبكة عام", async () => {
    const listener = vi.fn();
    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, listener);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ questions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })),
    );
    await expect(creditAwareFetch("/api/ai/generate-questions")).resolves.toHaveProperty("status", 200);
    expect(listener).not.toHaveBeenCalled();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network unavailable")));
    await expect(creditAwareFetch("/api/ai/generate-questions")).rejects.toThrow("Network unavailable");
    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, listener);
  });
});