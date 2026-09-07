import React from "react";
import { Link, useLocation } from "wouter";
import { useKidsProfile, useKidsAdventureState } from "@/hooks/use-kids";
import { Star, LockKeyhole, Home as HomeIcon, Map as MapIcon, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import KidsOnboarding from "./onboarding";

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: profile, isLoading, isError } = useKidsProfile();
  const { data: adventureState } = useKidsAdventureState();

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-sky-50 dark:bg-slate-900">
        <div className="animate-bounce">
          <Star className="h-12 w-12 text-yellow-400 fill-yellow-400" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-sky-50 p-6" dir="rtl">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
          <Star className="mx-auto h-12 w-12 fill-amber-400 text-amber-400" />
          <h1 className="mt-4 text-2xl font-bold text-slate-800">سجّل دخول الطالب أولاً</h1>
          <p className="mt-2 text-slate-500">يحتاج عالم حصاد الصغير إلى حساب الطالب لحفظ التقدم والنجوم.</p>
          <Link href="/student/login">
            <Button className="mt-6 h-12 w-full rounded-2xl font-bold">تسجيل دخول الطالب</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <KidsOnboarding />;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] bg-sky-50 dark:bg-slate-900 font-sans" dir="rtl">
      <header className="flex items-center justify-between p-4 md:p-6 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-sky-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm bg-primary">
            <span className="text-xl font-bold">{profile?.display_name?.charAt(0) || "أ"}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">أهلاً {profile?.display_name}</h1>
            <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full text-sm w-fit">
              <Star className="w-4 h-4 fill-amber-500" />
              <span>{adventureState?.stars || 0} نجمة</span>
            </div>
          </div>
        </div>

        <Link href="/teacher/kids">
          <Button variant="ghost" size="icon" aria-label="لوحة المعلمة" title="لوحة المعلمة" className="rounded-full w-12 h-12 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <LockKeyhole className="w-7 h-7" />
          </Button>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-sky-100 dark:border-slate-700 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="flex justify-around items-center p-3 max-w-md mx-auto">
          <Link href="/kids" className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-colors ${location === "/kids" ? "text-primary bg-primary/10" : "text-slate-400"}`}>
            <HomeIcon className={`w-7 h-7 ${location === "/kids" ? "fill-primary/20" : ""}`} />
            <span className="text-xs font-bold">الرئيسية</span>
          </Link>
          <Link href="/kids/adventure" className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-colors ${location.startsWith("/kids/adventure") || location.startsWith("/kids/activity") ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20" : "text-slate-400"}`}>
            <MapIcon className={`w-7 h-7 ${location.startsWith("/kids/adventure") ? "fill-amber-500/20" : ""}`} />
            <span className="text-xs font-bold">المغامرة</span>
          </Link>
          <Link href="/kids/stickers" className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-colors ${location === "/kids/stickers" ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-slate-400"}`}>
            <Award className={`w-7 h-7 ${location === "/kids/stickers" ? "fill-emerald-500/20" : ""}`} />
            <span className="text-xs font-bold">ملصقاتي</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
