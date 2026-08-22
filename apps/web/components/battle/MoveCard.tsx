import type { BattleMoveOption } from "@yrud/shared";
import { TypeIcon, typeColor, typeLabel } from "./typeTheme";

interface MoveCardProps {
  move: BattleMoveOption;
  selected: boolean;
  disabled: boolean;
  onChoose: () => void;
}

export function MoveCard({ move, selected, disabled, onChoose }: MoveCardProps) {
  const color = typeColor(move.type);
  const noPp = move.pp <= 0;
  const isDisabled = disabled || move.disabled || noPp;

  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={isDisabled}
      className={`group relative flex flex-col gap-1.5 rounded-xl border bg-gradient-to-b from-panel-raised to-void-deep px-3 py-2.5 text-left transition-all duration-150 ${
        isDisabled ? "cursor-not-allowed opacity-40 grayscale" : "cursor-pointer hover:-translate-y-0.5"
      } ${selected ? "border-gold-bright shadow-[0_0_18px_rgba(232,193,90,0.5)]" : "border-border hover:border-border-strong"}`}
    >
      <div className="flex items-start gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}33`, color, boxShadow: isDisabled ? undefined : `0 0 8px ${color}66` }}
        >
          <TypeIcon type={move.type} size={14} />
        </span>
        <span className="font-display text-[13px] font-bold leading-tight text-ink">{move.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${color}26`, color }}
        >
          {typeLabel(move.type)}
        </span>
        <span className={`font-mono text-[11px] ${noPp ? "text-crimson-bright" : "text-ink-muted"}`}>
          {move.pp} / {move.maxPp} PP
        </span>
      </div>
    </button>
  );
}
