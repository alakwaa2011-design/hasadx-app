import pg from "pg";
import { readFileSync } from "fs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ANSWER_KEYS = ["A", "B", "C", "D"];

const ISLAMIC_CATEGORIES = new Set([
  "عقيدة",
  "فقه",
  "حديث",
  "قرآن كريم",
  "تفسير",
  "سيرة",
]);

function parseQuestionsFromFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const data = JSON.parse(content);

  const questions = [];
  const skipped = [];

  for (const q of data.questions) {
    const { question, options, correctAnswer, difficulty, category } = q;

    if (!ISLAMIC_CATEGORIES.has(category)) {
      skipped.push({ id: q.id, reason: `unknown category="${category}"` });
      continue;
    }

    if (difficulty !== "hard") {
      skipped.push({ id: q.id, reason: `non-hard difficulty="${difficulty}"` });
      continue;
    }

    if (!Array.isArray(options) || options.length !== 4) {
      skipped.push({ id: q.id, reason: `options count=${options?.length ?? 0} (expected 4)` });
      continue;
    }

    if (typeof correctAnswer !== "number" || correctAnswer < 0 || correctAnswer > 3) {
      skipped.push({ id: q.id, reason: `invalid correctAnswer=${correctAnswer}` });
      continue;
    }

    questions.push({
      text: question.trim(),
      optionA: options[0].trim(),
      optionB: options[1].trim(),
      optionC: options[2].trim(),
      optionD: options[3].trim(),
      correctAnswer: ANSWER_KEYS[correctAnswer],
      level: "hard",
      category: "religion",
    });
  }

  if (skipped.length > 0) {
    console.warn(`WARNING: ${skipped.length} question(s) skipped due to data issues:`);
    for (const s of skipped) {
      console.warn(`  - id=${s.id}: ${s.reason}`);
    }
    process.exitCode = 1;
  }

  return questions;
}

async function main() {
  const filePath = "./attached_assets/islamic_hard_questions_bank_1776487864453.json";

  console.log("Parsing questions from JSON file...");
  const parsed = parseQuestionsFromFile(filePath);
  console.log(`Parsed ${parsed.length} questions from file`);

  if (parsed.length === 0) {
    console.error("No questions parsed! Check file format.");
    await pool.end();
    return;
  }

  // Deduplicate within the parsed batch itself
  const seenInBatch = new Set();
  const deduped = parsed.filter((q) => {
    if (seenInBatch.has(q.text)) return false;
    seenInBatch.add(q.text);
    return true;
  });
  if (deduped.length < parsed.length) {
    console.log(`Removed ${parsed.length - deduped.length} intra-file duplicates`);
  }

  // Fetch existing question texts from DB
  const { rows: existing } = await pool.query(`SELECT text FROM million_bank_questions`);
  const existingTexts = new Set(existing.map((r) => r.text.trim()));
  console.log(`Found ${existingTexts.size} existing questions in DB`);

  // Filter out duplicates against DB
  const toInsert = deduped.filter((q) => !existingTexts.has(q.text));
  console.log(
    `${toInsert.length} new questions to insert (${deduped.length - toInsert.length} duplicates skipped)`
  );

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
    const values = batch
      .map((_, idx) => {
        const base = idx * 8;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`;
      })
      .join(",");
    const params = batch.flatMap((q) => [
      q.text,
      q.optionA,
      q.optionB,
      q.optionC,
      q.optionD,
      q.correctAnswer,
      q.level,
      q.category,
    ]);

    await pool.query(
      `INSERT INTO million_bank_questions (text, option_a, option_b, option_c, option_d, correct_answer, level, category) VALUES ${values}`,
      params
    );
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${toInsert.length}...`);
  }

  console.log(`\nDone! Inserted ${inserted} new questions.`);

  const { rows: total } = await pool.query(
    `SELECT COUNT(*) as count FROM million_bank_questions`
  );
  console.log(`Total questions in bank: ${total[0].count}`);

  const { rows: religionTotal } = await pool.query(
    `SELECT COUNT(*) as count FROM million_bank_questions WHERE category = 'religion' AND level = 'hard'`
  );
  console.log(`Total hard religion questions in bank: ${religionTotal[0].count}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
