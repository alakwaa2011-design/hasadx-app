import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorksheetPreview, worksheetPreviewScale } from "./use-worksheet-preview";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("worksheet preview fitting", () => {
  it.each([320, 375, 390, 430, 768])("fits the entire A4 paper inside a %ipx viewport", width => {
    const paperWidth = 210 / 25.4 * 96;
    const scale = worksheetPreviewScale(width - 16, paperWidth);
    expect(scale * paperWidth).toBeCloseTo(width - 16);
    expect(scale).toBeLessThan(1);
  });

  it("does not enlarge paper on desktop or divide by an unmeasured width", () => {
    expect(worksheetPreviewScale(1280)).toBe(1);
    expect(worksheetPreviewScale(0)).toBe(1);
  });

  it("refits on resize and disconnects observation on unmount", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let width = 390;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(794);
    let resize: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    function Preview() {
      const ref = useWorksheetPreview();
      return <div ref={ref} style={{ padding: "0 8px" }}><article className="ws-page" /></div>;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<Preview />));
    const host = container.firstElementChild as HTMLElement;
    expect(Number(host.style.getPropertyValue("--ws-preview-scale"))).toBeCloseTo(374 / 794);
    width = 844;
    resize?.();
    expect(host.style.getPropertyValue("--ws-preview-scale")).toBe("1");
    await act(async () => root.unmount());
    expect(disconnect).toHaveBeenCalledOnce();
  });
});