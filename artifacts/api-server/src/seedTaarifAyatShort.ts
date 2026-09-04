import { db, islamicCategoriesTable, islamicQuestionsTable, islamicSectionsTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { logger } from "./lib/logger";
import { TAARIF_AYAT_SHORT_ITEMS, type TaarifAyatShortItem } from "./data/taarif-ayat-short";

const SECTION_NAME = "مسابقات قرآنية";
const CATEGORY_NAME = "تعرّف على الآية";
const CATEGORY_DESCRIPTION = "فكّر في الآية المناسبة، ثم اكشف الإجابة وقيّم نفسك.";

export function formatTaarifAyatAnswer(item: TaarifAyatShortItem): string {
  return `${item.verse}\n[${item.surah}: ${item.ayah}]${item.explanation ? `\n${item.explanation}` : ""}`;
}

/** Adds only missing curated questions and is safe to run on every startup. */
export async function seedTaarifAyatShortIfNeeded(): Promise<void> {
  try {
    const [section] = await db
      .select({ id: islamicSectionsTable.id })
      .from(islamicSectionsTable)
      .where(eq(islamicSectionsTable.name, SECTION_NAME))
      .limit(1);
    if (!section) {
      logger.warn("[seedTaarifAyatShort] Quran competitions section is not available yet");
      return;
    }

    let [category] = await db
      .select({ id: islamicCategoriesTable.id })
      .from(islamicCategoriesTable)
      .where(and(eq(islamicCategoriesTable.sectionId, section.id), eq(islamicCategoriesTable.name, CATEGORY_NAME)))
      .limit(1);
    if (!category) {
      [category] = await db
        .insert(islamicCategoriesTable)
        .values({
          sectionId: section.id,
          name: CATEGORY_NAME,
          description: CATEGORY_DESCRIPTION,
          level: "mixed",
          isVisible: true,
          order: 5,
        })
        .returning({ id: islamicCategoriesTable.id });
    } else {
      await db
        .update(islamicCategoriesTable)
        .set({ description: CATEGORY_DESCRIPTION, isVisible: true })
        .where(eq(islamicCategoriesTable.id, category.id));
    }

    let added = 0;
    for (const item of TAARIF_AYAT_SHORT_ITEMS) {
      const [existing] = await db
        .select({ id: islamicQuestionsTable.id })
        .from(islamicQuestionsTable)
        .where(or(eq(islamicQuestionsTable.sourceUrl, item.sourceUrl), eq(islamicQuestionsTable.questionText, item.prompt)))
        .limit(1);
      if (existing) continue;
      await db.insert(islamicQuestionsTable).values({
        categoryId: category.id,
        questionText: item.prompt,
        questionType: "short_answer",
        sourceName: "الموسوعة القرآنية",
        sourceUrl: item.sourceUrl,
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: formatTaarifAyatAnswer(item),
        difficulty: "medium",
      });
      added++;
    }
    logger.info({ categoryId: category.id, added, total: TAARIF_AYAT_SHORT_ITEMS.length }, "[seedTaarifAyatShort] curated questions ready");
  } catch (err) {
    logger.error({ err }, "[seedTaarifAyatShort] failed");
  }
}