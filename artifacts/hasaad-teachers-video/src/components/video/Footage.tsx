import { useContext, useEffect, useRef } from 'react';
import { VideoPausedContext } from '@/lib/video';

/** Scene-owned video: the preview pause button also freezes the screen recording. */
export function Footage({ file, className = '', style }: {
  file: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const paused = useContext(VideoPausedContext);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (paused) ref.current?.pause();
    else ref.current?.play().catch(() => {});
  }, [paused]);
  return (
    <video
      ref={ref}
      className={`footage ${className}`}
      style={style}
      src={`${import.meta.env.BASE_URL}video/${file}.mp4`}
      poster={`${import.meta.env.BASE_URL}video/posters/${file}.jpg`}
      autoPlay
      muted
      playsInline
      preload="auto"
    />
  );
}