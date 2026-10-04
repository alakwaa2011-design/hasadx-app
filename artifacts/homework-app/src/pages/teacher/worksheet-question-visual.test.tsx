import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { WorksheetQuestionVisual } from "./worksheet-question-visual";

afterEach(cleanup);

it("prints real geometry and labels, rather than referring to absent images", () => {
  const { container } = render(<WorksheetQuestionVisual visual={{ caption: "اختر الشكل المظلل", shapes: [
    { kind: "rectangle", x: 20, y: 20, width: 40, height: 40, shaded: true, label: "أ" },
    { kind: "triangle", x: 80, y: 20, width: 40, height: 40 },
    { kind: "circle", x: 140, y: 20, width: 40, height: 40 },
    { kind: "line", x: 200, y: 20, width: 40, height: 40 },
  ] }} />);
  expect(container.querySelectorAll("svg")).toHaveLength(1);
  expect(container.querySelectorAll("rect, polygon, ellipse, line")).toHaveLength(4);
  expect(container.textContent).toContain("أ");
  expect(container.textContent).toContain("اختر الشكل المظلل");
  expect(container.querySelector("img")).toBeNull();
});

it("does not add empty drawing space to legacy questions", () => {
  const { container } = render(<WorksheetQuestionVisual />);
  expect(container.innerHTML).toBe("");
});