import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentTeacher,
  useListTeacherSessions,
  useRevokeTeacherSession,
  useRevokeOtherTeacherSessions,
  getListTeacherSessionsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Shield,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  Globe,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";

type DeviceKind = "mobile" | "tablet" | "desktop";

type SessionLike = {
  userAgent?: string | null;
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  deviceModel?: string | null;
  location?: string | null;
};

function detectDeviceFallback(ua: string | null | undefined): DeviceKind {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (/(ipad|tablet|playbook|silk)/.test(lower)) return "tablet";
  if (/(mobi|iphone|ipod|android.*mobile|phone)/.test(lower)) return "mobile";
  return "desktop";
}

function getDeviceKind(s: SessionLike): DeviceKind {
  if (s.deviceType === "mobile" || s.deviceType === "tablet" || s.deviceType === "desktop") {
    return s.deviceType;
  }
  return detectDeviceFallback(s.userAgent);
}

function buildDeviceLabel(s: SessionLike, lang: "ar" | "en"): string {
  const browser = s.browser?.trim() || null;
  const os = s.os?.trim() || null;
  const model = s.deviceModel?.trim() || null;
  const kind = getDeviceKind(s);

  // For phones/tablets prefer the device model (e.g. "iPhone", "Samsung SM-S908B").
  // For desktops prefer the OS (e.g. "macOS", "Windows") since model is rarely useful.
  const target = kind === "desktop" ? os || model : model || os;

  if (browser && target) {
    return lang === "ar" ? `${browser} على ${target}` : `${browser} on ${target}`;
  }
  if (browser) return browser;
  if (target) return target;

  return lang === "ar" ? "جهاز غير معروف" : "Unknown device";
}

function buildLocationLabel(s: SessionLike, lang: "ar" | "en"): string {
  if (s.location && s.location.trim()) return s.location.trim();
  return lang === "ar" ? "موقع غير معروف" : "Unknown location";
}

function formatRelative(iso: string | null | undefined, lang: "ar" | "en") {
  if (!iso) return lang === "ar" ? "غير متاح" : "Unavailable";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return lang === "ar" ? "غير متاح" : "Unavailable";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const rtf = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", { numeric: "auto" });
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return rtf.format(-diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  return rtf.format(-diffMonth, "month");
}

function formatAbsolute(iso: string | null | undefined, lang: "ar" | "en") {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function TeacherSessions() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;
  const queryClient = useQueryClient();

  const { data: user, isLoading: loadingUser, error: userError } =
    useGetCurrentTeacher({ query: { retry: false } });

  useEffect(() => {
    if (userError) setLocation("/login");
  }, [userError, setLocation]);

  const {
    data: sessions,
    isLoading: loadingSessions,
    refetch,
  } = useListTeacherSessions({
    query: {
      enabled: !!user,
      refetchOnWindowFocus: true,
    },
  });

  const sortedSessions = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      const ta = Date.parse(a.lastSeenAt || a.createdAt || "") || 0;
      const tb = Date.parse(b.lastSeenAt || b.createdAt || "") || 0;
      return tb - ta;
    });
  }, [sessions]);

  const revokeOne = useRevokeTeacherSession({
    mutation: {
      onSuccess: (data) => {
        if (data.wasCurrent) {
          toast.success(lang === "ar" ? "تم تسجيل الخروج" : "Signed out");
          queryClient.clear();
          setLocation("/login");
          return;
        }
        toast.success(data.message || (lang === "ar" ? "تم إنهاء الجلسة" : "Session revoked"));
        queryClient.invalidateQueries({ queryKey: getListTeacherSessionsQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err?.message || (lang === "ar" ? "خطأ في إنهاء الجلسة" : "Failed to revoke"));
      },
    },
  });

  const revokeOthers = useRevokeOtherTeacherSessions({
    mutation: {
      onSuccess: (data: any) => {
        const count = data?.revoked ?? 0;
        toast.success(
          lang === "ar"
            ? count > 0
              ? `تم تسجيل الخروج من ${count} جهاز آخر`
              : "لا توجد جلسات أخرى نشطة"
            : count > 0
              ? `Signed out of ${count} other device(s)`
              : "No other active sessions",
        );
        queryClient.invalidateQueries({ queryKey: getListTeacherSessionsQueryKey() });
      },
      onError: (err: any) => {
        toast.error(err?.message || (lang === "ar" ? "خطأ" : "Failed"));
      },
    },
  });

  if (userError) return null;
  if (loadingUser || (loadingSessions && !sessions)) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  const otherCount = (sessions ?? []).filter((s) => !s.isCurrent).length;

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-3xl" dir={dir}>
        <button
          onClick={() => setLocation("/teacher/settings")}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <BackArrow className="w-4 h-4" />
          {lang === "ar" ? "الإعدادات" : "Settings"}
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-lg shadow-primary/20"
            >
              <Shield className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              {lang === "ar" ? "الجلسات النشطة" : "Active sessions"}
            </h1>
            <p className="text-muted-foreground">
              {lang === "ar"
                ? "الأجهزة المسجل دخولها حالياً إلى حسابك"
                : "Devices currently signed in to your account"}
            </p>
          </div>

          <Card className="p-4 sm:p-6 shadow-xl border-t-4 border-t-primary mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {lang === "ar" ? "الأجهزة الأخرى" : "Other devices"}
                  </div>
                  <div className="font-bold">
                    {otherCount}{" "}
                    {lang === "ar"
                      ? otherCount === 1
                        ? "جهاز"
                        : "أجهزة"
                      : otherCount === 1
                        ? "device"
                        : "devices"}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => revokeOthers.mutate()}
                disabled={revokeOthers.isPending || otherCount === 0}
                className="gap-2 bg-amber-500 hover:bg-amber-600"
              >
                {revokeOthers.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                {lang === "ar"
                  ? "تسجيل الخروج من جميع الأجهزة الأخرى"
                  : "Sign out of all other devices"}
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            {sortedSessions.map((s) => {
              const device = getDeviceKind(s);
              const Icon =
                device === "mobile" ? Smartphone : device === "tablet" ? Tablet : Monitor;
              const deviceLabel = buildDeviceLabel(s, lang);
              const locationLabel = buildLocationLabel(s, lang);
              return (
                <Card
                  key={s.sid}
                  className={`p-4 sm:p-5 ${s.isCurrent ? "border-2 border-primary/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">
                            {deviceLabel}
                          </span>
                          {s.isCurrent && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              {lang === "ar" ? "هذا الجهاز" : "This device"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span title={formatAbsolute(s.lastSeenAt, lang)}>
                            {lang === "ar" ? "آخر استخدام: " : "Last active: "}
                            {formatRelative(s.lastSeenAt || s.createdAt, lang)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Globe className="w-3.5 h-3.5" />
                          <span>{locationLabel}</span>
                        </div>
                        {s.ip && (
                          <div className="text-xs text-muted-foreground/80 mt-0.5 font-mono" dir="ltr">
                            IP: {s.ip}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const confirmMsg = s.isCurrent
                          ? lang === "ar"
                            ? "سيتم تسجيل خروجك من هذا الجهاز. هل أنت متأكد؟"
                            : "You will be signed out of this device. Continue?"
                          : lang === "ar"
                            ? "إنهاء هذه الجلسة؟"
                            : "End this session?";
                        if (!window.confirm(confirmMsg)) return;
                        revokeOne.mutate({ sid: s.sid });
                      }}
                      disabled={revokeOne.isPending}
                      className={`gap-2 ${
                        s.isCurrent
                          ? "bg-rose-500 hover:bg-rose-600"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {revokeOne.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      {s.isCurrent
                        ? lang === "ar"
                          ? "تسجيل الخروج من هذا الجهاز"
                          : "Sign out of this device"
                        : lang === "ar"
                          ? "إنهاء الجلسة"
                          : "End session"}
                    </Button>
                  </div>
                </Card>
              );
            })}

            {sortedSessions.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">
                {lang === "ar" ? "لا توجد جلسات نشطة" : "No active sessions"}
              </Card>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => refetch()}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {lang === "ar" ? "تحديث القائمة" : "Refresh"}
            </button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
