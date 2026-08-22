import type { BattleSwitchOption } from "@yrud/shared";
import { PokemonSprite } from "./PokemonSprite";

interface SwitchSelectorProps {
  options: BattleSwitchOption[];
  forced?: boolean;
  onChoose: (slot: number) => void;
}

export function SwitchSelector({ options, forced, onChoose }: SwitchSelectorProps) {
  const targets = options.filter((o) => !o.fainted && !o.isActive);
  // `forced` alone doesn't mean the active Pokémon fainted — U-turn, Volt
  // Switch, Baton Pass, and being hit by Whirlwind/Roar/Dragon Tail all set
  // the same forceSwitch flag on a Pokémon that's still perfectly healthy.
  // Showing "K.O." on a voluntary U-turn would read as a false, confusing
  // error live.
  const activeFainted = options.find((o) => o.isActive)?.fainted ?? false;
  const heading = !forced
    ? "Choisis un remplaçant"
    : activeFainted
      ? "Ton Pokémon est K.O. — choisis le suivant"
      : "Changement forcé — choisis un remplaçant";

  return (
    <div>
      <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-gold-dim">{heading}</p>
      {targets.length === 0 ? (
        <p className="text-center text-xs text-ink-muted">Aucun autre Pokémon disponible.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {targets.map((o) => (
            <button
              key={o.slot}
              type="button"
              onClick={() => onChoose(o.slot)}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-void-deep/40 px-2 py-2 transition-colors hover:border-border-strong hover:bg-void-deep/70"
            >
              <div className="relative h-10 w-10">
                <PokemonSprite species={o.species} />
              </div>
              <span className="max-w-[5.5rem] truncate text-[11px] text-ink">{o.species}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
