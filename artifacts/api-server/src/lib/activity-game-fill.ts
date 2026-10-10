/* Open-answer activity slides render as an empty box. For identity decks they become a playable Hasad game
   instead: the model writes a few questions grounded in the lesson's own slides, and a game kind is chosen
   from the subject and topic. Failures leave the card untouched (it then falls back to the open prompt). */

import type { Request } from "express";
import type { OutlineCard } from "@workspace/slide-templates";
import { generateMcqQuestions } from "./generate-mcq-slides";

type Kind = NonNullable<OutlineCard["gameSuggestion"]>;

/* Only games that need no student devices: Wameedh (class), Tug of war (class), XO (class) and the
   self-paced challenge. The subject only changes the order they are offered in. */
export function chooseGameKind(subject: string, topic: string, ordinal: number): Kind {
  const text = `${subject} ${topic}`.toLowerCase();
  const order: Kind[] =
    /(رياضيات|حساب|جبر|هندسة|math|algebra|geometry)/.test(text) ? ["xo", "kahoot", "tug", "solo"]
      : /(قرآن|قران|تجويد|حديث|فقه|سيرة|توحيد|islam|quran|hadith)/.test(text) ? ["kahoot", "tug", "solo", "xo"]
        : /(علوم|فيزياء|كيمياء|أحياء|science|physics|chemistry|biology)/.test(text) ? ["kahoot", "xo", "tug", "solo"]
          : ["kahoot", "tug", "xo", "solo"];
  return order[ordinal % order.length];
}

const needsGame = (c: OutlineCard) =>
  c.kind === "interactive" && !(c.gameQuestions && c.gameQuestions.length > 0);

export async function fillActivityGames(
  cards: OutlineCard[],
  ctx: { req: Request; language: "ar" | "en"; subject?: string | null; topic?: string | null },
): Promise<number> {
  const targets = cards.filter(needsGame).slice(0, 3);
  if (targets.length === 0) return 0;
  const lesson = cards
    .filter((c) => c.kind !== "interactive" && c.kind !== "title")
    .map((c) => `${c.title}\n${c.talkingPoints.join("\n")}`)
    .join("\n\n")
    .slice(0, 6000);
  if (!lesson.trim()) return 0;
  let filled = 0;
  await Promise.all(targets.map(async (card, n) => {
    try {
      const focus = `${card.title}\n${card.talkingPoints.join("\n")}`.trim();
      const questions = await generateMcqQuestions(
        `${focus ? `التركيز: ${focus}\n\n` : ""}${lesson}`,
        ctx.language,
        { req: ctx.req, callKey: `activity-game-${n}` },
      );
      if (questions.length === 0) return;
      card.gameQuestions = questions.map((q) => ({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex }));
      card.gameSuggestion = chooseGameKind(ctx.subject ?? "", ctx.topic ?? "", n);
      filled++;
    } catch {
      /* keep the open-answer fallback */
    }
  }));
  return filled;
}
