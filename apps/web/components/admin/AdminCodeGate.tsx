"use client";

import { useState } from "react";
import Image from "next/image";

interface AdminCodeGateProps {
  onUnlock: (code: string) => void;
  error?: string | null;
  busy?: boolean;
}

export function AdminCodeGate({ onUnlock, error, busy }: AdminCodeGateProps) {
  const [value, setValue] = useState("");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Image src="/sprites/yrud.png" alt="" width={71} height={100} style={{ imageRendering: "pixelated" }} />
      <h1 className="font-display text-xl font-semibold text-gold-bright">Panneau d&apos;administration de Yrud</h1>
      <div className="panel-ornate flex w-full max-w-sm flex-col gap-3 rounded-2xl p-6">
        <label className="text-sm text-ink-muted">
          Code d&apos;accès
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value && onUnlock(value)}
            className="mt-1 w-full rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
            autoFocus
          />
        </label>
        <button
          onClick={() => onUnlock(value)}
          disabled={!value || busy}
          className="btn-gold w-full"
        >
          Déverrouiller
        </button>
        {error && <p className="text-sm text-crimson-bright">{error}</p>}
      </div>
    </div>
  );
}
