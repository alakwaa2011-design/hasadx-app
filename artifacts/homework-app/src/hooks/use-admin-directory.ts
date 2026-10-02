import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

export type DirectoryKind = "teachers" | "students" | "activities";

export interface DirectorySummary {
  totalAssignments: number;
  totalGames: number;
  totalVideoLessons: number;
  totalTugGames: number;
  totalMemorySets: number;
  totalSubmissions: number;
}

export interface DirectoryResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary?: DirectorySummary;
}

export function clampPage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(Math.floor(page) || 1, Math.max(1, totalPages)));
}

export function buildDirectoryUrl(
  kind: DirectoryKind,
  o: { page: number; pageSize: number; q?: string; section?: string; lookup?: boolean },
): string {
  const p = new URLSearchParams();
  p.set("page", String(o.page));
  p.set("pageSize", String(Math.min(100, Math.max(1, o.pageSize))));
  const q = (o.q ?? "").trim().slice(0, 120);
  if (q) p.set("q", q);
  if (o.section) p.set("section", o.section);
  if (o.lookup) p.set("lookup", "true");
  return `${API_BASE}/api/admin/directory/${kind}?${p.toString()}`;
}

interface Options {
  kind: DirectoryKind;
  accountId: number | null;
  enabled: boolean;
  pageSize?: number;
  section?: string;
  lookup?: boolean;
  debounceMs?: number;
}

export function useAdminDirectory<T>({ kind, accountId, enabled, pageSize = 25, section, lookup, debounceMs = 300 }: Options) {
  const queryClient = useQueryClient();
  // Account-local state is tagged with the account it belongs to; a different account sees defaults.
  const [searchState, setSearchState] = useState<{ account: number | null; value: string }>({ account: accountId, value: "" });
  const [debouncedState, setDebouncedState] = useState<{ account: number | null; value: string }>({ account: accountId, value: "" });
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: "", page: 1 });

  const search = searchState.account === accountId ? searchState.value : "";
  const debouncedQ = debouncedState.account === accountId ? debouncedState.value : "";
  const pending = search.trim() !== debouncedQ;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedState({ account: accountId, value: search.trim() }), debounceMs);
    return () => clearTimeout(id);
  }, [search, accountId, debounceMs]);

  // Page belongs to a scope (account + section + query); any scope change falls back to page 1 synchronously.
  const scopeKey = `${accountId}|${section ?? ""}|${debouncedQ}|${lookup ? 1 : 0}`;
  const page = pageState.key === scopeKey ? pageState.page : 1;

  const queryKey = ["admin-directory", accountId, kind, { page, pageSize, q: debouncedQ, section: section ?? null, lookup: !!lookup }] as const;

  const query = useQuery<DirectoryResponse<T>>({
    queryKey,
    enabled: enabled && accountId !== null && !pending,
    staleTime: 30_000,
    gcTime: 120_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const res = await fetch(buildDirectoryUrl(kind, { page, pageSize, q: debouncedQ, section, lookup }), { credentials: "include", signal });
      if (!res.ok) throw new Error(`directory ${res.status}`);
      return res.json();
    },
  });

  const data = pending ? undefined : query.data;
  const setPage = useCallback((p: number, totalPages = 1) => setPageState({ key: scopeKey, page: clampPage(p, totalPages) }), [scopeKey]);

  useEffect(() => {
    if (!data) return;
    if (data.totalPages > 0 && page > data.totalPages) setPage(data.totalPages, data.totalPages);
    else if (data.total === 0 && page > 1) setPage(1);
  }, [data, page, setPage]);

  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;

  const patchItems = useCallback((fn: (items: T[]) => T[]) => {
    queryClient.setQueryData<DirectoryResponse<T>>(keyRef.current as unknown as unknown[], old => (old ? { ...old, items: fn(old.items) } : old));
    // Other searches can contain this same teacher. Refresh them on their next
    // use instead of treating their old flags as fresh for another 30 seconds.
    void queryClient.invalidateQueries({ queryKey: ["admin-directory", accountId, kind], refetchType: "none" });
  }, [queryClient, accountId, kind]);

  const afterRemove = useCallback(() => {
    const cur = queryClient.getQueryData<DirectoryResponse<T>>(keyRef.current as unknown as unknown[]);
    if (cur && cur.items.length === 0 && page > 1) setPage(page - 1, cur.totalPages);
    // Removing a teacher also removes their students and activities.
    void queryClient.invalidateQueries({ queryKey: ["admin-directory", accountId] });
  }, [queryClient, accountId, kind, page, setPage]);

  // Keep summary only within the same account so category controls stay mounted while a section loads.
  const summaryRef = useRef<{ account: number | null; summary?: DirectorySummary }>({ account: accountId });
  if (data?.summary) summaryRef.current = { account: accountId, summary: data.summary };
  const summary = data?.summary ?? (summaryRef.current.account === accountId ? summaryRef.current.summary : undefined);

  return {
    items: data?.items ?? [],
    summary,
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 1,
    page,
    pageSize: data?.pageSize ?? pageSize,
    setPage: (p: number) => setPage(p, data?.totalPages ?? 1),
    search,
    setSearch: (v: string) => setSearchState({ account: accountId, value: v }),
    isLoading: enabled && accountId !== null && (pending || (query.isLoading && !query.isError)),
    isFetching: pending || query.isFetching,
    isError: !pending && query.isError,
    refetch: () => { void query.refetch(); },
    patchItems,
    afterRemove,
  };
}

export type AdminDirectory<T> = ReturnType<typeof useAdminDirectory<T>>;
