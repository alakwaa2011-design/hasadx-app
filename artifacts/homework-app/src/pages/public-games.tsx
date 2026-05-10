import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Search, User, Copy, Check,
  Play, Globe, BookOpen, Loader2, Share2,
  FileText, Tag, Gamepad2, Zap, Bot, Users, X, Terminal,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface PublicAssignment {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  submissionMode: string;
  targetClass: string | null;
  totalPoints: number | null;
  teacherName: string | null;
  isAdminContent?: boolean;
  questionCount: number;
  createdAt: string;
}

export default function PublicGamesPage() {
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [startingGameId, setStartingGameId] = useState<number | null>(null);

  const [botDialogAssignment, setBotDialogAssignment] = useState<PublicAssignment | null>(null);
  const [botCount, setBotCount] = useState(4);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/assignments`)
      .then(r => r.ok ? r.json() : [])
      .then(a => setAssignments(Array.isArray(a) ? a : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const searchLower = search.toLowerCase();

  const filtered = assignments.filter(a => {
    if (!search) return true;
    return (
      a.title.toLowerCase().includes(searchLower) ||
      (a.teacherName || "").toLowerCase().includes(searchLower) ||
      (a.subject || "").toLowerCase().includes(searchLower)
    );
  });

  const creatorName = (name: string | null) =>
    name || (lang === "ar" ? "مجهول" : "Anonymous");

  const handleOpenBotDialog = (a: PublicAssignment) => {
    setBotDialogAssignment(a);
  };

  const handleStartGame = async (assignmentId: number, withBots: boolean, bots: number) => {
    setBotDialogAssignment(null);
    setStartingGameId(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/public/start-wameeth/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ withBots, botCount: bots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ في بدء اللعبة");
      setLocation(`/game/join/${data.pin}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ في بدء اللعبة";
      toast.error(message);
    } finally {
      setStartingGameId(null);
    }
  };

  const copyLink = (a: PublicAssignment) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${window.location.origin}${base}/solve/${a.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(`${a.id}`);
      toast.success(t.publicGames.linkCopied);
      setTimeout(() => setCopiedLinkId(null), 2000);
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl" dir={dir}>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else setLocation("/");
            }}
            className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "رجوع" : "Back"}
          </button>
          <span className="text-muted-foreground/40">·</span>
          <Link href="/" className="text-primary hover:underline font-bold flex items-center gap-1 w-fit">
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "القائمة الرئيسية" : "Main Menu"}
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <Link href="/teacher" className="text-primary hover:underline font-bold flex items-center gap-1 w-fit">
            <BackArrow className="w-4 h-4" />
            {lang === "ar" ? "لوحة التحكم" : "Teacher Dashboard"}
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{t.publicGames.title}</h1>
            <p className="text-sm text-muted-foreground">{t.publicGames.subtitle}</p>
          </div>
        </div>

        {/* ── Featured interactive games ── */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {/* Tug of War */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setLocation("/game/tug/create")}
            className="rounded-2xl bg-gradient-to-br from-indigo-600/60 to-blue-700/60 p-4 text-white flex items-center gap-4 shadow-lg relative overflow-hidden cursor-pointer hover:from-indigo-500/70 hover:to-blue-600/70 transition-all hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0">🪢</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm">{lang === "ar" ? "شد الحبل المعرفي" : "Knowledge Tug of War"}</h3>
              <p className="text-indigo-200 text-xs mt-0.5 line-clamp-1">
                {lang === "ar" ? "فريقان يتنافسان على الحبل!" : "Two teams compete on the rope!"}
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-3 py-1.5 rounded-lg bg-green-500/90 text-white font-black text-xs">
                {lang === "ar" ? "🎮 العب الآن" : "🎮 Play Now"}
              </span>
            </div>
          </motion.div>

          {/* Wameeth */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white flex items-center gap-4 shadow-lg"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm">{lang === "ar" ? "وميض" : "Wameeth"}</h3>
              <p className="text-amber-100 text-xs mt-0.5 line-clamp-1">
                {lang === "ar" ? "مسابقة تفاعلية مباشرة" : "Live interactive quiz"}
              </p>
            </div>
            <div className="shrink-0">
              <Link href="/game/join" className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-black text-xs hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                {lang === "ar" ? "انضم بكود" : "Join"}
              </Link>
            </div>
          </motion.div>

          {/* Hack Game */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setLocation("/game/hack")}
            className="rounded-2xl bg-gradient-to-br from-green-700 to-emerald-900 p-4 text-white flex items-center gap-4 shadow-lg shadow-green-900/40 relative overflow-hidden cursor-pointer hover:from-green-600 hover:to-emerald-800 transition-all hover:-translate-y-0.5 border border-green-600/40"
          >
            <div className="w-12 h-12 rounded-2xl bg-black/40 border border-green-400/40 flex items-center justify-center shrink-0">
              <Terminal className="w-6 h-6 text-green-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm font-mono tracking-wide">{lang === "ar" ? "لعبة الاختراق" : "H4CK_GAME"}</h3>
              <p className="text-green-200 text-xs mt-0.5 line-clamp-1 font-mono">
                {lang === "ar" ? "ماراثون كلمات سر وسحب نقاط" : "Password marathon + steal points"}
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-3 py-1.5 rounded-lg bg-green-400 text-black font-mono font-black text-xs">
                {lang === "ar" ? "ابدأ ▶" : "START ▶"}
              </span>
            </div>
          </motion.div>

          {/* Wameeth Join slot to keep grid balanced */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => setLocation("/game/join")}
            className="rounded-2xl bg-gradient-to-br from-purple-600/70 to-indigo-700/70 p-4 text-white flex items-center gap-4 shadow-lg cursor-pointer hover:from-purple-500/80 hover:to-indigo-600/80 transition-all hover:-translate-y-0.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0">🎮</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm">{lang === "ar" ? "انضم برمز لعبة" : "Join with PIN"}</h3>
              <p className="text-purple-200 text-xs mt-0.5 line-clamp-1">
                {lang === "ar" ? "أدخل رمز اللعبة المُرسَل إليك" : "Enter the game PIN sent to you"}
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-3 py-1.5 rounded-lg bg-white/20 text-white font-black text-xs">
                {lang === "ar" ? "انضم" : "Join"}
              </span>
            </div>
          </motion.div>
        </div>

        <div className="relative mb-6">
          <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.publicGames.searchPlaceholder}
            className={`w-full border border-border rounded-lg py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${lang === "ar" ? "pr-10 pl-3" : "pl-10 pr-3"}`}
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">{t.publicGames.noGames}</h3>
            <p className="text-sm text-muted-foreground">{t.publicGames.noGamesDesc}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
              >
                <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-lg transition-all hover:border-teal-400/30 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-foreground text-base leading-tight mb-1 truncate">{a.title}</h3>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {!a.isAdminContent && (
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{creatorName(a.teacherName)}</span>
                        )}
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{a.questionCount} {t.publicGames.questions}</span>
                        {a.subject && (
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{a.subject}</span>
                        )}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                      <Zap className="w-3.5 h-3.5" />
                      {t.publicGames.gameBadge}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleOpenBotDialog(a)}
                      disabled={startingGameId === a.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                    >
                      {startingGameId === a.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      {startingGameId === a.id
                        ? t.publicGames.startingGameBtn
                        : t.publicGames.startGameBtn}
                    </button>
                    <button
                      onClick={() => copyLink(a)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground font-bold text-sm hover:bg-muted transition-colors"
                    >
                      {copiedLinkId === `${a.id}` ? <Check className="w-4 h-4 text-green-500" /> : <Share2 className="w-4 h-4" />}
                      {copiedLinkId === `${a.id}` ? t.publicGames.copied : t.publicGames.shareLink}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            {`${filtered.length} ${t.publicGames.totalItems}`}
          </p>
        )}
      </div>

      <AnimatePresence>
        {botDialogAssignment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setBotDialogAssignment(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              dir={dir}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setBotDialogAssignment(null)}
                className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center gap-1 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-2 shadow-lg">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-extrabold text-foreground">
                  {lang === "ar" ? "ابدأ اللعبة" : "Start Game"}
                </h2>
                <p className="text-sm text-muted-foreground font-medium truncate max-w-[220px]">
                  {botDialogAssignment.title}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 mb-5 border border-border/60">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="font-bold text-foreground text-sm">
                    {lang === "ar"
                      ? "هل تريد منافسة لاعبين وهميين؟"
                      : "Want to compete with bot players?"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {lang === "ar"
                    ? "سيتنافس معك لاعبون وهميون ويمكنك تجميدهم أو سرقة نقاطهم!"
                    : "Bot players will compete with you — freeze them or steal their points!"}
                </p>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {lang === "ar" ? "عدد الوهميين" : "Bot count"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBotCount(c => Math.max(2, c - 1))}
                      className="w-7 h-7 rounded-lg bg-background border border-border text-foreground font-bold text-base hover:bg-muted transition-colors flex items-center justify-center"
                    >-</button>
                    <span className="w-6 text-center font-extrabold text-foreground">{botCount}</span>
                    <button
                      onClick={() => setBotCount(c => Math.min(8, c + 1))}
                      className="w-7 h-7 rounded-lg bg-background border border-border text-foreground font-bold text-base hover:bg-muted transition-colors flex items-center justify-center"
                    >+</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleStartGame(botDialogAssignment.id, true, botCount)}
                  disabled={startingGameId === botDialogAssignment.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                >
                  {startingGameId === botDialogAssignment.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  {lang === "ar" ? `نعم، العب مع ${botCount} لاعبين وهميين` : `Yes, play with ${botCount} bots`}
                </button>
                <button
                  onClick={() => handleStartGame(botDialogAssignment.id, false, 0)}
                  disabled={startingGameId === botDialogAssignment.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                >
                  {startingGameId === botDialogAssignment.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {lang === "ar" ? "لا، العب بمفردك" : "No, play solo"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
