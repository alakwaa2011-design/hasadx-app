import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const TITLES = ['الافتتاح', 'ورقة العمل', 'الخريطة الذهنية', 'لعبة وميض', 'حصاد'];
const format = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function PlaybackProgress({ keys, activeIndex, activeDuration, activeStartTime, totalDuration, tick, paused, jump }: {
  keys: string[]; activeIndex: number; activeDuration: number; activeStartTime: number;
  totalDuration: number; tick: number; paused: boolean; jump: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBase = useRef(0);
  useEffect(() => { setElapsed(0); elapsedBase.current = 0; }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const timer = window.setInterval(() => setElapsed(elapsedBase.current + performance.now() - start), 60);
    return () => { clearInterval(timer); elapsedBase.current += performance.now() - start; };
  }, [tick, paused]);
  return (
    <>
      <div className="preview-progress">
        {keys.map((key, i) => (
          <button key={key} aria-label={`المشهد ${i + 1}: ${TITLES[i]}`} onClick={() => jump(i)}>
            {i === activeIndex && <span style={{ width: `${Math.min(100, elapsed / activeDuration * 100)}%` }} />}
          </button>
        ))}
      </div>
      <span className="preview-time">{activeIndex + 1}/{keys.length} · {format(Math.min(totalDuration, activeStartTime + elapsed))}/{format(totalDuration)}</span>
    </>
  );
}

interface ControlsProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
}

function PreviewWithControls({ audioRef, muted, onMutedChange }: ControlsProps) {
  const controls = useSceneControls(SCENE_DURATIONS);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controls.paused) return;
    const frozen = document.getAnimations().filter(animation => animation.playState === 'running');
    frozen.forEach(animation => animation.pause());
    return () => frozen.forEach(animation => animation.play());
  }, [controls.paused]);
  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const outside = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && sensor.current && !sensor.current.contains(event.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [collapsed, tapPinned]);

  const jump = useCallback((index: number) => {
    controls.jumpTo(index);
    window.parent.postMessage({
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index, sceneCount: controls.keys.length, sceneTitle: TITLES[index],
        filePath: `src/components/video/video_scenes/Scene${index}.tsx`, lineNumber: 1,
      },
    }, '*');
  }, [controls]);
  const visible = !collapsed || hovering || tapPinned;
  return (
    <div className="preview-shell">
      <VideoTemplate key={controls.mountKey} durations={controls.durations} paused={controls.paused} muted={muted} audioRef={audioRef} onSceneChange={controls.onSceneChange} />
      <div ref={sensor} className="preview-sensor"
        onPointerEnter={e => e.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={e => e.pointerType === 'mouse' && setHovering(false)}
        onPointerDown={e => e.pointerType !== 'mouse' && collapsed && setTapPinned(true)}
      >
        <div className="preview-sensor-space" />
        <div className={`preview-controls ${visible ? 'visible' : 'hidden'}`}>
          <button aria-label={controls.paused ? 'تشغيل' : 'إيقاف مؤقت'} onClick={controls.togglePause}>{controls.paused ? <Play /> : <Pause />}</button>
          <button aria-label="تكرار المشهد" aria-pressed={controls.locked} onClick={controls.toggleLock}><Repeat /></button>
          <button aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={() => { onMutedChange(!muted); audioRef.current?.play().catch(() => {}); }}>{muted ? <VolumeX /> : <Volume2 />}</button>
          <PlaybackProgress keys={controls.keys} activeIndex={controls.activeIndex} activeDuration={controls.activeDuration} activeStartTime={controls.activeStartTime} totalDuration={controls.totalDuration} tick={controls.tick} paused={controls.paused} jump={jump} />
          <button aria-label={collapsed ? 'إظهار التحكم' : 'إخفاء التحكم'} onClick={() => { setCollapsed(value => !value); setTapPinned(false); setHovering(false); }}>{collapsed ? <ChevronUp /> : <ChevronDown />}</button>
        </div>
      </div>
    </div>
  );
}

export default function VideoWithControls(props: ControlsProps) {
  return typeof window !== 'undefined' && window.self !== window.top ? <PreviewWithControls {...props} /> : <VideoTemplate audioRef={props.audioRef} />;
}