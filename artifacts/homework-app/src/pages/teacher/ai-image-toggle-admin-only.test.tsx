/**
 * سياسة: خيار «توليد صورة لكل سؤال» أداة داخلية للمسؤول فقط.
 * يتحقق هذا الملف أن الزر لا يظهر إطلاقاً في منشئ النشاط لأي معلم عادي
 * (Free/Basic/Pro — أي أن /auth/me لا يعيد isAdmin)، ويظهر للمسؤول فقط،
 * وأن بقية طرق إضافة الأسئلة (يدوي / نصي بالذكاء / استخراج / بنك الأسئلة)
 * تبقى ظاهرة كما هي للجميع.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let tutorialTeacherId: number | undefined;

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => (props: any) => {
    const { initial, animate, exit, transition, layout, whileTap, whileHover, ...rest } = props;
    return <div {...rest} />;
  }}),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/create", vi.fn()],
  useRoute: () => [false, {}],
  Link: ({ children }: any) => <>{children}</>,
}));
vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useCreateAssignment: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useGetCurrentTeacher: () => ({ data: tutorialTeacherId ? { id: tutorialTeacherId } : undefined }),
}));
vi.mock("@/components/credits-chip", () => ({
  useCreditsBalance: () => ({ data: { balance: 50 }, refetch: vi.fn() }),
  useRefreshCreditsBalance: () => vi.fn(),
}));

import CreateAssignment from "./create-assignment";

const IMG_TOGGLE_AR = "توليد صورة لكل سؤال";

let container: HTMLDivElement;
let root: Root;

function mockAuthMe(isAdmin: boolean) {
  vi.stubGlobal("fetch", vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes("/auth/me")) {
      return { ok: true, json: async () => ({ id: 1, name: "معلم", isAdmin }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }));
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <I18nProvider>
          <CreateAssignment />
        </I18nProvider>
      </QueryClientProvider>,
    );
  });
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function setTextValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** ينتقل لخطوة الأسئلة ويفتح لوحة التوليد بالذكاء */
async function openAiPanel() {
  /* الخطوة 1 → 2: زر المتابعة يتفعل بعد إدخال العنوان */
  const title = container.querySelector('input') as HTMLInputElement;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(title, "نشاط اختبار");
    title.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const next = container.querySelector('[data-testid="btn-wizard-next"]') as HTMLButtonElement;
  expect(next, "زر المتابعة للخطوة الثانية").toBeTruthy();
  await act(async () => { next!.click(); });
  const aiBtn = container.querySelector('[data-testid="btn-method-ai"]') as HTMLButtonElement;
  expect(aiBtn, "زر طريقة التوليد بالذكاء").toBeTruthy();
  await act(async () => { aiBtn.click(); });
}

beforeEach(() => {
  localStorage.removeItem("hw_lang");
  tutorialTeacherId = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.removeItem("hw_lang");
  localStorage.removeItem("hasaad:tutorial:create-assignment:v1:41");
  vi.unstubAllGlobals();
});

describe("شرح إنشاء الواجب", () => {
  it("يحفظ إخفاء التلميح محليًا لحساب المعلم ويبقي زر الشرح متاحًا", async () => {
    tutorialTeacherId = 41;
    mockAuthMe(false);
    renderPage();
    await settle();
    expect(container.querySelector('[data-testid="notice-assignment-tutorial"]')).toBeTruthy();
    await act(async () => {
      (container.querySelector('[data-testid="button-dismiss-assignment-tutorial-hint"]') as HTMLButtonElement).click();
    });
    expect(localStorage.getItem("hasaad:tutorial:create-assignment:v1:41")).toBe("dismissed");
    expect(container.querySelector('[data-testid="notice-assignment-tutorial"]')).toBeNull();
    await act(async () => {
      (container.querySelector('[data-testid="button-tutorial-video"]') as HTMLButtonElement).click();
    });
    expect((document.querySelector('[data-testid="iframe-tutorial-video"]') as HTMLIFrameElement).src)
      .toBe("https://www.youtube-nocookie.com/embed/oMaDMEM40l4");
  });
});

describe("خيار توليد الصور بالذكاء — للمسؤول فقط", () => {
  it("لا يظهر لمعلم عادي (Free/Basic/Pro) ولا أي تلميح له", async () => {
    mockAuthMe(false);
    renderPage();
    await act(async () => {}); // يترك fetch /auth/me يكتمل
    await openAiPanel();
    expect(container.textContent).not.toContain(IMG_TOGGLE_AR);
    expect(container.textContent).not.toContain("Generate an image per question");
    /* لوحة التوليد النصي نفسها ما زالت تعمل */
    expect(container.textContent).toContain("توليد");
  });

  it("يظهر للمسؤول فقط", async () => {
    mockAuthMe(true);
    renderPage();
    await act(async () => {});
    await openAiPanel();
    expect(container.textContent).toContain(IMG_TOGGLE_AR);
  });

  it("طرق الأسئلة الأخرى تبقى ظاهرة للمعلم العادي دون تغيير", async () => {
    mockAuthMe(false);
    renderPage();
    await act(async () => {});
    const title = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(title, "نشاط اختبار");
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const next = container.querySelector('[data-testid="btn-wizard-next"]') as HTMLButtonElement;
    await act(async () => { next!.click(); });
    expect(container.querySelector('[data-testid="btn-method-ai"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="btn-method-file"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="btn-method-bank"]')).toBeTruthy();
  });
});

describe("سعر استخراج الأسئلة عند إعادة فتح اللوحة", () => {
  it("يمسح السعر القديم فورًا ويبقي الاستخراج معطّلًا حتى ينجح السعر الجديد", async () => {
    let resolveSecondPrice!: (value: Response) => void;
    const secondPrice = new Promise<Response>(resolve => {
      resolveSecondPrice = resolve;
    });
    let priceCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/extract_questions_from_source")) {
        priceCalls += 1;
        return priceCalls === 1
          ? Promise.resolve(response({ effectiveCost: 3, baseCost: 3, isPro: false, balance: 50, creditsEnabled: true }))
          : secondPrice;
      }
      if (url.includes("/auth/me")) return Promise.resolve(response({ id: 1, isAdmin: false }));
      return Promise.resolve(response({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await settle();

    const title = container.querySelector("input") as HTMLInputElement;
    setTextValue(title, "نشاط اختبار");
    await act(async () => {
      (container.querySelector('[data-testid="btn-wizard-next"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="btn-method-file"]') as HTMLButtonElement).click();
    });
    await settle();

    const pasteText = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent?.includes("لصق نص")) as HTMLButtonElement;
    await act(async () => pasteText.click());
    setTextValue(
      container.querySelector('[data-testid="input-extract-source-text"]') as HTMLTextAreaElement,
      "نص تعليمي صالح للاستخراج",
    );
    expect((container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      (container.querySelector('[data-testid="btn-close-extract-panel"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="section-other-methods"] > button') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="btn-open-extract-panel"]') as HTMLButtonElement).click();
    });

    const extract = container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement;
    expect(extract.disabled).toBe(true);
    extract.click();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/worksheets/ai/extract"))).toBe(false);

    await act(async () => resolveSecondPrice(response(
      { effectiveCost: 5, baseCost: 5, isPro: false, balance: 50, creditsEnabled: true },
    )));
    await settle();
    expect((container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector('[data-testid="text-extract-cost"]')?.textContent).toContain("5 نقاط حصاد");
  });

  it("يشرح فشل تحميل السعر ويبقي الاستخراج معطّلًا حتى تنجح إعادة المحاولة", async () => {
    let resolveRetryPrice!: (value: Response) => void;
    const retryPrice = new Promise<Response>(resolve => {
      resolveRetryPrice = resolve;
    });
    let priceCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/extract_questions_from_source")) {
        priceCalls += 1;
        return priceCalls === 1
          ? Promise.resolve(response({}, 503))
          : retryPrice;
      }
      if (url.includes("/auth/me")) return Promise.resolve(response({ id: 1, isAdmin: false }));
      return Promise.resolve(response({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await settle();

    setTextValue(container.querySelector("input") as HTMLInputElement, "نشاط اختبار");
    await act(async () => {
      (container.querySelector('[data-testid="btn-wizard-next"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="btn-method-file"]') as HTMLButtonElement).click();
    });
    await settle();
    const pasteText = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent?.includes("لصق نص")) as HTMLButtonElement;
    await act(async () => pasteText.click());
    setTextValue(
      container.querySelector('[data-testid="input-extract-source-text"]') as HTMLTextAreaElement,
      "نص تعليمي صالح للاستخراج",
    );
    expect((container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-testid="extract-price-error"]')?.textContent)
      .toContain("تعذّر تحميل تكلفة الاستخراج");

    await act(async () => {
      (container.querySelector('[data-testid="btn-retry-extract-price"]') as HTMLButtonElement).click();
    });
    expect((container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-testid="extract-price-loading"]')?.textContent)
      .toContain("جاري تحميل تكلفة الاستخراج");

    await act(async () => resolveRetryPrice(response({
      effectiveCost: 4,
      baseCost: 4,
      isPro: false,
      balance: 50,
      creditsEnabled: true,
    })));
    await settle();

    expect(priceCalls).toBe(2);
    expect(container.querySelector('[data-testid="extract-price-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="text-extract-cost"]')?.textContent).toContain("4 نقاط حصاد");
    expect((container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it("يعرض فشل السعر وإعادة المحاولة بالإنجليزية ثم يفعّل الاستخراج بعد نجاح السعر", async () => {
    localStorage.setItem("hw_lang", "en");
    let resolveRetryPrice!: (value: Response) => void;
    const retryPrice = new Promise<Response>(resolve => {
      resolveRetryPrice = resolve;
    });
    let priceCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/extract_questions_from_source")) {
        priceCalls += 1;
        return priceCalls === 1
          ? Promise.resolve(response({}, 503))
          : retryPrice;
      }
      if (url.includes("/auth/me")) return Promise.resolve(response({ id: 1, isAdmin: false }));
      return Promise.resolve(response({}));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await settle();

    setTextValue(container.querySelector("input") as HTMLInputElement, "Test assignment");
    await act(async () => {
      (container.querySelector('[data-testid="btn-wizard-next"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="btn-method-file"]') as HTMLButtonElement).click();
    });
    await settle();
    const pasteText = Array.from(container.querySelectorAll("button"))
      .find(button => button.textContent?.includes("Paste text")) as HTMLButtonElement;
    await act(async () => pasteText.click());
    setTextValue(
      container.querySelector('[data-testid="input-extract-source-text"]') as HTMLTextAreaElement,
      "Valid educational source text",
    );

    const extract = container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement;
    expect(extract.disabled).toBe(true);
    expect(container.querySelector('[data-testid="extract-price-error"]')?.textContent)
      .toContain("We couldn't load the extraction cost. Retry to enable extraction.");
    expect(container.querySelector('[data-testid="btn-retry-extract-price"]')?.textContent)
      .toContain("Retry");

    await act(async () => {
      (container.querySelector('[data-testid="btn-retry-extract-price"]') as HTMLButtonElement).click();
    });
    expect(extract.disabled).toBe(true);
    expect(container.querySelector('[data-testid="extract-price-loading"]')?.textContent)
      .toContain("Loading extraction cost");

    await act(async () => resolveRetryPrice(response({
      effectiveCost: 4,
      baseCost: 4,
      isPro: false,
      balance: 50,
      creditsEnabled: true,
    })));
    await settle();

    expect(priceCalls).toBe(2);
    expect(container.querySelector('[data-testid="extract-price-error"]')).toBeNull();
    expect(container.querySelector('[data-testid="text-extract-cost"]')?.textContent)
      .toContain("4 Hasad credits will be used for this extraction.");
    expect((container.querySelector('[data-testid="btn-extract-source"]') as HTMLButtonElement).disabled).toBe(false);
  });
});
