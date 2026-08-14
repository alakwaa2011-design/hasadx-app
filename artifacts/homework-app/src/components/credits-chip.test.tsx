/**
 * اختبارات وحدة لمكوّن CreditsChip
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── top-level mocks ────────────────────────────────────────────────────────
vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/dashboard", vi.fn()],
}));

import { CreditsChip } from "./credits-chip";

// ── helpers ──────────────────────────────────────────────────────────────────
function makeFetch(balance: number | "error") {
  if (balance === "error") {
    return vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
  }
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ balance }),
  } as Response);
}

function Wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

async function render() {
  await act(async () => {
    root.render(
      <Wrap>
        <CreditsChip />
      </Wrap>,
    );
  });
  // انتظار اكتمال fetch+useQuery
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return () => container.textContent ?? "";
}

// ── tests ────────────────────────────────────────────────────────────────────
describe("CreditsChip", () => {
  it("يعرض الرصيد بالأرقام اللاتينية عند نجاح الجلب", async () => {
    vi.stubGlobal("fetch", makeFetch(400));
    const text = await render();
    expect(text()).toContain("400");
    expect(text()).not.toContain("٤٠٠");
  });

  it("لا يعرض رقمًا عند فشل الجلب — الزر لا يزال موجودًا وقابلًا للنقر", async () => {
    vi.stubGlobal("fetch", makeFetch("error"));
    await render();
    const btn = container.querySelector("button[aria-label]");
    expect(btn).not.toBeNull();
    // لا رقم مضلل (نص الزر فارغ أو يحتوي فقط على الأيقونة)
    expect(container.textContent?.trim()).toBe("");
  });

  it("الزر يحمل aria-label يشمل «نقاط حصاد»", async () => {
    vi.stubGlobal("fetch", makeFetch(150));
    await render();
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("aria-label")).toMatch(/نقاط حصاد/);
  });

  it("يعرض الرصيد 0 بشكل صحيح بعد نجاح الجلب", async () => {
    vi.stubGlobal("fetch", makeFetch(0));
    const text = await render();
    // يعرض "0" لأن fetch نجح ورجع balance=0
    expect(text()).toContain("0");
  });

  it("لا يستخدم window.open — التنقل فقط عبر setLocation", async () => {
    vi.stubGlobal("fetch", makeFetch(150));
    // نتأكد أن window.open لم يُعرَّف من المكوّن
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    await render();
    const btn = container.querySelector("button") as HTMLButtonElement;
    await act(async () => { btn.click(); });
    // لم ينادِ window.open
    expect(openSpy).not.toHaveBeenCalled();
  });
});
