import { MOLE_KINDS } from "@yrud/shared";
import { MoleSprite } from "./MoleSprite";

// What each mole does — on the manche's rules card.
export function WhackLegend() {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {Object.values(MOLE_KINDS).map((def) => (
        <li key={def.kind} data-rule className="flex items-center gap-3 rounded-xl border border-border bg-void-deep/50 p-2">
          <MoleSprite kind={def.kind} className="h-12 w-12 shrink-0" />
          <span className="flex flex-col">
            <span className="font-display text-sm font-bold text-ink">{def.label}</span>
            <span
              className={`text-xs font-semibold ${
                def.points > 0 ? "text-emerald-300" : def.points < 0 ? "text-crimson-bright" : "text-gold-bright"
              }`}
            >
              {def.description}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
