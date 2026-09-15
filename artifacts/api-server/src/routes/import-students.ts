import { Router, type IRouter } from "express";
import { awardXpAndNotify } from "../lib/xp/socket";
import multer from "multer";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { db, studentsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/csv",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv|docx|doc|jpg|jpeg|png|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("نوع الملف غير مدعوم"));
    }
  },
});

const NAME_HEADERS = ["name", "الاسم", "اسم الطالب", "اسم", "student", "student name", "الطالب", "الاسم الكامل", "full name", "اسم الطالب كاملاً"];

function findNameColumn(headers: string[]): string | null {
  for (const h of NAME_HEADERS) {
    const match = headers.find(k => k.toLowerCase().trim() === h.toLowerCase());
    if (match) return match;
  }
  return null;
}

function isLikelyName(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^[\d\s\+\-\(\)]+$/.test(trimmed)) return false;
  return true;
}

async function parseExcel(buffer: Buffer): Promise<string[]> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "", header: 1 });
  if (rows.length === 0) return [];

  const headerRow = rows[0] as any[];
  const headers = headerRow.map((h: any) => (h ?? "").toString().trim());

  const namedCol = findNameColumn(headers);

  if (namedCol) {
    const colIdx = headers.indexOf(namedCol);
    return rows.slice(1)
      .map((r: any) => (r[colIdx] ?? "").toString().trim())
      .filter(isLikelyName);
  }

  if (headers.length === 1) {
    const firstVal = (headerRow[0] ?? "").toString().trim();
    const firstIsHeader = NAME_HEADERS.some(h => h.toLowerCase() === firstVal.toLowerCase());
    const startIdx = firstIsHeader ? 1 : 0;
    return rows.slice(startIdx)
      .map((r: any) => (r[0] ?? "").toString().trim())
      .filter(isLikelyName);
  }

  const nameRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  const allKeys = nameRows.length > 0 ? Object.keys(nameRows[0]) : [];

  let bestCol: string | null = null;
  let bestScore = 0;
  for (const key of allKeys) {
    const values = nameRows.map(r => (r[key] ?? "").toString().trim()).filter(Boolean);
    const nameScore = values.filter(v => /[\u0600-\u06FF]/.test(v) || /^[a-zA-Z\s]+$/.test(v)).length;
    const score = nameScore / Math.max(values.length, 1);
    if (score > bestScore) {
      bestScore = score;
      bestCol = key;
    }
  }

  if (!bestCol || bestScore < 0.3) {
    return nameRows
      .map(r => (r[allKeys[0]] ?? "").toString().trim())
      .filter(isLikelyName);
  }

  return nameRows
    .map(r => (r[bestCol!] ?? "").toString().trim())
    .filter(isLikelyName);
}

async function parseWord(buffer: Buffer): Promise<string[]> {
  const result = await mammoth.extractRawText({ buffer });
  const lines = result.value
    .split("\n")
    .map(l => l.replace(/^\d+[\.\-\)\s]+/, "").trim())
    .filter(isLikelyName);
  return lines;
}

async function parseRosterImage(buffer: Buffer, mimetype: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "استخرج أسماء الطلاب فقط من كشف الأسماء الظاهر في الصورة.",
            "تجاهل العناوين والأرقام والدرجات والتواريخ وأسماء المواد.",
            "لا تخمّن اسمًا غير واضح، ولا تصحح أو تعيد صياغة الأسماء.",
            'أعد JSON فقط بالشكل: {\"names\":[\"الاسم الأول\",\"الاسم الثاني\"]}',
          ].join("\n"),
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimetype};base64,${buffer.toString("base64")}`,
            detail: "high",
          },
        },
      ],
    }],
    response_format: { type: "json_object" },
    max_completion_tokens: 2500,
  });
  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { names?: unknown };
  if (!Array.isArray(parsed.names)) return [];
  return [...new Set(parsed.names
    .filter((name): name is string => typeof name === "string")
    .map((name) => name.replace(/^\d+[\.\-\)\s]+/, "").trim())
    .filter(isLikelyName))];
}

router.post("/students/import", upload.single("file"), async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      res.status(401).json({ message: "غير مسجل الدخول" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "لم يتم رفع ملف" });
      return;
    }

    const { buffer, mimetype, originalname } = req.file;
    let names: string[] = [];

    const ext = originalname.toLowerCase().split(".").pop();
    const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext ?? "") || mimetype.startsWith("image/");

    if (ext === "xlsx" || ext === "xls" || ext === "csv" || mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype === "text/csv") {
      names = await parseExcel(buffer);
    } else if (ext === "docx" || ext === "doc" || mimetype.includes("word")) {
      names = await parseWord(buffer);
    } else if (isImage) {
      names = await parseRosterImage(buffer, mimetype);
    } else {
      res.status(400).json({ message: "نوع الملف غير مدعوم" });
      return;
    }

    if (names.length === 0) {
      res.json({ students: [], saved: 0, message: "لم يتم العثور على أسماء طلاب في الملف" });
      return;
    }

    if (isImage) {
      res.json({
        students: [],
        names,
        saved: 0,
        preview: true,
        message: "تم استخراج الأسماء من الصورة. راجعها قبل الإضافة.",
      });
      return;
    }

    if (names.length > 500) {
      names = names.slice(0, 500);
    }

    const defaultClass = req.body?.studentClass?.trim() || null;
    const defaultGrade = req.body?.gradeLevel?.trim() || null;

    const values = names.map(name => ({
      name,
      gradeLevel: defaultGrade,
      studentClass: defaultClass,
      parentPhone: null,
      notes: null,
      teacherId,
    }));

    const inserted = await db.insert(studentsTable).values(values).returning();

    // Award XP for bulk import (≥10 students), one-shot per import batch
    if (inserted.length >= 10) {
      const batchKey = `bulk_import:${teacherId}:${inserted[0]?.id ?? Date.now()}`;
      void awardXpAndNotify({
        teacherId,
        actionKey: "students.bulk_import",
        refId: batchKey,
      }).catch(() => {});
    }

    res.status(201).json({
      students: inserted,
      saved: inserted.length,
      message: `تم استيراد ${inserted.length} طالب بنجاح`,
    });
  } catch (err: any) {
    req.log.error(err, "Failed to import students");
    if (err.message === "نوع الملف غير مدعوم") {
      res.status(400).json({ message: err.message });
    } else {
      res.status(500).json({ message: "حدث خطأ أثناء استيراد الطلاب" });
    }
  }
});

export default router;
