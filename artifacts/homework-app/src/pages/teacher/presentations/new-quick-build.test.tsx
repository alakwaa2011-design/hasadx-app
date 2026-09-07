import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setLocation, creditAwareFetch } = vi.hoisted(() => ({
  setLocation: vi.fn(),
  creditAwareFetch: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/presentations/new", setLocation],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

vi.mock("@/lib/nav-history", () => ({
  useSmartBack: () => vi.fn(),
}));

vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => vi.fn(),
}));

vi.mock("@/lib/credit-aware-fetch", () => ({
  creditAwareFetch,
  isInsufficientCreditsResponse: () => false,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetCurrentTeacher: () => ({
    data: { id: 1, name: "معلم" },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("./builder", () => ({
  AiPresentationBuilder: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_, tag: string) => ({ children, ...props }: any) => {
      const {
        initial, animate, exit, transition, layout, whileTap, whileHover,
        ...domProps
      } = props;
      const Tag = tag as keyof React.JSX.IntrinsicElements;
      return <Tag {...domProps}>{children}</Tag>;
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import NewPresentationPage from "./new";

let container: HTMLDivElement;
let root: Root;

function clickButton(label: string) {
  const button = [...container.querySelectorAll("button")]
    .find((candidate) => candidate.textContent?.includes(label));
  expect(button, `زر "${label}"`).toBeTruthy();
  button!.click();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  setLocation.mockReset();
  creditAwareFetch.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("الإنشاء السريع للعروض", () => {
  it("يفتح المحرر فوراً من presentationId ولا يستعلم عن حالة المسودة", async () => {
    creditAwareFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 41,
          outline: { slides: [{ title: "المقدمة", kind: "content" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presentationId: 87 }),
      });

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PATCH");
      return { ok: true, json: async () => ({}) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<NewPresentationPage />);
    });
    await act(async () => clickButton("إنشاء سريع"));

    const topic = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(topic).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(topic, "دورة الماء");
      topic.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      clickButton("أنشئ الحصة الآن");
    });

    expect(creditAwareFetch).toHaveBeenNthCalledWith(
      2,
      "/api/presentations/ai/build/41",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/presentations/drafts/41",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(setLocation).toHaveBeenCalledWith(
      "/teacher/presentations/87?draftId=41",
    );
  });

  it("ينتظر حالة المسودة ويفتح المحرر عندما يتأخر presentationId", async () => {
    vi.useFakeTimers();
    creditAwareFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 41,
          outline: { slides: [{ title: "المقدمة", kind: "content" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    let draftPollCount = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      draftPollCount += 1;
      return {
        ok: true,
        json: async () => ({
          status: draftPollCount === 1 ? "building" : "built",
          presentationId: draftPollCount === 1 ? undefined : 93,
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<NewPresentationPage />);
    });
    await act(async () => clickButton("إنشاء سريع"));

    const topic = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(topic).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(topic, "دورة الماء");
      topic.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      clickButton("أنشئ الحصة الآن");
      await vi.advanceTimersByTimeAsync(1_600);
    });

    expect(creditAwareFetch).toHaveBeenNthCalledWith(
      2,
      "/api/presentations/ai/build/41",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/presentations/drafts/41",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(setLocation).toHaveBeenCalledWith(
      "/teacher/presentations/93?draftId=41",
    );
    vi.useRealTimers();
  });

  it.each([
    ["الصفري", 0],
    ["غير الرقمي", "not-a-presentation-id"],
  ])("يعامل presentationId %s كاستجابة ناقصة ويفحص حالة المسودة", async (_, presentationId) => {
    vi.useFakeTimers();
    creditAwareFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 41,
          outline: { slides: [{ title: "المقدمة", kind: "content" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ presentationId }),
      });

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return { ok: true, json: async () => ({}) } as Response;
      }
      expect(url).toBe("/api/presentations/drafts/41");
      return {
        ok: true,
        json: async () => ({ status: "built", presentationId: 92 }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(<NewPresentationPage />);
    });
    await act(async () => clickButton("إنشاء سريع"));

    const topic = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(topic).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(topic, "دورة الماء");
      topic.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      clickButton("أنشئ الحصة الآن");
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/presentations/drafts/41",
      { credentials: "include" },
    );
    expect(setLocation).not.toHaveBeenCalledWith(
      expect.stringMatching(`/teacher/presentations/${String(presentationId)}`),
    );
    expect(setLocation).toHaveBeenCalledWith(
      "/teacher/presentations/92?draftId=41",
    );
    vi.useRealTimers();
  });
});