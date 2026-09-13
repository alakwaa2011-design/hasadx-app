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

const API_BASE = import.meta.env.VITE_API_URL || "";
const mutationVersions = new Map<number, number>();
const writeChains = new Map<number, Promise<void>>();

function enqueueServerWrite(userId: number, preferences: ScheduleCountdownPreferences, locale: "ar" | "en") {
  const chain = (writeChains.get(userId) || Promise.resolve())
    .catch(() => undefined)
    .then(() => saveServerPreferences(preferences, locale));
  writeChains.set(userId, chain);
  return chain;
}

export function useScheduleCountdownPreferences(userId?: number, locale: "ar" | "en" = "ar") {
  const storageKey = userId ? `hasaad_schedule_countdown_v1_${userId}` : null;
  const [preferences, setPreferences] = useState<ScheduleCountdownPreferences>(
    DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES,
  );

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    const versionAtLoad = mutationVersions.get(userId!) || 0;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as Partial<ScheduleCountdownPreferences>;
      const local: ScheduleCountdownPreferences = {
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
      };
      setPreferences(local);
      void fetch(`${API_BASE}/api/teacher/schedule/notification-preferences`, { credentials: "include" })
        .then(async (response) => response.ok ? response.json() : null)
        .then(async (remote) => {
          if (cancelled || (mutationVersions.get(userId!) || 0) !== versionAtLoad) return;
          if (remote?.exists) {
            setPreferences((current) => ({
              ...current,
              enabled: remote.enabled,
              alertMinutes: remote.alertMinutes,
              endAlertMinutes: remote.endAlertMinutes,
              soundEnabled: remote.soundEnabled,
            }));
          } else {
            await enqueueServerWrite(userId!, local, locale);
          }
        })
        .catch(() => undefined);
    } catch {
      setPreferences(DEFAULT_SCHEDULE_COUNTDOWN_PREFERENCES);
    }
    return () => { cancelled = true; };
  }, [storageKey, locale]);

  const updatePreferences = useCallback((patch: Partial<ScheduleCountdownPreferences>) => {
    if (userId) mutationVersions.set(userId, (mutationVersions.get(userId) || 0) + 1);
    setPreferences((current) => {
      const next = { ...current, ...patch };
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Keep the setting for this session when browser storage is unavailable.
        }
      }
      if (userId) void enqueueServerWrite(userId, next, locale).catch(() => undefined);
      return next;
    });
  }, [storageKey, locale, userId]);

  return { preferences, setPreferences, updatePreferences };
}

async function saveServerPreferences(preferences: ScheduleCountdownPreferences, locale: "ar" | "en") {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  await fetch(`${API_BASE}/api/teacher/schedule/notification-preferences`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enabled: preferences.enabled,
      alertMinutes: preferences.alertMinutes,
      endAlertMinutes: preferences.endAlertMinutes,
      soundEnabled: preferences.soundEnabled,
      locale,
      timezone,
    }),
  });
}