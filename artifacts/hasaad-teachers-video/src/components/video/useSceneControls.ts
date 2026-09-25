import { useCallback, useMemo, useState } from 'react';

function rotateFromIndex(durations: Record<string, number>, start: number): Record<string, number> {
  const keys = Object.keys(durations);
  if (start <= 0) return durations;
  return Object.fromEntries(keys.map((_, i) => {
    const key = keys[(start + i) % keys.length];
    return [key, durations[key]];
  }));
}

export function useSceneControls(base: Record<string, number>) {
  const keys = useMemo(() => Object.keys(base), [base]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const [tick, setTick] = useState(0);
  const durations = useMemo(() => {
    if (locked) {
      const key = keys[activeIndex];
      return { [`${key}_r1`]: base[key], [`${key}_r2`]: base[key] };
    }
    return rotateFromIndex(base, activeIndex);
  }, [locked, activeIndex, base, keys]);
  const activeStartTime = keys.slice(0, activeIndex).reduce((sum, key) => sum + base[key], 0);
  const totalDuration = keys.reduce((sum, key) => sum + base[key], 0);
  const onSceneChange = useCallback((rawKey: string) => {
    const index = keys.indexOf(rawKey.replace(/_r[12]$/, ''));
    if (index >= 0) setActiveIndex(index);
    setTick(t => t + 1);
  }, [keys]);
  const jumpTo = useCallback((index: number) => {
    setActiveIndex(index);
    setPaused(false);
    setMountKey(value => value + 1);
    setTick(value => value + 1);
  }, []);
  const toggleLock = useCallback(() => {
    setLocked(value => !value);
    setPaused(false);
    setMountKey(value => value + 1);
    setTick(value => value + 1);
  }, []);
  const pause = useCallback(() => setPaused(true), []);
  const togglePause = useCallback(() => setPaused(value => !value), []);
  return {
    keys, activeIndex, locked, paused, mountKey, tick, durations,
    activeDuration: base[keys[activeIndex]] ?? 0,
    activeStartTime, totalDuration, onSceneChange, jumpTo, toggleLock,
    pause, togglePause,
  };
}