import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assessPersonalVerse,
  emptyQuranPersonalState,
  masteredTodayInPlan,
  nextPersonalMemorization,
  personalDueReviews,
  readQuranPersonalState,
  validPersonalPlan,
  verseOrdinal,
  type QuranPersonalPlan,
  type QuranPersonalState,
  type QuranPracticeSession,
  type QuranVerseRef,
} from "./quran-personal-plan";

function initialState(storageKey: string | null): { key: string | null; state: QuranPersonalState; error: boolean } {
  if (!storageKey) return { key: null, state: emptyQuranPersonalState(), error: false };
  try {
    return { key: storageKey, state: readQuranPersonalState(storageKey), error: false };
  } catch {
    return { key: storageKey, state: emptyQuranPersonalState(), error: true };
  }
}

const EMPTY_STATE = emptyQuranPersonalState();

export function useQuranPersonalPlan(storageKey: string | null) {
  const [snapshot, setSnapshot] = useState(() => initialState(storageKey));
  const latest = useRef(snapshot);
  const enabled = storageKey !== null && snapshot.key === storageKey;
  const state = enabled ? snapshot.state : EMPTY_STATE;
  const error = enabled && snapshot.error;

  useEffect(() => {
    const next = initialState(storageKey);
    latest.current = next;
    setSnapshot(next);
  }, [storageKey]);

  const write = useCallback((update: (previous: QuranPersonalState) => QuranPersonalState): boolean => {
    if (!storageKey || latest.current.key !== storageKey) return false;
    try {
      // Re-read before each write: an unreadable record must never be overwritten
      // by a blank state, and another tab may have saved assessments since mount.
      const next = update(readQuranPersonalState(storageKey));
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      const saved = { key: storageKey, state: next, error: false };
      latest.current = saved;
      setSnapshot(saved);
      return true;
    } catch {
      const failed = { ...latest.current, error: true };
      latest.current = failed;
      setSnapshot(failed);
      return false;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      try {
        const current = initialState(storageKey);
        latest.current = current;
        setSnapshot(current);
      } catch {
        const failed = { ...latest.current, error: true };
        latest.current = failed;
        setSnapshot(failed);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

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
  const nextNow = useCallback(() => nextPersonalMemorization(latest.current.state), []);
  const completedTodayNow = useCallback(() => masteredTodayInPlan(latest.current.state), []);

  return {
    plan: state.plan,
    session: state.session,
    due,
    next,
    completedToday,
    error,
    enabled,
    savePlan,
    clearPlan,
    saveSession,
    assess,
    nextNow,
    completedTodayNow,
  };
}