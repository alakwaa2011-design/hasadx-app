import type { XoClassQuestion } from "./xo-class-engine";

export type XoClassSetup = {
  questions: XoClassQuestion[];
  duration?: number;
  teamX?: string;
  teamO?: string;
  title?: string;
  savedActivityId?: number | string;
};

export function encodeXoClassSetup(setup: XoClassSetup): string {
  return btoa(encodeURIComponent(JSON.stringify(setup)));
}

export function decodeXoClassSetup(encoded: string): XoClassSetup | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(encoded))) as XoClassSetup;
    return parsed && Array.isArray(parsed.questions) ? parsed : null;
  } catch {
    return null;
  }
}