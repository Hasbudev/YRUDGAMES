"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BattleCommandsProps {
  canSwitch: boolean;
  switchMode: boolean;
  onToggleSwitch: () => void;
  onForfeit: () => void;
}

export function BattleCommands({ canSwitch, switchMode, onToggleSwitch, onForfeit }: BattleCommandsProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onToggleSwitch}
        disabled={!canSwitch}
        title="Changer de Pokémon"
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          switchMode ? "border-purple bg-purple/20" : "border-border hover:border-border-strong"
        }`}
      >
        <Image src="/fight/action-icon-switch.png" alt="" width={78} height={46} className="h-5 w-auto" />
        Changer de Pokémon
      </button>
      <button
        type="button"
        onClick={() => {
          if (armed) {
            onForfeit();
            setArmed(false);
          } else {
            setArmed(true);
          }
        }}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
          armed ? "border-crimson-bright bg-crimson/20 text-crimson-bright" : "border-border text-ink-muted hover:border-crimson/50 hover:text-crimson-bright"
        }`}
      >
        <Image src="/fight/action-icon-run.png" alt="" width={64} height={46} className="h-5 w-auto" />
        {armed ? "Confirmer l'abandon ?" : "Abandonner"}
      </button>
    </div>
  );
}
