import { afterEach, describe, expect, it, vi } from "vitest";
import { collaborationRequest } from "./collab-request";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("explicit collaboration writes", () => {
  it("refuses offline writes immediately without invoking or queuing a request", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const request = vi.fn();
    await expect(collaborationRequest(request)).rejects.toThrow("لم تُرسل العملية");
    expect(request).not.toHaveBeenCalled();
  });
  it("returns only server-confirmed responses", async () => {
    await expect(collaborationRequest(async () => "confirmed")).resolves.toBe("confirmed");
  });
  it("aborts a stalled request with an uncertain-outcome message, never retries", async () => {
    vi.useFakeTimers();
    const request = vi.fn((signal: AbortSignal) => new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    const result = expect(collaborationRequest(request, 100)).rejects.toThrow("لم يصل تأكيد");
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("aborts on connectivity loss and does not resend on reconnection", async () => {
    const request = vi.fn((signal: AbortSignal) => new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    const result = expect(collaborationRequest(request)).rejects.toThrow("انقطع الاتصال");
    window.dispatchEvent(new Event("offline"));
    await result;
    window.dispatchEvent(new Event("online"));
    expect(request).toHaveBeenCalledTimes(1);
  });
});
