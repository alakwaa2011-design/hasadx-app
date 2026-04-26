import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ConfettiBurst } from "@/components/confetti-burst";
import {
  ArrowRight,
  Volume2,
  VolumeX,
  RotateCcw,
  Lightbulb,
  Delete,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  ARABIC_KEYBOARD_ROWS,
  CATEGORY_LABELS,
  CATEGORY_EMOJI,
  evaluateGuess,
  getRandomWord,
  isInDictionary,
  isDictionaryLoaded,
  preloadDictionary,
  mergeKeyboardStates,
  normalizeArabic,
  buildShareGrid,
  type LetrlyCategory,
  type LetrlyLength,
  type LetrlyWord,
  type TileResult,
  type TileState,
} from "@/lib/letrly-engine";
import { useGameAudio } from "./useGameAudio";

const MAX_ATTEMPTS = 6;

const VALID_CATEGORIES = new Set<LetrlyCategory>([
  "general",
  "animals",
  "fruits",
  "cities",
  "science",
  "islamic",
]);

function parseSettings(search: string): {
  category: LetrlyCategory;
  length: LetrlyLength;
  pin: string | null;
  daily: boolean;
} {
  const params = new URLSearchParams(search);
  const cat = (params.get("category") || "general") as LetrlyCategory;
  const len = parseInt(params.get("length") || "5", 10) as LetrlyLength;
  const pin = params.get("pin");
  const daily = params.get("daily") === "1";
  return {
    category: VALID_CATEGORIES.has(cat) ? cat : "general",
    length: ([4, 5, 6] as const).includes(len as 4 | 5 | 6) ? len : 5,
    pin: pin && /^\d{4,8}$/.test(pin) ? pin : null,
    daily,
  };
}

const API_BASE = import.meta.env.VITE_API_URL || "";
type Phase = "playing" | "won" | "lost";
type Source = "random" | "pin" | "daily";

export default function LetrlyPlay() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const settings = useMemo(() => parseSettings(search), [search]);

  const { muted, toggleMute, playSelect, playWrong, playCorrect, playCelebration } =
    useGameAudio();

  const [target, setTarget] = useState<LetrlyWord | null>(null);
  const [rows, setRows] = useState<TileResult[][]>([]); // submitted rows
  const [currentRow, setCurrentRow] = useState<string[]>([]); // current input letters
  const [phase, setPhase] = useState<Phase>("playing");
  const [keyStates, setKeyStates] = useState<Record<string, TileState>>({});
  const [hintRevealed, setHintRevealed] = useState(false);
  const [shake, setShake] = useState(false);
  const [flippingRow, setFlippingRow] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [noWords, setNoWords] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped whenever a length finishes loading so re-renders pick up the new
  // ready state. Actual readiness is read from `isDictionaryLoaded(len)` at
  // call time to avoid stale-closure issues.
  const [dictTick, setDictTick] = useState(0);

  const source: Source = settings.pin ? "pin" : settings.daily ? "daily" : "random";

  // Whether the comprehensive dictionary for the active puzzle length has
  // finished downloading. Recomputed whenever the target changes or a
  // length finishes loading (`dictTick`). Used to disable submit and to
  // show an inline loading indicator above the keyboard.
  const dictReady = useMemo(() => {
    const len = target?.normalized.length ?? settings.length;
    return isDictionaryLoaded(len);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.normalized, settings.length, dictTick]);

  const resetState = () => {
    setRows([]);
    setCurrentRow([]);
    setKeyStates({});
    setHintRevealed(false);
    setPhase("playing");
    setShake(false);
    setFlippingRow(null);
    setCopied(false);
  };

  // Fetch remote puzzle (pin or daily) — runs once
  useEffect(() => {
    if (source === "random") return;
    let cancelled = false;
    setLoadError(null);
    setNoWords(false);
    setTarget(null);
    const url =
      source === "pin"
        ? `${API_BASE}/api/letrly/puzzle/${settings.pin}`
        : `${API_BASE}/api/letrly/today`;
    fetch(url)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(data?.error || "تعذّر تحميل التحدّي");
          return;
        }
        if (source === "daily" && data?.available === false) {
          setLoadError("لا توجد كلمة يوم محدّدة اليوم — جرّب لاحقاً");
          return;
        }
        const w: LetrlyWord = {
          word: data.word,
          normalized: data.normalized,
          hint: data.hint || "",
          category: (data.category || "general") as LetrlyCategory,
        };
        setTarget(w);
        resetState();
      })
      .catch(() => {
        if (!cancelled) setLoadError("خطأ في الاتصال بالخادم");
      });
    return () => {
      cancelled = true;
    };
  }, [source, settings.pin]);

  // Pick a random word for solo mode — prefer admin-managed bank, fall
  // back to local dictionary only when the bank has nothing matching.
  const startNew = useCallback(() => {
    if (source !== "random") return;
    setLoadError(null);
    const url = `${API_BASE}/api/letrly/random?category=${encodeURIComponent(settings.category)}&length=${settings.length}`;
    fetch(url)
      .then(async (r) => {
        if (r.status === 403) {
          // category/length disabled by admin — surface a clear error
          const data = await r.json().catch(() => ({}));
          setLoadError(data?.error || "هذا الخيار غير متاح حالياً");
          return null;
        }
        if (r.ok) {
          const data = await r.json();
          const w: LetrlyWord = {
            word: data.word,
            normalized: data.normalized,
            hint: data.hint || "",
            category: (data.category || settings.category) as LetrlyCategory,
          };
          return w;
        }
        // 204 (no bank match) or other → fall back to local dictionary
        return getRandomWord(settings.category, settings.length);
      })
      .catch(() => getRandomWord(settings.category, settings.length))
      .then((w) => {
        if (!w) {
          setTarget(null);
          setNoWords(true);
        } else {
          setTarget(w);
          setNoWords(false);
        }
        resetState();
      });
  }, [source, settings.category, settings.length]);

  useEffect(() => {
    if (source === "random") startNew();
  }, [startNew, source]);

  // Preload the comprehensive Arabic dictionary for the active puzzle's
  // length. For pin/daily puzzles `settings.length` is just a default — the
  // real length comes from the loaded `target`. We preload both as soon as
  // each is known so validation always has the right set.
  useEffect(() => {
    let cancelled = false;
    const lens = new Set<number>([settings.length]);
    if (target?.normalized) lens.add(target.normalized.length);
    for (const len of lens) {
      preloadDictionary(len).then(() => {
        if (!cancelled) setDictTick((n) => n + 1);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [settings.length, target?.normalized]);

  const submitGuess = useCallback(() => {
    if (!target || phase !== "playing") return;
    const len = target.normalized.length;
    if (currentRow.length !== len) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      toast.error("أكمل الحروف أولاً", { duration: 1400 });
      return;
    }
    const guess = currentRow.join("");
    if (!isInDictionary(guess, len)) {
      // If the comprehensive dictionary hasn't finished loading for THIS
      // length yet, the word might actually be valid — surface a loading
      // hint instead of a false "not in dictionary" rejection. Read the
      // ready state at call time (not via stale closure).
      if (!isDictionaryLoaded(len)) {
        toast("جاري تحميل القاموس…", { duration: 1400 });
        return;
      }
      setShake(true);
      setTimeout(() => setShake(false), 400);
      playWrong();
      toast.error("هذه الكلمة ليست في القاموس", { duration: 1600 });
      return;
    }
    const result = evaluateGuess(guess, target.word);
    const newRows = [...rows, result];
    setRows(newRows);
    setCurrentRow([]);
    setFlippingRow(newRows.length - 1);
    // animation duration ~ len * 180ms + 400ms buffer
    const animMs = len * 180 + 400;
    setTimeout(() => {
      setKeyStates((prev) => mergeKeyboardStates(prev, result));
      setFlippingRow(null);
      const won = result.every((t) => t.state === "correct");
      if (won) {
        setPhase("won");
        playCelebration();
      } else if (newRows.length >= MAX_ATTEMPTS) {
        setPhase("lost");
        playWrong();
      } else {
        playCorrect();
      }
    }, animMs);
  }, [target, phase, currentRow, rows, playCorrect, playWrong, playCelebration]);

  const pressKey = useCallback(
    (key: string) => {
      if (!target || phase !== "playing" || flippingRow !== null) return;
      const len = target.normalized.length;
      if (key === "ENTER") {
        submitGuess();
        return;
      }
      if (key === "BACK") {
        if (currentRow.length > 0) {
          playSelect();
          setCurrentRow((r) => r.slice(0, -1));
        }
        return;
      }
      // letter
      if (currentRow.length >= len) return;
      const normalized = normalizeArabic(key);
      if (!normalized) return;
      playSelect();
      setCurrentRow((r) => [...r, normalized]);
    },
    [target, phase, flippingRow, currentRow.length, submitGuess, playSelect]
  );

  // Physical keyboard support (Arabic + Enter/Backspace)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Mirror the on-screen ENTER button: ignore submit while the
        // dictionary for the active length is still loading, so a valid
        // word doesn't get falsely rejected.
        const len = target?.normalized.length ?? settings.length;
        if (!isDictionaryLoaded(len)) return;
        pressKey("ENTER");
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        pressKey("BACK");
        return;
      }
      if (e.key.length === 1) {
        const norm = normalizeArabic(e.key);
        if (norm && /[\u0621-\u064A]/.test(norm)) {
          pressKey(norm);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pressKey]);

  const revealHint = () => {
    if (hintRevealed || !target) return;
    setHintRevealed(true);
    toast(target.hint, { duration: 4000 });
  };

  const shareText = useMemo(() => {
    if (phase === "playing" || !target) return "";
    return buildShareGrid(rows, phase === "won", MAX_ATTEMPTS);
  }, [rows, phase, target]);

  const handleShare = async () => {
    if (!shareText) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        toast.success("تم نسخ النتيجة");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("تعذّر النسخ");
      }
    }
  };

  const copyResult = async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("تم نسخ النتيجة");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  if (loadError) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4 px-6 text-center" dir="rtl">
          <div className="text-5xl">🔍</div>
          <h2 className="text-xl font-extrabold">{loadError}</h2>
          <button
            onClick={() => setLocation("/game/letrly")}
            className="bg-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,28%)] text-white font-bold px-5 py-2.5 rounded-xl"
          >
            العودة للإعدادات
          </button>
        </div>
      </Layout>
    );
  }

  if (noWords) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4 px-6 text-center" dir="rtl">
          <div className="text-5xl">🤔</div>
          <h2 className="text-xl font-extrabold">لا توجد كلمات بهذه الإعدادات بعد</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            جرّب تغيير التصنيف أو طول الكلمة. سنضيف المزيد من الكلمات قريباً.
          </p>
          <button
            onClick={() => setLocation("/game/letrly")}
            className="bg-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,28%)] text-white font-bold px-5 py-2.5 rounded-xl"
          >
            تغيير الإعدادات
          </button>
        </div>
      </Layout>
    );
  }

  if (!target) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[hsl(145,55%,32%)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  const len = target.normalized.length;

  return (
    <Layout>
      <div
        className="min-h-[calc(100vh-4rem)] py-4 sm:py-6"
        style={{ background: "#F5FAF7" }}
        dir="rtl"
      >
        <div className="container mx-auto px-3 sm:px-6 max-w-lg">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setLocation("/game/letrly")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              رجوع
            </button>

            <div className="flex items-center gap-1.5 text-xs font-bold text-[hsl(145,55%,32%)] bg-[hsl(145,55%,32%)]/10 px-3 py-1.5 rounded-full">
              <span>{CATEGORY_EMOJI[target.category]}</span>
              <span>{CATEGORY_LABELS[target.category]}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={revealHint}
                disabled={hintRevealed || phase !== "playing"}
                title="تلميح"
                aria-label="إظهار تلميح للكلمة"
                className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
              <button
                onClick={toggleMute}
                title={muted ? "تشغيل الصوت" : "كتم الصوت"}
                aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
                className="p-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={startNew}
                title="كلمة جديدة"
                aria-label="بدء كلمة جديدة"
                className="p-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tile grid */}
          <div className="flex flex-col items-center gap-1.5 mb-5">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, rowIdx) => {
              const submitted = rows[rowIdx];
              const isCurrent = rowIdx === rows.length && phase === "playing";
              const isFlipping = flippingRow === rowIdx;
              return (
                <motion.div
                  key={rowIdx}
                  className="flex gap-1.5"
                  animate={
                    isCurrent && shake
                      ? { x: [0, -8, 8, -8, 8, 0] }
                      : { x: 0 }
                  }
                  transition={{ duration: 0.4 }}
                >
                  {Array.from({ length: len }).map((_, colIdx) => {
                    let letter = "";
                    let state: TileState = "empty";
                    let filled = false;
                    if (submitted) {
                      letter = submitted[colIdx].letter;
                      state = submitted[colIdx].state;
                      filled = true;
                    } else if (isCurrent) {
                      letter = currentRow[colIdx] ?? "";
                      filled = !!letter;
                    }
                    return (
                      <Tile
                        key={colIdx}
                        letter={letter}
                        state={state}
                        filled={filled}
                        flip={isFlipping}
                        delay={isFlipping ? colIdx * 0.18 : 0}
                        size={len <= 4 ? 56 : len === 5 ? 50 : 44}
                      />
                    );
                  })}
                </motion.div>
              );
            })}
          </div>

          {/* Result banner */}
          <AnimatePresence>
            {phase !== "playing" && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`rounded-2xl p-5 mb-5 text-center border-2 ${
                  phase === "won"
                    ? "bg-emerald-50 border-emerald-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="text-2xl font-extrabold mb-1">
                  {phase === "won" ? "🎉 أحسنت!" : "😢 انتهت المحاولات"}
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  الكلمة كانت:{" "}
                  <span className="font-extrabold text-foreground text-lg">
                    {target.word}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  💡 {target.hint}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={startNew}
                    className="inline-flex items-center gap-1.5 bg-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,28%)] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    كلمة جديدة
                  </button>
                  <button
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 bg-white border-2 border-[hsl(145,55%,32%)] text-[hsl(145,55%,32%)] hover:bg-[hsl(145,55%,32%)]/5 font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    شارك النتيجة
                  </button>
                  <button
                    onClick={copyResult}
                    className="inline-flex items-center gap-1.5 bg-white border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    نسخ
                  </button>
                </div>
                {shareText && (
                  <pre className="mt-4 text-xs text-zinc-700 whitespace-pre-wrap font-mono bg-white/60 rounded-lg p-3 inline-block text-left" dir="ltr">
                    {shareText}
                  </pre>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dictionary loading indicator */}
          {!dictReady && phase === "playing" && (
            <div
              className="flex items-center justify-center gap-2 text-xs text-zinc-500"
              dir="rtl"
              data-testid="dict-loading-indicator"
            >
              <span className="inline-block w-3 h-3 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" />
              <span>جاري تحميل القاموس…</span>
            </div>
          )}

          {/* Keyboard */}
          <div className="space-y-1.5">
            {ARABIC_KEYBOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
                {row.map((key) => {
                  const isAction = key === "ENTER" || key === "BACK";
                  const state = keyStates[key] ?? "empty";
                  // Block ENTER while the dictionary is still loading so a
                  // valid word doesn't get falsely rejected. Other keys
                  // remain enabled so the player can keep typing.
                  const disabled = key === "ENTER" && !dictReady;
                  return (
                    <button
                      key={key}
                      onClick={() => pressKey(key)}
                      disabled={disabled}
                      data-testid={key === "ENTER" ? "btn-enter" : undefined}
                      className={`flex-1 max-w-[44px] h-12 sm:h-14 rounded-md text-base sm:text-lg font-extrabold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isAction
                          ? "bg-zinc-700 text-white max-w-[64px] text-xs"
                          : state === "correct"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : state === "present"
                          ? "bg-amber-400 text-white shadow-sm"
                          : state === "absent"
                          ? "bg-zinc-400 text-white"
                          : "bg-white border border-zinc-200 text-foreground hover:bg-zinc-50"
                      }`}
                    >
                      {key === "ENTER" ? (
                        "تأكيد"
                      ) : key === "BACK" ? (
                        <Delete className="w-4 h-4 mx-auto" />
                      ) : (
                        key
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <ConfettiBurst active={phase === "won"} />
        </div>
      </div>
    </Layout>
  );
}

interface TileProps {
  letter: string;
  state: TileState;
  filled: boolean;
  flip: boolean;
  delay: number;
  size: number;
}

function Tile({ letter, state, filled, flip, delay, size }: TileProps) {
  const colorClass =
    state === "correct"
      ? "bg-emerald-500 text-white border-emerald-500"
      : state === "present"
      ? "bg-amber-400 text-white border-amber-400"
      : state === "absent"
      ? "bg-zinc-400 text-white border-zinc-400"
      : filled
      ? "bg-white border-zinc-400 text-foreground"
      : "bg-white border-zinc-200 text-foreground";

  return (
    <motion.div
      animate={
        flip
          ? { rotateX: [0, 90, 0] }
          : filled && state === "empty"
          ? { scale: [1, 1.08, 1] }
          : { scale: 1 }
      }
      transition={
        flip
          ? { duration: 0.55, delay, times: [0, 0.5, 1] }
          : { duration: 0.15 }
      }
      className={`flex items-center justify-center font-extrabold rounded-md border-2 ${colorClass}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
      }}
    >
      {letter}
    </motion.div>
  );
}
