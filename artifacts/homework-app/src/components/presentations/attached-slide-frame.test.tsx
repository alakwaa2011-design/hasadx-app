import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AttachedSlideFrame } from "./attached-slide-frame";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AttachedSlideFrame", () => {
  function mockGeometry() {
    const geometry = { availableHeight: 720, headerHeight: 60, footerHeight: 60 };
    let resize = () => {};
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1280);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => geometry.availableHeight);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-slide-actions") ? geometry.headerHeight : geometry.footerHeight;
    });
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    return { geometry, triggerResize: () => act(() => resize()) };
  }

  it("keeps launch, slide, and navigation in one frame with separate non-covering slots", () => {
    mockGeometry();
    const launch = vi.fn();
    const next = vi.fn();
    const { container } = render(
      <AttachedSlideFrame
        header={<button onClick={launch}>فتح النشاط</button>}
        footer={<button onClick={next}>التالي</button>}
      >
        <div>محتوى الشريحة</div>
      </AttachedSlideFrame>,
    );
    const frame = container.querySelector("[data-presentation-frame]")!;
    const children = [...frame.children];
    expect(children.map(node => node.getAttributeNames().find(name => name.startsWith("data-"))))
      .toEqual(["data-slide-actions", "data-presentation-surface", "data-slide-navigation"]);
    fireEvent.click(screen.getByRole("button", { name: "فتح النشاط" }));
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    expect(launch).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });

  it("fits the slide plus actual control heights after viewport rotation or toolbar wrapping", () => {
    const { geometry, triggerResize } = mockGeometry();
    const { container } = render(
      <AttachedSlideFrame header={<button>فتح النشاط</button>} footer={<button>التالي</button>}>
        <div>محتوى الشريحة</div>
      </AttachedSlideFrame>,
    );
    const frame = container.querySelector<HTMLElement>("[data-presentation-frame]")!;
    const firstWidth = parseFloat(frame.style.width);
    expect(firstWidth).toBeCloseTo((720 - 60 - 60 - 4) * 16 / 9 + 4);
    geometry.availableHeight = 390;
    geometry.headerHeight = 108;
    geometry.footerHeight = 108;
    triggerResize();
    const rotatedWidth = parseFloat(frame.style.width);
    expect(rotatedWidth).toBeLessThan(firstWidth);
    const totalHeight = (rotatedWidth - 4) * 9 / 16 + geometry.headerHeight + geometry.footerHeight + 4;
    expect(totalHeight).toBeCloseTo(390);
  });
});
