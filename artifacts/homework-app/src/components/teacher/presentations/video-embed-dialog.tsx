/**
 * VideoEmbedDialog — paste a YouTube or Hasaad interactive video URL
 * and insert a video-embed element on the active slide.
 *
 * Supported inputs:
 *   • YouTube: https://www.youtube.com/watch?v=…  |  https://youtu.be/…
 *              https://www.youtube.com/shorts/…
 *   • Hasaad interactive video: /video/:id  or  /student/video-lesson/:id
 */
import { useState } from "react";
import type { SlideElement } from "@workspace/api-client-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseVideoUrl } from "@/lib/video-url";
import { Video, Youtube, AlertCircle, Info } from "lucide-react";

const BRAND_GREEN = "#225739";
const CANVAS_W = 1280;
const CANVAS_H = 720;

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function VideoEmbedDialog({
  open,
  onClose,
  onInsert,
  isAr,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (el: SlideElement) => void;
  isAr: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const dir = isAr ? "rtl" : "ltr";

  const parsed = parseVideoUrl(url);

  function handleClose() {
    setUrl("");
    setError("");
    onClose();
  }

  function handleInsert() {
    const result = parseVideoUrl(url.trim());
    if (!result) {
      setError(
        isAr
          ? "الرابط غير معروف. أدخل رابط يوتيوب أو رابط فيديو تفاعلي من حصاد."
          : "Unrecognized URL. Enter a YouTube or Hasaad interactive video link.",
      );
      return;
    }
    const W = 640;
    const H = 360;
    const el: SlideElement = {
      id: genId("vid"),
      kind: "video-embed",
      url: url.trim(),
      videoKind: result.kind,
      videoId: result.videoId,
      title: result.kind === "hasad-video"
        ? (isAr ? "فيديو تفاعلي" : "Interactive Video")
        : undefined,
      x: Math.round((CANVAS_W - W) / 2),
      y: Math.round((CANVAS_H - H) / 2),
      w: W,
      h: H,
    } as SlideElement;
    onInsert(el);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-2xl" dir={dir}>
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-base font-bold flex items-center gap-2" style={{ color: BRAND_GREEN }}>
            <Video className="w-5 h-5" />
            {isAr ? "إدراج فيديو" : "Insert Video"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              {isAr ? "رابط الفيديو" : "Video URL"}
            </label>
            <Input
              dir="ltr"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleInsert(); }}
              placeholder="https://www.youtube.com/watch?v=… أو /video/123"
              className="text-sm font-mono"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          {parsed?.kind === "youtube" && parsed.thumbnailUrl && (
            <div className="rounded-xl overflow-hidden border border-border shadow-sm relative">
              <img
                src={parsed.thumbnailUrl}
                alt="YouTube thumbnail"
                className="w-full aspect-video object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-red-600 rounded-full p-2 shadow-lg">
                  <Youtube className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded font-bold">
                YouTube
              </div>
            </div>
          )}

          {parsed?.kind === "hasad-video" && (
            <div
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: `${BRAND_GREEN}10`, border: `1.5px solid ${BRAND_GREEN}30` }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: BRAND_GREEN }}
              >
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm" style={{ color: BRAND_GREEN }}>
                  {isAr ? "فيديو تفاعلي من حصاد" : "Hasaad Interactive Video"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr ? `درس رقم ${parsed.videoId}` : `Lesson ID: ${parsed.videoId}`}
                </p>
              </div>
            </div>
          )}

          <div
            className="rounded-xl p-3 flex gap-2"
            style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
          >
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {isAr
                ? "يمكنك إدراج فيديو من يوتيوب أو فيديو تفاعلي من منصة حصاد. ارسم للطلاب رابط الفيديو التفاعلي من صفحة الدروس لتظهر له الأسئلة تلقائياً أثناء المشاهدة."
                : "Paste a YouTube link or a Hasaad interactive video lesson link. Hasaad interactive videos show questions to students at the right timestamps while they watch."}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-muted/20">
          <Button variant="outline" size="sm" onClick={handleClose} className="rounded-lg">
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            size="sm"
            disabled={!parsed}
            onClick={handleInsert}
            className="gap-2 rounded-lg font-bold"
            style={{ background: BRAND_GREEN, color: "white" }}
          >
            <Video className="w-4 h-4" />
            {isAr ? "أضف الفيديو" : "Insert Video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
