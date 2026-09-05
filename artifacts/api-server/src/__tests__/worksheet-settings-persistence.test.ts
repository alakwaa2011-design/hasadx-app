import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  const queue: unknown[] = [];
  const writes: unknown[] = [];
  function makeChain(result: unknown): unknown {
    const promise = Promise.resolve(result);
    const chain = new Proxy(promise, {
      get(target, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return target[prop].bind(target);
        }
        if (prop === "values" || prop === "set") {
          return (value: unknown) => {
            writes.push(value);
            return chain;
          };
        }
        return () => chain;
      },
    });
    return chain;
  }
  const operation = () => makeChain(queue.shift());
  const db = {
    select: operation,
    insert: operation,
    update: operation,
    delete: operation,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      select: operation,
      insert: operation,
      update: operation,
      delete: operation,
    }),
  };
  return { queue, writes, db };
});

vi.mock("@workspace/db", () => {
  const table = new Proxy({}, { get: () => "column" });
  return {
    db: mockState.db,
    worksheetsTable: table,
    teachersTable: table,
    assignmentsTable: table,
    questionsTable: table,
    submissionsTable: table,
    answersTable: table,
    studentsTable: table,
  };
});
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn() } } },
}));
vi.mock("../lib/anthropic-client", () => ({ anthropic: {}, SONNET_MODEL: "model" }));
vi.mock("../lib/xp/socket", () => ({
  awardXpInTxAndNotifyAfterCommit: async () => ({ runAfterCommit: () => undefined }),
}));
vi.mock("../lib/xp/engine", () => ({ reverseXpIfWithinWindow: async () => undefined }));
vi.mock("../lib/check-credits", () => ({
  checkCredits: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  captureCredits: async () => undefined,
  refundCredits: async () => undefined,
}));
vi.mock("../lib/file-upload", () => ({
  createUploadFilesMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  processUploadedFiles: async () => [],
  runVisionCompletionMulti: async () => "",
}));

import express from "express";
import request from "supertest";
import type {
  WorksheetCanvasElement,
  WorksheetSettings,
} from "@workspace/api-zod";
import worksheetsRouter from "../routes/worksheets";

const settings = {
  instructions: "اقرأ التعليمات",
  includeName: true,
  includeDate: false,
  includeClass: true,
  includeAnswerKey: false,
  columns: 2,
  headerNote: "ملاحظة علوية",
  footerNote: "ملاحظة سفلية",
  goodLuck: "بالتوفيق",
  schoolName: "مدرسة حصاد",
  section: "أ",
  teacherName: "المعلم",
  customFields: [{ label: "الفصل", value: "الأول" }],
  fontFamily: "cairo",
  fontSizePt: 14,
  showWatermark: false,
  themeColor: "#225739",
  logoUrl: "data:image/png;base64,iVBORw0KGgo=",
  template: "geometric",
  layout: {
    elements: [{
      id: "title-1",
      kind: "text",
      x: 5,
      y: 8,
      width: 40,
      height: 10,
      text: "عنوان",
      fontSize: 24,
      fontColor: "#225739",
      bold: true,
      italic: false,
      align: "center",
      opacity: 0.9,
    }, {
      id: "shape-1",
      kind: "rect",
      x: 10,
      y: 25,
      width: 30,
      height: 12,
      fillColor: "transparent",
      strokeColor: "#1a3a6b",
      strokeWidth: 2,
      strokeStyle: "dashed",
      borderRadius: 4,
    }],
  },
  pageBreaks: ["q2"],
  questionStyles: [{
    questionId: "q1",
    fields: [{ key: "prompt", fontSizePt: 16, bold: true, align: "start" }],
    spacing: "relaxed",
  }],
} satisfies WorksheetSettings;

const questions = [{
  id: "q1",
  type: "true_false",
  prompt: "الأرض كروية",
  correct: true,
}];

function makeApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    (req as any).session = { teacherId: 7 };
    (req as any).log = { error: () => undefined, warn: () => undefined, info: () => undefined };
    next();
  });
  app.use("/api", worksheetsRouter);
  return app;
}

function payload(nextSettings: unknown = settings) {
  return {
    title: "ورقة اختبار",
    language: "ar",
    gradeLevel: "5",
    subject: "علوم",
    questions,
    settings: nextSettings,
    smartGrading: false,
  };
}

function customFields(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    label: `حقل ${index + 1}`,
    value: `قيمة ${index + 1}`,
  }));
}

function layoutElements(count: number): WorksheetCanvasElement[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `element-${index + 1}`,
    kind: "rect",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  }));
}

function pageBreaks(count: number) {
  return Array.from({ length: count }, (_, index) => `question-${index + 1}`);
}

beforeEach(() => {
  mockState.queue.length = 0;
  mockState.writes.length = 0;
});

describe("worksheet appearance settings persistence", () => {
  it("preserves every editor-supported setting after create and reread", async () => {
    const created = { id: 11, teacherId: 7, ...payload(), isShared: false, linkedAssignmentId: null };
    mockState.queue.push([created]);

    const createResponse = await request(makeApp()).post("/api/worksheets").send(payload());
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.settings).toEqual(settings);
    expect(mockState.writes[0]).toMatchObject({ settings });

    mockState.queue.push([{ worksheet: created, owner: { id: 7, name: "المعلم", isAdmin: false } }]);
    const readResponse = await request(makeApp()).get("/api/worksheets/11");
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.settings).toEqual(settings);
  });

  it("preserves every editor-supported setting after update and reread", async () => {
    const existing = { id: 11, teacherId: 7, ...payload(), linkedAssignmentId: null };
    const updatedSettings = {
      ...settings,
      goodLuck: "أحسنت",
      themeColor: "#1a3a6b",
      pageBreaks: ["q1"],
    };
    const updated = { ...existing, ...payload(updatedSettings) };
    mockState.queue.push([existing], [updated]);

    const updateResponse = await request(makeApp()).put("/api/worksheets/11").send(payload(updatedSettings));
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.settings).toEqual(updatedSettings);
    expect(mockState.writes[0]).toMatchObject({ settings: updatedSettings });

    mockState.queue.push([{ worksheet: updated, owner: { id: 7, name: "المعلم", isAdmin: false } }]);
    const readResponse = await request(makeApp()).get("/api/worksheets/11");
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.settings).toEqual(updatedSettings);
  });

  it.each([
    ["theme color", { ...settings, themeColor: "green" }],
    ["logo", { ...settings, logoUrl: "https://example.com/logo.png" }],
    ["layout element", {
      ...settings,
      layout: {
        elements: [{
          id: "broken-element",
          kind: "image",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        }],
      },
    }],
  ])("rejects an invalid %s with 400", async (_name, invalidSettings) => {
    const response = await request(makeApp()).post("/api/worksheets").send(payload(invalidSettings as typeof settings));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid worksheet");
    expect(mockState.writes).toHaveLength(0);
  });

  it("accepts the maximum supported counts", async () => {
    const maximumSettings = {
      ...settings,
      customFields: customFields(6),
      layout: { elements: layoutElements(100) },
      pageBreaks: pageBreaks(59),
    };
    const created = { id: 12, teacherId: 7, ...payload(maximumSettings), linkedAssignmentId: null };
    mockState.queue.push([created]);

    const response = await request(makeApp()).post("/api/worksheets").send(payload(maximumSettings));

    expect(response.status).toBe(201);
    expect(mockState.writes[0]).toMatchObject({ settings: maximumSettings });
  });

  it.each([
    ["custom fields", { ...settings, customFields: customFields(7) }],
    ["layout elements", { ...settings, layout: { elements: layoutElements(101) } }],
    ["page breaks", { ...settings, pageBreaks: pageBreaks(60) }],
  ])("rejects too many %s with 400", async (_name, invalidSettings) => {
    const response = await request(makeApp()).post("/api/worksheets").send(payload(invalidSettings));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid worksheet");
    expect(mockState.writes).toHaveLength(0);
  });

  it("leaves the saved worksheet unchanged when an update is rejected", async () => {
    const existing = { id: 11, teacherId: 7, ...payload(), linkedAssignmentId: null };
    const invalidSettings = { ...settings, themeColor: "#not-a-color" };

    const updateResponse = await request(makeApp()).put("/api/worksheets/11").send(payload(invalidSettings));

    expect(updateResponse.status).toBe(400);
    expect(mockState.writes).toHaveLength(0);

    mockState.queue.push([{ worksheet: existing, owner: { id: 7, name: "المعلم", isAdmin: false } }]);
    const readResponse = await request(makeApp()).get("/api/worksheets/11");
    expect(readResponse.status).toBe(200);
    expect(readResponse.body.settings).toEqual(settings);
  });
});