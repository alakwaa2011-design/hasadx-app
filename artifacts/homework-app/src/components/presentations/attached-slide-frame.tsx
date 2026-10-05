import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Fit the printed slide AND its attached controls, not the viewport letterbox. */
export function AttachedSlideFrame({
  header, footer, children,
}: {
  header?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const availableRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const available = availableRef.current;
    const top = headerRef.current;
    const bottom = footerRef.current;
    if (!available || !top || !bottom) return;
    const measure = () => {
      const height = Math.max(0, available.clientHeight - top.offsetHeight - bottom.offsetHeight - 4);
      const next = Math.min(available.clientWidth, height * 16 / 9 + 4);
      if (next > 0) setWidth(previous => previous !== undefined && Math.abs(previous - next) < 0.5 ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    [available, top, bottom].forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="absolute inset-3 flex items-center justify-center" ref={availableRef}>
      <section
        data-presentation-frame=""
        className="relative flex w-full shrink-0 flex-col overflow-hidden rounded-xl border-2 border-amber-400/60 bg-slate-900 shadow-2xl"
        style={{ width }}
      >
        <div ref={headerRef} data-slide-actions="">
          {header}
        </div>
        <div data-presentation-surface="" className="relative aspect-video w-full overflow-hidden bg-black">
          {children}
        </div>
        <div ref={footerRef} data-slide-navigation="">
          {footer}
        </div>
      </section>
    </div>
  );
}
