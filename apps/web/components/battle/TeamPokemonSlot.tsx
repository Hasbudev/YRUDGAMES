import Image from "next/image";
import type { BattleTeamMember } from "@yrud/shared";
import { HPBar } from "./HPBar";
import { StatusDot } from "./StatusBadge";

function spriteUrl(species: string) {
  return `https://play.pokemonshowdown.com/sprites/xyani/${species.toLowerCase().replace(/[^a-z0-9]/g, "")}.gif`;
}

interface TeamPokemonSlotProps {
  member?: BattleTeamMember;
}

export function TeamPokemonSlot({ member }: TeamPokemonSlotProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative aspect-[63/48] w-full">
        <Image
          src={member?.isActive ? "/fight/team-slot-selected.png" : "/fight/team-slot-plain.png"}
          alt=""
          fill
          sizes="80px"
          className="object-contain"
        />
        {member && (
          <div className="absolute inset-[14%]">
            <Image
              src={spriteUrl(member.species)}
              alt={member.species}
              fill
              unoptimized
              className={`object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] ${
                member.fainted ? "opacity-35 grayscale" : ""
              }`}
            />
          </div>
        )}
        {member?.status && !member.fainted && (
          <span className="absolute -right-0.5 -top-0.5">
            <StatusDot status={member.status} />
          </span>
        )}
      </div>
      {member && !member.fainted ? (
        <HPBar hpPercent={member.hpPercent} size="sm" />
      ) : (
        <div className="h-1.5 w-full rounded-full border border-black/40 bg-void-deep/60" />
      )}
    </div>
  );
}
