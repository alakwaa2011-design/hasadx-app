import { useCallback, useEffect, useState } from "react";

export type ScheduleCountdownPreferences = {
  enabled: boolean;
  alertMinutes: number;
  endAlertMinutes: number;
  soundEnabled: boolean;
  soundId: "chime" | "wood" | "breeze";
  position: { x: number; y: number } | null;
};

export const DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES: ScheduleCountdownPreferences = {
  enabled: true,
  alertMinutes: 5,
  endAlertMinutes: 5,
  soundEnabled: false,
  soundId: "chime",
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
        enabled: saved.enabled !== false,
        alertMinutes: Math.max(
          1,
          Math.min(120, Number(saved.alertMinutes) || DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES.alertMinutes),
        ),
        endAlertMinutes: Math.max(
          0,
          Math.min(120, Number(saved.endAlertMinutes ?? DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES.endAlertMinutes)),
        ),
        soundEnabled: Boolean(saved.soundEnabled),
        soundId: saved.soundId === "wood" || saved.soundId === "breeze" ? saved.soundId : "chime",
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