import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Play, Copy, Check, Users, BookOpen, ChevronDown, Globe, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePublicContent, startPublicGame } from "@/lib/landing-api";
import { toast } from "sonner";

export function PublicQuizzesSection() {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const isAr = lang === "ar";
  const { assignments, loading } = usePublicContent();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [startingGameId, setStartingGameId] = useState<number | null>(null);

  const copyLink = (id: number) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${window.location.origin}${base}/solve/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleStartGame = async (assignmentId: number) => {
    setStartingGameId(assignmentId);
    try {
      const pin = await startPublicGame(assignmentId, false, 0);
      setLocation(`/game/join/${pin}`);
    } catch (err: any) {
      toast.error(err.message || (isAr ? "خطأ في بدء اللعبة" : "Error starting game"));
    } finally {
      setStartingGameId(null);
    }
  };

  const previewCount = 6;
  const displayed = showAll ? assignments : assignments.slice(0, previewCount);
  const overflow = assignments.length - previewCount;

  if (!loading && assignments.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-card border-y border-border" dir={dir}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
            {isAr ? "أسئلة ومسابقات جاهزة" : "Ready-made Quizzes"}
          </h2>
          <p className="text-lg text-muted-foreground font-medium">
            {isAr 
              ? "لا تريد البدء من الصفر؟ ابدأ من فكرة جاهزة أو اصنع تجربتك الخاصة"
              : "Don't want to start from scratch? Start with a ready idea or create your own"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayed.map((a) => (
                <div key={a.id} className="bg-background border border-border hover:border-secondary/40 rounded-2xl p-6 transition-all hover:shadow-lg flex flex-col h-full group">
                  <h3 className="font-bold text-foreground text-lg mb-2 line-clamp-2 leading-tight">
                    {a.title}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-medium mb-6">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      {a.questionCount} {isAr ? "سؤال" : "Q"}
                    </span>
                    {!a.isAdminContent && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {a.teacherName || (isAr ? "مجهول" : "Anonymous")}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-auto flex gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartGame(a.id)}
                      disabled={startingGameId === a.id}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-70"
                    >
                      {startingGameId === a.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      {startingGameId === a.id
                        ? (isAr ? "جارٍ..." : "Starting...")
                        : (isAr ? "العب الآن" : "Play Now")}
                    </button>
                    <button
                      onClick={() => copyLink(a.id)}
                      className="w-12 h-12 flex items-center justify-center shrink-0 rounded-xl bg-muted text-foreground hover:bg-secondary/20 hover:text-secondary transition-colors"
                      title={isAr ? "نسخ الرابط" : "Copy Link"}
                    >
                      {copiedId === a.id ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {overflow > 0 && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-border font-bold text-foreground hover:bg-muted transition-colors"
                >
                  {showAll ? (isAr ? "عرض أقل" : "Show less") : (isAr ? `عرض المزيد (+${overflow})` : `Show more (+${overflow})`)}
                  <ChevronDown className={`w-5 h-5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </button>
              </div>
            )}
            
            <div className="text-center mt-6">
              <Link href="/public/games" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
                <Globe className="w-5 h-5" />
                {isAr ? "تصفح مكتبة الأنشطة الكاملة" : "Browse full activities library"}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
