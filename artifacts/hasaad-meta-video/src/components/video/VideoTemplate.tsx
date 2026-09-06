import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { Scene0, Scene1, Scene2, Scene3 } from './video_scenes';

export const SCENE_DURATIONS = {
  scene0: 3500, // Intro
  scene1: 4500, // AI tools
  scene2: 4500, // Games
  scene3: 4000, // Outro
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  scene0: Scene0,
  scene1: Scene1,
  scene2: Scene2,
  scene3: Scene3,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const offsets: Record<string, number> = {};
  let elapsed = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    offsets[key] = elapsed / 1000;
    elapsed += duration;
  }
  return offsets;
})();

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const currentScene = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);

  useEffect(() => onSceneChange?.(currentSceneKey), [currentSceneKey, onSceneChange]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const target = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
      <VideoCanvas
        aspectRatio={VIDEO_ASPECT_RATIO}
        style={{ backgroundColor: 'var(--brand-green-dark)' }}
      >
      {/* Background Layer: Persistent elements */}
      {/* Animated gradient mesh background */}
      <motion.div
        className="absolute inset-0 z-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 50%, var(--brand-green) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: currentScene === 1 ? '10vw' : currentScene === 2 ? '-10vw' : '0vw',
          y: currentScene === 1 ? '10vh' : currentScene === 2 ? '5vh' : '0vh',
        }}
        transition={{ duration: 6, ease: "easeInOut", repeat: Infinity }}
      />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-10"
           style={{
             backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }}
      />

      {/* Persistent floating particles */}
      <motion.div
        className="absolute top-[20%] left-[15%] w-32 h-32 rounded-full blur-[60px] z-0"
        style={{ backgroundColor: 'var(--brand-gold)' }}
        animate={{
          x: currentScene === 1 ? '-20vw' : currentScene === 2 ? '30vw' : '0vw',
          y: currentScene === 1 ? '30vh' : currentScene === 2 ? '40vh' : '0vh',
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
      />
      
      <motion.div
        className="absolute bottom-[20%] right-[10%] w-48 h-48 rounded-full blur-[80px] z-0"
        style={{ backgroundColor: 'var(--brand-green-light)' }}
        animate={{
          x: currentScene === 1 ? '20vw' : currentScene === 2 ? '-20vw' : '0vw',
          y: currentScene === 1 ? '-20vh' : currentScene === 2 ? '10vh' : '0vh',
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ duration: 7, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Foreground Layer: Scenes */}
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
        <audio
          ref={audioRef}
          src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
          preload="auto"
          autoPlay
          muted={muted}
        />
      </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
