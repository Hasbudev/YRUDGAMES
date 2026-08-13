import { useState } from "react";
import type { BattleChoiceRequest } from "@yrud/shared";

interface MoveChooserProps {
  request: BattleChoiceRequest;
  onChoose: (choice: string) => void;
}

export function MoveChooser({ request, onChoose }: MoveChooserProps) {
  const [mode, setMode] = useState<"moves" | "switch">("moves");
  const switchTargets = request.switchOptions.filter((o) => !o.fainted && !o.isActive);

  if (request.forceSwitch) {
    return (
      <div className="panel w-full max-w-2xl rounded-2xl p-4">
        <p className="mb-2 text-sm font-semibold text-gold-bright">Ton Pokémon est K.O. — choisis le suivant</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {switchTargets.map((o) => (
            <button
              key={o.slot}
              onClick={() => onChoose(`switch ${o.slot}`)}
              className="rounded-lg border border-border bg-void-deep/40 px-3 py-2 text-sm text-ink hover:border-border-strong hover:bg-void-deep/70"
            >
              {o.species}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="panel w-full max-w-2xl rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setMode("moves")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            mode === "moves" ? "bg-gold text-void-deep" : "border border-border text-ink-muted hover:border-border-strong"
          }`}
        >
          Attaques
        </button>
        <button
          onClick={() => setMode("switch")}
          disabled={request.trapped}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            mode === "switch" ? "bg-purple text-white" : "border border-border text-ink-muted hover:border-border-strong"
          }`}
        >
          Équipe
        </button>
        {request.trapped && <span className="text-xs text-crimson-bright">Tu ne peux pas changer de Pokémon !</span>}
      </div>

      {mode === "moves" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {request.moves.map((m, i) => (
            <button
              key={m.id}
              disabled={m.disabled}
              onClick={() => onChoose(`move ${i + 1}`)}
              className="rounded-lg border border-border bg-void-deep/40 px-3 py-2 text-left text-sm text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:border-border-strong hover:bg-void-deep/70"
            >
              {m.name} <span className="text-xs text-ink-muted">({m.pp}/{m.maxPp} PP)</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {switchTargets.length === 0 ? (
            <p className="col-span-full text-sm text-ink-muted">Aucun autre Pokémon disponible.</p>
          ) : (
            switchTargets.map((o) => (
              <button
                key={o.slot}
                onClick={() => onChoose(`switch ${o.slot}`)}
                className="rounded-lg border border-border bg-void-deep/40 px-3 py-2 text-sm text-ink hover:border-border-strong hover:bg-void-deep/70"
              >
                {o.species}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
