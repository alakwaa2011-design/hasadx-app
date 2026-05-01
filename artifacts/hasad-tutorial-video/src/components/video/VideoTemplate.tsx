import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { TutorialFull } from './video_scenes/TutorialFull';

export const SCENE_DURATIONS: Record<string, number> = {
  tutorial: 47000,
  open: 10000,
  create: 18000,
  wameed: 18000,
  hack: 18000,
  close: 10000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  tutorial: TutorialFull,
  open: Scene1,
  create: Scene2,
  wameed: Scene3,
  hack: Scene4,
  close: Scene5,
};

const SCENE_ORDER = ['tutorial', 'open', 'create', 'wameed', 'hack', 'close'];

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const sceneIndex = Math.max(0, SCENE_ORDER.indexOf(baseSceneKey));

  // Hide the persistent brand layer during the opening and closing scenes,
  // because those scenes already feature the wordmark prominently.
  const showBrandLayer = baseSceneKey !== 'open' && baseSceneKey !== 'close';

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
      dir="rtl"
    >
      <AnimatePresence mode="wait">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      {/* PERSISTENT BRAND LAYER — lives outside <AnimatePresence> so it stays
          on screen across scene transitions, giving the piece a single
          continuous-film feel rather than five disconnected slides. */}
      <PersistentBrandLayer visible={showBrandLayer} sceneIndex={sceneIndex} />
    </div>
  );
}

function PersistentBrandLayer({
  visible,
  sceneIndex,
}: {
  visible: boolean;
  sceneIndex: number;
}) {
  // Scene-aware tint so the wordmark plays nicely with each scene's palette
  const tint =
    sceneIndex === 1
      ? 'text-emerald-700/70'
      : sceneIndex === 2
        ? 'text-white/80'
        : sceneIndex === 3
          ? 'text-emerald-400/80'
          : 'text-slate-700/60';

  return (
    <motion.div
      className="pointer-events-none absolute top-5 right-6 z-40 flex items-center gap-2"
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : -12,
      }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span
          className={`font-display text-2xl font-black tracking-tight ${tint}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          حصاد
        </span>
        <span className={`text-xs font-bold ${tint} opacity-80`}>·</span>
        <span className={`text-xs ${tint} opacity-80`}>تعليمي</span>
      </div>
    </motion.div>
  );
}
