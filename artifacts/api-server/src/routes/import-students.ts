import { Router, type IRouter } from "express";
import { awardXpAndNotify } from "../lib/xp/socket";
import multer from "multer";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { db, studentsTable } from "@workspace/db";

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
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv|docx|doc)$/i)) {
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

    if (ext === "xlsx" || ext === "xls" || ext === "csv" || mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype === "text/csv") {
      names = await parseExcel(buffer);
    } else if (ext === "docx" || ext === "doc" || mimetype.includes("word")) {
      names = await parseWord(buffer);
    } else {
      res.status(400).json({ message: "نوع الملف غير مدعوم" });
      return;
    }

    if (names.length === 0) {
      res.json({ students: [], saved: 0, message: "لم يتم العثور على أسماء طلاب في الملف" });
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
