import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MathText } from "./math-text";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderMathText(text: string): HTMLElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root!.render(<MathText text={text} fallbackDirection="rtl" />);
  });

  const element = container.firstElementChild;
  if (!(element instanceof HTMLElement)) {
    throw new Error("MathText did not render a root element");
  }
  return element;
}

function renderedParts(element: HTMLElement) {
  return Array.from(element.children).map((child) => {
    const annotation = child.querySelector("annotation");
    return {
      direction: child.getAttribute("dir"),
      value: annotation?.textContent ?? child.textContent,
    };
  });
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  container?.remove();
  container = null;
});


describe("MathText mixed-direction rendering", () => {
  it("keeps Arabic, an equation, and English text in source order", () => {
    const element = renderMathText("احسب \\(x+1=3\\) then explain بالعربية");

    expect(element.getAttribute("dir")).toBe("rtl");
    expect(renderedParts(element)).toEqual([
      { direction: null, value: "احسب " },
      { direction: "ltr", value: "x+1=3" },
      { direction: null, value: " then explain بالعربية" },
    ]);
  });

  it("preserves newlines and multiple equations while leaving an incomplete formula literal", () => {
    const element = renderMathText(
      "السطر الأول \\(a^2+b^2=c^2\\)\nSecond line \\(\\frac{1}{2}\\)\nصيغة غير مكتملة \\(x+",
    );

    expect(renderedParts(element)).toEqual([
      { direction: null, value: "السطر الأول " },
      { direction: "ltr", value: "a^2+b^2=c^2" },
      { direction: null, value: "\nSecond line " },
      { direction: "ltr", value: "\\frac{1}{2}" },
      { direction: null, value: "\nصيغة غير مكتملة \\(x+" },
    ]);
    expect(element.textContent).toContain("\nSecond line ");
    expect(element.textContent).toContain("\nصيغة غير مكتملة \\(x+");
  });

  it("renders legacy text literally without converting its math-like content", () => {
    const legacyText = "النص القديم: $x + 1$ و <b>ليس HTML</b> و \\[y=2\\]";
    const element = renderMathText(legacyText);

    expect(element.children).toHaveLength(1);
    expect(element.textContent).toBe(legacyText);
    expect(element.querySelector("b")).toBeNull();
    expect(element.innerHTML).toContain("&lt;b&gt;ليس HTML&lt;/b&gt;");
  });

  it("keeps a mixed Arabic, English, and KaTeX answer option in stored order", () => {
    const storedOption = "اختر speed ثم \\(v=d/t\\) بوحدة m/s";
    const element = renderMathText(storedOption);

    expect(renderedParts(element)).toEqual([
      { direction: null, value: "اختر speed ثم " },
      { direction: "ltr", value: "v=d/t" },
      { direction: null, value: " بوحدة m/s" },
    ]);
  });

  it("keeps mixed submitted-answer feedback in stored order", () => {
    const storedFeedback = "إجابتك Correct لأن \\(2x=10\\) إذن x = 5";
    const element = renderMathText(storedFeedback);

    expect(renderedParts(element)).toEqual([
      { direction: null, value: "إجابتك Correct لأن " },
      { direction: "ltr", value: "2x=10" },
      { direction: null, value: " إذن x = 5" },
    ]);
  });
});