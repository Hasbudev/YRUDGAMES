"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface OrnateScrollAreaProps {
  maxHeight: string;
  children: ReactNode;
  className?: string;
  // For content that streams in (a live log): keep pinned to the newest
  // entry as it arrives, but only while the reader is already at/near the
  // bottom — if they've scrolled up to read history, new entries shouldn't
  // yank the view away from them.
  autoScrollToBottom?: boolean;
}

// Native scrollbars look wildly out of place against the illustrated chrome
// everywhere else on these pages — this tracks scroll position ourselves and
// draws a small gold rail/thumb instead, with the real scrollbar hidden via
// .scrollbar-hidden. A bottom fade (mask-image) hints "more below" instead of
// hard-clipping mid-card when the list overflows.
export function OrnateScrollArea({ maxHeight, children, className, autoScrollToBottom }: OrnateScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(null);
  const wasNearBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Thumb geometry needs recomputing whenever content or box size changes,
    // but must NOT touch wasNearBottom here — at this point scrollHeight
    // already reflects newly-added content while scrollTop hasn't moved yet,
    // so "distance to bottom" would read as "far" the instant a big enough
    // chunk of new content lands, even if the reader was genuinely at the
    // bottom right before it arrived. wasNearBottom is only ever updated by
    // the real 'scroll' event below, which fires on genuine position changes
    // (user scrolling, or our own auto-scroll), never on a content resize.
    function updateThumb() {
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

    function handleScroll() {
      const node = el;
      if (!node) return;
      const { scrollTop, scrollHeight, clientHeight } = node;
      wasNearBottom.current = scrollHeight - (scrollTop + clientHeight) < 24;
      updateThumb();
    }

    updateThumb();
    el.addEventListener("scroll", handleScroll);
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      ro.disconnect();
    };
  }, [children]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollToBottom || !wasNearBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [children, autoScrollToBottom]);

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
