import type { BattleSideSnapshot, TeamSheetMember } from "@yrud/shared";
import { TeamGrid } from "./TeamGrid";
import { ActivePokemonCard } from "./ActivePokemonCard";
import { TeamSheetPanel } from "./TeamSheetPanel";

interface PlayerPanelProps {
  side: BattleSideSnapshot;
  // Only ever passed for the viewer's own side — the opponent's items/
  // abilities/EVs/IVs are never sent to this client in the first place.
  mySheet?: TeamSheetMember[];
}

export function PlayerPanel({ side, mySheet }: PlayerPanelProps) {
  return (
    <div className="flex w-full flex-col gap-3">
      <TeamGrid team={side.team} />
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-dim">Actif</p>
        <ActivePokemonCard active={side.active} />
      </div>
      {mySheet && <TeamSheetPanel sheet={mySheet} />}
    </div>
  );
}
