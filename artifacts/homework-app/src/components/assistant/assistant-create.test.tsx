import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  quote: vi.fn(), confirm: vi.fn(), noop: vi.fn(),
  operation: {
    id: "fixture-draft", title: "دورة الماء", requestText: "ورقة عمل", reply: "جاهزة",
    parameters: { topic: "دورة الماء", subject: "العلوم", gradeLevel: "الخامس", pages: 1, language: "ar", questionSelection: "auto" },
    template: "geometric", status: "draft", missingFields: [], credits: 0,
    worksheetId: null, errorCode: null, quote: null, messages: [], updatedAt: "2026-01-01",
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/teacher", mocks.noop] }));
vi.mock("@/components/credits-chip", () => ({ useRefreshCreditsBalance: () => mocks.noop }));
vi.mock("./execution-access", () => ({ ExecutionAccess: () => null }));
vi.mock("@/pages/teacher/worksheet-themes", () => ({ THEMES: { geometric: { id: "geometric", nameAr: "هندسي", nameEn: "Geometric" } } }));
vi.mock("@workspace/api-client-react", () => ({
  getListAssistantOperationsQueryKey: () => ["operations"],
  getGetAssistantOperationQueryKey: () => ["operation"],
  useListAssistantOperations: () => ({ data: history, refetch: mocks.noop }),
  useGetAssistantOperation: () => ({ data: undefined }),
  usePrepareAssistantWorksheet: () => ({ mutate: mocks.noop }),
  useQuoteAssistantWorksheet: () => ({ mutate: mocks.quote }),
  useConfirmAssistantWorksheet: () => ({ mutate: mocks.confirm }),
  useCancelAssistantWorksheet: () => ({ mutate: mocks.noop }),
  useHideAssistantOperation: () => ({ mutate: mocks.noop }),
}));
import { AssistantCreate } from "./assistant-create";
const history = { enabled: true, operations: [mocks.operation] };
let root: Root, host: HTMLDivElement, client: QueryClient;
let price = 10;
function response(input: any, credits = price) {
  return { ...mocks.operation, ...input.data, status: "quoted", quote: { id: `quote-${credits}`, credits, expiresAt: "2099-01-01" } };
}
function button(id: string) { return host.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement; }
async function settle(ms = 30) { await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); }); }
async function open() {
  await act(async () => {
    root.render(<QueryClientProvider client={client}><AssistantCreate teacherId={1} lang="ar" seed=""
      onSeedUsed={mocks.noop} onAskGuide={mocks.noop} onNavigate={mocks.noop} /></QueryClientProvider>);
  });
  await act(async () => button("button-create-history").click());
  await act(async () => (host.querySelector('[data-testid="row-operation-fixture-draft"] button') as HTMLButtonElement).click());
  await settle();
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks(); price = 10;
  mocks.quote.mockImplementation((input, callbacks) => {
    callbacks.onSuccess(response(input)); callbacks.onSettled?.();
  });
  mocks.confirm.mockImplementation((_input, callbacks) => {
    callbacks.onSuccess({ ...mocks.operation, status: "queued", quote: response({ data: {} }).quote });
    callbacks.onSettled?.();
  });
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount()); client.clear(); host.remove(); vi.unstubAllGlobals();
});

describe("assistant automatic price and single confirmation", () => {
  it("loads price without a price button, then confirms once with a fresh quote", async () => {
    await open();
    expect(button("button-assistant-quote")).toBeNull();
    expect(button("text-assistant-price").textContent).toContain("10");
    expect(button("button-assistant-confirm").disabled).toBe(false);
    expect(mocks.quote).toHaveBeenCalledTimes(1);
    await act(async () => button("button-assistant-confirm").click());
    expect(mocks.quote).toHaveBeenCalledTimes(2);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm.mock.calls[0][0].data.quoteId).toBe("quote-10");
  });
  it("explains real account exemptions instead of presenting the trial as free", async () => {
    price = 0; await open();
    expect(button("text-assistant-price").textContent).toContain("بدون خصم نقاط لهذا الحساب");
    expect(button("text-assistant-price").title).toContain("ليس إعفاءً لتجربة Free");
    expect(button("button-assistant-confirm").disabled).toBe(false);
  });
  it("does not execute when the displayed price changes at confirmation", async () => {
    await open(); price = 12;
    await act(async () => button("button-assistant-confirm").click());
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(button("text-assistant-price").textContent).toContain("12");
    await act(async () => button("button-assistant-confirm").click());
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
  });
  it("drops stale automatic prices after an edit and refreshes the current settings", async () => {
    const pending: any[] = [];
    mocks.quote.mockImplementation((input, callbacks) => pending.push({ input, callbacks }));
    await open();
    const pages = Array.from(host.querySelectorAll("label")).find(l => l.textContent?.includes("الصفحات"))!.querySelector("select")!;
    await act(async () => {
      pages.value = "2";
      pages.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => { pending[0].callbacks.onSuccess(response(pending[0].input)); pending[0].callbacks.onSettled(); });
    expect(button("text-assistant-price").textContent).not.toContain("السعر: 10");
    await settle(300);
    expect(pending[1].input.data.parameters.pages).toBe(2);
    await act(async () => { pending[1].callbacks.onSuccess(response(pending[1].input)); pending[1].callbacks.onSettled(); });
    expect(button("button-assistant-confirm").disabled).toBe(false);
  });
});
