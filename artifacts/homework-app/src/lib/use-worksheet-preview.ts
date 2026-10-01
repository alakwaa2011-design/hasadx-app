import { useLayoutEffect, useRef } from "react";

const A4_WIDTH_PX = 210 / 25.4 * 96;

export function worksheetPreviewScale(availableWidth: number, paperWidth = A4_WIDTH_PX): number {
  if (availableWidth <= 0 || paperWidth <= 0) return 1;
  return Math.min(1, availableWidth / paperWidth);
}

/** Scale only the displayed paper, never its underlying A4 layout or the app controls. */
export function useWorksheetPreview() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const fit = () => {
      const style = getComputedStyle(host);
      const available = host.clientWidth
        - (parseFloat(style.paddingLeft) || 0)
        - (parseFloat(style.paddingRight) || 0);
      const paper = host.querySelector<HTMLElement>(":scope > .ws-page");
      const scale = worksheetPreviewScale(available, paper?.offsetWidth || A4_WIDTH_PX);
      const value = String(scale);
      if (host.style.getPropertyValue("--ws-preview-scale") !== value) {
        host.style.setProperty("--ws-preview-scale", value);
      }
      // The live creator can also apply an outer transform. Keep this
      // inverse separate so touch controls compensate for both fit layers.
      host.style.setProperty("--ws-fit-inv-scale", String(1 / scale));
    };
    fit();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    observer?.observe(host);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);
  return ref;
}