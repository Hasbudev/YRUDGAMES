"use client";

import { useEffect, useState } from "react";

interface TimerBarProps {
  startedAt: number;
  timeLimitMs: number;
}

export function TimerBar({ startedAt, timeLimitMs }: TimerBarProps) {
  const [remainingMs, setRemainingMs] = useState(timeLimitMs);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      setRemainingMs(Math.max(0, timeLimitMs - elapsed));
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [startedAt, timeLimitMs]);

  const pct = Math.max(0, Math.min(100, (remainingMs / timeLimitMs) * 100));
  const urgent = remainingMs < 5000;

  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full border border-black/40 bg-void-deep shadow-inner">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${
            urgent
              ? "animate-pulse bg-gradient-to-r from-crimson to-crimson-bright shadow-[0_0_12px_rgba(217,88,74,0.8)]"
              : "bg-gradient-to-r from-gold-dim via-gold to-gold-bright shadow-[0_0_10px_rgba(232,193,90,0.6)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`w-9 text-right font-mono text-sm font-bold tabular-nums ${urgent ? "text-crimson-bright" : "text-gold-dim"}`}
      >
        {Math.ceil(remainingMs / 1000)}s
      </span>
    </div>
  );
}
