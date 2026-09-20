import { useEffect, useState, useCallback } from "react";

export type InstallPlatform = "native" | "ios-safari" | "ios-inapp" | "unsupported" | "installed";

const COOLDOWN_KEY = "quran_install_dismissed_until";
const COOLDOWN_DAYS = 30;

export function useQuranInstallCooldown() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    try {
      const dismissedUntil = localStorage.getItem(COOLDOWN_KEY);
      if (dismissedUntil && parseInt(dismissedUntil, 10) > Date.now()) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      const until = Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(COOLDOWN_KEY, until.toString());
      setIsDismissed(true);
    } catch {}
  }, []);

  return { isDismissed, dismiss };
}

export function useQuranInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>("unsupported");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      (typeof window.matchMedia === "function"
        && window.matchMedia("(display-mode: standalone)").matches) ||
      (window.navigator as any).standalone || 
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setPlatform("installed");
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);

    const isAlternateIOSBrowser = /crios|fxios|opios|edgios/.test(ua);
    const isIOSSafari = isIOS && /safari/.test(ua) && !isAlternateIOSBrowser;
    // iOS webviews often omit their host app name entirely. Any iOS context
    // that is not Safari needs the same "open in Safari first" guidance.
    const isIOSInApp = isIOS && !isIOSSafari;

    if (isIOSInApp) {
      setPlatform("ios-inapp");
    } else if (isIOSSafari) {
      setPlatform("ios-safari");
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform("native");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    const handleAppInstalled = () => {
      setPlatform("installed");
      setDeferredPrompt(null);
    };
    
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
        }
        return outcome;
      } catch {
        return null;
      }
    }
    return null;
  }, [deferredPrompt]);

  return { 
    platform, 
    promptInstall, 
    isInstallable: platform !== "unsupported" && platform !== "installed" 
  };
}
