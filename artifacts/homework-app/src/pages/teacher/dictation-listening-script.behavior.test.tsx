import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/lib/i18n";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/dictation/create", vi.fn()],
}));

vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import DictationCreate from "./dictation-create";

type DeferredResponse = {
  promise: Promise<Response>;
  resolve: (response: Response) => void;
};

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function deferredResponse(): DeferredResponse {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function byTestId(id: string) {
  const element = document.querySelector(`[data-testid="${id}"]`);
  expect(element, `Expected data-testid="${id}"`).toBeTruthy();
  return element as HTMLElement;
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

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openGenerator() {
  setTextValue(
    document.querySelector("input") as HTMLInputElement,
    "نشاط الاستماع",
  );
  await act(async () => byTestId("button-listening-wizard-primary").click());
  await act(async () => byTestId("button-open-listening-script-generator").click());
  setTextValue(
    byTestId("input-listening-script-topic") as HTMLTextAreaElement,
    "قصة عن الصدق",
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("hw_lang", "ar");
  window.history.replaceState({}, "", "/teacher/dictation/create");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("سعر توليد نص الاستماع", () => {
  it("يعطّل الإنشاء حتى يصل السعر ثم يعرض التكلفة القادمة من الخادم", async () => {
    const price = deferredResponse();
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/listening-script")) return price.promise;
      if (url.includes("/api/teacher/grade-levels")) return Promise.resolve(response([]));
      return Promise.resolve(response({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider><DictationCreate /></I18nProvider>
      </QueryClientProvider>,
    ));
    await openGenerator();

    const generate = byTestId("button-generate-listening-script") as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    expect(byTestId("listening-script-credit-price").textContent).toContain("جارٍ تحميل تكلفة الإنشاء");
    generate.click();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/listening-script/generate"))).toBe(false);

    await act(async () => price.resolve(response({ effectiveCost: 7, creditsEnabled: true })));
    await settle();

    expect(byTestId("listening-script-credit-price").textContent).toContain("7 نقاط حصاد");
    expect(generate.textContent).toContain("7 نقاط حصاد");
    expect(generate.disabled).toBe(false);
  });

  it.each([
    {
      name: "تعطيل نظام النقاط",
      price: { effectiveCost: 9, creditsEnabled: false },
      message: "نظام نقاط حصاد معطّل حاليًا — لن تُخصم نقاط.",
    },
    {
      name: "السعر الصفري",
      price: { effectiveCost: 0, creditsEnabled: true },
      message: "إنشاء النص متاح دون خصم نقاط.",
    },
  ])("يعرض حالة $name دون إظهار تكلفة على زر الإنشاء", async ({ price, message }) => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/listening-script")) return Promise.resolve(response(price));
      if (url.includes("/api/teacher/grade-levels")) return Promise.resolve(response([]));
      return Promise.resolve(response({}));
    }));

    await act(async () => root.render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider><DictationCreate /></I18nProvider>
      </QueryClientProvider>,
    ));
    await openGenerator();
    await settle();

    expect(byTestId("listening-script-credit-price").textContent).toContain(message);
    const generate = byTestId("button-generate-listening-script") as HTMLButtonElement;
    expect(generate.textContent).toBe("إنشاء النص");
    expect(generate.disabled).toBe(false);
  });

  it("يبقي الإنشاء معطّلًا عند فشل تحميل السعر", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/listening-script")) return Promise.resolve(response({}, 503));
      if (url.includes("/api/teacher/grade-levels")) return Promise.resolve(response([]));
      return Promise.resolve(response({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider><DictationCreate /></I18nProvider>
      </QueryClientProvider>,
    ));
    await openGenerator();
    await settle();

    expect(byTestId("listening-script-credit-price").textContent).toContain("تعذّر تحميل التكلفة");
    const generate = byTestId("button-generate-listening-script") as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    generate.click();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/listening-script/generate"))).toBe(false);
  });

  it("يعطّل إعادة التوليد إلى أن يُعرف السعر بعد إعادة فتح النافذة", async () => {
    const secondPrice = deferredResponse();
    let priceCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/credits/tool-price/listening-script")) {
        priceCalls += 1;
        return priceCalls === 1
          ? Promise.resolve(response({ effectiveCost: 2, creditsEnabled: true }))
          : secondPrice.promise;
      }
      if (url.includes("/api/listening-script/generate")) {
        return Promise.resolve(response({ script: "هذا نص مولّد.", language: "ar" }));
      }
      if (url.includes("/api/teacher/grade-levels")) return Promise.resolve(response([]));
      return Promise.resolve(response({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider><DictationCreate /></I18nProvider>
      </QueryClientProvider>,
    ));
    await openGenerator();
    await settle();
    await act(async () => byTestId("button-generate-listening-script").click());
    await settle();
    expect(byTestId("button-regenerate-listening-script")).toBeTruthy();

    const closeButton = Array.from(
      byTestId("dialog-listening-script-generator").querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("إغلاق"));
    expect(closeButton).toBeTruthy();
    await act(async () => closeButton!.click());
    await act(async () => byTestId("button-open-listening-script-generator").click());

    const regenerate = byTestId("button-regenerate-listening-script") as HTMLButtonElement;
    expect(regenerate.disabled).toBe(true);
    regenerate.click();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/listening-script/generate"))).toHaveLength(1);

    await act(async () => secondPrice.resolve(response({ effectiveCost: 4, creditsEnabled: true })));
    await settle();
    expect(regenerate.disabled).toBe(false);
    expect(regenerate.textContent).toContain("4 نقاط حصاد");
  });
});