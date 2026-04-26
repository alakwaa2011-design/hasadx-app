import { pool } from "@workspace/db";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getBankCount(): Promise<number> {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS cnt FROM million_bank_questions");
  return rows[0]?.cnt ?? 0;
}

async function fixCategoryConstraint(): Promise<void> {
  await pool.query(`
    ALTER TABLE million_bank_questions
      DROP CONSTRAINT IF EXISTS million_bank_category_check;
    ALTER TABLE million_bank_questions
      ADD CONSTRAINT million_bank_category_check CHECK (
        category = ANY (ARRAY[
          'culture', 'religion', 'language', 'inventions', 'countries',
          'technology', 'science', 'geography',
          'history', 'sports', 'mathematics', 'art', 'space', 'economics',
          'animals', 'food', 'cinema', 'medicine', 'plants', 'nature',
          'politics', 'energy', 'literature'
        ])
      );
  `);
}

function findRepoRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../../.."),
    path.resolve(__dirname, "../../../.."),
    path.resolve(process.cwd(), "../.."),
    process.cwd(),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "scripts", "seed-million-bank.mjs"))) {
      return dir;
    }
  }
  return process.cwd();
}

export async function seedMillionBankIfEmpty(): Promise<void> {
  try {
    const count = await getBankCount();
    if (count > 0) return;

    console.log("[seedMillionBank] Bank is empty — starting seed...");

    await fixCategoryConstraint();
    console.log("[seedMillionBank] CHECK constraint updated.");

    const repoRoot = findRepoRoot();
    const env = { ...process.env };

    const seedScript = path.join(repoRoot, "scripts", "seed-million-bank.mjs");
    if (fs.existsSync(seedScript)) {
      console.log("[seedMillionBank] Running seed-million-bank.mjs ...");
      execSync(`node "${seedScript}"`, { env, stdio: "inherit", cwd: repoRoot });
    } else {
      console.warn("[seedMillionBank] seed-million-bank.mjs not found at", seedScript);
    }

    const importScript = path.join(repoRoot, "scripts", "import-500-questions.mjs");
    const questionsFile = path.join(repoRoot, "attached_assets", "Pasted--500-4--1776123641404_1776123641405.txt");
    if (fs.existsSync(importScript) && fs.existsSync(questionsFile)) {
      console.log("[seedMillionBank] Running import-500-questions.mjs ...");
      execSync(`node "${importScript}"`, { env, stdio: "inherit", cwd: repoRoot });
    } else {
      console.warn("[seedMillionBank] import script or questions file not found — skipping 500-question import.");
    }

    const finalCount = await getBankCount();
    console.log(`[seedMillionBank] Done. Bank now has ${finalCount} questions.`);
  } catch (err) {
    console.error("[seedMillionBank] Seeding failed (non-fatal):", err);
  }
}
