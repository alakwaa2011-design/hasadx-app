import pg from "pg";
import { readFileSync } from "fs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CATEGORY_MAP = {
  "جغرافيا": "geography",
  "تاريخ": "history",
  "علوم": "science",
  "ثقافة إسلامية": "religion",
  "رياضة": "sports",
  "فضاء وفلك": "space",
  "رياضيات": "mathematics",
  "فنون": "art",
  "اقتصاد": "economics",
  "عالم الحيوان": "animals",
  "طعام وطبخ": "food",
  "لغة عربية": "language",
  "سينما": "cinema",
  "طب وصحة": "medicine",
  "نباتات": "plants",
  "مناخ وطبيعة": "nature",
  "سياسة": "politics",
  "طاقة": "energy",
  "تكنولوجيا": "technology",
  "أدب وثقافة": "literature",
  "أديان": "religion",
  "علم الأحياء": "science",
};

const DIFFICULTY_MAP = {
  "سهل": "easy",
  "متوسط": "medium",
  "صعب": "hard",
};

const ANSWER_KEYS = ["A", "B", "C", "D"];

function extractSmartQuotedFields(line) {
  const parts = [];
  let m;
  const re = /\u201c([^\u201d]*)\u201d/gu;
  while ((m = re.exec(line)) !== null) {
    parts.push(m[1]);
  }
  return parts;
}

function parseQuestionsFromFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const questions = [];

  // Parse line by line - each question is on one line
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Only process lines that look like question objects
    if (!trimmed.startsWith("{") || !trimmed.includes("question:")) continue;

    // Extract all smart-quoted strings from the line
    // Format: { id: N, question: "...", options: ["...", "...", "...", "..."], answer: "...", category: "...", difficulty: "..." }
    const parts = extractSmartQuotedFields(trimmed);

    // Expected: [question, opt1, opt2, opt3, opt4, answer, category, difficulty]
    if (parts.length < 8) continue;

    const question = parts[0];
    const opt1 = parts[1];
    const opt2 = parts[2];
    const opt3 = parts[3];
    const opt4 = parts[4];
    const answer = parts[5];
    const category = parts[6];
    const difficulty = parts[7];

    const options = [opt1, opt2, opt3, opt4];
    const answerIdx = options.indexOf(answer);
    if (answerIdx === -1) continue;

    const correctAnswer = ANSWER_KEYS[answerIdx];
    const level = DIFFICULTY_MAP[difficulty];
    const cat = CATEGORY_MAP[category];

    if (!level) {
      console.warn(`Skipping: unknown difficulty="${difficulty}" in question: ${question.slice(0, 40)}`);
      continue;
    }
    if (!cat) {
      console.warn(`Skipping: unknown category="${category}" in question: ${question.slice(0, 40)}`);
      continue;
    }

    questions.push({
      text: question.trim(),
      optionA: opt1.trim(),
      optionB: opt2.trim(),
      optionC: opt3.trim(),
      optionD: opt4.trim(),
      correctAnswer,
      level,
      category: cat,
    });
  }

  return questions;
}

async function main() {
  const filePath = "./attached_assets/Pasted--500-4--1776123641404_1776123641405.txt";
  
  console.log("Parsing questions from file...");
  const parsed = parseQuestionsFromFile(filePath);
  console.log(`Parsed ${parsed.length} questions from file`);

  if (parsed.length === 0) {
    console.error("No questions parsed! Check file format.");
    await pool.end();
    return;
  }

  // Deduplicate within the parsed batch itself (in case file has duplicates)
  const seenInBatch = new Set();
  const deduped = parsed.filter(q => {
    if (seenInBatch.has(q.text)) return false;
    seenInBatch.add(q.text);
    return true;
  });
  if (deduped.length < parsed.length) {
    console.log(`Removed ${parsed.length - deduped.length} intra-file duplicates`);
  }

  // Fetch existing question texts from DB
  const { rows: existing } = await pool.query(`SELECT text FROM million_bank_questions`);
  const existingTexts = new Set(existing.map(r => r.text.trim()));
  console.log(`Found ${existingTexts.size} existing questions in DB`);

  // Filter out duplicates against DB
  const toInsert = deduped.filter(q => !existingTexts.has(q.text));
  console.log(`${toInsert.length} new questions to insert (${parsed.length - toInsert.length} duplicates skipped)`);

  if (toInsert.length === 0) {
    console.log("Nothing to insert — all questions already in DB!");
    await pool.end();
    return;
  }

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const values = batch.map((_, idx) => {
      const base = idx * 8;
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
    }).join(",");
    const params = batch.flatMap(q => [q.text, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, q.level, q.category]);
    
    await pool.query(
      `INSERT INTO million_bank_questions (text, option_a, option_b, option_c, option_d, correct_answer, level, category) VALUES ${values}`,
      params
    );
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${toInsert.length}...`);
  }

  console.log(`\n✅ Done! Inserted ${inserted} new questions.`);
  
  const { rows: total } = await pool.query(`SELECT COUNT(*) as count FROM million_bank_questions`);
  console.log(`Total questions in bank: ${total[0].count}`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
