import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ lang: "ar", dir: "rtl" }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

import { MotivationSection } from "./motivation-section";

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
});

describe("MotivationSection", () => {
  it("يعرّف لقطة اللوحة بنص بديل وأنماط تمنع القص", async () => {
    await act(async () => {
      root.render(<MotivationSection />);
    });

    const image = container.querySelector(
      '[data-testid="img-motivation-board"]',
    ) as HTMLImageElement | null;

    expect(image).not.toBeNull();
    expect(image?.alt).toBe("لوحة التحفيز الأصلية في حصاد");
    expect(image?.classList.contains("w-full")).toBe(true);
    expect(image?.classList.contains("h-auto")).toBe(true);
    expect(image?.classList.contains("object-contain")).toBe(true);
    expect(image?.classList.contains("object-cover")).toBe(false);
  });
});