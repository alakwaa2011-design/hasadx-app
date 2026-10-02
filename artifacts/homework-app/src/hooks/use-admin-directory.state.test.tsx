import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAdminDirectory } from "./use-admin-directory";

function wrap(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const resp = (tag: string, page = 1, totalPages = 3) => ({
  ok: true,
  json: async () => ({ items: [{ id: 1, tag }], page, pageSize: 25, total: 60, totalPages }),
});

let calls: { url: URL; signal?: AbortSignal; resolve: (v: unknown) => void }[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => new Promise((resolve, reject) => {
    const entry = { url: new URL(url, "http://x"), signal: init?.signal as AbortSignal | undefined, resolve };
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    calls.push(entry);
  })));
});
afterEach(() => vi.unstubAllGlobals());

type Props = { account: number | null; section?: string };
const setup = (initial: Props) =>
  renderHook((p: Props) => useAdminDirectory<{ id: number; tag: string }>({ kind: "activities", accountId: p.account, enabled: true, section: p.section, debounceMs: 20 }), { wrapper: wrap(), initialProps: initial });

describe("useAdminDirectory state", () => {
  it("debounces search, hides rows while pending and resets page", async () => {
    const { result } = setup({ account: 1 });
    await waitFor(() => expect(calls.length).toBe(1));
    await act(async () => calls[0].resolve(resp("first")));
    await waitFor(() => expect(result.current.items[0]?.tag).toBe("first"));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(calls.length).toBe(2));
    await act(async () => calls[1].resolve(resp("p2", 2)));
    await waitFor(() => expect(result.current.page).toBe(2));
    act(() => { result.current.setSearch("ab"); result.current.setSearch("abc"); });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(calls.length).toBe(3));
    expect(calls[2].url.searchParams.get("q")).toBe("abc");
    expect(calls[2].url.searchParams.get("page")).toBe("1");
    expect(calls.length).toBe(3);
  });

  it("aborts out-of-order requests and ignores stale responses", async () => {
    const { result } = setup({ account: 1 });
    await waitFor(() => expect(calls.length).toBe(1));
    act(() => result.current.setSearch("a"));
    await waitFor(() => expect(calls.length).toBe(2));
    act(() => result.current.setSearch("ab"));
    await waitFor(() => expect(calls.length).toBe(3));
    expect(calls[1].signal?.aborted).toBe(true);
    await act(async () => calls[2].resolve(resp("ab")));
    await waitFor(() => expect(result.current.items[0]?.tag).toBe("ab"));
    await act(async () => calls[1].resolve(resp("a")));
    expect(result.current.items[0]?.tag).toBe("ab");
  });

  it("never shows previous-section rows and resets page on section change", async () => {
    const { result, rerender } = setup({ account: 1, section: "games" });
    await waitFor(() => expect(calls.length).toBe(1));
    await act(async () => calls[0].resolve(resp("games")));
    await waitFor(() => expect(result.current.items[0]?.tag).toBe("games"));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    rerender({ account: 1, section: "tug" });
    expect(result.current.items).toEqual([]);
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(calls.at(-1)!.url.searchParams.get("section")).toBe("tug"));
    expect(calls.at(-1)!.url.searchParams.get("page")).toBe("1");
  });

  it("clears search and rows on account change", async () => {
    const { result, rerender } = setup({ account: 1 });
    await waitFor(() => expect(calls.length).toBe(1));
    await act(async () => calls[0].resolve(resp("acct1")));
    act(() => result.current.setSearch("zed"));
    await waitFor(() => expect(calls.length).toBe(2));
    rerender({ account: 2 });
    expect(result.current.search).toBe("");
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(calls.at(-1)!.url.searchParams.has("q")).toBe(false));
  });

  it("invalidates other searches after edits and dependent lists after deletion", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const otherTeacher = ["admin-directory", 1, "teachers", { q: "other" }];
    const students = ["admin-directory", 1, "students", { q: "" }];
    const otherAccount = ["admin-directory", 2, "students", { q: "" }];
    for (const key of [otherTeacher, students, otherAccount]) {
      qc.setQueryData(key, { items: [{ id: 1 }], page: 1, pageSize: 25, total: 1, totalPages: 1 });
    }
    const { result, unmount } = renderHook(() => useAdminDirectory<{ id: number; tag: string }>({
      kind: "teachers", accountId: 1, enabled: true,
    }), { wrapper: wrap(qc) });
    await waitFor(() => expect(calls.length).toBe(1));
    await act(async () => calls[0].resolve(resp("original")));
    await waitFor(() => expect(result.current.items[0]?.tag).toBe("original"));
    act(() => result.current.patchItems(rows => rows.map(row => ({ ...row, tag: "edited" }))));
    await waitFor(() => expect(result.current.items[0].tag).toBe("edited"));
    expect(qc.getQueryState(otherTeacher)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(students)?.isInvalidated).toBe(false);
    expect(calls.length).toBe(1);
    act(() => { result.current.patchItems(() => []); result.current.afterRemove(); });
    expect(qc.getQueryState(students)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(otherAccount)?.isInvalidated).toBe(false);
    unmount();
  });
});
