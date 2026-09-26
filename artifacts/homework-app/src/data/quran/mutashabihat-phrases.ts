export type SimilarityVerse = {
  chapter_id: number;
  number: number;
  content: string;
};

type Word = { value: string; originalIndex: number };
type IndexedVerse = { words: Word[]; normalizedText: string };

export type PhraseMatch = {
  otherVerseKey: string;
  wordCount: number;
  exactVerse: boolean;
};

export type SharedPhrase = {
  first: Set<number>;
  second: Set<number>;
  wordCount: number;
  exactVerse: boolean;
};

export type QuranPhraseIndex = {
  byVerse: Map<string, IndexedVerse>;
  byThreeWords: Map<string, string[]>;
  byFullVerse: Map<string, string[]>;
};

function normalizeWord(word: string): string {
  return word.normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\u0621-\u064A]/g, "");
}

function comparableWords(verse: SimilarityVerse): Word[] {
  const words = verse.content.split(/\s+/).filter(Boolean)
    .map((word, originalIndex) => ({ value: normalizeWord(word), originalIndex }))
    .filter((word) => word.value);

  // Q-Complex prefixes some opening ayahs with the basmala. It is displayed
  // unchanged, but is not evidence that the actual ayahs are similar.
  if (verse.number === 1 && verse.chapter_id !== 1
    && words.slice(0, 4).map((word) => word.value).join(" ") === "بسم الله الرحمن الرحيم") {
    return words.slice(4);
  }
  return words;
}

function compareWords(first: Word[], second: Word[]): SharedPhrase {
  const previous = new Array<number>(second.length + 1).fill(0);
  let best = { length: 0, firstStart: 0, secondStart: 0 };
  for (let i = 1; i <= first.length; i++) {
    for (let j = second.length; j >= 1; j--) {
      previous[j] = first[i - 1].value === second[j - 1].value ? previous[j - 1] + 1 : 0;
      if (previous[j] > best.length) {
        best = { length: previous[j], firstStart: i - previous[j], secondStart: j - previous[j] };
      }
    }
  }
  const exactVerse = first.length > 0 && first.length === second.length && best.length === first.length;
  // Two words make a useful highlight in a manually reviewed pair. A single
  // word counts only when both complete (possibly basmala-prefixed) ayahs match.
  if (best.length < 2 && !(exactVerse && best.length === 1)) {
    return { first: new Set(), second: new Set(), wordCount: 0, exactVerse: false };
  }
  return {
    first: new Set(first.slice(best.firstStart, best.firstStart + best.length).map((word) => word.originalIndex)),
    second: new Set(second.slice(best.secondStart, best.secondStart + best.length).map((word) => word.originalIndex)),
    wordCount: best.length,
    exactVerse,
  };
}

function pushIndex(map: Map<string, string[]>, phrase: string, verseKey: string) {
  const matches = map.get(phrase);
  if (matches) matches.push(verseKey);
  else map.set(phrase, [verseKey]);
}

export function buildQuranPhraseIndex(verses: readonly SimilarityVerse[]): QuranPhraseIndex {
  const byVerse = new Map<string, IndexedVerse>();
  const byThreeWords = new Map<string, string[]>();
  const byFullVerse = new Map<string, string[]>();

  for (const verse of verses) {
    const verseKey = `${verse.chapter_id}:${verse.number}`;
    const words = comparableWords(verse);
    const normalizedText = words.map((word) => word.value).join(" ");
    byVerse.set(verseKey, { words, normalizedText });
    if (!normalizedText) continue;
    pushIndex(byFullVerse, normalizedText, verseKey);

    const uniquePhrases = new Set<string>();
    for (let i = 0; i <= words.length - 3; i++) {
      uniquePhrases.add(words.slice(i, i + 3).map((word) => word.value).join(" "));
    }
    for (const phrase of uniquePhrases) pushIndex(byThreeWords, phrase, verseKey);
  }
  return { byVerse, byThreeWords, byFullVerse };
}

let cachedVerses: readonly SimilarityVerse[] | null = null;
let cachedIndex: QuranPhraseIndex | null = null;

export function getQuranPhraseIndex(verses: readonly SimilarityVerse[]): QuranPhraseIndex {
  if (cachedVerses !== verses || !cachedIndex) {
    cachedIndex = buildQuranPhraseIndex(verses);
    cachedVerses = verses;
  }
  return cachedIndex;
}

export function getSharedPhrase(index: QuranPhraseIndex, firstKey: string, secondKey: string): SharedPhrase {
  const first = index.byVerse.get(firstKey);
  const second = index.byVerse.get(secondKey);
  if (!first || !second) return { first: new Set(), second: new Set(), wordCount: 0, exactVerse: false };
  return compareWords(first.words, second.words);
}

export function findRepeatedPhrases(index: QuranPhraseIndex, verseKey: string): PhraseMatch[] {
  const current = index.byVerse.get(verseKey);
  if (!current?.words.length) return [];

  const candidates = new Set(index.byFullVerse.get(current.normalizedText) ?? []);
  if (current.words.length >= 3) {
    for (let i = 0; i <= current.words.length - 3; i++) {
      const phrase = current.words.slice(i, i + 3).map((word) => word.value).join(" ");
      for (const otherKey of index.byThreeWords.get(phrase) ?? []) candidates.add(otherKey);
    }
  }
  candidates.delete(verseKey);

  return [...candidates].flatMap((otherVerseKey) => {
    const shared = getSharedPhrase(index, verseKey, otherVerseKey);
    // One- and two-word matches count only when the entire short ayah recurs.
    if (!shared.exactVerse && shared.wordCount < 3) return [];
    return [{ otherVerseKey, wordCount: shared.wordCount, exactVerse: shared.exactVerse }];
  }).sort((a, b) =>
    Number(b.exactVerse) - Number(a.exactVerse)
    || b.wordCount - a.wordCount
    || Number(a.otherVerseKey.split(":")[0]) - Number(b.otherVerseKey.split(":")[0])
    || Number(a.otherVerseKey.split(":")[1]) - Number(b.otherVerseKey.split(":")[1]));
}