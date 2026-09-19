/**
 * اختبارات عقد معاملات الرابط في dashboard.tsx
 *
 * يثبت هذه الاختبارات أن parseDashboardUrlParams — الدالة التي تستخدمها
 * TeacherDashboard لقراءة معاملات URL عند الدخول — تفسّر بشكل صحيح:
 *
 *   ?liveGamePicker=<id>            ← يفتح نافذة اختيار اللعبة للنشاط المحدد
 *   ?tab=assignments&liveGamePicker=<id>  ← يجمع التبويب والنافذة معاً
 *   ?liveGame=1                     ← المسار القديم: ينتقل إلى إنشاء وميض
 *
 * أي تعديل مستقبلي على معالجة معاملات الرابط في dashboard يجب أن يمر
 * بهذه الاختبارات أولاً.
 */
import { describe, it, expect } from "vitest";
import {
  dashboardPathForSelection,
  matchesTeacherToolQuery,
  parseDashboardPathname,
  parseDashboardUrlParams,
} from "./dashboard";

const PATH = "/teacher";

describe("parseDashboardUrlParams — ?liveGamePicker", () => {
  it("يفتح نافذة اختيار اللعبة للنشاط المحدد", () => {
    const result = parseDashboardUrlParams("?liveGamePicker=42", PATH);
    expect(result.liveGamePickerId).toBe(42);
  });

  it("ينظّف المعامل من الرابط", () => {
    const result = parseDashboardUrlParams("?liveGamePicker=42", PATH);
    expect(result.cleanedUrl).toBe(PATH);
    expect(result.cleanedUrl).not.toContain("liveGamePicker");
  });

  it("لا يشغّل مسار وميض القديم عند وجود liveGamePicker", () => {
    const result = parseDashboardUrlParams("?liveGamePicker=42", PATH);
    expect(result.navigateTo).toBeUndefined();
  });

  it("يدعم أي معرّف رقمي صحيح", () => {
    expect(parseDashboardUrlParams("?liveGamePicker=1", PATH).liveGamePickerId).toBe(1);
    expect(parseDashboardUrlParams("?liveGamePicker=999", PATH).liveGamePickerId).toBe(999);
  });

  it("يتجاهل قيمة liveGamePicker غير الرقمية", () => {
    const result = parseDashboardUrlParams("?liveGamePicker=abc", PATH);
    expect(result.liveGamePickerId).toBeUndefined();
  });

  it("يحافظ على hash الصفحة في الرابط المنظَّف", () => {
    const result = parseDashboardUrlParams("?liveGamePicker=42", PATH, "#section");
    expect(result.cleanedUrl).toBe(`${PATH}#section`);
  });
});

describe("parseDashboardUrlParams — ?tab + ?liveGamePicker معاً", () => {
  it("يضبط التبويب ويفتح النافذة في نفس الوقت", () => {
    const result = parseDashboardUrlParams("?tab=assignments&liveGamePicker=42", PATH);
    expect(result.tab).toBe("assignments");
    expect(result.liveGamePickerId).toBe(42);
  });

  it("ينظّف كلا المعاملين من الرابط", () => {
    const result = parseDashboardUrlParams("?tab=assignments&liveGamePicker=42", PATH);
    expect(result.cleanedUrl).toBe(PATH);
    expect(result.cleanedUrl).not.toContain("tab");
    expect(result.cleanedUrl).not.toContain("liveGamePicker");
  });

  it("لا ينشئ navigateTo عند وجود liveGamePicker حتى لو كان liveGame=1 أيضاً", () => {
    const result = parseDashboardUrlParams("?liveGamePicker=42&liveGame=1", PATH);
    expect(result.liveGamePickerId).toBe(42);
    expect(result.navigateTo).toBeUndefined();
  });
});

describe("parseDashboardUrlParams — ?tab وحده", () => {
  it("يضبط التبويب عند وجود قيمة معروفة", () => {
    const result = parseDashboardUrlParams("?tab=assignments", PATH);
    expect(result.tab).toBe("assignments");
    expect(result.cleanedUrl).toBe(PATH);
  });

  it("يتجاهل قيمة tab غير المعروفة", () => {
    const result = parseDashboardUrlParams("?tab=unknown_tab", PATH);
    expect(result.tab).toBeUndefined();
  });

  const recognised = [
    "overview", "assignments", "shared", "library_homework",
    "competitive", "tools", "videos", "stats", "students",
    "rewards", "kids_board",
  ] as const;

  for (const tab of recognised) {
    it(`يتعرّف على التبويب المعروف: ${tab}`, () => {
      expect(parseDashboardUrlParams(`?tab=${tab}`, PATH).tab).toBe(tab);
    });
  }
});

describe("parseDashboardUrlParams — ?liveGame=1 (المسار القديم)", () => {
  it("ينتقل إلى صفحة إنشاء وميض", () => {
    const result = parseDashboardUrlParams("?liveGame=1", PATH);
    expect(result.navigateTo).toBe("/game/wameeth/create");
  });

  it("ينظّف المعامل من الرابط", () => {
    const result = parseDashboardUrlParams("?liveGame=1", PATH);
    expect(result.cleanedUrl).toBe(PATH);
    expect(result.cleanedUrl).not.toContain("liveGame");
  });

  it("لا يفتح نافذة اختيار اللعبة", () => {
    const result = parseDashboardUrlParams("?liveGame=1", PATH);
    expect(result.liveGamePickerId).toBeUndefined();
  });

  it("يتجاهل liveGame بقيمة غير 1", () => {
    const result = parseDashboardUrlParams("?liveGame=0", PATH);
    expect(result.navigateTo).toBeUndefined();
  });

  it("يدعم مزج tab مع liveGame=1", () => {
    const result = parseDashboardUrlParams("?tab=assignments&liveGame=1", PATH);
    expect(result.tab).toBe("assignments");
    expect(result.navigateTo).toBe("/game/wameeth/create");
    expect(result.cleanedUrl).toBe(PATH);
  });
});

describe("parseDashboardUrlParams — لا معاملات", () => {
  it("يُعيد cleanedUrl مساوياً للمسار عند غياب المعاملات", () => {
    const result = parseDashboardUrlParams("", PATH);
    expect(result.cleanedUrl).toBe(PATH);
    expect(result.tab).toBeUndefined();
    expect(result.liveGamePickerId).toBeUndefined();
    expect(result.navigateTo).toBeUndefined();
  });
});

describe("روابط أقسام لوحة المعلم", () => {
  it("يعطي كل قسم داخلي رابطًا وصفيًا ثابتًا", () => {
    expect(dashboardPathForSelection("assignments")).toBe("/teacher/assignments");
    expect(dashboardPathForSelection("competitive")).toBe("/teacher/competitions");
    expect(dashboardPathForSelection("stats")).toBe("/teacher/statistics");
  });

  it("يحفظ مجموعة الأدوات المختارة في الرابط", () => {
    expect(dashboardPathForSelection("tools", "content"))
      .toBe("/teacher/tools/content");
    expect(parseDashboardPathname("/teacher/tools/content")).toEqual({
      tab: "tools",
      toolsSubTab: "content",
    });
  });

  it("يحفظ قسم مركز القرآن المختار في الرابط", () => {
    expect(dashboardPathForSelection("quran", "ai-tools", "circles"))
      .toBe("/teacher/quran/circles");
    expect(parseDashboardPathname("/teacher/quran/circles")).toEqual({
      tab: "quran",
      quranSubTab: "circles",
    });
  });

  it("يتجاهل المسارات غير التابعة للوحة", () => {
    expect(parseDashboardPathname("/teacher/tools/timer")).toBeNull();
  });
});

describe("بحث أدوات المعلم", () => {
  const scheduleTool = {
    title: "جدول الحصص والمواعيد",
    desc: "نظّم حصصك ومواعيدك واحصل على تنبيهات قبل الحصة.",
    searchText: "جدول الحصص إدارة الجدول المواعيد التنبيهات class schedule appointments alerts",
  };

  it("يبحث بالاسم العربي", () => {
    expect(matchesTeacherToolQuery(scheduleTool, "جدول الحصص")).toBe(true);
  });

  it("يبحث بالوصف العربي", () => {
    expect(matchesTeacherToolQuery(scheduleTool, "تنبيهات")).toBe(true);
  });

  it("يبحث بالكلمات الإنجليزية البديلة أثناء عرض العربية", () => {
    expect(matchesTeacherToolQuery(scheduleTool, "schedule")).toBe(true);
  });

  it("لا يعرض أداة غير مطابقة", () => {
    expect(matchesTeacherToolQuery(scheduleTool, "Google Classroom")).toBe(false);
  });
});
