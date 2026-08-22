import type { BattleActivePokemon } from "@yrud/shared";
import { HPBar } from "./HPBar";
import { StatusBadge } from "./StatusBadge";
import { PokemonSprite } from "./PokemonSprite";

const GENDER_SYMBOL: Record<string, string> = { M: "♂", F: "♀" };
const GENDER_COLOR: Record<string, string> = { M: "text-sky-400", F: "text-pink-400" };

const STAT_ABBR: Record<string, string> = {
  atk: "ATQ",
  def: "DEF",
  spa: "ATS",
  spd: "DFS",
  spe: "VIT",
  accuracy: "PRÉ",
  evasion: "ESQ",
};

export function ActivePokemonCard({ active }: { active: BattleActivePokemon | null }) {
  if (!active) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-void-deep/50 px-3 py-4 text-xs text-ink-muted">
        En attente...
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-gold/30 bg-gradient-to-b from-panel-raised to-panel px-2.5 py-2 shadow-[inset_0_1px_0_rgba(232,193,90,0.08)] transition-opacity ${
        active.fainted ? "opacity-40 grayscale" : ""
      }`}
    >
      <div className="relative h-11 w-11 shrink-0">
        <PokemonSprite species={active.species} className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="truncate font-display text-sm font-bold text-ink">{active.species}</span>
          {GENDER_SYMBOL[active.gender] && (
            <span className={`text-xs font-bold ${GENDER_COLOR[active.gender]}`}>{GENDER_SYMBOL[active.gender]}</span>
          )}
          <span className="text-[10px] text-ink-muted">Niv. {active.level}</span>
          {active.status && !active.fainted && <StatusBadge status={active.status} />}
        </div>
        {Object.entries(active.boosts).some(([, stage]) => stage) && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {Object.entries(active.boosts)
              .filter(([, stage]) => stage)
              .map(([stat, stage]) => (
                <span
                  key={stat}
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                    (stage ?? 0) > 0 ? "bg-gold/20 text-gold-bright" : "bg-purple/20 text-purple"
                  }`}
                >
                  {STAT_ABBR[stat] ?? stat.toUpperCase()} {(stage ?? 0) > 0 ? "+" : ""}
                  {stage}
                </span>
              ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1">
            <HPBar hpPercent={active.hpPercent} />
          </div>
          <span className="shrink-0 font-mono text-[10px] text-ink-muted">
            {active.hp !== null && active.maxHp !== null ? `${active.hp} / ${active.maxHp}` : `${active.hpPercent}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
