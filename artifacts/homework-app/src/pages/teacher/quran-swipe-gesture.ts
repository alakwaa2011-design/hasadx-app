export type SwipeAxis = "horizontal" | "vertical";
export type PageSwipeDirection = "next" | "previous";

export function swipeAxis(dx: number, dy: number): SwipeAxis | null {
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (horizontal < 12 && vertical < 12) return null;
  if (horizontal > vertical * 1.15) return "horizontal";
  if (vertical > horizontal * 1.15) return "vertical";
  return null;
}

export function pageSwipeDirection(
  dx: number,
  dy: number,
  elapsedMs: number,
  axis: SwipeAxis | null,
): PageSwipeDirection | null {
  if (axis !== "horizontal" || Math.abs(dx) < Math.abs(dy) * 1.15) return null;
  const distance = Math.abs(dx);
  if (distance < 48 && (distance < 28 || distance / Math.max(elapsedMs, 1) < 0.35)) {
    return null;
  }
  // A Mushaf turns with the physical page: right for next, left for previous,
  // regardless of the surrounding interface language.
  return dx > 0 ? "next" : "previous";
}