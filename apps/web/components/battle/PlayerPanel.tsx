import type { BattleSideSnapshot } from "@yrud/shared";
import { TeamGrid } from "./TeamGrid";
import { ActivePokemonCard } from "./ActivePokemonCard";

export function PlayerPanel({ side }: { side: BattleSideSnapshot }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <TeamGrid team={side.team} />
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-dim">Actif</p>
        <ActivePokemonCard active={side.active} />
      </div>
    </div>
  );
}
