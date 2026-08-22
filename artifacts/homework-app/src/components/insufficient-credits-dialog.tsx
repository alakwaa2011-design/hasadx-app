import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Coins, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  INSUFFICIENT_CREDITS_EVENT,
  type InsufficientCreditsDetail,
} from "@/lib/credit-aware-fetch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function InsufficientCreditsDialog() {
  const { lang, dir } = useI18n();
  const [, setLocation] = useLocation();
  const [detail, setDetail] = useState<InsufficientCreditsDetail | null>(null);
  const isOpenRef = useRef(false);
  const isAr = lang === "ar";

  useEffect(() => {
    const handleInsufficientCredits = (event: Event) => {
      const { detail: nextDetail } = event as CustomEvent<InsufficientCreditsDetail>;
      if (isOpenRef.current) return;

      isOpenRef.current = true;
      setDetail(nextDetail);
    };

    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, handleInsufficientCredits);
    return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, handleInsufficientCredits);
  }, []);

  const close = () => {
    isOpenRef.current = false;
    setDetail(null);
  };

  const hasTrustedAmounts =
    typeof detail?.balance === "number" && typeof detail?.required === "number";

  return (
    <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        dir={dir}
        className="w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-2xl border-emerald-200 p-0 shadow-2xl dark:border-emerald-800"
      >
        <div className="bg-gradient-to-l from-[#17382a] via-[#225739] to-[#2d6a47] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8B84B]/20 ring-1 ring-[#E8B84B]/40">
              <Coins className="h-5 w-5 text-[#F5D47B]" aria-hidden />
            </div>
            <DialogHeader className="space-y-1 text-start">
              <DialogTitle className="text-lg font-black text-white">
                {isAr ? "رصيد نقاط حصاد غير كافٍ" : "Your Hasad credits are insufficient"}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-emerald-50/90">
                {isAr
                  ? "تحتاج إلى نقاط حصاد لإكمال هذا الإجراء بالذكاء الاصطناعي."
                  : "You need Hasad credits to complete this AI action."}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          {hasTrustedAmounts && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-[#225739] dark:bg-emerald-950/45 dark:text-emerald-100">
              {isAr
                ? <>لديك <span className="tabular-nums">{detail.balance}</span> نقطة، بينما يتطلب هذا الإجراء <span className="tabular-nums">{detail.required}</span> نقطة.</>
                : <>You have <span className="tabular-nums">{detail.balance}</span> credits, while this action requires <span className="tabular-nums">{detail.required}</span>.</>}
            </p>
          )}

          <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <button
              type="button"
              onClick={() => { close(); setLocation("/teacher/credits"); }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#225739] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#17382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2"
            >
              <Sparkles className="h-4 w-4 text-[#F5D47B]" aria-hidden />
              {isAr ? "شراء نقاط" : "Buy credits"}
            </button>
            <button
              type="button"
              onClick={() => { close(); setLocation("/teacher/pricing"); }}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#225739]/25 bg-white px-4 py-2.5 text-sm font-bold text-[#225739] transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2 dark:bg-background dark:text-emerald-200 dark:hover:bg-emerald-950/30"
            >
              {isAr ? "عرض الباقات" : "View plans"}
            </button>
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2"
            >
              {isAr ? "ليس الآن" : "Not now"}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}