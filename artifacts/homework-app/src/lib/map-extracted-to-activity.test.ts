/**
 * Unit tests for the activity-editor extraction utilities.
 *
 * Covers:
 *  - mapExtractedToActivity — worksheet-question → CreateQuestionBody mapping
 *  - extractFileError / EXTRACT_EXT_RE — client-side file-format rejection
 */
import { describe, it, expect } from "vitest";
import {
  mapExtractedToActivity,
  extractFileError,
  EXTRACT_EXT_RE,
  fingerprintFiles,
  fingerprintFilesContent,
} from "./map-extracted-to-activity";

/* ─────────────────────────────────────────────────────────
   mapExtractedToActivity
───────────────────────────────────────────────────────── */

describe("fingerprintFiles — same-source duplicate detection", () => {
  const f = (name: string, size: number, lastModified = 111) => ({ name, size, lastModified });

  it("identical file sets produce the same fingerprint regardless of order", () => {
    const a = fingerprintFiles([f("a.pdf", 100), f("b.png", 200)]);
    const b = fingerprintFiles([f("b.png", 200), f("a.pdf", 100)]);
    expect(a).toBe(b);
  });

  it("differing name, size, or lastModified changes the fingerprint", () => {
    const base = fingerprintFiles([f("a.pdf", 100)]);
    expect(fingerprintFiles([f("b.pdf", 100)])).not.toBe(base);
    expect(fingerprintFiles([f("a.pdf", 101)])).not.toBe(base);
    expect(fingerprintFiles([f("a.pdf", 100, 222)])).not.toBe(base);
  });

  it("adding a file changes the fingerprint", () => {
    expect(fingerprintFiles([f("a.pdf", 100), f("c.txt", 5)]))
      .not.toBe(fingerprintFiles([f("a.pdf", 100)]));
  });
});

describe("fingerprintFilesContent — content-based SHA-256 fingerprint", () => {
  /** File-like object backed by actual bytes. */
  const cf = (name: string, content: string, lastModified = 111) => {
    const bytes = new TextEncoder().encode(content);
    return {
      name,
      size: bytes.byteLength,
      lastModified,
      arrayBuffer: async () => bytes.buffer.slice(0) as ArrayBuffer,
    };
  };

  it("same content under different names/timestamps → same fingerprint", async () => {
    const a = await fingerprintFilesContent([cf("lesson.pdf", "same bytes", 111)]);
    const b = await fingerprintFilesContent([cf("renamed-copy.pdf", "same bytes", 999)]);
    expect(a).toBe(b);
  });

  it("multi-file fingerprint is order-insensitive", async () => {
    const a = await fingerprintFilesContent([cf("a.pdf", "AAA"), cf("b.png", "BBB")]);
    const b = await fingerprintFilesContent([cf("b.png", "BBB"), cf("a.pdf", "AAA")]);
    expect(a).toBe(b);
  });

  it("different content → different fingerprint", async () => {
    const a = await fingerprintFilesContent([cf("a.pdf", "AAA")]);
    const b = await fingerprintFilesContent([cf("a.pdf", "AAB")]);
    expect(a).not.toBe(b);
  });

  it("fingerprint is built from sorted SHA-256 hex hashes", async () => {
    const fp = await fingerprintFilesContent([cf("a", "x"), cf("b", "y")]);
    const parts = fp.split("|");
    expect(parts).toHaveLength(2);
    for (const p of parts) expect(p).toMatch(/^[0-9a-f]{64}$/);
    expect([...parts].sort()).toEqual(parts);
  });

  it("falls back to metadata fingerprint when hashing fails", async () => {
    const broken = {
      name: "a.pdf",
      size: 100,
      lastModified: 111,
      arrayBuffer: async () => { throw new Error("unreadable"); },
    };
    expect(await fingerprintFilesContent([broken])).toBe(fingerprintFiles([broken]));
  });
});

describe("mapExtractedToActivity — MCQ", () => {
  it("maps a well-formed MCQ to correctAnswer A–D letters", () => {
    const result = mapExtractedToActivity([
      {
        type: "mcq",
        prompt: "ما ناتج 2+2؟",
        options: ["3", "4", "5", "6"],
        correctIndex: 1,
        points: 2,
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: "ما ناتج 2+2؟",
      questionType: "mcq",
      optionA: "3",
      optionB: "4",
      optionC: "5",
      optionD: "6",
      correctAnswer: "B",
      points: 2,
    });
  });

  it("clamps correctIndex to 0 when it is out of bounds (negative)", () => {
    const result = mapExtractedToActivity([
      {
        type: "mcq",
        prompt: "سؤال",
        options: ["أ", "ب"],
        correctIndex: -5,
      },
    ]);
    expect(result[0].correctAnswer).toBe("A");
  });

  it("clamps correctIndex to the last option when too large", () => {
    const result = mapExtractedToActivity([
      {
        type: "mcq",
        prompt: "سؤال",
        options: ["أ", "ب", "ج"],
        correctIndex: 99,
      },
    ]);
    expect(result[0].correctAnswer).toBe("C");
  });

  it("takes at most 4 options even when more are supplied", () => {
    const result = mapExtractedToActivity([
      {
        type: "mcq",
        prompt: "سؤال طويل",
        options: ["أ", "ب", "ج", "د", "هـ", "و"],
        correctIndex: 0,
      },
    ]);
    expect(result[0].optionD).toBe("د");
    // 5th and 6th options are silently ignored — no optionE
    expect((result[0] as Record<string, unknown>).optionE).toBeUndefined();
  });

  it("defaults points to 1 when missing or zero", () => {
    const result = mapExtractedToActivity([
      { type: "mcq", prompt: "سؤال", options: ["أ", "ب"], correctIndex: 0 },
      {
        type: "mcq",
        prompt: "سؤال آخر",
        options: ["أ", "ب"],
        correctIndex: 0,
        points: 0,
      },
    ]);
    expect(result[0].points).toBe(1);
    expect(result[1].points).toBe(1);
  });
});

describe("mapExtractedToActivity — true_false", () => {
  it("maps correct:true to correctAnswer 'true'", () => {
    const result = mapExtractedToActivity([
      { type: "true_false", prompt: "الأرض كروية.", correct: true },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: "الأرض كروية.",
      questionType: "true_false",
      correctAnswer: "true",
    });
  });

  it("maps correct:false to correctAnswer 'false'", () => {
    const result = mapExtractedToActivity([
      { type: "true_false", prompt: "الشمس تشرق من الغرب.", correct: false },
    ]);
    expect(result[0].correctAnswer).toBe("false");
  });
});

describe("mapExtractedToActivity — fill_blank", () => {
  it("maps fill_blank with an answer string", () => {
    const result = mapExtractedToActivity([
      {
        type: "fill_blank",
        prompt: "عاصمة السعودية هي ___.",
        answer: "الرياض",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      text: "عاصمة السعودية هي ___.",
      questionType: "fill_blank",
      correctAnswer: "الرياض",
    });
  });
});

describe("mapExtractedToActivity — filtering & unsupported types", () => {
  it("drops questions with empty or whitespace-only prompt", () => {
    const result = mapExtractedToActivity([
      { type: "true_false", prompt: "", correct: true },
      { type: "true_false", prompt: "   ", correct: false },
      { type: "true_false", prompt: "سؤال حقيقي", correct: true },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("سؤال حقيقي");
  });

  it("silently drops unsupported types (short_answer, matching)", () => {
    const result = mapExtractedToActivity([
      { type: "short_answer", prompt: "اشرح مفهوم الجاذبية.", answer: "قوة" },
      { type: "matching", prompt: "طابق الأعداد", pairs: [] },
      { type: "true_false", prompt: "سؤال مدعوم", correct: true },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].questionType).toBe("true_false");
  });

  it("handles an empty input array without throwing", () => {
    expect(mapExtractedToActivity([])).toEqual([]);
  });

  it("returns multiple question types from a mixed batch", () => {
    const result = mapExtractedToActivity([
      {
        type: "mcq",
        prompt: "س1",
        options: ["أ", "ب", "ج", "د"],
        correctIndex: 2,
      },
      { type: "true_false", prompt: "س2", correct: false },
      { type: "fill_blank", prompt: "س3", answer: "جواب" },
      { type: "short_answer", prompt: "يُسقط", answer: "x" }, // dropped
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].questionType).toBe("mcq");
    expect(result[1].questionType).toBe("true_false");
    expect(result[2].questionType).toBe("fill_blank");
  });
});

/* ─────────────────────────────────────────────────────────
   Client-side file-format validation
   (mirrors what handleSourceFiles in create-assignment.tsx does)
───────────────────────────────────────────────────────── */

describe("EXTRACT_EXT_RE — accepted formats", () => {
  const accepted = [
    "lesson.pdf",
    "notes.DOCX",
    "slides.pptx",
    "photo.jpg",
    "photo.JPG",
    "photo.jpeg",
    "img.png",
    "img.PNG",
    "img.webp",
    "anim.gif",
    "notes.txt",
    "notes.md",
    "lesson.PDF",
  ];
  for (const name of accepted) {
    it(`accepts ${name}`, () => {
      expect(EXTRACT_EXT_RE.test(name)).toBe(true);
    });
  }
});

describe("EXTRACT_EXT_RE / extractFileError — rejected formats", () => {
  const rejected = [
    ["old.doc", "DOC"],
    ["old.ppt", "PPT"],
    ["sheet.xlsx", "XLSX"],
    ["sheet.xls", "XLS"],
    ["archive.zip", "ZIP"],
    ["photo.heic", "HEIC"],
    ["data.csv", "CSV"],
    ["program.exe", "EXE"],
  ] as const;

  for (const [name] of rejected) {
    it(`rejects ${name} via the regex`, () => {
      expect(EXTRACT_EXT_RE.test(name)).toBe(false);
    });
  }

  it("returns an Arabic error message for .doc files", () => {
    const msg = extractFileError("report.doc", "ar");
    expect(msg).not.toBeNull();
    expect(msg).toContain("report.doc");
    expect(msg).toContain("DOCX"); // user-facing hint
  });

  it("returns an Arabic error message for .ppt files", () => {
    const msg = extractFileError("slides.ppt", "ar");
    expect(msg).not.toBeNull();
    expect(msg).toContain("slides.ppt");
    expect(msg).toContain("PPTX");
  });

  it("returns an Arabic error message for .xlsx files", () => {
    const msg = extractFileError("data.xlsx", "ar");
    expect(msg).not.toBeNull();
    expect(msg).toContain("data.xlsx");
  });

  it("returns an English error message when lang is en", () => {
    const msg = extractFileError("report.doc", "en");
    expect(msg).not.toBeNull();
    expect(msg).toContain("Unsupported format");
  });

  it("returns null for accepted files", () => {
    expect(extractFileError("lesson.pdf", "ar")).toBeNull();
    expect(extractFileError("photo.png", "ar")).toBeNull();
    expect(extractFileError("notes.docx", "ar")).toBeNull();
  });
});
