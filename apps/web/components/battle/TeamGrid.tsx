import type { BattleTeamMember } from "@yrud/shared";
import { TeamPokemonSlot } from "./TeamPokemonSlot";

export function TeamGrid({ team }: { team: BattleTeamMember[] }) {
  const slots = Array.from({ length: 6 }, (_, i) => team[i]);
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-dim">Équipe</p>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((member, i) => (
          <TeamPokemonSlot key={i} member={member} />
        ))}
      </div>
    </div>
  );
}
