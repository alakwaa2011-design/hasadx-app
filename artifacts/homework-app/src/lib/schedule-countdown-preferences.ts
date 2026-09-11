import { useCallback, useEffect, useState } from "react";

export type ScheduleCountdownPreferences = {
  alertMinutes: number;
  soundEnabled: boolean;
  position: { x: number; y: number } | null;
};

export const DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES: ScheduleCountdownPreferences = {
  alertMinutes: 5,
  soundEnabled: false,
  position: null,
};

export function useScheduleCountdownPreferences(userId?: number) {
  const storageKey = userId ? `hasaad_schedule_countdown_v1_${userId}` : null;
  const [preferences, setPreferences] = useState<ScheduleCountdownPreferences>(
    DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES,
  );

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as Partial<ScheduleCountdownPreferences>;
      setPreferences({
        alertMinutes: Math.max(
          1,
          Math.min(120, Number(saved.alertMinutes) || DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES.alertMinutes),
        ),
        soundEnabled: Boolean(saved.soundEnabled),
        position: saved.position && Number.isFinite(saved.position.x) && Number.isFinite(saved.position.y)
          ? saved.position
          : null,
      });
    } catch {
      setPreferences(DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES);
    }
  }, [storageKey]);

  const updatePreferences = useCallback((patch: Partial<ScheduleCountdownPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...patch };
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Keep the setting for this session when browser storage is unavailable.
        }
      }
      return next;
    });
  }, [storageKey]);

  return { preferences, setPreferences, updatePreferences };
}