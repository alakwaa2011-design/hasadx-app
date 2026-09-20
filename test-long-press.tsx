import { useRef, useCallback } from "react";
export function useLongPress(callback: () => void, ms = 400) {
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const startY = useRef(0);
  const startX = useRef(0);
  
  return {
    onPointerDown: (e: React.PointerEvent) => {
      startY.current = e.clientY;
      startX.current = e.clientX;
      timeout.current = setTimeout(callback, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.abs(e.clientY - startY.current) > 10 || Math.abs(e.clientX - startX.current) > 10) {
        clearTimeout(timeout.current);
      }
    },
    onPointerUp: () => clearTimeout(timeout.current),
    onPointerCancel: () => clearTimeout(timeout.current),
  };
}
