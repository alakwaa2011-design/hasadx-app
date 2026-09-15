// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubjectMultiSelect } from "./subject-multi-select";

describe("SubjectMultiSelect", () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.splice(0).forEach((root) => {
      act(() => root.unmount());
    });
    document.body.innerHTML = "";
  });

  it("keeps two selected subjects in one editing flow", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    function Harness() {
      const [subjects, setSubjects] = useState<string[]>([]);
      return (
        <SubjectMultiSelect
          value={subjects}
          lang="ar"
          onChange={(next) => {
            setSubjects(next);
            onChange(next);
          }}
        />
      );
    }

    await act(async () => root.render(<Harness />));

    const arabic = container.querySelector('[data-testid="button-subject-اللغة العربية"]') as HTMLButtonElement;
    const science = container.querySelector('[data-testid="button-subject-العلوم"]') as HTMLButtonElement;
    await act(async () => arabic.click());
    await act(async () => science.click());

    expect(onChange).toHaveBeenLastCalledWith(["اللغة العربية", "العلوم"]);
    expect(arabic.getAttribute("aria-pressed")).toBe("true");
    expect(science.getAttribute("aria-pressed")).toBe("true");
  });
});