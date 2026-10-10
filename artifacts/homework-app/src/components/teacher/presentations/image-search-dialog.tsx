import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X as XIcon, ImagePlus, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ImageResult {
  url: string;
  thumbUrl: string;
  title: string;
  source: string;
}

export function ImageSearchDialog({
  open,
  onClose,
  onInsert,
  isAr,
  initialQuery,
  theme,
  mode = "search",
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
  isAr: boolean;
  initialQuery?: string;
  /** deck theme key, so a drawn picture matches the deck's identity */
  theme?: string;
  /** "generate" shows only the AI image generator; "search" is the web search with a generate shortcut */
  mode?: "search" | "generate";
}) {
  const [drawing, setDrawing] = useState(false);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [results, setResults] = useState<ImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dir = isAr ? "rtl" : "ltr";

  useEffect(() => {
    if (open) {
      setResults([]);
      setSelected(null);
      if (initialQuery) {
        setQuery(initialQuery);
        runSearch(initialQuery);
      } else {
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }, [open]);

  async function runSearch(q?: string) {
    const term = (q ?? query).trim();
    if (!term) return;
    setLoading(true);
    setResults([]);
    setSelected(null);
    try {
      const res = await fetch(`${API_BASE}/api/presentations/image-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: term, count: 12 }),
      });

      let payload: { results?: ImageResult[]; message?: string; code?: string } = {};
      try {
        payload = (await res.json()) as typeof payload;
      } catch {
        payload = {};
      }

      if (!res.ok) {
        console.error("[presentation-image-search] HTTP error", res.status, payload);
        if (res.status === 401 || res.status === 403) {
          toast.error(
            isAr
              ? "لا يمكن تنفيذ البحث: انتهت الجلسة أو لا تملك صلاحية المعلم. سجّل الدخول مجدداً."
              : "Cannot search: session expired or you lack teacher access.",
          );
        } else {
          toast.error(
            isAr
              ? "تعذّر الوصول إلى خدمة البحث عن الصور حالياً. تحقق من الاتصال بالإنترنت أو حاول بعد قليل."
              : "Image search is unavailable right now. Check your connection or try again shortly.",
          );
        }
        return;
      }

      const imgs = Array.isArray(payload.results) ? payload.results : [];
      setResults(imgs);
      if (!imgs.length) {
        toast.info(
          isAr ? "لم تُوجد صور لهذا البحث. جرّب كلمات أخرى أو استخدم مصطلحات بالإنجليزية." : "No images found — try other keywords or English terms.",
        );
      }
    } catch (e) {
      console.error("[presentation-image-search] network or parse error", e);
      toast.error(
        isAr
          ? "تعذّر الاتصال بالخادم أثناء البحث عن الصور. تحقق من الشبكة وحاول مرة أخرى."
          : "Could not reach the server while searching for images. Check your network and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

    async function drawImage() {
    const term = query.trim();
    if (!term || drawing) return;
    setDrawing(true);
    try {
      const res = await fetch(`${API_BASE}/api/presentations/image-generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: term, theme }),
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !payload.url) {
        const why = res.status === 404 ? (isAr ? "الخادم لم يُعد تشغيله بعد" : "server not restarted yet")
          : res.status === 402 ? (isAr ? "الرصيد غير كافٍ" : "not enough credits")
          : `HTTP ${res.status}`;
        toast.error(`${payload.message ?? (isAr ? "تعذّر رسم الصورة الآن." : "Could not draw the image right now.")} (${why})`);
        return;
      }
      const drawn: ImageResult = { url: payload.url, thumbUrl: payload.url, title: term, source: "AI" };
      setResults((prev) => [drawn, ...prev]);
      setSelected(payload.url);
    } catch {
      toast.error(isAr ? "تعذّر الاتصال بالخادم." : "Could not reach the server.");
    } finally {
      setDrawing(false);
    }
  }

  async function handleInsert() {
    if (!selected) return;
    setInserting(true);
    try {
      onInsert(selected);
      onClose();
    } finally {
      setInserting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl w-full"
        style={{ direction: dir, fontFamily: "'Tajawal', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold" style={{ color: "#225739" }}>
            {mode === "generate" ? (isAr ? "توليد صورة بالذكاء الاصطناعي" : "Generate an image with AI") : (isAr ? "البحث عن صورة من الإنترنت" : "Search images from the web")}
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              dir={dir}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder={mode === "generate" ? (isAr ? "صف الصورة التي تريدها... (مثال: قافلة جمال في الصحراء)" : "Describe the image you want...") : (isAr ? "ابحث عن صورة... (مثال: طبيعة، تعليم، علوم)" : "Search for an image... (e.g. nature, education, science)")}
              className="ps-9 rounded-xl"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setResults([]); setSelected(null); inputRef.current?.focus(); }}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          {mode !== "generate" && (<Button
            onClick={() => runSearch()}
            disabled={loading || !query.trim()}
            className="rounded-xl"
            style={{ background: "#225739" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ms-1.5 hidden sm:inline">{isAr ? "بحث" : "Search"}</span>
          </Button>)}
          <Button
            onClick={drawImage}
            disabled={drawing || !query.trim()}
            variant="outline"
            className="rounded-xl"
            title={isAr ? "يولّد الذكاء الاصطناعي صورة بهذا الوصف (يستهلك رصيدًا)" : "AI generates an image for this description (uses credits)"}
          >
            {drawing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="ms-1.5 hidden sm:inline">{isAr ? "صورة بالذكاء" : "AI image"}</span>
          </Button>
        </div>

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>{isAr ? "جارٍ البحث..." : "Searching..."}</span>
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-sm">{isAr ? "ابحث عن صورة لتراها هنا" : "Search for an image to see results here"}</p>
              <p className="text-xs opacity-60">{mode === "generate" ? (isAr ? "صف الصورة ثم اضغط «صورة بالذكاء» — يستهلك رصيد الذكاء الاصطناعي" : "Describe the image, then press AI image — uses AI credits") : (isAr ? "اكتب وصفًا ثم «بحث» لصور من الإنترنت، أو «صورة بالذكاء» ليولّدها الذكاء الاصطناعي" : "Type a description, then Search the web or generate it with AI")}</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
              {results.map((img) => {
                const isSelected = selected === img.url;
                return (
                  <button
                    key={img.url}
                    onClick={() => setSelected(isSelected ? null : img.url)}
                    className={`relative rounded-xl overflow-hidden aspect-video border-2 transition-all duration-150 group
                      ${isSelected ? "border-emerald-500 shadow-lg scale-[1.02]" : "border-transparent hover:border-emerald-300 hover:shadow-md"}`}
                    title={img.title}
                  >
                    <img
                      src={img.thumbUrl}
                      alt={img.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    {/* Overlay on hover */}
                    <div className={`absolute inset-0 bg-black/40 flex items-end p-1.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                      <p className="text-white text-[10px] leading-tight line-clamp-2 text-start">{img.title}</p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1.5 end-1.5 bg-emerald-500 rounded-full p-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">
            {selected
              ? (isAr ? "تم اختيار صورة — اضغط إضافة للإدراج" : "Image selected — press Insert to add")
              : (isAr ? "انقر على صورة لاختيارها" : "Click an image to select it")}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="rounded-xl h-9">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleInsert}
              disabled={!selected || inserting}
              className="rounded-xl h-9 gap-1.5"
              style={{ background: selected ? "#225739" : undefined }}
            >
              {inserting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ImagePlus className="w-4 h-4" />}
              {isAr ? "إضافة للشريحة" : "Insert into slide"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
