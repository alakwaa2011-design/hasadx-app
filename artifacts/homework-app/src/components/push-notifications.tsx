import { useCallback, useEffect, useState } from "react";
import { BellRing, BellOff, Loader2, Send, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, Button } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import { timerStore } from "@/lib/timer-store";
import { playTimerSound } from "@/lib/timer-sounds";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function saveSubscription(subscription: PushSubscription, lang: "ar" | "en"): Promise<void> {
  const timer = timerStore.getState();
  const response = await fetch(`${API_BASE}/api/notifications/push/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...subscription.toJSON(),
      locale: lang,
      soundEnabled: !timer.soundMuted,
    }),
  });
  if (!response.ok) throw new Error("Unable to save push subscription");
}

export function GlobalPushNotificationManager() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const { data: user } = useGetCurrentTeacher({ query: { retry: false } as any });

  useEffect(() => {
    if (!user || !supported()) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "HASAAD_PUSH_NAVIGATE" && typeof event.data.actionUrl === "string") {
        setLocation(event.data.actionUrl);
        return;
      }
      if (event.data?.type === "HASAAD_PUSH_ACTIVE" && document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        const notificationId = event.data.notification?.notificationId;
        if (notificationId) {
          const key = "hasaad_push_seen_v1";
          const seen = JSON.parse(localStorage.getItem(key) || "[]") as number[];
          if (seen.includes(notificationId)) return;
          localStorage.setItem(key, JSON.stringify([...seen.slice(-99), notificationId]));
        }
        const timer = timerStore.getState();
        if (!timer.soundMuted) playTimerSound(timer.soundSelection, timer.soundVolume);
      }
    };
    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [queryClient, setLocation, user]);

  useEffect(() => {
    if (!user || !supported() || Notification.permission !== "granted") return;
    let cancelled = false;
    void currentSubscription().then(async (subscription) => {
      if (!subscription || cancelled) return;
      await saveSubscription(subscription, lang).catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [lang, user]);

  useEffect(() => {
    if (!user || !supported()) return;
    let previous = timerStore.getState().soundMuted;
    const unsubscribe = timerStore.subscribe(() => {
      const muted = timerStore.getState().soundMuted;
      if (muted === previous) return;
      previous = muted;
      void currentSubscription().then((subscription) => {
        if (!subscription) return;
        return fetch(`${API_BASE}/api/notifications/push/preferences`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint, soundEnabled: !muted, locale: lang }),
        });
      }).catch(() => undefined);
    });
    return () => { unsubscribe(); };
  }, [lang, user]);

  return null;
}

export function PushNotificationSettings() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    supported() ? Notification.permission : "denied",
  );
  const iosNeedsInstall = /iPad|iPhone|iPod/.test(navigator.userAgent) && !isStandalone();

  const refresh = useCallback(async () => {
    setSubscription(await currentSubscription());
    if (supported()) setPermission(Notification.permission);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      if (!supported()) throw new Error(isAr ? "هذا المتصفح لا يدعم إشعارات الويب" : "This browser does not support Web Push");
      if (iosNeedsInstall) throw new Error(isAr ? "ثبّت حصاد على الشاشة الرئيسية أولًا، ثم افتحه من الأيقونة" : "Install Hasaad on your Home Screen, then open it from the icon");
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error(isAr ? "لم يتم منح إذن الإشعارات" : "Notification permission was not granted");
      const keyResponse = await fetch(`${API_BASE}/api/notifications/push/public-key`, { credentials: "include" });
      const keyData = await keyResponse.json();
      if (!keyResponse.ok) throw new Error(keyData.message || "Web Push unavailable");
      const registration = await navigator.serviceWorker.ready;
      const next = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(keyData.publicKey),
      });
      await saveSubscription(next, lang);
      setSubscription(next);
      toast.success(isAr ? "تم تفعيل إشعارات الجهاز" : "Device notifications enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isAr ? "تعذّر تفعيل الإشعارات" : "Could not enable notifications"));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!subscription) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/notifications/push/unsubscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success(isAr ? "تم إيقاف إشعارات الجهاز" : "Device notifications disabled");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/notifications/push/test`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      toast.success(isAr ? "أُرسل الإشعار التجريبي" : "Test notification sent");
    } catch {
      toast.error(isAr ? "تعذّر إرسال الإشعار التجريبي" : "Could not send test notification");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-sky-500 mb-6">
      <h2 className="text-lg font-extrabold text-foreground mb-2 flex items-center gap-2">
        <BellRing className="w-5 h-5 text-sky-500" />
        {isAr ? "إشعارات الجهاز" : "Device notifications"}
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        {isAr
          ? "استقبل إشعارات حصاد حتى عند إغلاق المنصة. يستخدم الهاتف صوت النظام، بينما تستخدم المنصة المفتوحة صوت حصاد المحدد إذا لم يكن مكتومًا."
          : "Receive Hasaad alerts when the app is closed. Your device uses its system sound; while Hasaad is open, it uses your selected Hasaad sound when unmuted."}
      </p>
      <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3 mb-4">
        <Smartphone className="w-5 h-5 text-sky-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold text-foreground">
            {subscription
              ? (isAr ? "الإشعارات مفعّلة على هذا الجهاز" : "Notifications are enabled on this device")
              : (isAr ? "الإشعارات غير مفعّلة على هذا الجهاز" : "Notifications are not enabled on this device")}
          </p>
          {permission === "denied" && (
            <p className="text-destructive mt-1">
              {isAr ? "الإذن محظور من إعدادات المتصفح أو الجهاز." : "Permission is blocked in browser or device settings."}
            </p>
          )}
          {iosNeedsInstall && (
            <p className="text-amber-700 dark:text-amber-300 mt-1">
              {isAr ? "على iPhone: ثبّت حصاد على الشاشة الرئيسية قبل التفعيل." : "On iPhone: install Hasaad to the Home Screen before enabling."}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {!subscription ? (
          <Button onClick={enable} disabled={busy || permission === "denied"}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
            {isAr ? "تفعيل الإشعارات" : "Enable notifications"}
          </Button>
        ) : (
          <>
            <Button onClick={sendTest} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isAr ? "إرسال إشعار تجريبي" : "Send test notification"}
            </Button>
            <Button variant="outline" onClick={disable} disabled={busy}>
              <BellOff className="w-4 h-4" />
              {isAr ? "إيقاف على هذا الجهاز" : "Disable on this device"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}