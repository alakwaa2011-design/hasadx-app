/**
 * Client helpers for a teacher's reusable saved game question sets.
 * Kept independent from generated API clients while this small, game-specific
 * endpoint is intentionally not part of the public OpenAPI surface.
 */

import { EVENTS, trackProjectAnalyticsEvent } from "@/lib/analytics";

const API_BASE = import.meta.env.VITE_API_URL || "";

export type SavedGameQuestionType = "mcq" | "true_false";

export interface SavedGameQuestion {
  text: string;
  options: string[];
  correct: number;
  type?: SavedGameQuestionType;
  imageUrl?: string | null;
}

export interface SavedGameActivity {
  id: number | string;
  title: string;
  gameType: string;
  questionCount: number;
  lastUsedAt: string | null;
  questions?: unknown;
  content?: unknown;
  settings?: unknown;
  source?: string;
  [key: string]: unknown;
}

export interface SaveGameActivityInput {
  title: string;
  gameType: string;
  questions?: SavedGameQuestion[];
  content?: unknown;
  settings?: unknown;
  source?: string;
}

export class SavedGameActivitiesError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "SavedGameActivitiesError";
  }
}

export type SavedGameAnalyticsLocation = "game_creator" | "saved_games_library";

const ANALYTICS_GAME_TYPE_ALIASES: Record<string, string> = {
  "tug-of-war": "tug",
  tug_of_war: "tug",
  escape_room: "escape",
  "escape-room": "escape",
  rocket_race: "rocket",
  "rocket-race": "rocket",
  wameeth_class: "wameeth",
};

function analyticsGameType(gameType: string): string {
  const normalized = gameType.trim().toLowerCase();
  const canonical = ANALYTICS_GAME_TYPE_ALIASES[normalized] ?? normalized.slice(0, 50);
  return canonical || "unknown";
}

/**
 * Saved-game analytics deliberately accepts only stable, non-content
 * dimensions. Titles, questions, and teacher identifiers must never be added.
 */
export function trackSavedGameEvent(
  eventName:
    | typeof EVENTS.savedGameSaved
    | typeof EVENTS.savedGameReplayed
    | typeof EVENTS.savedGameDeleted,
  gameType: string,
  location: SavedGameAnalyticsLocation,
): void {
  trackProjectAnalyticsEvent(eventName, {
    game_type: analyticsGameType(gameType),
    location,
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/game-activities${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let message = "Unable to complete saved game request";
    try {
      const body = await response.json();
      if (typeof body?.message === "string") message = body.message;
      else if (typeof body?.error === "string") message = body.error;
    } catch {
      // The HTTP status is still useful to callers when a proxy returns HTML.
    }
    throw new SavedGameActivitiesError(message, response.status);
  }
  // DELETE endpoints correctly return 204 and therefore have no body for
  // Response.json() to parse. Keep the generic return contract for callers
  // while allowing void-returning operations to complete successfully.
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function asActivity(value: unknown): SavedGameActivity {
  if (!value || typeof value !== "object") throw new SavedGameActivitiesError("Invalid saved game response");
  const item = value as Record<string, unknown>;
  const id = item.id;
  if ((typeof id !== "number" && typeof id !== "string") || !id) {
    throw new SavedGameActivitiesError("Invalid saved game response");
  }
  return {
    ...item,
    id,
    title: typeof item.title === "string" ? item.title : typeof item.gameTitle === "string" ? item.gameTitle : "",
    gameType: typeof item.gameType === "string" ? item.gameType : typeof item.type === "string" ? item.type : "",
    questionCount: typeof item.questionCount === "number" ? item.questionCount : Array.isArray(item.questions) ? item.questions.length : Array.isArray(item.questionData) ? item.questionData.length : 0,
    lastUsedAt: typeof item.lastUsedAt === "string"
      ? item.lastUsedAt
      : typeof item.lastPlayedAt === "string"
        ? item.lastPlayedAt
        : typeof item.updatedAt === "string"
          ? item.updatedAt
          : null,
    questions: item.questions ?? item.questionData ?? item.questionsJson ?? (
      Array.isArray(item.content)
        ? item.content
        : item.content && typeof item.content === "object"
          ? (item.content as Record<string, unknown>).questions
          : undefined
    ),
    content: item.content,
    settings: item.settings,
    source: typeof item.source === "string" ? item.source : undefined,
  };
}

/** Lists only the authenticated teacher's saved games (ownership is server-enforced). */
export async function listSavedGameActivities(): Promise<SavedGameActivity[]> {
  const response = await request<unknown>("");
  const values = Array.isArray(response)
    ? response
    : response && typeof response === "object"
      ? (response as Record<string, unknown>).activities ?? (response as Record<string, unknown>).savedGames ?? []
      : [];
  if (!Array.isArray(values)) throw new SavedGameActivitiesError("Invalid saved games response");
  return values.map(asActivity);
}

export async function getSavedGameActivity(id: SavedGameActivity["id"]): Promise<SavedGameActivity> {
  const response = await request<unknown>(`/${encodeURIComponent(String(id))}`);
  const item = response && typeof response === "object"
    ? (response as Record<string, unknown>).activity ?? (response as Record<string, unknown>).savedGame ?? response
    : response;
  const activity = asActivity(item);
  trackSavedGameEvent(EVENTS.savedGameReplayed, activity.gameType, "saved_games_library");
  return activity;
}

export async function saveGameActivity(input: SaveGameActivityInput): Promise<SavedGameActivity> {
  const activity = asActivity(await request<unknown>("", { method: "POST", body: JSON.stringify(input) }));
  trackSavedGameEvent(EVENTS.savedGameSaved, activity.gameType || input.gameType, "game_creator");
  return activity;
}

export async function deleteSavedGameActivity(id: SavedGameActivity["id"]): Promise<void> {
  await request<unknown>(`/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

function parseQuestions(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Converts historic/manual question shapes into the small cross-game question
 * contract. Invalid records are ignored rather than allowing malformed saved
 * data to reach an individual game's setup page.
 */
export function normalizeSavedGameQuestions(value: unknown): SavedGameQuestion[] {
  return parseQuestions(value).flatMap((item): SavedGameQuestion[] => {
    if (!item || typeof item !== "object") return [];
    const question = item as Record<string, unknown>;
    const text = typeof question.text === "string" ? question.text.trim() : typeof question.question === "string" ? question.question.trim() : "";
    if (!text) return [];
    const requestedType = question.type === "true_false" || question.type === "tf" ? "true_false" : "mcq";
    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string").map(option => option.trim())
      : ["optionA", "optionB", "optionC", "optionD"].map(key => typeof question[key] === "string" ? (question[key] as string).trim() : "");
    const requiredOptions = requestedType === "true_false" ? 2 : 4;
    if (options.length < requiredOptions || options.slice(0, requiredOptions).some(option => !option)) return [];
    const answer = question.correct ?? question.correctAnswer;
    const correct = typeof answer === "number" && answer >= 0 && answer < requiredOptions
      ? answer
      : typeof answer === "string" && ["A", "B", "C", "D"].includes(answer.toUpperCase())
        ? ["A", "B", "C", "D"].indexOf(answer.toUpperCase())
        : 0;
    return [{
      text,
      options: options.slice(0, requiredOptions),
      correct,
      ...(requestedType === "true_false" ? { type: "true_false" as const } : {}),
      imageUrl: typeof question.imageUrl === "string" ? question.imageUrl : null,
    }];
  });
}