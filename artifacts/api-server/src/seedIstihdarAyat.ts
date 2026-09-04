import { db, islamicCategoriesTable, islamicQuestionsTable, islamicSectionsTable } from "@workspace/db";
import { and, eq, or } from "drizzle-orm";
import { ISTIHDAR_AYAT_ITEMS, type IstihdarAyatItem } from "./data/istihdar-ayat";
import { logger } from "./lib/logger";

const SECTION_NAME = "مسابقات قرآنية";
const CATEGORY_NAME = "استحضار الآيات";
const CATEGORY_DESCRIPTION = "استحضر الآية أو اجمع أكبر عدد من النقاط، ثم اكشف الإجابة وقيّم حصادك.";

export function formatIstihdarAyatAnswer(item: IstihdarAyatItem): string {
  return item.kind === "multi_point"
    ? JSON.stringify({ answer: item.answer, points: item.points })
    : item.answer;
}

/** Creates or refreshes the category and adds only missing source-backed rows. */
export async function seedIstihdarAyatIfNeeded(): Promise<void> {
  try {
    const [section] = await db.select({ id: islamicSectionsTable.id }).from(islamicSectionsTable)
      .where(eq(islamicSectionsTable.name, SECTION_NAME)).limit(1);
    if (!section) {
      logger.warn("[seedIstihdarAyat] Quran competitions section is not available yet");
      return;
    }

    let [category] = await db.select({ id: islamicCategoriesTable.id }).from(islamicCategoriesTable)
      .where(and(eq(islamicCategoriesTable.sectionId, section.id), eq(islamicCategoriesTable.name, CATEGORY_NAME))).limit(1);
    if (!category) {
      [category] = await db.insert(islamicCategoriesTable).values({
        sectionId: section.id, name: CATEGORY_NAME, description: CATEGORY_DESCRIPTION,
        level: "mixed", isVisible: true, order: 6,
      }).returning({ id: islamicCategoriesTable.id });
    } else {
      await db.update(islamicCategoriesTable).set({
        description: CATEGORY_DESCRIPTION, isVisible: true, order: 6,
      }).where(eq(islamicCategoriesTable.id, category.id));
    }

    let added = 0;
    for (const item of ISTIHDAR_AYAT_ITEMS) {
      const [existing] = await db.select({ id: islamicQuestionsTable.id }).from(islamicQuestionsTable)
        .where(and(
          eq(islamicQuestionsTable.categoryId, category.id),
          or(eq(islamicQuestionsTable.sourceUrl, item.sourceUrl), eq(islamicQuestionsTable.questionText, item.prompt)),
        )).limit(1);
      if (existing) continue;
      await db.insert(islamicQuestionsTable).values({
        categoryId: category.id, questionText: item.prompt,
        questionType: item.kind === "multi_point" ? "multi_point" : "short_answer",
        sourceName: "الموسوعة القرآنية", sourceUrl: item.sourceUrl,
        optionA: "", optionB: "", optionC: "", optionD: "",
        correctAnswer: formatIstihdarAyatAnswer(item), difficulty: "medium",
      });
      added++;
    }
    logger.info({ categoryId: category.id, added, total: ISTIHDAR_AYAT_ITEMS.length }, "[seedIstihdarAyat] curated questions ready");
  } catch (err) {
    logger.error({ err }, "[seedIstihdarAyat] failed");
  }
}