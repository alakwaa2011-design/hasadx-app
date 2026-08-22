import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { INSUFFICIENT_CREDITS_EVENT } from "@/lib/credit-aware-fetch";

const navigation = vi.hoisted(() => ({ setLocation: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/teacher", navigation.setLocation],
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar", dir: "rtl" }),
}));

import { InsufficientCreditsDialog } from "./insufficient-credits-dialog";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  navigation.setLocation.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderAndOpen(detail = { balance: 3, required: 10 }) {
  await act(async () => {
    root.render(<InsufficientCreditsDialog />);
  });
  await act(async () => {
    window.dispatchEvent(new CustomEvent(INSUFFICIENT_CREDITS_EVENT, { detail }));
  });
}

describe("InsufficientCreditsDialog", () => {
  it("يعرض الأرقام الخادمية ويتجاهل إشعار نقص ثانٍ أثناء فتحه", async () => {
    await renderAndOpen();

    expect(document.body.textContent).toContain("رصيد نقاط حصاد غير كافٍ");
    expect(document.body.textContent).toContain("لديك 3 نقطة");
    expect(document.body.textContent).toContain("يتطلب هذا الإجراء 10 نقطة");

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(INSUFFICIENT_CREDITS_EVENT, {
          detail: { balance: 0, required: 99 },
        }),
      );
    });

    expect(document.body.textContent).not.toContain("99 نقطة");
  });

  it("يعيد استخدام صفحات شراء النقاط والباقات ويغلق عند ليس الآن", async () => {
    await renderAndOpen();

    const buy = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "شراء نقاط",
    ) as HTMLButtonElement;
    await act(async () => buy.click());
    expect(navigation.setLocation).toHaveBeenCalledWith("/teacher/credits");
    expect(document.body.textContent).not.toContain("رصيد نقاط حصاد غير كافٍ");

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(INSUFFICIENT_CREDITS_EVENT, {
          detail: { balance: 1, required: 5 },
        }),
      );
    });
    const plans = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "عرض الباقات",
    ) as HTMLButtonElement;
    await act(async () => plans.click());
    expect(navigation.setLocation).toHaveBeenCalledWith("/teacher/pricing");

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(INSUFFICIENT_CREDITS_EVENT, {
          detail: { balance: 1, required: 5 },
        }),
      );
    });
    const notNow = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "ليس الآن",
    ) as HTMLButtonElement;
    await act(async () => notNow.click());
    expect(navigation.setLocation).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain("رصيد نقاط حصاد غير كافٍ");
  });
});