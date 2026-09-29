import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n";

const api = vi.hoisted(() => {
  const initial = [{ id: "original", title: "شرح سابق", url: "https://youtu.be/oMaDMEM40l4" }];
  return {
    links: [...initial] as typeof initial,
    initial,
    save: vi.fn(),
    get: vi.fn(),
  };
});

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => ({ children, initial, animate, exit, transition, layout, whileTap, whileHover, ...rest }: any) => <div {...rest}>{children}</div> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/create", vi.fn()],
  useRoute: () => [false, {}],
  Link: ({ children }: any) => <>{children}</>,
}));
vi.mock("@/components/layout", () => ({ Layout: ({ children }: any) => <div>{children}</div> }));
vi.mock("@/components/ui/sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@workspace/api-client-react", () => ({
  getTutorialLinks: (...args: any[]) => api.get(...args),
  saveTutorialLinks: (...args: any[]) => api.save(...args),
  useGetTutorialLinks: () => ({ data: { links: [...api.links] } }),
  useGetCurrentTeacher: () => ({ data: { id: 41 } }),
  useCreateAssignment: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/components/credits-chip", () => ({
  useCreditsBalance: () => ({ data: { balance: 50 }, refetch: vi.fn() }),
  useRefreshCreditsBalance: () => vi.fn(),
}));

import { TutorialLinksTab } from "./tutorial-links-tab";
import CreateAssignment from "@/pages/teacher/create-assignment";

function teacherPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider><CreateAssignment /></I18nProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.links = [...api.initial];
  api.get.mockImplementation(async () => ({ links: [...api.links] }));
  api.save.mockImplementation(async ({ links }: { links: typeof api.links }) => {
    api.links = [...links];
    return { links: [...api.links] };
  });
  localStorage.removeItem("hw_lang");
});
afterEach(() => {
  cleanup();
  localStorage.removeItem("hw_lang");
  localStorage.removeItem("hasaad:tutorial:create-assignment:v1:41");
  vi.clearAllMocks();
});

describe("admin tutorial editor → teacher create page", () => {
  it("saves a YouTube tutorial and displays it after remounting the teacher page", async () => {
    const admin = render(<TutorialLinksTab lang="ar" />);
    await screen.findByDisplayValue("شرح سابق");
    fireEvent.click(screen.getByRole("button", { name: "إضافة شرح" }));
    fireEvent.change(screen.getAllByRole("textbox", { name: "العنوان" })[1], { target: { value: "شرح جديد" } });
    fireEvent.change(screen.getAllByRole("textbox", { name: "رابط YouTube" })[1], { target: { value: "https://www.youtube.com/watch?v=5NV6Rdv1a3I" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText("التغييرات لم تُحفظ بعد.")).toBeNull());
    expect(api.links[1]).toMatchObject({ title: "شرح جديد", url: "https://www.youtube.com/watch?v=5NV6Rdv1a3I" });
    admin.unmount();

    // A fresh mount uses the server list, not admin component state.
    const teacher = teacherPage();
    await act(async () => {});
    expect(screen.getAllByTestId("button-tutorial-video").some(button => button.textContent?.includes("شرح جديد"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "شرح جديد" }));
    expect((screen.getByTestId("iframe-tutorial-video") as HTMLIFrameElement).src)
      .toBe("https://www.youtube-nocookie.com/embed/5NV6Rdv1a3I");
    teacher.unmount();
  });

  it("does not submit invalid links or replace the saved list", async () => {
    render(<TutorialLinksTab lang="ar" />);
    await screen.findByDisplayValue("شرح سابق");
    for (const invalid of ["https://youtube.com.evil.example/watch?v=oMaDMEM40l4", "https://youtu.be/oMaDMEM40l4/other"]) {
      fireEvent.change(screen.getByRole("textbox", { name: "رابط YouTube" }), { target: { value: invalid } });
      fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    }
    expect(api.save).not.toHaveBeenCalled();
    expect(api.links).toEqual(api.initial);
  });

  it("hides teacher tutorial buttons after the admin deletes every link", async () => {
    const admin = render(<TutorialLinksTab lang="ar" />);
    await screen.findByDisplayValue("شرح سابق");
    fireEvent.click(screen.getByRole("button", { name: "حذف شرح سابق" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ التغييرات" }));
    await waitFor(() => expect(api.links).toEqual([]));
    admin.unmount();
    teacherPage();
    await act(async () => {});
    expect(screen.queryByTestId("button-tutorial-video")).toBeNull();
    expect(screen.queryByTestId("notice-assignment-tutorial")).toBeNull();
  });
});