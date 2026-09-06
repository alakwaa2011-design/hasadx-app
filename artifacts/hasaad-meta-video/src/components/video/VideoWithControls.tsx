import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const DETAILS = [
  ['الافتتاح', 'src/components/video/video_scenes/Scene0.tsx'],
  ['ذكاء المعلم', 'src/components/video/video_scenes/Scene1.tsx'],
  ['الألعاب', 'src/components/video/video_scenes/Scene2.tsx'],
  ['الخاتمة', 'src/components/video/video_scenes/Scene3.tsx'],
];

function time(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  if (!isIframed) return <VideoTemplate />;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedBase = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBase.current = 0;
  }, [controls.tick]);
  useEffect(() => {
    if (controls.paused) return;
    const started = performance.now();
    const id = window.setInterval(() => setElapsed(elapsedBase.current + performance.now() - started), 60);
    return () => {
      window.clearInterval(id);
      elapsedBase.current += performance.now() - started;
    };
  }, [controls.paused, controls.tick]);
  useEffect(() => {
    if (!controls.paused) return;
    const animations = document.getAnimations().filter(animation => animation.playState === 'running');
    animations.forEach(animation => animation.pause());
    return () => animations.forEach(animation => animation.play());
  }, [controls.paused]);

  const jumpTo = useCallback((index: number) => {
    controls.jumpTo(index);
    const [title, filePath] = DETAILS[index];
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: { sceneIndex: index, sceneCount: controls.sceneKeys.length, sceneTitle: title, filePath, lineNumber: 1 },
    }, '*');
  }, [controls]);

  const visible = !collapsed || hovering;
  const totalElapsed = Math.min(controls.totalDuration, controls.activeStartTime + Math.min(elapsed, controls.activeDuration));
  return (
    <div className="relative w-full h-screen">
      <VideoTemplate
        key={controls.mountKey}
        durations={controls.durations}
        paused={controls.paused}
        muted={muted}
        onSceneChange={controls.onSceneChange}
      />
      <div
        className="absolute bottom-0 inset-x-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={event => event.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={event => event.pointerType === 'mouse' && setHovering(false)}
      >
        <div className="flex-1" />
        <div className={`flex items-center gap-3 bg-black/55 backdrop-blur-md px-5 py-4 transition-all ${visible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <button onClick={controls.togglePause} className="w-14 h-14 grid place-items-center text-white rounded-lg hover:bg-white/10">{controls.paused ? <Play /> : <Pause />}</button>
          <button onClick={controls.toggleLock} className={`w-14 h-14 grid place-items-center text-white rounded-lg ${controls.locked ? 'bg-white/20' : 'hover:bg-white/10'}`}><Repeat /></button>
          <button onClick={() => setMuted(value => !value)} className="w-14 h-14 grid place-items-center text-white rounded-lg hover:bg-white/10">{muted ? <VolumeX /> : <Volume2 />}</button>
          <div className="w-px self-stretch bg-white/20" />
          <div className="flex-1 flex gap-2">
            {controls.sceneKeys.map((key, index) => (
              <button key={key} onClick={() => jumpTo(index)} className="relative flex-1 h-3 rounded-full bg-white/20 overflow-hidden">
                {index === controls.activeIndex && <span className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${Math.min(100, elapsed / controls.activeDuration * 100)}%` }} />}
              </button>
            ))}
          </div>
          <span className="text-white/70 text-lg tabular-nums">{controls.activeIndex + 1}/{controls.sceneKeys.length}</span>
          <span className="text-white/80 text-lg tabular-nums">{time(totalElapsed)} / {time(controls.totalDuration)}</span>
          <button onClick={() => setCollapsed(value => !value)} className="w-14 h-14 grid place-items-center text-white rounded-lg hover:bg-white/10">{collapsed ? <ChevronUp /> : <ChevronDown />}</button>
        </div>
      </div>
    </div>
  );
}