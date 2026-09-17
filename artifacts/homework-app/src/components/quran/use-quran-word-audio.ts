import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export function useQuranWordAudio() {
  const { lang } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestTokenRef = useRef(0);
  const [activeWordKey, setActiveWordKey] = useState<string | null>(null);
  const [loadingWordKey, setLoadingWordKey] = useState<string | null>(null);

  const stopWordAudio = useCallback(() => {
    requestTokenRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    audioRef.current = null;
    setActiveWordKey(null);
    setLoadingWordKey(null);
  }, []);

  const playWord = useCallback((
    surahNumber: number,
    ayahNumber: number,
    wordPosition: number,
  ) => {
    const wordKey = `${surahNumber}:${ayahNumber}:${wordPosition}`;
    if (activeWordKey === wordKey || loadingWordKey === wordKey) {
      stopWordAudio();
      return;
    }

    stopWordAudio();
    const token = requestTokenRef.current;
    const audio = new Audio(
      `/api/quran/audio/word/${surahNumber}/${ayahNumber}/${wordPosition}`,
    );
    audio.preload = "auto";
    audioRef.current = audio;
    setActiveWordKey(wordKey);
    setLoadingWordKey(wordKey);

    let reportedFailure = false;
    const fail = () => {
      if (token !== requestTokenRef.current) return;
      audioRef.current = null;
      setActiveWordKey(null);
      setLoadingWordKey(null);
      if (!reportedFailure) {
        reportedFailure = true;
        toast.error(lang === "ar"
          ? "تعذر تشغيل نطق هذه الكلمة"
          : "Could not play this word");
      }
    };
    audio.onplaying = () => {
      if (token === requestTokenRef.current) setLoadingWordKey(null);
    };
    audio.onended = () => {
      if (token !== requestTokenRef.current) return;
      audioRef.current = null;
      setActiveWordKey(null);
      setLoadingWordKey(null);
    };
    audio.onerror = fail;
    void audio.play().catch(fail);
  }, [activeWordKey, lang, loadingWordKey, stopWordAudio]);

  useEffect(() => stopWordAudio, [stopWordAudio]);

  return { activeWordKey, loadingWordKey, playWord, stopWordAudio };
}