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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
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
