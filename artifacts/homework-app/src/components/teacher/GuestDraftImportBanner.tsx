import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Download, X, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import {
  loadGuestDraft,
  clearGuestDraft,
  draftToApiPayload,
  type GuestDraft,
} from "@/lib/guest-draft";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function GuestDraftImportBanner() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setDraft(loadGuestDraft());
  }, []);

  if (!draft) return null;

  const payload = draftToApiPayload(draft);
  if (!payload) return null;

  const questionCount = payload.questions.length;
  const dir = lang === "ar" ? "rtl" : "ltr";

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      clearGuestDraft();
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast.success(t.guestCreate.importBannerSuccess);
    } catch {
      toast.error(t.guestCreate.importBannerFailed);
    } finally {
      setImporting(false);
    }
  };

  const handleDismiss = () => {
    clearGuestDraft();
    setDraft(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="rounded-2xl border border-amber-300/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4 sm:p-5 shadow-sm"
        dir={dir}
        role="region"
        aria-label={t.guestCreate.importBannerTitle}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-foreground text-sm sm:text-base leading-tight">
              {t.guestCreate.importBannerTitle}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {t.guestCreate.importBannerDesc}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="font-bold text-foreground truncate max-w-[60vw] sm:max-w-xs">
                {draft.title}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {t.guestCreate.importBannerMeta.replace("{n}", String(questionCount))}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-60"
              >
                {importing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {importing
                  ? t.guestCreate.importBannerImporting
                  : t.guestCreate.importBannerButton}
              </button>
              <button
                onClick={handleDismiss}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 text-xs sm:text-sm font-bold transition-colors disabled:opacity-60"
              >
                <X className="w-3.5 h-3.5" />
                {t.guestCreate.importBannerDismiss}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
