import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { buildSystemPrompt } from "../lib/ai-system-prompt";
import {
  HASAD_GUIDE_ROUTES,
  HASAD_GUIDE_ROUTE_EXCLUSIONS,
} from "../data/hasad-guide-route-contract";

const APP_ROUTE_PATTERN = /<Route\s+path="([^"]+)"/g;
const DOCUMENTED_ROUTE_PATTERN = /`(\/[^`\s]+)`/g;

const API_ROOT = resolve(process.cwd());
const REPOSITORY_ROOT = resolve(API_ROOT, "../..");
const CANONICAL_KNOWLEDGE_PATH = resolve(
  API_ROOT,
  "src/data/hasad_knowledge_base.md",
);

function findSecondaryKnowledgeFiles(directory: string): string[] {
  const ignoredDirectories = new Set([
    ".git",
    ".local",
    "attached_assets",
    "dist",
    "node_modules",
  ]);
  const matches: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        matches.push(...findSecondaryKnowledgeFiles(resolve(directory, entry.name)));
      }
      continue;
    }

    const normalizedName = entry.name.toLowerCase().replaceAll("-", "_");
    if (
      entry.isFile() &&
      normalizedName.endsWith(".md") &&
      normalizedName.includes("hasad") &&
      normalizedName.includes("knowledge")
    ) {
      matches.push(resolve(directory, entry.name));
    }
  }

  return matches;
}

describe("Hasad Guide system prompt", () => {
  it("keeps one editable source for platform feature and policy claims", () => {
    expect(existsSync(CANONICAL_KNOWLEDGE_PATH)).toBe(true);

    const knowledgeFiles = findSecondaryKnowledgeFiles(REPOSITORY_ROOT)
      .map((path) => relative(REPOSITORY_ROOT, path))
      .sort();

    expect(knowledgeFiles).toEqual([
      relative(REPOSITORY_ROOT, CANONICAL_KNOWLEDGE_PATH),
    ]);

    const source = readFileSync(
      resolve(API_ROOT, "src/lib/ai-system-prompt.ts"),
      "utf8",
    );
    expect(source).toContain(
      'const KNOWLEDGE_BASE_FILENAME = "hasad_knowledge_base.md"',
    );
    expect(basename(CANONICAL_KNOWLEDGE_PATH)).toBe(
      "hasad_knowledge_base.md",
    );
  });

  it("loads the current adaptive-assessment knowledge", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("الاختبار التكيفي");
    expect(prompt).toContain("تكيفي متعدد المراحل");
    expect(prompt).toContain("عرض مسار الطالب");
    expect(prompt).toContain("الأسئلة الناقصة فقط");
  });

  it("teaches the verified cancellation steps without inventing refunds or revoking prepaid access", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("### إلغاء الاشتراك وإيقاف التجديد التلقائي");
    expect(prompt).toContain("افتح صفحة الباقات `/teacher/pricing`");
    expect(prompt).toContain("«إدارة الاشتراك»");
    expect(prompt).toContain("«إلغاء الاشتراك»");
    expect(prompt).toContain("«تأكيد الإلغاء»");
    expect(prompt).toContain("انتظر رسالة نجاح الإلغاء");
    expect(prompt).toContain("إذا ظهر خطأ، فلا تعتبر الاشتراك ملغى");
    expect(prompt).toContain("حتى نهاية الفترة المدفوعة الحالية");
    expect(prompt).toContain("إلغاء التجديد ليس طلب استرداد مبلغ");
    expect(prompt).toContain("لا يلغي استحقاق تلك الفترة");
    expect(prompt).not.toContain("**سياسة الاسترجاع** والاشتراكات.");
  });

  it("uses the current points policy instead of the retired daily-message limit", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("نقاط حصاد");
    expect(prompt).toContain("لا توجد حصة رسائل يومية مستقلة");
    expect(prompt).not.toContain("له حد رسائل يومي حسب الباقة");
    expect(prompt).not.toContain("انتهى الحدّ اليومي");
  });

  it("keeps unsupported platform claims behind the exact support fallback", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("لا أملك هذه المعلومة حالياً، تواصل مع الدعم.");
    expect(prompt).toContain("لا تخترع");
    expect(prompt).toContain("لا تعرض قاعدة المعرفة أسعاراً أو حدوداً رقمية للباقات");
  });

  it("treats saved admin facts as approved knowledge without permitting invented procedures", () => {
    const prompt = buildSystemPrompt(
      "الميزة: إنشاء نشاط تجريبي\nالخطوات:\n1. افتح صفحة الأنشطة\n2. اضغط إنشاء نشاط",
    );

    expect(prompt).toContain("معلومات معتمدة مضافة من المسؤول");
    expect(prompt).toContain("إنشاء نشاط تجريبي");
    expect(prompt).toContain("أسماء أزرار أو ترتيب خطوات");
    expect(prompt).toContain("فلا تكمل الخطوات من عندك");
    expect(prompt).not.toContain("تخص النبرة والأسلوب فقط");
  });

  it("consistently supports teachers and organizers", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("مساعدة المعلّمين والمنظّمين");
    expect(prompt).toContain("زر عائم للمعلّمين والمنظّمين");
    expect(prompt).toContain("تسجيل دخول من `/login` ثم فتح `/organizer`");
    expect(prompt).toContain("واجهة مبسّطة للفعاليات والألعاب فقط، وتحتاج إلى تسجيل دخول");
    expect(prompt).not.toContain("للمعلّمين فقط");
    expect(prompt).not.toContain("زر عائم للمعلّم.");
    expect(prompt).not.toContain("الزائر (مقدّم فعالية)");
    expect(prompt).not.toContain("من `/organizer` (لوحة المنظّم)");
  });

  it("keeps every guide route registered in the web app and documented", () => {
    const prompt = buildSystemPrompt();
    const appPath = resolve(process.cwd(), "../homework-app/src/App.tsx");
    const appSource = readFileSync(appPath, "utf8");
    const registeredRoutes = new Set(
      Array.from(appSource.matchAll(APP_ROUTE_PATTERN), (match) => match[1]),
    );

    for (const route of HASAD_GUIDE_ROUTES) {
      expect(
        registeredRoutes,
        `${route.appPath} is documented by the Hasad Guide but is not registered in App.tsx`,
      ).toContain(route.appPath);
      expect(
        prompt,
        `${route.guidePath} is in the guide route contract but missing from the knowledge base`,
      ).toContain(route.guidePath);
    }

    expect(prompt).not.toContain("/student-login");
    expect(prompt).not.toContain("/game/wameedh");
  });

  it("does not turn privileged administration URLs into enforced guide routes", () => {
    const enforcedPaths = HASAD_GUIDE_ROUTES.flatMap((route) => [
      route.guidePath,
      route.appPath,
    ]);

    expect(enforcedPaths).not.toContain("/teacher/admin");
    expect(enforcedPaths.some((path) => path.startsWith("/admin/"))).toBe(false);
  });

  it("requires every documented route to be classified by the central contract", () => {
    const prompt = buildSystemPrompt();
    const documentedPaths = new Set(
      Array.from(prompt.matchAll(DOCUMENTED_ROUTE_PATTERN), (match) => match[1]),
    );
    const classifiedPaths = new Set<string>([
      ...HASAD_GUIDE_ROUTES.map((route) => route.guidePath),
      ...HASAD_GUIDE_ROUTE_EXCLUSIONS,
    ]);

    expect(
      [...documentedPaths].filter((path) => !classifiedPaths.has(path)),
      "Route-like links in the knowledge base must be public guide routes or explicit privileged exclusions",
    ).toEqual([]);
  });

  it("keeps the FAQ data internally consistent with the prompt policy", () => {
    const faqPath = resolve(process.cwd(), "src/data/hasad_faq.json");
    const parsed = JSON.parse(readFileSync(faqPath, "utf8")) as {
      faqs: Array<{ q: string; a: string }>;
    };
    const answers = parsed.faqs.map((entry) => entry.a).join("\n");
    const quotaEntry = parsed.faqs.find((entry) =>
      entry.q.includes("الحدّ اليومي"),
    );

    expect(quotaEntry?.a).toContain("لا توجد حصة رسائل يومية مستقلة");
    expect(answers).not.toContain("انتهى الحدّ اليومي");
    expect(answers).not.toContain("/game/wameedh/create");
    expect(answers).toContain("/game/wameeth/create");
  });
});