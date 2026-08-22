import type { BattleStatus, BattleTeamMember } from "@yrud/shared";
import { HPBar } from "./HPBar";
import { StatusDot } from "./StatusBadge";
import { PokemonSprite } from "./PokemonSprite";

const STATUS_LABEL: Record<BattleStatus, string> = {
  brn: "Brûlure",
  par: "Paralysie",
  slp: "Sommeil",
  frz: "Gel",
  psn: "Poison",
  tox: "Poison grave",
};

interface TeamPokemonSlotProps {
  member?: BattleTeamMember;
}

export function TeamPokemonSlot({ member }: TeamPokemonSlotProps) {
  return (
    <div
      className="group relative flex flex-col items-center gap-1"
      tabIndex={member ? 0 : undefined}
    >
      <div
        className={`relative aspect-[63/48] w-full rounded-lg border transition-colors ${
          member?.isActive
            ? "border-gold bg-gradient-to-b from-panel-raised to-panel shadow-[0_0_10px_rgba(232,193,90,0.35)]"
            : "border-border bg-void-deep/50"
        } ${member?.fainted ? "opacity-50 grayscale" : ""}`}
      >
        {member && (
          <div className="absolute inset-[9%]">
            <PokemonSprite species={member.species} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
          </div>
        )}
        {member?.status && !member.fainted && (
          <span className="absolute -right-1 -top-1">
            <StatusDot status={member.status} />
          </span>
        )}
      </div>
      {member && !member.fainted ? (
        <HPBar hpPercent={member.hpPercent} size="sm" />
      ) : (
        <div className="h-1.5 w-full rounded-full border border-black/40 bg-void-deep/60" />
      )}

      {/* Showdown-style hover/focus tooltip — name + current HP% + status,
          the only per-slot info this app tracks (no ability/speed data for
          reserve team members, only the active Pokémon gets that detail). */}
      {member && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[9rem] -translate-x-1/2 rounded-lg border border-gold/40 bg-void-deep/95 px-2.5 py-1.5 text-center opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.65)] transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
          <p className="truncate font-display text-xs font-bold text-ink">{member.species}</p>
          <p className="mt-0.5 font-mono text-[10px] text-ink-muted">{member.fainted ? "K.O." : `${member.hpPercent}% PV`}</p>
          {member.status && !member.fainted && (
            <p className="mt-0.5 text-[10px] font-semibold text-crimson-bright">{STATUS_LABEL[member.status]}</p>
          )}
          {member.isActive && !member.fainted && (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-gold-bright">Actif</p>
          )}
        </div>
      )}
    </div>
  );
}
