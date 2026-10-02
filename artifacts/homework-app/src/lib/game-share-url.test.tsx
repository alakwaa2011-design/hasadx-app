// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import { HostJoinBar } from "@/components/host-join-bar";
import {
  canonicalGamePath,
  copyGameShortUrl,
  clearGameShareLinkCache,
  createGameShareLink,
  isGameSharePath,
  publicShortUrl,
  shareRedirectPath,
} from "@/lib/game-share-url";
import { openGameShareWindow, useGameShareUrl } from "@/lib/use-game-share-url";

vi.mock("react-qr-code", () => ({
  default: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} />,
}));

const makeResponse = (path: string, code = "abcdefghij") => ({
  ok: true,
  json: async () => ({ code, path, shortPath: `/s/${code}` }),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearGameShareLinkCache();
  vi.unstubAllGlobals();
});

describe("universal game share URL", () => {
  it("canonicalizes same-origin aliases and reuses a resolved share code for the same exact target", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse("/game/join/123?name=A%20B#room"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await createGameShareLink("/game/join/123?name=A%20B#room");
    const reused = await createGameShareLink(`${window.location.origin}/game/join/123?name=A%20B#room`);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(reused);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ path: "/game/join/123?name=A%20B#room" }),
    });
    expect(canonicalGamePath("/game/join/123?name=A%20B#room")).toBe("/game/join/123?name=A%20B#room");
    expect(isGameSharePath("/kids/activity/letters?level=1")).toBe(true);
    expect(() => canonicalGamePath("/teacher/assignment/123")).toThrow(/game destinations/);
    expect(() => canonicalGamePath("https://evil.example/game/join/123")).toThrow(/this site/);
    expect(publicShortUrl("/s/abcdefghij")).toBe(`${window.location.origin}/s/abcdefghij`);
    expect(shareRedirectPath("abcdefghij")).toBe("/api/game-share-links/abcdefghij/redirect");
    expect(() => shareRedirectPath("bad-code")).toThrow(/Invalid/);
  });

  it("does not expose a prior target while a new target is pending and makes failed requests retryable", async () => {
    let resolveFirst!: (response: unknown) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(makeResponse("/game/join/456", "bcdefghijk"));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ target }) => useGameShareUrl(target), {
      initialProps: { target: "/game/join/123" },
    });
    expect(result.current.status).toBe("pending");
    rerender({ target: "/game/join/456" });
    expect(result.current).toMatchObject({ status: "pending", url: "" });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.url).toBe("");
    await act(async () => { result.current.retry(); });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.url).toBe(`${window.location.origin}/s/bcdefghijk`);
    resolveFirst(makeResponse("/game/join/123"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.url).toBe(`${window.location.origin}/s/bcdefghijk`);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("turns a synchronous invalid-target error into retryable UI state", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useGameShareUrl("https://evil.example/game/join/123"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.url).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts clipboard writing before source-token and short-link requests resolve", async () => {
    let resolve!: (response: unknown) => void;
    const fetchMock = vi.fn(() => new Promise(done => { resolve = done; }));
    vi.stubGlobal("fetch", fetchMock);
    class TestClipboardItem {
      constructor(public types: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal("ClipboardItem", TestClipboardItem);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write } });
    let resolveTarget!: (target: string) => void;
    const target = new Promise<string>(done => { resolveTarget = done; });
    const copying = copyGameShortUrl(target);
    expect(write).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    resolveTarget("/game/join/567");
    await Promise.resolve();
    resolve(makeResponse("/game/join/567"));
    expect(await copying).toBe(`${window.location.origin}/s/abcdefghij`);
  });

  it("uses the same resolved short URL for host copy and QR output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse("/game/rocket/join/123"));
    vi.stubGlobal("fetch", fetchMock);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<I18nProvider><HostJoinBar pin="123" joinUrl="/game/rocket/join/123" /></I18nProvider>);

    const copyButton = await screen.findByRole("button", { name: /نسخ الرابط|Copy link/ });
    await waitFor(() => expect((copyButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(copyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/abcdefghij`));

    fireEvent.click(screen.getByRole("button", { name: /فتح رمز QR|Open QR code/ }));
    await waitFor(() => expect(screen.getByTestId("qr").getAttribute("data-value")).toBe(`${window.location.origin}/s/abcdefghij`));
  });

  it("opens a privacy-safe share popup without treating noopener success as blocking", () => {
    const popupDocument = document.implementation.createHTMLDocument();
    const replace = vi.fn();
    const popup = { opener: window, document: popupDocument, location: { replace } };
    const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    expect(openGameShareWindow("https://wa.me/?text=short-link")).toBe(true);
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(popup.opener).toBeNull();
    expect(popupDocument.querySelector('meta[name="referrer"]')?.getAttribute("content")).toBe("no-referrer");
    expect(replace).toHaveBeenCalledWith("https://wa.me/?text=short-link");
    open.mockReturnValue(null);
    expect(openGameShareWindow("https://wa.me/?text=short-link")).toBe(false);
  });
});