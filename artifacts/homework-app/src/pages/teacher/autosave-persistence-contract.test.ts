import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function source(name: string) {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
}

describe("عقد تثبيت معرّفات الحفظ التلقائي", () => {
  it("تثبت ورقة العمل المعرّف وتعيد المحاولة من آخر payload دون إعادة توليد", () => {
    const code = source("./worksheet-create.tsx");

    expect(code).toContain('const method = currentId ? "PUT" : "POST"');
    expect(code).toMatch(/editingIdRef\.current\s*=\s*savedId/);
    expect(code).toContain("await persistWorksheetPayload({");
    expect(code).toContain("latestWorksheetRef.current");
    expect(code).toContain("clientRequestId");
    expect(code).toContain("retryWorksheetPayloadRef.current");
    expect(code).toContain("saveBlockedRef.current && !retrying");
    expect(code).toContain("persistWorksheetPayload(payload, true, true)");
    expect(code).toContain('autoSaveStatus === "error"');
  });

  it("تثبت خطة الدرس المعرّف وتحوّل الحفظات التالية إلى PUT", () => {
    const code = source("./lesson-plan-create.tsx");

    expect(code).toContain('const method = currentId ? "PUT" : "POST"');
    expect(code).toMatch(/editingIdRef\.current\s*=\s*savedId/);
    expect(code).toContain("await persistPlanPayload({");
    expect(code).toContain("latestPlanRef.current");
    expect(code).toContain("clientRequestId");
    expect(code).toContain("retryPlanPayloadRef.current");
    expect(code).toContain("saveBlockedRef.current && !retrying");
    expect(code).toContain("persistPlanPayload(payload, true, true)");
    expect(code).toContain('autoSaveStatus === "error"');
  });

  it("تحفظ السبورة بعد التوليد وتستخدم المعرّف نفسه عند بدء العرض", () => {
    const code = source("./smart-board-new.tsx");

    expect(code).toContain('method: currentId ? "PUT" : "POST"');
    expect(code).toMatch(/savedIdRef\.current\s*=\s*nextId/);
    expect(code).toContain("await persistPlan(d.plan)");
    expect(code).toMatch(/const id = await persistPlan\(plan, true\)/);
    expect(code).toContain("navigate(`/teacher/smart-board/present/${id}`)");
    expect(code).toContain("clientRequestId");
    expect(code).toContain("retryPlanPayloadRef.current");
    expect(code).toContain("saveBlockedRef.current && !retrying");
    expect(code).toContain("persistPlan(payload.plan, false, true, payload)");
    expect(code).toContain('saveStatus === "error"');
  });
});