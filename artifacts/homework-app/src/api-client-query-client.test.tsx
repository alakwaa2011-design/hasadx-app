import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetCurrentTeacherQueryKey, useGetCurrentTeacher } from "@workspace/api-client-react";
import { afterEach, describe, expect, it, vi } from "vitest";

function CurrentTeacherQueryProbe() {
  const { queryKey } = useGetCurrentTeacher({
    query: { enabled: false, retry: false },
  });

  return <div data-testid="query-key">{JSON.stringify(queryKey)}</div>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("generated API hooks and the app QueryClient", () => {
  it("uses the app QueryClient context without fetching when disabled", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() =>
      render(
        <QueryClientProvider client={queryClient}>
          <CurrentTeacherQueryProbe />
        </QueryClientProvider>,
      ),
    ).not.toThrow();

    const queryKey = getGetCurrentTeacherQueryKey();
    expect(queryClient.getQueryCache().find({ queryKey })?.queryKey).toEqual(queryKey);
    expect(fetch).not.toHaveBeenCalled();
    queryClient.clear();
  });
});