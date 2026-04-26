import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Play, ArrowLeft, ArrowRight, Globe, Trophy, Star, Users, User, Copy, Check, QrCode, Share2, Swords } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";
import { LEVELS, DURATIONS, getCountriesByTier, shuffleArray, generateDistractors, type Country, getFlagUrl } from "@/data/countries";
import { io as ioClient, Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL || "";

type GameMode = "solo" | "multi";
type SetupPhase = "mode" | "config" | "lobby";

export default function FlagsSetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<GameMode>("solo");
  const [phase, setPhase] = useState<SetupPhase>("mode");
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [selectedDuration, setSelectedDuration] = useState(2);
  const [pin, setPin] = useState("");
  const [players, setPlayers] = useState<{ name: string; score: number; connected: boolean }[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [showArenaLobby, setShowArenaLobby] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const level = LEVELS[selectedLevel];
  const duration = DURATIONS[selectedDuration];
  const pool = getCountriesByTier(level.tier);
  const questionCount = Math.min(level.count, pool.length);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleSoloStart = () => {
    const params = new URLSearchParams({
      tier: String(level.tier),
      count: String(questionCount),
      duration: "7",
    });
    setLocation(`/game/flags/play?${params.toString()}`);
  };

  const handleMultiCreate = () => {
    const socket = ioClient(API_BASE || window.location.origin, {
      path: "/api/socket.io",
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const allPool = getCountriesByTier(level.tier);
      const shuffled = shuffleArray(allPool);
      const selected = shuffled.slice(0, questionCount);
      const questions = selected.map((country: Country) => {
        const distractors = generateDistractors(country, allPool);
        const options = shuffleArray([country, ...distractors]);
        return {
          countryCode: country.code,
          countryNameAr: country.nameAr,
          countryNameEn: country.nameEn,
          options: options.map(o => ({ code: o.code, nameAr: o.nameAr, nameEn: o.nameEn })),
        };
      });

      socket.emit("flag:create-game", {
        tier: level.tier,
        questionDuration: duration,
        questions,
        questionCount,
      }, (res: { pin?: string; error?: string }) => {
        if (res.error) {
          setError(res.error);
          return;
        }
        if (res.pin) {
          setPin(res.pin);
          setPhase("lobby");
        }
      });
    });

    socket.on("flag:player-joined", (data: { players: typeof players; name: string }) => {
      setPlayers(data.players);
    });

    socket.on("flag:player-left", (data: { players: typeof players }) => {
      setPlayers(data.players);
    });
  };

  const handleStartMulti = () => {
    if (!socketRef.current || players.length === 0) return;
    socketRef.current.emit("flag:start-game", { pin }, (res: { error?: string }) => {
      if (res?.error) {
        setError(res.error);
        return;
      }
      setLocation(`/game/flags/multi?pin=${pin}&host=1`);
    });
  };

  const copyPin = () => {
    const link = `${window.location.origin}/game/flags/join/${pin}`;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareGame = () => {
    const link = `${window.location.origin}/game/flags/join/${pin}`;
    const text = lang === "ar" ? `انضم للعبة أعلام الدول! الرمز: ${pin}` : `Join the Flag Quiz! Code: ${pin}`;
    if (navigator.share) {
      navigator.share({ title: lang === "ar" ? "أعلام الدول" : "Flag Quiz", text, url: link }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${link}`).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  if (phase === "lobby") {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/20 dark:via-blue-950/20 dark:to-indigo-950/20 py-8 px-4" dir={dir}>
          <div className="max-w-xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-xl mb-4">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-foreground mb-1">{lang === "ar" ? "غرفة الانتظار" : "Waiting Room"}</h1>
              <p className="text-muted-foreground text-sm">
                {lang === "ar" ? "شارك الرمز مع اللاعبين للانضمام" : "Share the code with players to join"}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border/60 rounded-2xl p-6 shadow-lg mb-4 text-center">
              <p className="text-xs font-bold text-muted-foreground mb-2">{lang === "ar" ? "رمز اللعبة" : "Game Code"}</p>
              <div className="flex items-center justify-center gap-2 mb-4">
                {pin.split("").map((d, i) => (
                  <motion.div key={i} initial={{ scale: 0, rotateY: 180 }} animate={{ scale: 1, rotateY: 0 }} transition={{ delay: i * 0.08, type: "spring" }}
                    className="w-12 h-14 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-black text-white">{d}</span>
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2">
                <button onClick={copyPin} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-xs font-bold hover:bg-sky-200 transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? (lang === "ar" ? "تم النسخ!" : "Copied!") : (lang === "ar" ? "نسخ الرابط" : "Copy Link")}
                </button>
                <button onClick={shareGame} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-200 transition-colors">
                  <Share2 className="w-3.5 h-3.5" />
                  {lang === "ar" ? "مشاركة" : "Share"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {lang === "ar" ? `أو ادخل على: /game/flags/join/${pin}` : `Or visit: /game/flags/join/${pin}`}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border/60 rounded-2xl p-5 shadow-md mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-500" />
                  <span className="font-bold text-sm text-foreground">{lang === "ar" ? "اللاعبون" : "Players"}</span>
                </div>
                <span className="text-xs font-bold text-sky-600 bg-sky-100 dark:bg-sky-900/30 px-2.5 py-1 rounded-full">{players.length}</span>
              </div>
              {players.length === 0 ? (
                <div className="text-center py-6">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-3xl mb-2">👀</motion.div>
                  <p className="text-sm text-muted-foreground">{lang === "ar" ? "في انتظار اللاعبين..." : "Waiting for players..."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {players.map((p, i) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-800/50">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white text-xs font-black">{p.name[0]}</div>
                      <span className="text-sm font-bold text-foreground truncate">{p.name}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{lang === "ar" ? "المستوى:" : "Level:"} <span className="font-bold text-foreground">{level.icon} {lang === "ar" ? level.nameAr : level.nameEn}</span></span>
              <span className="text-muted-foreground">{lang === "ar" ? "الأعلام:" : "Flags:"} <span className="font-bold text-foreground">{questionCount}</span></span>
              <span className="text-muted-foreground">{lang === "ar" ? "الوقت:" : "Time:"} <span className="font-bold text-foreground">{duration}{lang === "ar" ? "ث" : "s"}</span></span>
            </div>

            {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStartMulti}
              disabled={players.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg shadow-xl shadow-green-500/30 hover:shadow-green-500/50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-6 h-6" />
              {lang === "ar" ? `ابدأ اللعبة (${players.length} لاعب)` : `Start Game (${players.length} players)`}
            </motion.button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-950/20 dark:via-blue-950/20 dark:to-indigo-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-2xl shadow-sky-500/40 mb-4">
              <Globe className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-foreground mb-1">{lang === "ar" ? "لعبة أعلام الدول" : "World Flags Game"}</h1>
            <p className="text-muted-foreground text-sm">{lang === "ar" ? "اختبر معلوماتك في أعلام دول العالم!" : "Test your knowledge of world flags!"}</p>
          </motion.div>

          {phase === "mode" && (
            <>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4 mb-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setMode("solo"); setPhase("config"); }}
                  className="bg-card border-2 border-border/40 hover:border-sky-400 rounded-2xl p-5 text-center transition-all hover:shadow-xl group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-2xl mb-1 flex justify-center gap-0.5">🇸🇦🇺🇸🇯🇵</div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mx-auto mb-2 shadow-lg group-hover:scale-110 transition-transform">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-black text-foreground text-sm mb-0.5">{lang === "ar" ? "لعب فردي" : "Solo Play"}</h3>
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "تحدَّ نفسك واختبر معلوماتك" : "Challenge yourself"}</p>
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setMode("multi"); setPhase("config"); }}
                  className="bg-card border-2 border-border/40 hover:border-purple-400 rounded-2xl p-5 text-center transition-all hover:shadow-xl group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="text-2xl mb-1 flex justify-center gap-0.5">🇩🇪🇫🇷🇧🇷</div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-2 shadow-lg group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-black text-foreground text-sm mb-0.5">{lang === "ar" ? "لعب جماعي" : "Multiplayer"}</h3>
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "تنافس مع أصدقائك بالرمز" : "Compete with friends via code"}</p>
                </motion.button>
              </motion.div>

              <motion.button whileTap={{ scale: 0.97 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                onClick={() => setShowArenaLobby(true)}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all text-center mb-6 flex items-center justify-center gap-3">
                <Swords className="w-5 h-5 text-white" />
                <span className="font-black text-white">{lang === "ar" ? "تحدِّ صديقاً (Arena) ⚔️" : "Challenge a Friend (Arena) ⚔️"}</span>
              </motion.button>

              <AnimatePresence>
                {showArenaLobby && (
                  <MultiplayerLobby
                    gameId="flags"
                    gameTitle={lang === "ar" ? "أعلام الدول" : "World Flags"}
                    playUrl={`/game/flags/play?tier=${level.tier}&count=${questionCount}`}
                    playerName=""
                    onClose={() => setShowArenaLobby(false)}
                  />
                )}
              </AnimatePresence>
            </>
          )}

          {phase === "config" && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setPhase("mode")} className="p-2 rounded-xl bg-white/80 dark:bg-gray-800 border border-border hover:bg-gray-100 transition-colors">
                  <BackArrow className="w-4 h-4 text-foreground" />
                </button>
                <div className={`px-3 py-1 rounded-xl text-xs font-bold ${mode === "solo" ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700"}`}>
                  {mode === "solo" ? (lang === "ar" ? "🎮 فردي" : "🎮 Solo") : (lang === "ar" ? "👥 جماعي" : "👥 Multiplayer")}
                </div>
              </div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/60 rounded-2xl p-5 shadow-md mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-sm text-foreground">{lang === "ar" ? "اختر المستوى" : "Choose Level"}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {LEVELS.map((lv, idx) => (
                    <motion.button key={lv.tier} whileTap={{ scale: 0.95 }} onClick={() => setSelectedLevel(idx)}
                      className={`relative p-4 rounded-2xl border-2 transition-all text-center ${selectedLevel === idx ? "border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/10" : "border-border/40 bg-background hover:border-sky-300/60"}`}>
                      <div className="text-3xl mb-2">{lv.icon}</div>
                      <p className="font-black text-foreground text-sm">{lang === "ar" ? lv.nameAr : lv.nameEn}</p>
                      <p className="text-xs text-muted-foreground mt-1">{lv.count} {lang === "ar" ? "علم" : "flags"}</p>
                      {selectedLevel === idx && (
                        <motion.div layoutId="level-check" className="absolute top-2 end-2 w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
                          <Star className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {mode === "multi" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border/60 rounded-2xl p-5 shadow-md mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-indigo-500" />
                    <span className="font-bold text-sm text-foreground">{lang === "ar" ? "وقت الإجابة" : "Answer Time"}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {DURATIONS.map((d, idx) => (
                      <button key={d} onClick={() => setSelectedDuration(idx)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedDuration === idx ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "bg-background border border-border text-muted-foreground hover:border-indigo-400"}`}>
                        {d} {lang === "ar" ? "ثانية" : "sec"}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">{lang === "ar" ? "عدد الأعلام:" : "Flags:"}</span>
                  <span className="font-black text-sky-600 text-lg">{questionCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground font-medium">{lang === "ar" ? "وقت كل سؤال:" : "Time per question:"}</span>
                  <span className="font-black text-indigo-600 text-lg">{mode === "solo" ? 7 : duration} {lang === "ar" ? "ث" : "s"}</span>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={mode === "solo" ? handleSoloStart : handleMultiCreate}
                className={`w-full py-4 rounded-2xl text-white font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${mode === "solo" ? "bg-gradient-to-r from-sky-500 to-indigo-600 shadow-sky-500/30" : "bg-gradient-to-r from-purple-500 to-pink-600 shadow-purple-500/30"}`}
              >
                <Play className="w-6 h-6" />
                {mode === "solo"
                  ? (lang === "ar" ? "ابدأ اللعبة!" : "Start Game!")
                  : (lang === "ar" ? "إنشاء غرفة" : "Create Room")}
              </motion.button>

              <button onClick={() => setPhase("mode")} className="w-full mt-3 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
                <BackArrow className="w-4 h-4" />
                {lang === "ar" ? "العودة" : "Back"}
              </button>
            </>
          )}

          {phase === "mode" && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              onClick={() => setLocation("/")}
              className="w-full mt-3 py-2.5 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
              <BackArrow className="w-4 h-4" />
              {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
            </motion.button>
          )}
        </div>
      </div>
    </Layout>
  );
}
