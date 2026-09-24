import { useEffect, useRef, type RefObject } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import './film.css';

export const SCENE_DURATIONS = {
  scene0: 3800,
  scene1: 7100,
  scene2: 6000,
  scene3: 7100,
  scene4: 5500,
  scene5: 4000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';
const SCENES: Record<string, React.ComponentType> = { scene0: Scene0, scene1: Scene1, scene2: Scene2, scene3: Scene3, scene4: Scene4, scene5: Scene5 };
const SCENE_START_SEC: Record<string, number> = Object.fromEntries(
  Object.keys(SCENE_DURATIONS).map((key, index, keys) => [
    key,
    keys.slice(0, index).reduce((total, previous) => total + SCENE_DURATIONS[previous as keyof typeof SCENE_DURATIONS], 0) / 1000,
  ]),
);

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  audioRef,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onSceneChange?: (sceneKey: string) => void;
}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const baseKey = currentSceneKey.replace(/_r[12]$/, '');
  const Scene = SCENES[baseKey];
  const previousKey = useRef<string | null>(null);

  useEffect(() => { onSceneChange?.(currentSceneKey); }, [currentSceneKey, onSceneChange]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.9;
    if (paused) {
      audio.pause();
      return;
    }
    if (previousKey.current !== currentSceneKey) {
      previousKey.current = currentSceneKey;
      // The composite starts with a silent preroll so browser audio is already
      // advancing when the recording clock starts at its first visible frame.
      const target = 2 + (SCENE_START_SEC[baseKey] ?? 0);
      if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    }
    audio.play().catch(() => { /* User activation may be required in a browser preview. */ });
  }, [baseKey, currentSceneKey, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} className="film-canvas" dir="rtl">
        <AnimatePresence mode="sync">
          {Scene && <Scene key={currentSceneKey} />}
        </AnimatePresence>
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}