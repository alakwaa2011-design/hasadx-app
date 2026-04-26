export interface MultiplyQuestion {
  a: number;
  b: number;
  answer: number;
  choices: number[];
}

export type Difficulty = "easy" | "medium" | "hard" | "challenge";

export interface GameSettings {
  table: number | null;
  difficulty: Difficulty;
}

function getDifficultyRange(difficulty: Difficulty): { maxVal: number } {
  switch (difficulty) {
    case "easy": return { maxVal: 5 };
    case "medium": return { maxVal: 9 };
    case "hard": return { maxVal: 12 };
    case "challenge": return { maxVal: 15 };
  }
}

function getRange(level: number): { maxA: number; maxB: number } {
  if (level <= 3) return { maxA: 5, maxB: 5 };
  if (level <= 7) return { maxA: 9, maxB: 9 };
  if (level <= 12) return { maxA: 12, maxB: 12 };
  return { maxA: 15, maxB: 15 };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateQuestion(level: number, settings?: GameSettings): MultiplyQuestion {
  let a: number;
  let b: number;

  if (settings?.table) {
    a = settings.table;
    const { maxVal } = getDifficultyRange(settings.difficulty);
    b = randInt(1, maxVal);
    if (Math.random() > 0.5) {
      [a, b] = [b, a];
    }
  } else if (settings) {
    const { maxVal } = getDifficultyRange(settings.difficulty);
    a = randInt(1, maxVal);
    b = randInt(1, maxVal);
  } else {
    const { maxA, maxB } = getRange(level);
    a = randInt(1, maxA);
    b = randInt(1, maxB);
  }

  const answer = a * b;

  const wrongSet = new Set<number>();
  wrongSet.add(answer);

  const nearby = [answer - 1, answer + 1, answer - 2, answer + 2, answer + a, answer - a, answer + b, answer - b];
  for (const n of nearby) {
    if (n > 0 && n !== answer && wrongSet.size < 4) {
      wrongSet.add(n);
    }
  }

  while (wrongSet.size < 4) {
    const off = randInt(1, Math.max(5, Math.floor(answer * 0.3)));
    const wrong = Math.random() > 0.5 ? answer + off : Math.max(1, answer - off);
    if (wrong !== answer) {
      wrongSet.add(wrong);
    }
  }

  wrongSet.delete(answer);
  const wrongs = Array.from(wrongSet).slice(0, 3);
  const choices = [...wrongs, answer];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return { a, b, answer, choices };
}

export function getRoundTime(level: number, difficulty?: Difficulty): number {
  if (difficulty) {
    switch (difficulty) {
      case "easy": return 15;
      case "medium": return 10;
      case "hard": return 7;
      case "challenge": {
        const decrease = Math.floor((level - 1) * 0.3 * 10) / 10;
        return Math.max(4, 7 - decrease);
      }
    }
  }
  const base = 10;
  const decrease = Math.floor((level - 1) * 0.3 * 10) / 10;
  return Math.max(4, base - decrease);
}

export function getStreakMultiplier(streak: number): number {
  if (streak >= 10) return 3;
  if (streak >= 5) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}

export function calculateScore(level: number, timeMs: number, streak: number, difficulty?: Difficulty): number {
  const basePoints = 100 + level * 15;
  const roundTimeMs = getRoundTime(level, difficulty) * 1000;
  const speedBonus = Math.max(0, Math.floor((1 - timeMs / roundTimeMs) * 40));
  const multiplier = getStreakMultiplier(streak);
  const diffMultiplier = difficulty === "challenge" ? 1.5 : difficulty === "hard" ? 1.2 : 1;
  return Math.floor((basePoints + speedBonus) * multiplier * diffMultiplier);
}

export function getLevelLabel(level: number, lang: string): string {
  if (lang === "ar") {
    if (level <= 3) return "مبتدئ";
    if (level <= 7) return "متوسط";
    if (level <= 12) return "متقدم";
    return "خبير";
  }
  if (level <= 3) return "Beginner";
  if (level <= 7) return "Intermediate";
  if (level <= 12) return "Advanced";
  return "Expert";
}

export function getDifficultyLabel(difficulty: Difficulty, lang: string): string {
  if (lang === "ar") {
    switch (difficulty) {
      case "easy": return "سهل";
      case "medium": return "متوسط";
      case "hard": return "صعب";
      case "challenge": return "تحدي";
    }
  }
  switch (difficulty) {
    case "easy": return "Easy";
    case "medium": return "Medium";
    case "hard": return "Hard";
    case "challenge": return "Challenge";
  }
}
