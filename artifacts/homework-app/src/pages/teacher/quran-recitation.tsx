import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  getGetQuranSurahContentQueryKey,
  getGetCurrentTeacherQueryKey,
  transcribeQuranRecitationPartial,
  useGetCurrentTeacher,
  useGetQuranSurahContent,
} from '@workspace/api-client-react';
import { Loader2, Mic, Pause, Square, Check, ChevronRight, ChevronLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import {
  alignQuranRecitationChunk,
  confirmQuranMismatch,
  concatPcm,
  downsamplePcm,
  encodePcmWav,
  normalizeQuranWord,
} from '@/lib/quran-live-recitation';

type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'completed' | 'error';

function getApiErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const candidate = error as { status?: unknown; response?: { status?: unknown } };
    const status = candidate.status ?? candidate.response?.status;
    return typeof status === 'number' ? status : null;
}

export default function QuranRecitation() {
    const { lang, dir } = useI18n();
    const params = useParams<{ surahNumber: string }>();
    const [, setLocation] = useLocation();
    
    const surahNumber = parseInt(params.surahNumber || '1', 10);
    const searchParams = new URLSearchParams(window.location.search);
    const ayahNumber = parseInt(searchParams.get('ayah') || '1', 10);
    
    const isStudent = window.location.pathname.startsWith('/student');
    const basePath = isStudent ? '/student/dashboard' : '/teacher/quran-center?tab=mushaf';
    const teacherSession = useGetCurrentTeacher({
        query: {
            queryKey: getGetCurrentTeacherQueryKey(),
            retry: false,
        },
    });
    
    const { data: surah, isLoading } = useGetQuranSurahContent(surahNumber, {
        query: {
            enabled: !isNaN(surahNumber),
            queryKey: getGetQuranSurahContentQueryKey(surahNumber),
        }
    });
    
    const ayah = surah?.ayahs.find(a => a.index === ayahNumber);
    const targetAyahText = ayah?.text || '';
    
    const targetWordsRaw = useMemo(() => targetAyahText ? targetAyahText.split(/\s+/) : [], [targetAyahText]);
    const targetWordsMemo = useMemo(() => targetWordsRaw.map(normalizeQuranWord), [targetWordsRaw]);
    const targetWordsRef = useRef<string[]>([]);
    
    useEffect(() => {
        targetWordsRef.current = targetWordsMemo;
    }, [targetWordsMemo]);
    
    const [state, setState] = useState<RecorderState>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [expectedIndex, setExpectedIndex] = useState(0);
    
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; }, [state]);
    
    const expectedIndexRef = useRef(expectedIndex);
    useEffect(() => { expectedIndexRef.current = expectedIndex; }, [expectedIndex]);
    
    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const gainRef = useRef<GainNode | null>(null);
    
    const pendingPcmChunks = useRef<Float32Array[]>([]);
    const pendingPcmLength = useRef(0);
    const overlapPcm = useRef(new Float32Array(0));
    const isSending = useRef(false);
    
    const mismatchCountRef = useRef(0);
    const lastMismatchKeyRef = useRef<string | null>(null);
    const networkErrorCountRef = useRef(0);
    
    const cleanupAudio = useCallback(() => {
        if (processorRef.current) processorRef.current.disconnect();
        if (sourceRef.current) sourceRef.current.disconnect();
        if (gainRef.current) gainRef.current.disconnect();
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close().catch(() => {});
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        audioCtxRef.current = null;
        streamRef.current = null;
        processorRef.current = null;
        sourceRef.current = null;
        gainRef.current = null;
    }, []);

    useEffect(() => {
        setExpectedIndex(0);
        setState('idle');
        cleanupAudio();
        pendingPcmChunks.current = [];
        pendingPcmLength.current = 0;
        overlapPcm.current = new Float32Array(0);
        isSending.current = false;
        mismatchCountRef.current = 0;
        lastMismatchKeyRef.current = null;
        networkErrorCountRef.current = 0;
    }, [surahNumber, ayahNumber, cleanupAudio]);
    
    const stopRecording = useCallback(() => {
        cleanupAudio();
        setState('idle');
    }, [cleanupAudio]);
    
    const completeRecording = useCallback(() => {
        cleanupAudio();
        setState('completed');
    }, [cleanupAudio]);

    const failRecording = useCallback((message: string) => {
        cleanupAudio();
        setErrorMsg(message);
        setState('error');
    }, [cleanupAudio]);

    const playGentleCue = () => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
            
            setTimeout(() => ctx.close(), 1000);
        } catch(e) {
            // ignore audio cue failure
        }
    };
    
    const startRecording = async () => {
        try {
            setState('requesting');
            setErrorMsg('');
            
            pendingPcmChunks.current = [];
            pendingPcmLength.current = 0;
            overlapPcm.current = new Float32Array(0);
            mismatchCountRef.current = 0;
            lastMismatchKeyRef.current = null;
            networkErrorCountRef.current = 0;

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Microphone capture is not supported');
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;
            
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
                if (stateRef.current !== 'recording') return;
                const input = e.inputBuffer.getChannelData(0);
                const chunk = new Float32Array(input.length);
                chunk.set(input);
                pendingPcmChunks.current.push(chunk);
                pendingPcmLength.current += chunk.length;
            };
            
            const gainNode = audioCtx.createGain();
            gainNode.gain.value = 0;
            gainRef.current = gainNode;
            
            source.connect(processor);
            processor.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            setState('recording');
        } catch (err) {
            failRecording(lang === 'ar' ? 'تعذر الوصول إلى الميكروفون. يرجى التحقق من الصلاحيات.' : 'Microphone access denied.');
        }
    };
    
    const pauseRecording = () => {
        audioCtxRef.current?.suspend();
        setState('paused');
    };
    
    const resumeRecording = () => {
        audioCtxRef.current?.resume();
        setState('recording');
    };
    
    const nextAyah = () => {
        if (surah && ayahNumber < surah.ayahs.length) {
            setLocation(`${isStudent ? '/student' : '/teacher'}/quran-recitation/${surahNumber}?ayah=${ayahNumber + 1}`);
        } else if (surahNumber < 114) {
            setLocation(`${isStudent ? '/student' : '/teacher'}/quran-recitation/${surahNumber + 1}?ayah=1`);
        } else {
            toast.success(lang === 'ar' ? 'تم ختم السورة!' : 'Surah completed!');
            setLocation(basePath);
        }
    };
    
    useEffect(() => {
        if (state !== 'recording') return;
        
        const interval = setInterval(async () => {
            if (isSending.current) return;
            if (!targetAyahText) return;
            
            const sampleRate = audioCtxRef.current?.sampleRate || 16000;
            
            if (pendingPcmLength.current < sampleRate * 0.8) return; 
            
            isSending.current = true;

            const freshPcm = concatPcm(pendingPcmChunks.current);
            pendingPcmChunks.current = [];
            pendingPcmLength.current = 0;
            const pcm = concatPcm([overlapPcm.current, freshPcm]);
            const overlapFrames = Math.floor(sampleRate * 0.4);
            overlapPcm.current = freshPcm.slice(Math.max(0, freshPcm.length - overlapFrames));
            const normalizedPcm = downsamplePcm(pcm, sampleRate, 16_000);
            const wavBlob = encodePcmWav(normalizedPcm, Math.min(sampleRate, 16_000));
            
            try {
                const data = await transcribeQuranRecitationPartial({
                    audio: wavBlob,
                    surahNumber,
                    ayahNumber,
                });
                networkErrorCountRef.current = 0;
                
                if (Array.isArray(data.words)) {
                    const recognizedWords = data.words.flatMap((recognized) =>
                        recognized.word
                            .split(/\s+/)
                            .map((word) => ({ word, confidence: recognized.confidence })),
                    );
                    const targetWords = targetWordsRef.current;
                    const alignment = alignQuranRecitationChunk(
                        targetWords,
                        expectedIndexRef.current,
                        recognizedWords,
                    );

                    if (alignment.madeProgress) {
                        setExpectedIndex(alignment.nextExpectedIndex);
                        mismatchCountRef.current = 0;
                        lastMismatchKeyRef.current = null;
                        if (alignment.nextExpectedIndex === targetWords.length) {
                            completeRecording();
                        }
                    } else if (alignment.mismatchKey) {
                        const confirmation = confirmQuranMismatch(
                            lastMismatchKeyRef.current,
                            mismatchCountRef.current,
                            alignment.mismatchKey,
                        );
                        lastMismatchKeyRef.current = confirmation.mismatchKey;
                        mismatchCountRef.current = confirmation.count;
                        if (confirmation.shouldAlert) {
                            playGentleCue();
                        }
                    } else {
                        mismatchCountRef.current = 0;
                        lastMismatchKeyRef.current = null;
                    }
                }
                
            } catch (err) {
                const status = getApiErrorStatus(err);
                if (status === 502 || status === 503) {
                    failRecording(lang === 'ar'
                        ? 'خدمة التسميع متوقفة مؤقتًا. حاول مرة أخرى لاحقًا.'
                        : 'The recitation service is temporarily unavailable. Please try again later.');
                } else if (status === 401) {
                    failRecording(lang === 'ar'
                        ? 'انتهت جلسة الدخول. سجّل الدخول ثم حاول مجددًا.'
                        : 'Your session has expired. Sign in and try again.');
                } else if (status === 400 || status === 413) {
                    failRecording(lang === 'ar'
                        ? 'تعذر قبول المقطع الصوتي. أعد المحاولة بصوت واضح.'
                        : 'The audio chunk was not accepted. Please try again clearly.');
                } else if (status !== 429) {
                    networkErrorCountRef.current++;
                    if (networkErrorCountRef.current >= 3) {
                        failRecording(lang === 'ar'
                            ? 'تعذر الاتصال بالخادم. تحقق من الشبكة ثم حاول مجددًا.'
                            : 'Could not reach the server. Check your connection and try again.');
                    }
                }
            } finally {
                isSending.current = false;
            }
        }, 2000); 
        
        return () => clearInterval(interval);
    }, [state, targetAyahText, surahNumber, ayahNumber, completeRecording, failRecording, lang]);

    if (isLoading) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] dark:bg-[#0a0c0b]">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
            </div>
        );
    }

    if (teacherSession.isPending) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] dark:bg-[#0a0c0b]">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
            </div>
        );
    }
    
    if (!isLoading && !ayah) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] dark:bg-[#0a0c0b]" dir={dir}>
                <div className="text-center">
                    <p className="text-emerald-900 dark:text-emerald-100 font-bold mb-4">
                        {lang === 'ar' ? 'الآية غير موجودة' : 'Ayah not found'}
                    </p>
                    <button 
                        onClick={() => setLocation(basePath)} 
                        className="bg-emerald-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-emerald-700 transition-colors"
                    >
                        {lang === 'ar' ? 'العودة' : 'Go Back'}
                    </button>
                </div>
            </div>
        );
    }

    if (!teacherSession.isSuccess) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfaf8] p-6 dark:bg-[#0a0c0b]" dir={dir}>
                <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm dark:border-amber-900 dark:bg-card">
                    <AlertCircle className="mx-auto mb-4 h-9 w-9 text-amber-600" />
                    <h1 className="font-black text-foreground">
                        {lang === 'ar' ? 'التسميع المباشر قيد التحقق' : 'Live recitation is under evaluation'}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {lang === 'ar'
                            ? 'لن نرسل صوت الطالب إلى خدمة خارجية قبل اكتمال اختبار الدقة والخصوصية والترخيص.'
                            : 'Student audio will not be sent to an external service until accuracy, privacy, and licensing checks are complete.'}
                    </p>
                    <button onClick={() => setLocation(basePath)} className="mt-5 rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white">
                        {lang === 'ar' ? 'العودة' : 'Go back'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-[100dvh] font-sans bg-[#fcfaf8] dark:bg-[#0a0c0b] transition-colors duration-300" dir={dir}>
            <header className="sticky top-0 z-40 shrink-0 border-b border-border/40 bg-[#fcfaf8]/95 dark:bg-[#0a0c0b]/95 shadow-sm backdrop-blur-xl">
                <div className="flex h-14 items-center justify-between px-4">
                    <button 
                        onClick={() => setLocation(basePath)}
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 transition-colors"
                        title={lang === 'ar' ? 'العودة' : 'Back'}
                    >
                        <ChevronRight className="h-6 w-6 rtl:hidden" />
                        <ChevronLeft className="h-6 w-6 ltr:hidden" />
                    </button>
                    <div className="text-center">
                        <h1 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                            {surah?.name || ''}
                        </h1>
                        <span className="text-xs font-medium text-emerald-700/70 dark:text-emerald-400/70">
                            {lang === 'ar' ? `آية ${ayahNumber}` : `Ayah ${ayahNumber}`}
                        </span>
                    </div>
                    <div className="w-10" /> 
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
                <div className="max-w-3xl w-full mx-auto flex flex-col items-center">
                    
                    <div 
                        className="text-center text-4xl md:text-5xl lg:text-6xl font-bold leading-[2.5]" 
                        style={{ wordSpacing: '0.1em' }}
                        dir="rtl"
                    >
                        {targetWordsRaw.map((word, i) => {
                            const isConcealed = i >= expectedIndex;
                            const isCurrent = i === expectedIndex;
                            return (
                                <span 
                                    key={i} 
                                    className={cn(
                                        "inline-block rounded px-2 mx-1 transition-all duration-500 select-none",
                                        isConcealed 
                                            ? "opacity-20 blur-[6px] bg-emerald-900/5 dark:bg-emerald-100/5 text-transparent" 
                                            : "text-emerald-950 dark:text-emerald-50",
                                        isCurrent && state === 'recording'
                                            ? "ring-2 ring-emerald-500/40 blur-[2px] opacity-60 bg-emerald-500/5"
                                            : ""
                                    )}
                                >
                                    {word}
                                </span>
                            );
                        })}
                        <span className="inline-flex items-center justify-center mx-3 h-[1.8em] w-[1.8em] rounded-full border border-emerald-700/30 text-[0.4em] text-emerald-800 dark:text-emerald-200 align-middle">
                            <span className="opacity-80 font-sans">{ayahNumber}</span>
                        </span>
                    </div>
                    
                    <div className="mt-16 h-32 flex items-center justify-center w-full">
                        {state === 'idle' && (
                            <button 
                                onClick={startRecording}
                                className="flex flex-col items-center gap-3 text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors group"
                            >
                                <div className="bg-emerald-100 dark:bg-emerald-900/40 p-6 rounded-full group-hover:scale-110 transition-transform shadow-sm">
                                    <Mic className="h-8 w-8" />
                                </div>
                                <span className="font-bold">{lang === 'ar' ? 'ابدأ التسميع' : 'Start Recitation'}</span>
                            </button>
                        )}
                        
                        {state === 'requesting' && (
                            <div className="flex flex-col items-center gap-3 text-emerald-700/60 dark:text-emerald-400/60">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="font-medium text-sm">
                                    {lang === 'ar' ? 'جاري طلب إذن الميكروفون...' : 'Requesting microphone access...'}
                                </span>
                            </div>
                        )}

                        {state === 'recording' && (
                            <div className="flex items-center gap-6 animate-in fade-in zoom-in duration-300">
                                <button 
                                    onClick={pauseRecording}
                                    className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 p-4 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors shadow-sm"
                                    title={lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
                                >
                                    <Pause className="h-6 w-6" />
                                </button>
                                
                                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 shadow-inner">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30"></span>
                                    <Mic className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                                </div>
                                
                                <button 
                                    onClick={stopRecording}
                                    className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 p-4 rounded-full hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors shadow-sm"
                                    title={lang === 'ar' ? 'إنهاء' : 'Stop'}
                                >
                                    <Square className="h-6 w-6" />
                                </button>
                            </div>
                        )}

                        {state === 'paused' && (
                            <div className="flex items-center gap-6 animate-in fade-in zoom-in duration-300">
                                <button 
                                    onClick={resumeRecording}
                                    className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 p-4 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors shadow-sm"
                                    title={lang === 'ar' ? 'متابعة' : 'Resume'}
                                >
                                    <Mic className="h-6 w-6" />
                                </button>
                                
                                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 dark:bg-muted/10 shadow-inner">
                                    <Pause className="h-8 w-8 text-muted-foreground" />
                                </div>
                                
                                <button 
                                    onClick={stopRecording}
                                    className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 p-4 rounded-full hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors shadow-sm"
                                    title={lang === 'ar' ? 'إنهاء' : 'Stop'}
                                >
                                    <Square className="h-6 w-6" />
                                </button>
                            </div>
                        )}

                        {state === 'completed' && (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 p-4 rounded-full shadow-sm">
                                    <Check className="h-8 w-8" />
                                </div>
                                <p className="text-emerald-700 dark:text-emerald-400 font-bold text-lg">
                                    {lang === 'ar' ? 'أحسنت! اكتملت الآية' : 'Excellent! Ayah completed'}
                                </p>
                                <button 
                                    onClick={nextAyah}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold shadow-md transition-colors"
                                >
                                    {lang === 'ar' ? 'الآية التالية' : 'Next Ayah'}
                                </button>
                            </div>
                        )}
                        
                        {state === 'error' && (
                            <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in">
                                <div className="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 p-4 rounded-full shadow-sm">
                                    <AlertCircle className="h-8 w-8" />
                                </div>
                                <p className="text-rose-700 dark:text-rose-400 font-bold max-w-xs text-center leading-relaxed">
                                    {errorMsg}
                                </p>
                                <button 
                                    onClick={() => setState('idle')}
                                    className="mt-2 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-full font-bold shadow-md transition-colors"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    {lang === 'ar' ? 'حاول مرة أخرى' : 'Try Again'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
