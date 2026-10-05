/**
 * Real-AI outputs are supplied by the opt-in API smoke AFTER save/reopen.
 * This file makes no AI requests. The ordinary suite uses only a sentinel
 * rubric to check that our assertions can catch accidental answer leakage.
 */
import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { WorksheetActivity } from "@workspace/api-zod";
import { WorksheetActivityView, shuffleStable } from "./worksheet-activity";
import { WorksheetQuestionVisual, type WorksheetVisual } from "./worksheet-question-visual";

type ActivityQuestion = {
  id: string; type: string; prompt: string; answer?: string;
  activity?: WorksheetActivity; visual?: WorksheetVisual;
};
type RealCase = { label: string; questions: ActivityQuestion[] };
const path = process.env.WORKSHEET_REAL_SMOKE_OUTPUT;
const cases: RealCase[] = path ? JSON.parse(readFileSync(path, "utf8")) : [];
afterEach(cleanup);

function checkWorkspace(q: ActivityQuestion) {
  const a = q.activity!;
  const { container } = render(<>
    <WorksheetQuestionVisual visual={q.visual} />
    <WorksheetActivityView activity={a} seed={q.id} />
  </>);
  const workspace = container.querySelector(`[data-activity="${a.kind}"]`)!;
  expect(workspace).toBeTruthy();
  // Compare decoded text rather than HTML entities. Rubric stays teacher-only;
  // never render it into any branch, chip, collaboration step or visual label.
  const answer = q.answer?.trim();
  expect(answer).toBeTruthy();
  expect(container.textContent).not.toContain(answer);
  expect(workspace.querySelectorAll("textarea,input")).toHaveLength(0);
  const blank = (el: Element) => expect(el.textContent?.trim()).toBe("");
  switch (a.kind) {
    case "concept_map": {
      expect(workspace.firstElementChild?.textContent).toBe(a.center);
      const branches = workspace.children[2].children;
      expect(branches).toHaveLength(a.branches!.length);
      [...branches].forEach((branch, i) => {
        const box = branch.children[1];
        expect(box.children[0].textContent).toBe(a.branches![i]);
        expect(box.children).toHaveLength(3);
        blank(box.children[1]); blank(box.children[2]);
      });
      break;
    }
    case "drawing":
    case "coloring":
      blank(workspace);
      expect((workspace as HTMLElement).style.height).toBe(`${Math.round(a.spaceHeight! * 0.26)}mm`);
      if (a.kind === "drawing") expect((workspace as HTMLElement).style.borderStyle).toBe("dashed");
      if (a.kind === "coloring") {
        const shapes = container.querySelectorAll("svg ellipse,svg rect,svg polygon,svg line");
        expect(shapes).toHaveLength(q.visual!.shapes.length);
        shapes.forEach(s => expect(s.parentElement?.getAttribute("fill")).toBe("none"));
      }
      break;
    case "sorting":
    case "sequencing": {
      const chips = [...workspace.children[0].children].map(el => el.textContent);
      expect(chips).toEqual(shuffleStable(a.items!, q.id));
      expect(chips).not.toEqual(a.items);
      expect([...chips].sort()).toEqual([...a.items!].sort());
      const slots = [...workspace.children[1].children];
      if (a.kind === "sorting") {
        expect(slots).toHaveLength(a.categories!.length);
        slots.forEach((slot, i) => {
          expect(slot.children).toHaveLength(1);
          expect(slot.textContent).toBe(a.categories![i]); // No preclassified items.
        });
      } else {
        expect(slots).toHaveLength(a.items!.length);
        slots.forEach((slot, i) => {
          expect(slot.children).toHaveLength(1);
          expect(slot.textContent).toBe(String(i + 1)); // Only the position, never the event.
        });
      }
      break;
    }
    case "group_task":
      expect([...workspace.children[0].children].map(el => el.textContent)).toEqual(a.roles!.map(role => `${role}: ______`));
      expect([...workspace.querySelectorAll("li")].map(el => el.textContent)).toEqual(a.steps);
      blank(workspace.lastElementChild!);
      break;
  }
  cleanup();
}

describe.skipIf(!path)("saved/reopened real AI student workspaces", () => {
  for (const c of cases) {
    it(c.label, () => {
      const kind = c.label.split("/")[0];
      const activities = c.questions.filter(q => q.type === "short_answer" && q.activity?.kind === kind);
      expect(activities.length).toBeGreaterThan(0);
      activities.forEach(checkWorkspace);
    });
  }
});

it("detects a teacher rubric leaked into a concept-map branch", () => {
  const q: ActivityQuestion = {
    id: "sentinel", type: "short_answer", prompt: "Complete the map",
    answer: "TEACHER-ONLY-RUBRIC",
    activity: { kind: "concept_map", center: "Topic", branches: ["Hint one", "Hint two"], spaceHeight: 120 },
  };
  checkWorkspace(q);
  expect(() => checkWorkspace({
    ...q, activity: { ...q.activity!, branches: [q.answer!, "Hint two"] },
  })).toThrow();
});