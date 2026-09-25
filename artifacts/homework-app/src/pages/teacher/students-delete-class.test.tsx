import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/locales/ar";

const { success, error, setLocation } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), setLocation: vi.fn() }));

vi.mock("@/components/layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: ar, lang: "ar", dir: "rtl" }),
}));
vi.mock("wouter", () => ({
  useLocation: () => ["/teacher/students", setLocation],
  Link: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success, error } }));

import StudentsPage from "./students";

const className = "الخامس";
const student = {
  id: 1, name: "ليان", gradeLevel: className, studentClass: className,
  parentPhone: null, parentName: null, parentEmail: null, notes: null,
  accountUsername: null, createdAt: "2026-01-01",
};

function response(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => data } as Response;
}

beforeEach(() => {
  success.mockClear();
  error.mockClear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("deleting a teacher class", () => {
  it.each(["http", "network"] as const)(
    "keeps the class after a %s failure in the class DELETE, while synchronizing deleted students",
    async (failure) => {
      let studentsDeleted = false;
      let listRequests = 0;
      const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
        if (input.endsWith("/api/students") && !init?.method) {
          listRequests++;
          return response(studentsDeleted ? [] : [student]);
        }
        if (input.endsWith("/api/teacher/classes") && !init?.method) {
          return response([{ name: className }]);
        }
        if (input.endsWith(`/api/students/group/${encodeURIComponent(className)}`)) {
          studentsDeleted = true;
          return response({ ok: true });
        }
        if (input.endsWith(`/api/teacher/classes/${encodeURIComponent(className)}`)) {
          if (failure === "network") throw new Error("Connection lost");
          return response({ message: "Failed" }, 500);
        }
        throw new Error(`Unexpected request: ${input}`);
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<QueryClientProvider client={new QueryClient()}><StudentsPage /></QueryClientProvider>);
      const classCard = await screen.findByTestId("class-card");
      expect(classCard.getAttribute("data-class-name")).toBe(className);
      fireEvent.click(within(classCard).getByRole("button", { name: ar.teacherStudents.deleteClass }));
      fireEvent.click(within(classCard).getByRole("button", { name: ar.teacherStudents.confirm }));

      await waitFor(() => expect(error).toHaveBeenCalledWith(ar.teacherStudents.classDeletePartial));
      await waitFor(() => expect(listRequests).toBe(2));
      await waitFor(() => expect(screen.getByTestId("class-card").getAttribute("data-class-name")).toBe(className));
      expect(screen.getByTestId("class-card").textContent).not.toContain(student.name);
      expect(success).not.toHaveBeenCalledWith(ar.teacherStudents.classDeleted);
    },
  );

  it("does not send the class DELETE when deleting students fails", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/api/students") && !init?.method) return response([student]);
      if (input.endsWith("/api/teacher/classes") && !init?.method) return response([{ name: className }]);
      if (input.includes("/api/students/group/")) return response({ message: "Failed" }, 500);
      throw new Error(`Unexpected request: ${input}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<QueryClientProvider client={new QueryClient()}><StudentsPage /></QueryClientProvider>);
    const classCard = await screen.findByTestId("class-card");
    fireEvent.click(within(classCard).getByRole("button", { name: ar.teacherStudents.deleteClass }));
    fireEvent.click(within(classCard).getByRole("button", { name: ar.teacherStudents.confirm }));
    await waitFor(() => expect(error).toHaveBeenCalledWith(ar.teacherStudents.genericError));
    expect(fetchMock.mock.calls.some(([input]) => input.includes(`/api/teacher/classes/${encodeURIComponent(className)}`))).toBe(false);
    expect(screen.getByTestId("class-card")).toBeTruthy();
  });
});