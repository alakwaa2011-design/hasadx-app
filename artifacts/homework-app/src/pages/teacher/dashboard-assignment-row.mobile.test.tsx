import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssignmentRow } from "./dashboard";

const assignment = {
  id: 42,
  title: "واجب العلوم بعنوان طويل للتأكد من بقاء الإدارة واضحة",
  questionCount: 8,
  submissionCount: 3,
  examMode: false,
};

const deleteAssignment = vi.fn();
const onShare = vi.fn();
const fetchMock = vi.fn();
const clipboardWrite = vi.fn();

function AssignmentRowHarness() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <AssignmentRow
      assignment={assignment}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded((value) => !value)}
      creatingGameForId={null}
      startGame={vi.fn()}
      deleteAssignment={deleteAssignment}
      setLocation={vi.fn()}
      lang="ar"
      t={{
        dashboard: {
          question: "أسئلة",
          submission: "تسليمات",
          liveGame: "لعبة مباشرة",
          creating: "جارٍ الإنشاء",
        },
      }}
      queryClient={{ invalidateQueries: vi.fn() }}
      onShare={onShare}
      collections={[]}
      addToCollection={vi.fn()}
      removeFromCollection={vi.fn()}
      creatingGroupName=""
      setCreatingGroupName={vi.fn()}
      createGroupAndAdd={vi.fn()}
      savingGroup={false}
      isFavorite={false}
      onToggleFavorite={vi.fn()}
    />
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("scrollTo", vi.fn());
  deleteAssignment.mockClear();
  onShare.mockClear();
  fetchMock.mockClear();
  clipboardWrite.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWrite },
  });
  vi.stubGlobal("innerWidth", 390);

  container = document.createElement("div");
  container.style.width = "390px";
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root.render(<AssignmentRowHarness />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function manageButton() {
  return container.querySelector(
    '[data-testid="assignment-manage-42"]',
  ) as HTMLButtonElement;
}

describe("AssignmentRow on mobile", () => {
  it("يعرض زر إدارة واضحًا ويفتح لوحة الإجراءات ويغلقها", async () => {
    const button = manageButton();

    expect(button.textContent).toContain("إدارة");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(container.textContent).not.toContain("تعديل النشاط");

    await act(async () => button.click());

    expect(manageButton().getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("تعديل النشاط");
    expect(container.textContent).toContain("نسخ الرابط");
    expect(container.textContent).toContain("إنشاء نسخة");

    await act(async () => manageButton().click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 220));
    });

    expect(manageButton().getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("تعديل النشاط");
  });

  it("يبقى داخل عرض الجوال دون تمرير أفقي ولا ينفذ إجراءات خطرة", () => {
    const row = container.querySelector(
      '[data-testid="assignment-row-42"]',
    ) as HTMLDivElement;

    expect(row.classList.contains("w-full")).toBe(true);
    expect(row.classList.contains("min-w-0")).toBe(true);
    expect(row.classList.contains("max-w-full")).toBe(true);
    expect(row.classList.contains("overflow-hidden")).toBe(true);
    expect(row.scrollWidth).toBeLessThanOrEqual(390);
    expect(deleteAssignment).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clipboardWrite).not.toHaveBeenCalled();
  });
});