// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubjectMultiSelect } from "./subject-multi-select";

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

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

    const open = container.querySelector('[data-testid="button-open-subjects"]') as HTMLButtonElement;
    await act(async () => open.click());
    const arabic = container.querySelector('[data-testid="button-subject-اللغة العربية"]') as HTMLButtonElement;
    const science = container.querySelector('[data-testid="button-subject-العلوم"]') as HTMLButtonElement;
    await act(async () => arabic.click());
    await act(async () => science.click());

    expect(onChange).toHaveBeenLastCalledWith(["اللغة العربية", "العلوم"]);
    expect(arabic.getAttribute("aria-pressed")).toBe("true");
    expect(science.getAttribute("aria-pressed")).toBe("true");
  });

  it("adds a trimmed custom subject and keeps it selected", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <SubjectMultiSelect value={[]} lang="ar" onChange={onChange} />,
      );
    });

    const open = container.querySelector('[data-testid="button-open-subjects"]') as HTMLButtonElement;
    await act(async () => open.click());
    const input = container.querySelector('[data-testid="input-custom-subject"]') as HTMLInputElement;
    const add = container.querySelector('[data-testid="button-add-custom-subject"]') as HTMLButtonElement;
    await act(async () => {
      setInputValue(input, "  التصميم الصناعي  ");
    });
    await act(async () => add.click());

    expect(onChange).toHaveBeenCalledWith(["التصميم الصناعي"]);
  });

  it("does not add a duplicate subject after whitespace and case normalization", async () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <SubjectMultiSelect value={["Physics"]} lang="en" onChange={onChange} />,
      );
    });

    const open = container.querySelector('[data-testid="button-open-subjects"]') as HTMLButtonElement;
    await act(async () => open.click());
    const input = container.querySelector('[data-testid="input-custom-subject"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, "  physics ");
    });

    const add = container.querySelector('[data-testid="button-add-custom-subject"]') as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});