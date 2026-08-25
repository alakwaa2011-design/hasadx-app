import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import MarwanPersonalAssistantPage from "./marwan-personal-assistant";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});

function renderPage() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<MarwanPersonalAssistantPage />);
  });
  return container;
}

describe("Marwan Personal Assistant public page", () => {
  it("renders the verification content in an Arabic RTL standalone page", () => {
    const host = renderPage();
    const page = host.querySelector('[data-testid="marwan-assistant-page"]');

    expect(page?.getAttribute("lang")).toBe("ar");
    expect(page?.getAttribute("dir")).toBe("rtl");
    expect(host.querySelector("h1")?.textContent).toBe("Marwan Personal Assistant");
    expect(host.textContent).toContain("مساعد شخصي خاص لمروان الأكوع لتنظيم المواعيد والتواصل الشخصي.");
    expect(host.textContent).toContain("هذه الصفحة تعريفية فقط");
    expect(host.textContent).toContain("لا يتم جمع أو مشاركة أي معلومات شخصية عبر هذه الصفحة.");
  });

  it("contains no login, contact form, messaging action, or platform links", () => {
    const host = renderPage();

    expect(host.querySelector("form")).toBeNull();
    expect(host.querySelector("input, textarea, button, a")).toBeNull();
    expect(host.querySelectorAll("nav, footer")).toHaveLength(0);
  });
});