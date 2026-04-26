export interface MemoryCard {
  id: number;
  pairId: number;
  content: string;
  emoji: string;
  color: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export interface MemoryLevel {
  level: number;
  cols: number;
  rows: number;
  totalCards: number;
  pairs: number;
}

const EMOJI_PAIRS = [
  { emoji: "🌟", color: "#fbbf24" },
  { emoji: "🎯", color: "#ef4444" },
  { emoji: "🚀", color: "#8b5cf6" },
  { emoji: "🌈", color: "#ec4899" },
  { emoji: "⚡", color: "#f59e0b" },
  { emoji: "🎨", color: "#06b6d4" },
  { emoji: "🔥", color: "#f97316" },
  { emoji: "💎", color: "#3b82f6" },
  { emoji: "🎪", color: "#a855f7" },
  { emoji: "🌺", color: "#f43f5e" },
  { emoji: "🦋", color: "#14b8a6" },
  { emoji: "🎵", color: "#6366f1" },
  { emoji: "🌙", color: "#eab308" },
  { emoji: "🍀", color: "#22c55e" },
  { emoji: "🎭", color: "#d946ef" },
  { emoji: "🧩", color: "#0ea5e9" },
  { emoji: "🌊", color: "#0284c7" },
  { emoji: "🎸", color: "#dc2626" },
];

const ARABIC_PAIRS = [
  { q: "٢ + ٣", a: "٥" },
  { q: "عاصمة مصر", a: "القاهرة" },
  { q: "٧ × ٨", a: "٥٦" },
  { q: "أكبر كوكب", a: "المشتري" },
  { q: "لون السماء", a: "أزرق" },
  { q: "عدد أيام الأسبوع", a: "٧" },
  { q: "٩ + ٦", a: "١٥" },
  { q: "عاصمة السعودية", a: "الرياض" },
  { q: "أول شهر هجري", a: "محرم" },
  { q: "كم ساعة في اليوم", a: "٢٤" },
  { q: "أطول نهر", a: "النيل" },
  { q: "١٠٠ ÷ ٤", a: "٢٥" },
  { q: "عدد الحروف العربية", a: "٢٨" },
  { q: "عاصمة الأردن", a: "عمّان" },
  { q: "٣ × ٩", a: "٢٧" },
  { q: "أصغر قارة", a: "أستراليا" },
  { q: "عدد أركان الإسلام", a: "٥" },
  { q: "١٢ × ١٢", a: "١٤٤" },
];

const CARD_COLORS = [
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-blue-400 to-indigo-600",
  "from-cyan-400 to-teal-600",
  "from-emerald-400 to-green-600",
  "from-amber-400 to-orange-600",
  "from-fuchsia-400 to-pink-600",
  "from-sky-400 to-blue-600",
  "from-lime-400 to-emerald-600",
  "from-red-400 to-rose-600",
  "from-indigo-400 to-violet-600",
  "from-teal-400 to-cyan-600",
  "from-orange-400 to-amber-600",
  "from-pink-400 to-fuchsia-600",
  "from-green-400 to-teal-600",
  "from-yellow-400 to-orange-600",
  "from-purple-400 to-indigo-600",
  "from-blue-400 to-cyan-600",
];

export function getLevelConfig(level: number): MemoryLevel {
  const gridSizes: [number, number][] = [
    [2, 3],
    [2, 4],
    [3, 4],
    [4, 4],
    [4, 5],
    [5, 4],
    [4, 6],
    [5, 6],
    [6, 6],
  ];
  const gridIdx = Math.min(Math.floor((level - 1) / 2), gridSizes.length - 1);
  const [rows, cols] = gridSizes[gridIdx];
  const totalCards = rows * cols;
  return { level, cols, rows, totalCards, pairs: totalCards / 2 };
}

export function generateCards(level: number, customPairs?: { q: string; a: string }[]): MemoryCard[] {
  const config = getLevelConfig(level);
  const pairCount = config.pairs;

  const cards: MemoryCard[] = [];

  if (customPairs && customPairs.length > 0) {
    const shuffledCustom = [...customPairs].sort(() => Math.random() - 0.5).slice(0, pairCount);
    const neededExtra = pairCount - shuffledCustom.length;
    const extraPairs = ARABIC_PAIRS.filter(p => !shuffledCustom.some(c => c.q === p.q))
      .sort(() => Math.random() - 0.5)
      .slice(0, neededExtra);
    const allPairs = [...shuffledCustom, ...extraPairs];

    allPairs.forEach((pair, i) => {
      const color = CARD_COLORS[i % CARD_COLORS.length];
      cards.push(
        { id: i * 2, pairId: i, content: pair.q, emoji: "❓", color, isFlipped: false, isMatched: false },
        { id: i * 2 + 1, pairId: i, content: pair.a, emoji: "💡", color, isFlipped: false, isMatched: false },
      );
    });
  } else {
    const useArabic = level >= 4 && Math.random() > 0.4;

    if (useArabic) {
      const selected = [...ARABIC_PAIRS].sort(() => Math.random() - 0.5).slice(0, pairCount);
      selected.forEach((pair, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length];
        cards.push(
          { id: i * 2, pairId: i, content: pair.q, emoji: "❓", color, isFlipped: false, isMatched: false },
          { id: i * 2 + 1, pairId: i, content: pair.a, emoji: "💡", color, isFlipped: false, isMatched: false },
        );
      });
    } else {
      const selected = [...EMOJI_PAIRS].sort(() => Math.random() - 0.5).slice(0, pairCount);
      selected.forEach((pair, i) => {
        const color = CARD_COLORS[i % CARD_COLORS.length];
        cards.push(
          { id: i * 2, pairId: i, content: pair.emoji, emoji: pair.emoji, color, isFlipped: false, isMatched: false },
          { id: i * 2 + 1, pairId: i, content: pair.emoji, emoji: pair.emoji, color, isFlipped: false, isMatched: false },
        );
      });
    }
  }

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

export function calculateScore(level: number, streak: number, timeMs: number, movesUsed: number): number {
  const basePoints = 50 + level * 30;
  const streakBonus = Math.min(streak * 15, 100);
  const config = getLevelConfig(level);
  const optimalMoves = config.pairs;
  const moveEfficiency = Math.max(0, 1 - (movesUsed - optimalMoves) / (optimalMoves * 3));
  const moveBonus = Math.floor(moveEfficiency * 50);
  const timeBonusMax = 80;
  const timeLimit = config.pairs * 8000;
  const timeBonus = Math.max(0, Math.floor((1 - timeMs / timeLimit) * timeBonusMax));

  return basePoints + streakBonus + moveBonus + timeBonus;
}

export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
