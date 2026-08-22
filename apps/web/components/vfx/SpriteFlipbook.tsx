"use client";

import { useEffect, useState } from "react";

interface SpriteFlipbookProps {
  src: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  className?: string;
  onDone?: () => void;
}

// Plain CSS background-position stepping — simplest way to play a
// horizontal sprite-sheet flipbook (each frame is 1/frameCount of the
// sheet's width) without pulling in an animation library for a one-shot VFX.
export function SpriteFlipbook({ src, frameCount, frameWidth, frameHeight, fps = 18, className = "", onDone }: SpriteFlipbookProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => {
        const next = f + 1;
        if (next >= frameCount) {
          clearInterval(interval);
          onDone?.();
          return f;
        }
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return (
    <div
      className={`pointer-events-none bg-no-repeat ${className}`}
      style={{
        aspectRatio: `${frameWidth}/${frameHeight}`,
        backgroundImage: `url(${src})`,
        backgroundSize: `${frameCount * 100}% 100%`,
        backgroundPosition: `${(frame / (frameCount - 1)) * 100}% 0%`,
      }}
    />
  );
}
