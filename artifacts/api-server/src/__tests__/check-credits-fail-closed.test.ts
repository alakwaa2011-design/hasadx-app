/* Fail-closed checkCredits middleware tests.

   When credit verification/hold fails UNEXPECTEDLY (DB down, settings read
   error, hold transaction error), the request must be BLOCKED with 503 before
   any paid AI provider is reached — never allowed through (fail-open) and
   never presented as "insufficient credits" (402).

   Also verifies:
   - insufficient balance → 402 with INSUFFICIENT_CREDITS (still blocked)
   - success path → next() with hold attached
*/
import { describe, it, expect, beforeEach, vi } from "vitest";

/* Mutable behaviour knobs read by the mocks */
const state = vi.hoisted(() => ({
  settingsRows: [{ creditsEnabled: true, adminCreditTestMode: false }] as any[],
  settingsThrow: false,
  teacherRows: [{ unlimitedCredits: false }] as any[],
  holdImpl: null as null | (() => Promise<any>),
}));

vi.mock("@workspace/db", () => {
  let selectCall = 0;
  function makeChain(getResult: () => unknown): any {
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === "then") {
          const p = Promise.resolve().then(() => {
            if (state.settingsThrow && selectCall === 1) throw new Error("db read failed");
            return getResult();
          });
          return p.then.bind(p);
        }
        if (prop === "catch" || prop === "finally") {
          const p = Promise.resolve(getResult());
          return (p as any)[prop].bind(p);
        }
        return () => makeChain(getResult);
      },
    };
    return new Proxy({}, handler);
  }
  const dbObj = {
    select: () => {
      selectCall++;
      const call = selectCall;
      // 1st select = platform settings, 2nd = teacher unlimited lookup
      return makeChain(() => (call === 1 ? state.settingsRows : state.teacherRows));
    },
    insert: () => makeChain(() => []),
  };
  // reset counter between tests via exported hook on the mock object
  (dbObj as any).__resetSelectCount = () => { selectCall = 0; };
  const stub = new Proxy({}, { get: () => "stub" });
  return new Proxy({ db: dbObj }, {
    has: () => true, // vitest validates exports with `in` — claim every export
    get(target, prop) {
      if (prop in target) return (target as any)[prop];
      return stub;
    },
  });
});

vi.mock("../lib/credit-service", () => ({
  CreditService: {
    hold: (..._a: any[]) => {
      if (state.holdImpl) return state.holdImpl();
      return Promise.resolve({ creditsHeld: 5, existingStatus: null });
    },
  },
}));

function makeReqRes(teacherId: number | undefined = 7) {
  const req: any = {
    session: teacherId ? { teacherId } : {},
    get: () => undefined,
    log: { error: vi.fn() },
  };
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  const next = vi.fn();
  return { req, res, next };
}

async function freshMiddleware() {
  vi.resetModules();
  const dbMod: any = await import("@workspace/db");
  dbMod.db.__resetSelectCount();
  const mod = await import("../lib/check-credits");
  return mod.checkCredits("tts");
}

beforeEach(() => {
  state.settingsRows = [{ creditsEnabled: true, adminCreditTestMode: false }];
  state.settingsThrow = false;
  state.teacherRows = [{ unlimitedCredits: false }];
  state.holdImpl = null;
});

describe("checkCredits fail-closed", () => {
  it("hold يرمي خطأ غير متوقع → 503 ولا يمر الطلب إلى المزود", async () => {
    state.holdImpl = () => Promise.reject(new Error("connection terminated"));
    const mw = await freshMiddleware();
    const { req, res, next } = makeReqRes();
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("CREDITS_CHECK_UNAVAILABLE");
    expect(res.body.message).toContain("تعذر التحقق");
    expect(req.log.error).toHaveBeenCalled();
  });

  it("فشل قراءة إعدادات المنصة → 503 وليس مروراً مجانياً", async () => {
    state.settingsThrow = true;
    const mw = await freshMiddleware();
    const { req, res, next } = makeReqRes();
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe("CREDITS_CHECK_UNAVAILABLE");
  });

  it("خطأ التحقق لا يُعرض كأنه رصيد غير كافٍ (لا 402)", async () => {
    state.holdImpl = () => Promise.reject(new Error("unexpected infra error"));
    const mw = await freshMiddleware();
    const { req, res, next } = makeReqRes();
    await mw(req, res, next);
    expect(res.statusCode).not.toBe(402);
    expect(res.body.code).not.toBe("INSUFFICIENT_CREDITS");
  });

  it("رصيد غير كافٍ → 402 INSUFFICIENT_CREDITS (يظل محجوباً قبل المزود)", async () => {
    state.holdImpl = () => {
      const err: any = new Error("رصيد غير كافٍ");
      err.required = 5;
      err.balance = 2;
      return Promise.reject(err);
    };
    const mw = await freshMiddleware();
    const { req, res, next } = makeReqRes();
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect(res.body.code).toBe("INSUFFICIENT_CREDITS");
  });

  it("النجاح → next() مع hold مرفق بالطلب", async () => {
    const mw = await freshMiddleware();
    const { req, res, next } = makeReqRes();
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.__creditRequestId).toBeTruthy();
    expect(req.__creditsHeld).toBe(5);
  });

  it("بلا جلسة معلم → يمر (المسار نفسه يرفض 401) ولا حجز", async () => {
    const mw = await freshMiddleware();
    const { req, res, next } = makeReqRes(null as any);
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.__creditRequestId).toBeUndefined();
  });
});
