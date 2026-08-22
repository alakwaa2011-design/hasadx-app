const LEMON_SCRIPT_ID = "hasad-lemon-squeezy";
const LEMON_SCRIPT_URL = "https://app.lemonsqueezy.com/js/lemon.js";

export type LemonSqueezyEvent = { event?: string; data?: unknown } | "close" | "mounted";

interface LemonSqueezyApi {
  Setup?: (options: { eventHandler?: (event: LemonSqueezyEvent) => void }) => void;
  Url?: {
    Open?: (url: string) => void;
  };
}

declare global {
  interface Window {
    LemonSqueezy?: LemonSqueezyApi;
    createLemonSqueezy?: () => void;
  }
}

let loader: Promise<LemonSqueezyApi> | null = null;
let isConfigured = false;
const eventListeners = new Set<(event: LemonSqueezyEvent) => void>();

function configure(api: LemonSqueezyApi): LemonSqueezyApi {
  if (!api.Url?.Open) {
    throw new Error("تعذر تهيئة نافذة الدفع الآمن.");
  }

  if (!isConfigured) {
    api.Setup?.({
      eventHandler: (event) => {
        eventListeners.forEach((listener) => listener(event));
      },
    });
    isConfigured = true;
  }

  return api;
}

/**
 * Loads Lemon.js from Lemon Squeezy's official CDN once for the whole SPA.
 * The script can be injected after page load, so we explicitly initialize it
 * before using the public LemonSqueezy.Url.Open API.
 */
export function loadLemonSqueezy(): Promise<LemonSqueezyApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("الدفع الآمن متاح من المتصفح فقط."));
  }

  if (loader) return loader;

  if (window.LemonSqueezy) {
    loader = Promise.resolve().then(() => configure(window.LemonSqueezy!));
    return loader;
  }

  loader = new Promise<LemonSqueezyApi>((resolve, reject) => {
    const existing = document.getElementById(LEMON_SCRIPT_ID) as HTMLScriptElement | null;
    // Only a load explicitly marked as failed may be replaced. A live script
    // is shared by the SPA rather than being injected a second time.
    if (existing?.dataset.hasadLemonState === "failed") existing.remove();
    const script = document.getElementById(LEMON_SCRIPT_ID) as HTMLScriptElement | null
      ?? document.createElement("script");
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const complete = () => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      try {
        window.createLemonSqueezy?.();
        script.dataset.hasadLemonState = "loaded";
        resolve(configure(window.LemonSqueezy!));
      } catch (error) {
        loader = null;
        reject(error instanceof Error ? error : new Error("تعذر تحميل نافذة الدفع الآمن."));
      }
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      script.dataset.hasadLemonState = "failed";
      loader = null;
      reject(new Error("تعذر تحميل نافذة الدفع الآمن. حاول مرة أخرى."));
    };

    script.addEventListener("load", complete, { once: true });
    script.addEventListener("error", fail, { once: true });

    if (!script.isConnected) {
      script.id = LEMON_SCRIPT_ID;
      script.dataset.hasadLemonState = "loading";
      script.src = LEMON_SCRIPT_URL;
      script.defer = true;
      document.head.appendChild(script);
    } else if (script.dataset.hasadLemonState === "loaded") {
      fail();
      return;
    }

    // This covers a third-party/legacy tag that was already inserted without
    // exposing LemonSqueezy. It fails visibly and can be retried safely.
    if (!settled) timeout = setTimeout(fail, 10_000);
  });

  return loader;
}

export function subscribeToLemonSqueezyEvents(
  listener: (event: LemonSqueezyEvent) => void,
): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

/** Opens the final server-provided checkout URL in Lemon Squeezy's official overlay. */
export async function openLemonSqueezyOverlay(checkoutUrl: string): Promise<void> {
  const lemon = await loadLemonSqueezy();
  lemon.Url?.Open?.(checkoutUrl);
}