"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface OrnateScrollAreaProps {
  maxHeight: string;
  children: ReactNode;
  className?: string;
}

// Native scrollbars look wildly out of place against the illustrated chrome
// everywhere else on these pages — this tracks scroll position ourselves and
// draws a small gold rail/thumb instead, with the real scrollbar hidden via
// .scrollbar-hidden. A bottom fade (mask-image) hints "more below" instead of
// hard-clipping mid-card when the list overflows.
export function OrnateScrollArea({ maxHeight, children, className }: OrnateScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function update() {
      const node = el;
      if (!node) return;
      const { scrollTop, scrollHeight, clientHeight } = node;
      if (scrollHeight <= clientHeight + 1) {
        setThumb(null);
        return;
      }
      const heightPct = Math.max((clientHeight / scrollHeight) * 100, 10);
      const topPct = (scrollTop / (scrollHeight - clientHeight)) * (100 - heightPct);
      setThumb({ top: topPct, height: heightPct });
    }

    update();
    el.addEventListener("scroll", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div className={`flex w-full gap-3 ${className ?? ""}`}>
      <div
        ref={scrollRef}
        className="scrollbar-hidden min-w-0 flex-1 overflow-y-auto"
        style={{
          maxHeight,
          maskImage: thumb ? "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)" : undefined,
          WebkitMaskImage: thumb ? "linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)" : undefined,
        }}
      >
        {children}
      </div>
      {thumb && (
        <div className="relative w-[5px] shrink-0 rounded-full bg-void-deep/70" style={{ maxHeight }}>
          <div
            className="absolute left-0 w-full rounded-full bg-gradient-to-b from-gold-bright to-gold shadow-[0_0_6px_rgba(232,193,90,0.55)]"
            style={{ top: `${thumb.top}%`, height: `${thumb.height}%` }}
          />
        </div>
      )}
    </div>
  );
}
