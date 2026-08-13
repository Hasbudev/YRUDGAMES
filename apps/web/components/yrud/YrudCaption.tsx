"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface YrudCaptionProps {
  message: string;
  captionKey: number;
  durationMs?: number;
}

export function YrudCaption({ message, captionKey, durationMs = 4200 }: YrudCaptionProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!captionKey) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [captionKey, durationMs]);

  if (!visible) return null;

  return (
    <div
      key={captionKey}
      className="pointer-events-none fixed bottom-4 left-4 z-40 flex max-w-xs items-end gap-2 sm:bottom-6 sm:left-6"
      style={{ animation: "caption-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-gold bg-void-deep shadow-[0_0_16px_rgba(232,193,90,0.35)]">
        <Image
          src="/sprites/yrud.png"
          alt=""
          width={142}
          height={200}
          className="h-full w-auto scale-150 translate-y-1"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="panel rounded-xl rounded-bl-sm px-3 py-2 text-xs font-medium text-ink shadow-lg">{message}</div>
    </div>
  );
}
