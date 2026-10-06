import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(), quote: vi.fn(), confirm: vi.fn(), noop: vi.fn(),
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
  usePrepareAssistantWorksheet: () => ({ mutate: (...a: any[]) => (mocks as any).prepare(...a) }),
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
  it("shows game settings when a request switches an existing worksheet to a new game draft", async () => {
    await open();
    mocks.quote.mockImplementation((input, cb) => {
      cb.onSuccess({ ...response(input), id: "new-game", tool: "game" }); cb.onSettled?.();
    });
    mocks.prepare.mockImplementationOnce((_input: any, cb: any) => {
      cb.onSuccess({ ...mocks.operation, id: "new-game", tool: "game", parameters: {
        topic: "مكروهات الصيام", subject: "التربية الإسلامية", gradeLevel: "الرابع", gameType: "solo", questionCount: 5,
      } });
      cb.onSettled?.();
    });
    const ta = host.querySelector("textarea")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(ta, "اريد لعبة عن مكروهات الصيام للصف الرابع"); ta.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => button("button-assistant-send").click());
    await settle();
    expect(button("text-assistant-tool").textContent).toBe("لعبة");
    expect(host.querySelector('[data-testid="form-assistant-detail"]')).not.toBeNull();
    expect(host.textContent).toContain("شد الحبل");
    expect(host.textContent).toContain("إكس أو");
    expect(host.textContent).not.toContain("الصفحات");
    expect(host.querySelector('[data-testid="select-assistant-template"]')).toBeNull();
    expect(host.textContent).not.toContain("إعدادات تدريس متقدمة");
  });
  it("loads price without a price button, then confirms directly with the valid quote", async () => {
    await open();
    expect(button("button-assistant-quote")).toBeNull();
    expect(button("text-assistant-price").textContent).toContain("10");
    expect(mocks.quote).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="form-assistant-detail"]')).toBeNull();
    await act(async () => button("button-assistant-confirm").click());
    expect(mocks.quote).toHaveBeenCalledTimes(1);
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.confirm.mock.calls[0][0].data.quoteId).toBe("quote-10");
  });
  it("navigates to resultUrl for a completed non-worksheet operation", async () => {
    const done = { ...mocks.operation, id: "fixture-draft", tool: "quiz", status: "completed", resultUrl: "/teacher/quizzes/7", quote: null };
    history.operations[0] = done as any;
    await open();
    await act(async () => button("button-assistant-open-draft").click());
    expect(mocks.noop).toHaveBeenCalled();
    expect(mocks.noop).toHaveBeenCalledWith("/teacher/quizzes/7");
    history.operations[0] = mocks.operation as any;
  });
  it("sends the explicitly selected tool for a new request", async () => {
    const prep = vi.fn();
    mocks.prepare = prep;
    history.operations.length = 0;
    await act(async () => {
      root.render(<QueryClientProvider client={client}><AssistantCreate teacherId={1} lang="ar" seed=""
        onSeedUsed={mocks.noop} onAskGuide={mocks.noop} onNavigate={mocks.noop} /></QueryClientProvider>);
    });
    await act(async () => button("button-tool-game").click());
    const ta = host.querySelector("textarea")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(ta, "لعبة عن الكسور"); ta.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => button("button-assistant-send").click());
    expect(prep.mock.calls[0][0].data.tool).toBe("game");
    history.operations.push(mocks.operation as any);
  });
  it("explains real account exemptions instead of presenting the trial as free", async () => {
    price = 0; await open();
    expect(button("text-assistant-price").textContent).toContain("بدون خصم نقاط لهذا الحساب");
    expect(button("text-assistant-price").title).toContain("ليس إعفاءً لتجربة Free");
    expect(button("button-assistant-confirm").disabled).toBe(false);
  });
  it("shows the new price after a server price change and requires another confirm", async () => {
    await open();
    mocks.confirm.mockImplementationOnce((_i, cb) => { price = 12; cb.onError({ status: 409, data: { code: "PRICE_CHANGED" } }); cb.onSettled?.(); });
    await act(async () => button("button-assistant-confirm").click());
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    await settle(400);
    expect(button("text-assistant-price").textContent).toContain("12");
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    await act(async () => button("button-assistant-confirm").click());
    expect(mocks.confirm).toHaveBeenCalledTimes(2);
    expect(mocks.confirm.mock.calls[1][0].data.quoteId).toBe("quote-12");
  });
  it("drops stale automatic prices after an edit and refreshes the current settings", async () => {
    const pending: any[] = [];
    mocks.quote.mockImplementation((input, callbacks) => pending.push({ input, callbacks }));
    await open();
    await act(async () => button("button-assistant-toggle-detail").click());
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
