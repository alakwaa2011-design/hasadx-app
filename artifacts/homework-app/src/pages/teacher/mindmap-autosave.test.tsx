import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, element: string) => {
      const MotionElement = ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) => {
        const Tag = element as keyof React.JSX.IntrinsicElements;
        return <Tag {...props}>{children}</Tag>;
      };
      return MotionElement;
    },
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/mindmap/create", vi.fn()],
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar" }),
}));

vi.mock("@/components/credits-chip", () => ({
  useRefreshCreditsBalance: () => vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import MindMapCreate from "./mindmap-create";

const GENERATED_MAP = {
  center: "دورة الماء",
  branches: [
    {
      label: "التبخر",
      icon: "",
      color: "#225739",
      children: ["حرارة الشمس", "بخار الماء"],
    },
  ],
};

const SECOND_MAP = {
  center: "دورة الصخور",
  branches: [
    {
      label: "التجوية",
      icon: "",
      color: "#225739",
      children: ["تفتيت الصخور"],
    },
  ],
};

let container: HTMLDivElement;
let root: Root;

function response(ok: boolean, body: unknown, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function generateMap(topic = "دورة الماء") {
  const input = container.querySelector('[data-testid="input-topic"]') as HTMLTextAreaElement;
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;

  act(() => {
    valueSetter.call(input, topic);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const button = container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  await act(async () => { button.click(); });
  await flushPromises();
  await flushPromises();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<MindMapCreate />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("الحفظ التلقائي للخريطة الذهنية", () => {
  it("يحفظ ناتج التوليد الصريح فوراً ويعرض حالة النجاح", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(true, GENERATED_MAP))
      .mockResolvedValueOnce(response(true, { id: 91 }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await generateMap();

    expect(container.querySelector('[data-testid="status-saved"]')).toBeTruthy();
    expect(container.textContent).toContain("دورة الماء");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [saveUrl, saveInit] = fetchMock.mock.calls[1];
    expect(String(saveUrl)).toBe("/api/mindmaps");
    expect(saveInit.method).toBe("POST");
    const saveBody = JSON.parse(String(saveInit.body));
    expect(saveBody).toEqual({
      title: "دورة الماء",
      topic: "دورة الماء",
      language: "ar",
      depth: "standard",
      map: GENERATED_MAP,
      clientRequestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
    });
  });

  it("يبقي الخريطة ظاهرة عند فشل الحفظ ويعيد الحفظ دون إعادة التوليد", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(true, GENERATED_MAP))
      .mockResolvedValueOnce(response(false, { message: "save failed" }))
      .mockResolvedValueOnce(response(true, { id: 92 }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await generateMap();

    expect(container.querySelector('[data-testid="status-error"]')).toBeTruthy();
    expect(container.textContent).toContain("التبخر");

    const generateButton = container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement;
    const blockedGenerateButton = container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement;
    expect(blockedGenerateButton.disabled).toBe(true);
    act(() => blockedGenerateButton.click());
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryButton = container.querySelector('[data-testid="btn-retry-save"]') as HTMLButtonElement;
    await act(async () => {
      retryButton.click();
    });
    await flushPromises();

    expect(container.querySelector('[data-testid="status-saved"]')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const generationCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/ai/generate-mindmap"),
    );
    const saveCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/mindmaps"),
    );
    expect(generationCalls).toHaveLength(1);
    expect(saveCalls).toHaveLength(2);
    expect(saveCalls[1][1]?.body).toBe(saveCalls[0][1]?.body);
  });

  it("يستخدم PUT بعد أول حفظ ناجح بدلاً من إنشاء صف مكرر", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(true, GENERATED_MAP))
      .mockResolvedValueOnce(response(true, { id: 93 }, 201))
      .mockResolvedValueOnce(response(true, {
        ...GENERATED_MAP,
        center: "دورة الماء المحدثة",
      }))
      .mockResolvedValueOnce(response(true, { id: 93 }));
    vi.stubGlobal("fetch", fetchMock);

    await generateMap();
    await generateMap();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/mindmaps");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(String(fetchMock.mock.calls[3][0])).toBe("/api/mindmaps/93");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("PUT");
  });

  it("يمنع توليداً ثانياً حتى يكتمل حفظ الأول ثم يحفظ الناتج الثاني عبر PUT", async () => {
    let resolveFirstSave!: (value: Response) => void;
    const delayedFirstSave = new Promise<Response>((resolve) => {
      resolveFirstSave = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(true, GENERATED_MAP))
      .mockReturnValueOnce(delayedFirstSave)
      .mockResolvedValueOnce(response(true, SECOND_MAP))
      .mockResolvedValueOnce(response(true, { id: 94 }));
    vi.stubGlobal("fetch", fetchMock);

    const input = container.querySelector('[data-testid="input-topic"]') as HTMLTextAreaElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    act(() => {
      valueSetter.call(input, "دورة الماء");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const generateButton = container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement;
    act(() => generateButton.click());
    await flushPromises();

    const blockedGenerateButton = container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement;
    expect(blockedGenerateButton.disabled).toBe(true);
    act(() => blockedGenerateButton.click());
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFirstSave(response(true, { id: 94 }, 201));
      await delayedFirstSave;
    });
    await flushPromises();
    expect(container.querySelector('[data-testid="status-saved"]')).toBeTruthy();
    expect((container.querySelector('[data-testid="btn-generate"]') as HTMLButtonElement).disabled).toBe(false);

    await generateMap("دورة الصخور");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[3][0])).toBe("/api/mindmaps/94");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("PUT");
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toMatchObject({
      topic: "دورة الصخور",
      map: SECOND_MAP,
    });
    expect(container.textContent).toContain("دورة الصخور");
    expect(container.querySelector('[data-testid="status-saved"]')).toBeTruthy();
  });
});