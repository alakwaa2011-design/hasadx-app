/**
 * اختبارات شاشة نجاح النشر — تتأكد أن زر «لعبة مباشرة» يظهر بعد نشر نشاط
 * بجانب الإجراءات الحالية دون حذفها، وأن الضغط عليه يفتح مسار نافذة
 * اختيار اللعبة الموجودة في «أنشطتي» (عبر ‎/teacher?liveGamePicker=<id>).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => (props: any) => {
    const { initial, animate, exit, transition, ...rest } = props;
    return <div {...rest} />;
  }}),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/create", vi.fn()],
  useRoute: () => [false, {}],
  Link: ({ children }: any) => <>{children}</>,
}));

import { PublishSuccessScreen } from "./create-assignment";

const PUBLISHED = {
  id: 42,
  title: "نشاط تجريبي",
  accessCode: "123456",
  accessMode: "private" as const,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(setLocation = vi.fn()) {
  act(() => {
    root.render(
      <PublishSuccessScreen publishedInfo={PUBLISHED} lang="ar" setLocation={setLocation} />,
    );
  });
  return setLocation;
}

describe("PublishSuccessScreen — زر لعبة مباشرة", () => {
  it("يعرض زر «لعبة مباشرة» بعد نشر النشاط", () => {
    render();
    const btn = container.querySelector('[data-testid="btn-live-game"]');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain("لعبة مباشرة");
  });

  it("لا يحذف أياً من الإجراءات الحالية ولا كود الدخول", () => {
    render();
    for (const id of [
      "btn-share-link",
      "btn-open-activity",
      "btn-view-results",
      "btn-back-to-activities",
      "section-access-code",
      "btn-copy-code",
    ]) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
  });

  it("الضغط عليه ينتقل إلى «أنشطتي» مع فتح نافذة اختيار اللعبة للنشاط المنشور", () => {
    const setLocation = render();
    const btn = container.querySelector('[data-testid="btn-live-game"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(setLocation).toHaveBeenCalledWith("/teacher?liveGamePicker=42");
  });

  it("يظهر أيضاً بدون كود دخول (نشاط عام)", () => {
    act(() => {
      root.render(
        <PublishSuccessScreen
          publishedInfo={{ ...PUBLISHED, accessCode: null, accessMode: "public" }}
          lang="ar"
          setLocation={vi.fn()}
        />,
      );
    });
    expect(container.querySelector('[data-testid="btn-live-game"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="section-access-code"]')).toBeNull();
  });

  it("يعرض رابط النشاط للنسخ فقط دون فتح خيارات المشاركة الأصلية", async () => {
    const nativeShare = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: nativeShare });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render();
    act(() => {
      (container.querySelector('[data-testid="btn-share-link"]') as HTMLButtonElement).click();
    });

    const linkInput = document.body.querySelector('input[aria-label="رابط النشاط"]') as HTMLInputElement;
    expect(linkInput).not.toBeNull();
    expect(linkInput.value).toMatch(/\/solve\/42$/);
    expect(nativeShare).not.toHaveBeenCalled();

    const copyButton = document.body.querySelector('[data-testid="btn-copy-share-link"]') as HTMLButtonElement;
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(linkInput.value);
  });
});
