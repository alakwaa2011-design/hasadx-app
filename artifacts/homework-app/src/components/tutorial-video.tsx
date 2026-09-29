import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TutorialVideo = {
  title: string;
  description?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  language?: "ar" | "en";
};

type TutorialVideoButtonProps = TutorialVideo & {
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;

export function getTutorialYoutubeVideoId({ youtubeVideoId, youtubeUrl }: Pick<TutorialVideo, "youtubeVideoId" | "youtubeUrl">): string | null {
  if (youtubeVideoId) return VIDEO_ID.test(youtubeVideoId) ? youtubeVideoId : null;
  if (!youtubeUrl) return null;

  try {
    const url = new URL(youtubeUrl);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id: string | undefined | null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      id = url.pathname.match(/^\/([^/]+)\/?$/)?.[1];
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com", "www.youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      else if (/^\/(embed|shorts|live)\/[^/]+\/?$/.test(url.pathname)) id = url.pathname.split("/")[2];
    }
    return id && VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function TutorialVideoModal({
  title,
  description,
  youtubeVideoId,
  youtubeUrl,
  language = "ar",
  open,
  onOpenChange,
}: TutorialVideo & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = getTutorialYoutubeVideoId({ youtubeVideoId, youtubeUrl });
  const isAr = language === "ar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isAr ? "rtl" : "ltr"}
        closeLabel={isAr ? "إغلاق" : "Close"}
        className={`w-[calc(100vw-1.5rem)] max-w-3xl gap-0 overflow-hidden rounded-2xl border border-[#dce6dc] bg-[#fbfcf9] p-0 shadow-2xl sm:w-full ${isAr ? "[&>button]:right-auto [&>button]:left-4" : ""}`}
        data-testid="dialog-tutorial-video"
      >
        <DialogHeader className="border-b border-[#e5ebe2] px-5 py-4 text-start sm:px-6">
          <DialogTitle className="pe-7 text-start text-lg font-black text-[#1E4D35]" data-testid="title-tutorial-video">{title}</DialogTitle>
          <DialogDescription className="text-start text-sm text-[#5c6d61]" data-testid="description-tutorial-video">
            {description || (isAr ? "شرح خطوة بخطوة" : "Step-by-step guide")}
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 sm:p-5">
          {id ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-[#12281c] shadow-sm">
              {open && (
                <iframe
                  title={title}
                  src={`https://www.youtube-nocookie.com/embed/${id}`}
                  className="h-full w-full border-0"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  data-testid="iframe-tutorial-video"
                />
              )}
            </div>
          ) : (
            <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-700">
              {isAr ? "رابط فيديو الشرح غير صالح." : "The tutorial video link is invalid."}
            </p>
          )}
          {id && (
            <div className="mt-4 flex justify-start">
              <a
                href={`https://www.youtube.com/watch?v=${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d4ded3] bg-white px-3 py-2 text-xs font-bold text-[#1E4D35] transition-colors hover:bg-[#f1f6f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E4D35]"
                data-testid="link-tutorial-youtube"
              >
                {isAr ? "فتح في YouTube" : "Open in YouTube"}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TutorialVideoButton({
  title,
  description,
  youtubeVideoId,
  youtubeUrl,
  language = "ar",
  label,
  open,
  onOpenChange,
}: TutorialVideoButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const changeOpen = (nextOpen: boolean) => {
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => changeOpen(true)}
        className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-[#c7d9ca] bg-[#eff5ee] px-3 py-1.5 text-xs font-bold text-[#1E4D35] transition-colors hover:border-[#1E4D35] hover:bg-[#e4eee2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E4D35] dark:border-[#376149] dark:bg-[#17382a] dark:text-[#eaf4eb]"
        data-testid="button-tutorial-video"
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-[#D3AD5F]/20 text-[#ad853a]" aria-hidden="true">
          <Play className="h-2.5 w-2.5 fill-current" />
        </span>
        {label || (language === "ar" ? "شاهد الشرح" : "Watch tutorial")}
      </button>
      <TutorialVideoModal
        title={title}
        description={description}
        youtubeVideoId={youtubeVideoId}
        youtubeUrl={youtubeUrl}
        language={language}
        open={isOpen}
        onOpenChange={changeOpen}
      />
    </>
  );
}