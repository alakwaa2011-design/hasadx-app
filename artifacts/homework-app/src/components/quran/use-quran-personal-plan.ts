import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assessPersonalVerse,
  emptyQuranPersonalState,
  masteredTodayInPlan,
  nextPersonalMemorization,
  personalDueReviews,
  QURAN_PERSONAL_PLAN_KEY,
  readQuranPersonalState,
  validPersonalPlan,
  verseOrdinal,
  type QuranPersonalPlan,
  type QuranPersonalState,
  type QuranPracticeSession,
  type QuranVerseRef,
} from "./quran-personal-plan";

function initialState(enabled: boolean): { state: QuranPersonalState; error: boolean } {
  if (!enabled) return { state: emptyQuranPersonalState(), error: false };
  try {
    return { state: readQuranPersonalState(), error: false };
  } catch {
    return { state: emptyQuranPersonalState(), error: true };
  }
}

export function useQuranPersonalPlan(enabled: boolean) {
  const [initial] = useState(() => initialState(enabled));
  const [state, setState] = useState(initial.state);
  const [error, setError] = useState(initial.error);
  const latest = useRef(state);

  const write = useCallback((update: (previous: QuranPersonalState) => QuranPersonalState): boolean => {
    if (!enabled) return false;
    try {
      // Re-read before each write: an unreadable record must never be overwritten
      // by a blank state, and another tab may have saved assessments since mount.
      const next = update(readQuranPersonalState());
      window.localStorage.setItem(QURAN_PERSONAL_PLAN_KEY, JSON.stringify(next));
      latest.current = next;
      setState(next);
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== QURAN_PERSONAL_PLAN_KEY && event.key !== null) return;
      try {
        const current = readQuranPersonalState();
        latest.current = current;
        setState(current);
        setError(false);
      } catch {
        setError(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled]);

  const savePlan = useCallback((plan: QuranPersonalPlan) => {
    if (!validPersonalPlan(plan)) return false;
    return write((previous) => ({ ...previous, plan }));
  }, [write]);

  const clearPlan = useCallback(() => write((previous) => ({
    ...previous,
    plan: null,
    session: null,
    // Earlier self-assessments remain due even when the active plan changes.
  })), [write]);

  const saveSession = useCallback((session: QuranPracticeSession) => {
    if (verseOrdinal(session.verse) === null) return false;
    return write((previous) => ({ ...previous, session }));
  }, [write]);

  const assess = useCallback((verse: QuranVerseRef, result: "mastered" | "review") => {
    if (verseOrdinal(verse) === null) return false;
    return write((previous) => assessPersonalVerse(previous, verse, result));
  }, [write]);

  const due = useMemo(() => personalDueReviews(state), [state]);
  const next = useMemo(() => nextPersonalMemorization(state), [state]);
  const completedToday = useMemo(() => masteredTodayInPlan(state), [state]);
  const nextNow = useCallback(() => nextPersonalMemorization(latest.current), []);
  const completedTodayNow = useCallback(() => masteredTodayInPlan(latest.current), []);

  return {
    plan: state.plan,
    session: state.session,
    due,
    next,
    completedToday,
    error,
    savePlan,
    clearPlan,
    saveSession,
    assess,
    nextNow,
    completedTodayNow,
  };
}