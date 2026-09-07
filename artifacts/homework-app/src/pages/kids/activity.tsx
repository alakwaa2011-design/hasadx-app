import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  useKidsActivity, 
  useStartKidsSession, 
  useAttemptKidsSession, 
  useCompleteKidsSession 
} from "@/hooks/use-kids";
import { X, Check, Volume2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveKidsAsset } from "@/lib/kids-assets";

// --- Utility: Media Renderer ---
function MediaElement({ media, className }: { media?: { kind: string; assetKey: string; alt?: string }, className?: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const audioRef = useRef<HTMLAudioElement>(null);
  if (!media) return null;
  const src = resolveKidsAsset(media.assetKey);
  if (!src) return <div className={cn("flex items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-600", className)}>الأصل غير معتمد</div>;
  if (media.kind === "image") {
    return (
      <div className={cn("relative flex items-center justify-center overflow-hidden rounded-lg bg-slate-100", className)}>
        {status === "loading" && <span className="absolute text-xs text-slate-400">جاري تحميل الصورة...</span>}
        {status === "error" ? <span className="text-xs font-bold text-red-600">تعذر تحميل الصورة</span> : (
          <img src={src} alt={media.alt || "صورة تعليمية"} className="h-full w-full object-contain" onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />
        )}
      </div>
    );
  }
  if (media.kind === "audio") {
    return (
      <div className={cn("relative flex items-center justify-center rounded-full bg-sky-100 p-2", className)}>
        <audio ref={audioRef} src={src} preload="auto" onCanPlayThrough={() => setStatus("ready")} onError={() => setStatus("error")} />
        <button
          type="button"
          disabled={status === "loading"}
          onClick={(event) => {
            event.stopPropagation();
            if (status === "error") {
              setStatus("loading");
              audioRef.current?.load();
              return;
            }
            audioRef.current?.play().catch(() => setStatus("error"));
          }}
          className="flex h-full w-full items-center justify-center rounded-full text-sky-700 disabled:text-slate-400"
          aria-label={status === "error" ? "إعادة تحميل الصوت" : "تشغيل الصوت"}
        >
          {status === "loading" ? <span className="text-sm font-black">•••</span> : status === "error" ? <span className="text-xl font-black text-red-600">!</span> : <Volume2 className="h-8 w-8" />}
        </button>
        {status === "loading" && <span className="sr-only">جاري تحميل الصوت</span>}
        {status === "error" && <span className="sr-only">تعذر تحميل الصوت، اضغط للمحاولة مجددًا</span>}
      </div>
    );
  }
  return null;
}

// --- Renderers ---

function MatchingRenderer({ content, onAttempt, onComplete }: any) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  
  // Scramble right side
  const rightSide = useMemo(() => {
    return [...content.pairs].sort(() => Math.random() - 0.5);
  }, [content.pairs]);

  useEffect(() => {
    if (matchedPairs.size === content.pairs.length && content.pairs.length > 0) {
      onComplete();
    }
  }, [matchedPairs, content.pairs.length, onComplete]);

  const handleRightClick = (rightPair: any) => {
    if (!selectedLeft || matchedPairs.has(rightPair.id)) return;
    
    // Find the left pair
    const leftPair = content.pairs.find((p: any) => p.id === selectedLeft);
    if (!leftPair) return;

    // Check match
    const isCorrect = leftPair.id === rightPair.id;
    onAttempt(leftPair.id, rightPair.right); // Attempt with itemKey = leftPair.id, answer = rightPair.right

    if (isCorrect) {
      setMatchedPairs(prev => new Set(prev).add(leftPair.id));
      setSelectedLeft(null);
    } else {
      // Shake or visual feedback could be added here
      setSelectedLeft(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-8 p-4">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{content.instructions}</h2>
      
      <div className="flex justify-between w-full max-w-2xl gap-8">
        {/* Left Column */}
        <div className="flex flex-col gap-4 flex-1">
          {content.pairs.map((pair: any) => {
            const isMatched = matchedPairs.has(pair.id);
            const isSelected = selectedLeft === pair.id;
            return (
              <button
                key={`l-${pair.id}`}
                disabled={isMatched}
                onClick={() => setSelectedLeft(isSelected ? null : pair.id)}
                className={cn(
                  "p-6 rounded-2xl border-4 text-xl font-bold transition-all h-24 flex items-center justify-center gap-4",
                  isMatched ? "bg-slate-100 border-slate-200 text-slate-400 opacity-50" :
                  isSelected ? "bg-amber-100 border-amber-400 text-amber-700 scale-105" :
                  "bg-white border-slate-200 text-slate-700 hover:border-amber-300"
                )}
              >
                <MediaElement media={pair.leftMedia} className="w-12 h-12" />
                {pair.left}
              </button>
            );
          })}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4 flex-1">
          {rightSide.map((pair: any) => {
            const isMatched = matchedPairs.has(pair.id);
            return (
              <button
                key={`r-${pair.id}`}
                disabled={isMatched}
                onClick={() => handleRightClick(pair)}
                className={cn(
                  "p-6 rounded-2xl border-4 text-xl font-bold transition-all h-24 flex items-center justify-center gap-4",
                  isMatched ? "bg-emerald-50 border-emerald-200 text-emerald-500 opacity-50" :
                  "bg-white border-slate-200 text-slate-700 hover:border-emerald-300"
                )}
              >
                <MediaElement media={pair.rightMedia} className="w-12 h-12" />
                {pair.right}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TracingRenderer({ content, onAttempt, onComplete }: any) {
  const [completedStrokes, setCompletedStrokes] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Array<{ x: number; y: number }>>([]);
  const [drawing, setDrawing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("مرّر إصبعك فوق الخط المنقّط");
  const draftRef = useRef<Array<{ x: number; y: number }>>([]);
  const stroke = content.strokes.find((entry: any) => !completedStrokes.has(entry.id));
  const normalizedPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };
  const finish = async (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing || !stroke || checking) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrawing(false);
    const points = [...draftRef.current, normalizedPoint(event)];
    if (points.length < 5) {
      draftRef.current = [];
      setDraft([]);
      setMessage("ارسم الخط كاملًا، وليس نقرة واحدة");
      return;
    }
    setChecking(true);
    setMessage("لحظة... أراجع رسمك");
    try {
      const response = await onAttempt(stroke.id, "trace", points);
      if (response?.attempt?.is_correct) {
        const next = new Set(completedStrokes).add(stroke.id);
        setCompletedStrokes(next);
        setMessage(next.size === content.strokes.length ? "أحسنت!" : "رائع! انتقل إلى الخط التالي");
        if (next.size === content.strokes.length) onComplete();
      } else {
        setMessage("قريب جدًا! حاول واتبع الخط المنقّط");
      }
    } catch {
      setMessage("تعذّر فحص الرسم، حاول مرة أخرى");
    } finally {
      draftRef.current = [];
      setDraft([]);
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-8 p-4">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{content.instructions}</h2>
      <div className="relative aspect-square w-full max-w-[min(78vh,52rem)] overflow-hidden rounded-3xl border-4 border-slate-200 bg-white p-3 sm:p-5">
        <p className="mb-3 text-center text-sm font-bold text-slate-500">{message}</p>
        {stroke ? (
          <svg
            viewBox="0 0 100 100"
            className="h-[calc(100%-2rem)] w-full touch-none rounded-2xl bg-sky-50"
            aria-label="مساحة رسم الحرف"
            onPointerDown={(event) => {
              if (checking) return;
              const point = normalizedPoint(event);
              event.currentTarget.setPointerCapture(event.pointerId);
              draftRef.current = [point];
              setDrawing(true);
              setDraft([point]);
            }}
            onPointerMove={(event) => {
              if (!drawing || checking) return;
              const point = normalizedPoint(event);
              setDraft((points) => {
                const previous = points[points.length - 1];
                if (points.length >= 300 || (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.008)) return points;
                const next = [...points, point];
                draftRef.current = next;
                return next;
              });
            }}
            onPointerUp={finish}
            onPointerCancel={() => { setDrawing(false); draftRef.current = []; setDraft([]); }}
          >
            <polyline points={stroke.points.map((point: any) => `${point.x * 100},${point.y * 100}`).join(" ")} fill="none" stroke="#94a3b8" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 3" />
            <polyline points={draft.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} fill="none" stroke="#0ea5e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : <div className="flex h-64 items-center justify-center"><Check className="h-20 w-20 text-emerald-500" /></div>}
      </div>
    </div>
  );
}

function MediaChoiceRenderer({ content, onAttempt, onComplete }: any) {
  const handleChoice = (choice: any) => {
    onAttempt(choice.id, choice.id); 
    if (choice.isCorrect) {
      setTimeout(onComplete, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-8 p-4">
      <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">{content.prompt}</h2>
      {content.promptMedia && <MediaElement media={content.promptMedia} className="w-32 h-32 mb-4" />}
      
      <div className="flex flex-wrap justify-center gap-6">
        {content.choices.map((choice: any) => (
          <button
            key={choice.id}
            onClick={() => handleChoice(choice)}
            className="flex flex-col items-center gap-4 p-6 bg-white border-4 border-slate-200 rounded-3xl hover:border-amber-400 hover:scale-105 transition-all w-48 active:scale-95"
          >
            <MediaElement media={choice.media} className="w-24 h-24" />
            <span className="text-xl font-bold text-slate-700">{choice.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CountingRenderer({ content, onAttempt, onComplete }: any) {
  const handleChoice = (num: number) => {
    // Send attempt with a generic itemKey since items aren't mapped to choices 1:1
    onAttempt(content.items[0]?.id || "count", num.toString());
    if (num === content.correctCount) {
      setTimeout(onComplete, 1000);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-8 p-4">
      <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">{content.prompt}</h2>
      
      <div className="flex flex-wrap justify-center gap-4 mb-8 max-w-3xl">
        {content.items.map((item: any, i: number) => (
          <div key={item.id + i} className="w-20 h-20 bg-white border-4 border-slate-200 rounded-2xl flex flex-col items-center justify-center animate-in zoom-in" style={{ animationDelay: `${i * 100}ms` }}>
            <MediaElement media={item.media} className="w-10 h-10" />
            {item.label && <span className="text-xs font-bold mt-1 text-slate-600">{item.label}</span>}
          </div>
        ))}
      </div>
      
      <div className="flex gap-4">
        {content.choices.map((num: number) => (
          <button
            key={num}
            onClick={() => handleChoice(num)}
            className="w-20 h-20 bg-amber-100 border-4 border-amber-400 text-amber-700 rounded-2xl text-3xl font-black hover:bg-amber-200 hover:scale-105 active:scale-95 transition-all"
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}

function OrderingPuzzleRenderer({ content, onAttempt, onComplete }: any) {
  const [order, setOrder] = useState<any[]>([]);
  
  const shuffledPieces = useMemo(() => {
    return [...content.pieces].sort(() => Math.random() - 0.5);
  }, [content.pieces]);

  const [available, setAvailable] = useState<any[]>(shuffledPieces);

  useEffect(() => {
    if (order.length === content.pieces.length && content.pieces.length > 0) {
      const isPerfect = order.every((p, i) => p.correctPosition === i);
      if (isPerfect) onComplete();
    }
  }, [order, content.pieces.length, onComplete]);

  const placePiece = (piece: any) => {
    const pos = order.length;
    onAttempt(piece.id, pos.toString());
    setOrder([...order, piece]);
    setAvailable(available.filter(p => p.id !== piece.id));
  };

  const removeLast = () => {
    if (order.length === 0) return;
    const piece = order[order.length - 1];
    setAvailable([...available, piece]);
    setOrder(order.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-8 p-4">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">{content.prompt}</h2>
      
      <div className="flex flex-wrap justify-center gap-2 min-h-24 p-4 bg-slate-100 rounded-3xl w-full max-w-4xl border-4 border-dashed border-slate-300">
        {order.map((piece: any, i: number) => (
          <div key={piece.id} className="p-4 bg-emerald-100 border-4 border-emerald-400 text-emerald-800 font-bold rounded-2xl text-xl animate-in zoom-in">
            {piece.label}
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-4">
        <Button variant="outline" onClick={removeLast} disabled={order.length === 0}>تراجع</Button>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
        {available.map((piece: any) => (
          <button
            key={piece.id}
            onClick={() => placePiece(piece)}
            className="p-4 bg-white border-4 border-slate-200 text-slate-700 font-bold rounded-2xl text-xl hover:border-amber-400 hover:scale-105 active:scale-95 transition-all"
          >
            {piece.label}
          </button>
        ))}
      </div>
    </div>
  );
}


// --- Main Component ---

export default function KidsActivityPage() {
  const [, params] = useRoute("/kids/activity/:id");
  const [, setLocation] = useLocation();
  const { data: activity } = useKidsActivity(params?.id || "");
  const startSession = useStartKidsSession();
  const attemptSession = useAttemptKidsSession();
  const completeSession = useCompleteKidsSession();

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const pendingAttempts = useRef(new Set<Promise<unknown>>());
  const completionStarted = useRef(false);
  const startRequested = useRef(false);

  useEffect(() => {
    if (activity && !sessionId && !startRequested.current) {
      startRequested.current = true;
      startSession.mutate({ activityId: activity.id, idempotencyKey }, {
        onSuccess: (data) => setSessionId(data.session.id)
      });
    }
  }, [activity, sessionId, idempotencyKey, startSession]);

  if (!activity) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Star className="h-12 w-12 text-amber-400 animate-spin" />
      </div>
    );
  }

  const handleAttempt = (itemKey: string, answer: string, tracePoints?: Array<{ x: number; y: number }>) => {
    if (!sessionId) return Promise.resolve();
    const request = attemptSession.mutateAsync({
      sessionId, 
      idempotencyKey: crypto.randomUUID(), 
      itemKey, 
      answer,
      tracePoints,
      exampleId: activity.content?.exampleId
    });
    pendingAttempts.current.add(request);
    void request.finally(() => pendingAttempts.current.delete(request));
    return request;
  };

  const handleComplete = async () => {
    if (!sessionId || completionStarted.current) return;
    completionStarted.current = true;
    setIsSuccess(true);
    await Promise.allSettled([...pendingAttempts.current]);
    completeSession.mutate({ sessionId }, {
      onSuccess: () => {
        setTimeout(() => {
          setLocation(`/kids/activity/${activity.id}/complete`);
        }, 1500);
      },
      onError: () => {
        completionStarted.current = false;
        setIsSuccess(false);
      },
    });
  };

  const Renderer = 
    activity.activity_type === "tracing" ? TracingRenderer :
    activity.activity_type === "matching" ? MatchingRenderer :
    activity.activity_type === "media_choice" ? MediaChoiceRenderer :
    activity.activity_type === "counting" ? CountingRenderer :
    activity.activity_type === "ordering_puzzle" ? OrderingPuzzleRenderer :
    () => <div>نشاط غير مدعوم</div>;
  const activityImage = resolveKidsAsset(activity.asset_key);

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col font-sans" dir="rtl">
      {/* Activity Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => setLocation("/kids/adventure")}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-3">
          {activityImage && <img src={activityImage} alt="" className="h-10 w-10 rounded-xl object-cover" />}
          <h1 className="font-bold text-slate-800 dark:text-white">{activity.title_ar}</h1>
        </div>

        <div className="w-12 h-12"></div> {/* Spacer */}
      </header>

      {/* Activity Content */}
      <main className="flex-1 overflow-y-auto relative">
        {isSuccess ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-500/10 backdrop-blur-sm z-10 animate-in fade-in">
            <div className="w-32 h-32 bg-emerald-400 rounded-full flex items-center justify-center shadow-xl animate-bounce">
              <Check className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-3xl font-black text-emerald-600 mt-8">أحسنت!</h2>
          </div>
        ) : null}

        {!sessionId ? (
          <div className="flex h-full items-center justify-center">
            <Star className="h-12 w-12 text-amber-400 animate-spin" />
          </div>
        ) : (
          <Renderer content={activity.content} onAttempt={handleAttempt} onComplete={handleComplete} />
        )}
      </main>
    </div>
  );
}
