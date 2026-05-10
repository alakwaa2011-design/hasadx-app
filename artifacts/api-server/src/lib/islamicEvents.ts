import { db, islamicEventsTable } from "@workspace/db";
import { logger } from "./logger";

export type IslamicEventType =
  | "login"
  | "start_quiz"
  | "answer_question"
  | "complete_quiz"
  | "exit_quiz";

export interface LogEventArgs {
  userId: number | null;
  eventType: IslamicEventType;
  questionId?: number | null;
  categoryId?: number | null;
  sessionId?: string | null;
  timeTaken?: number | null;
  isCorrect?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export async function logIslamicEvent(args: LogEventArgs): Promise<void> {
  try {
    await db.insert(islamicEventsTable).values({
      userId: args.userId ?? null,
      eventType: args.eventType,
      questionId: args.questionId ?? null,
      categoryId: args.categoryId ?? null,
      sessionId: args.sessionId ?? null,
      timeTaken: args.timeTaken ?? null,
      isCorrect: args.isCorrect ?? null,
      metadata: args.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, eventType: args.eventType }, "Failed to log General Quizzes event");
  }
}
