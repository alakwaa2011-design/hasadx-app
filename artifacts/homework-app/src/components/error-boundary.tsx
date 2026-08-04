import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Link } from "wouter";

interface Props {
  children: ReactNode;
  /** Optional friendly label for the failing area, e.g. "تحدي حصاد". */
  label?: string;
  /**
   * Optional cleanup callback fired before the user tries again — useful for
   * games that persist state to localStorage and may have stored a bad shape.
   */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/** Returns true if the error is a Vite/browser chunk-load failure (stale deploy). */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("unable to preload css") ||
    (error.name === "TypeError" && msg.includes("import"))
  );
}

const RELOAD_KEY = "eb_chunk_reload";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (typeof window !== "undefined") {
      console.error("[ErrorBoundary]", this.props.label ?? "", error, info);

      // Auto-reload once on chunk load errors (stale deploy).
      // Guard against infinite loops with a sessionStorage flag.
      if (isChunkLoadError(error)) {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return;
        }
      }
    }
  }

  handleRetry = () => {
    // Clear the reload guard so a manual retry can trigger auto-reload again.
    sessionStorage.removeItem(RELOAD_KEY);
    try {
      this.props.onReset?.();
    } catch {
      /* ignore reset errors */
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label ?? "هذه الصفحة";
    const message = error.message || "خطأ غير متوقع";
    const isChunk = isChunkLoadError(error);

    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background:
            "radial-gradient(ellipse at top, #064e3b 0%, #022c22 60%, #000 100%)",
        }}
      >
        <div className="w-full max-w-lg rounded-3xl p-8 border-2 border-amber-400/30 bg-black/40 backdrop-blur-md text-white text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-300" />
          </div>
          <h2 className="text-2xl font-extrabold mb-2 text-amber-100">
            {isChunk ? "تحديث جديد متاح" : `حدث خطأ في ${label}`}
          </h2>
          <p className="text-white/70 mb-1 text-sm">
            {isChunk
              ? "تم تحديث المنصة. اضغط على إعادة التحميل لتفتح النسخة الجديدة."
              : "لا تقلق — بياناتك الأخرى آمنة. جرّب إعادة المحاولة، وإن استمرت المشكلة عُد للصفحة الرئيسية."}
          </p>
          {!isChunk && (
            <div className="mt-3 mb-5 px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200/90 text-xs font-mono break-all text-start">
              {message}
            </div>
          )}
          <div className="flex flex-wrap gap-3 justify-center mt-5">
            <button
              onClick={() => {
                sessionStorage.removeItem(RELOAD_KEY);
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {isChunk ? "إعادة التحميل" : "إعادة المحاولة"}
            </button>
            {!isChunk && (
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
              >
                <Home className="w-4 h-4" />
                الصفحة الرئيسية
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }
}
