import { AvatarIcon } from "@/components/yrud/AvatarIcon";

const PLACEMENT_LABEL: Record<number, string> = { 1: "1er", 2: "2e", 3: "3e" };

export function placementLabel(placement: number): string {
  return PLACEMENT_LABEL[placement] ?? `${placement}e`;
}

export interface PodiumEntry {
  id: string;
  name: string;
  avatarSeed: string;
  avatarId?: string | null;
  rank: number;
  statLabel: string;
  highlight?: boolean;
}

interface PodiumProps {
  entries: PodiumEntry[];
  className?: string;
}

const PODIUM_HEIGHT: Record<number, string> = { 1: "h-36", 2: "h-24", 3: "h-16" };

// Shared "2nd — 1st — 3rd" three-block podium visual, used by the end-of-event
// summary (per-event standings) and the /classement page (global aggregate) —
// same look, fed by whichever ranking makes sense for the caller.
export function Podium({ entries, className }: PodiumProps) {
  const ordered = [entries[1], entries[0], entries[2]].filter(Boolean) as PodiumEntry[];

  return (
    <div className={`flex w-full items-end justify-center gap-4 ${className ?? ""}`}>
      {ordered.map((entry) => (
        <div key={entry.id} className="flex flex-col items-center gap-2">
          <AvatarIcon avatarId={entry.avatarId} seed={entry.avatarSeed} size={entry.rank === 1 ? 56 : 44} />
          <span className={`max-w-[7rem] truncate text-center text-sm font-bold ${entry.highlight ? "text-gold-bright" : "text-ink"}`}>
            {entry.name}
          </span>
          <span className="text-xs text-ink-muted">{entry.statLabel}</span>
          <div
            className={`flex w-24 items-start justify-center rounded-t-lg border-t-2 border-x-2 border-gold/40 bg-gradient-to-b from-gold/25 to-purple/10 pt-2 ${
              PODIUM_HEIGHT[entry.rank] ?? "h-12"
            }`}
          >
            <span className="font-display text-lg font-black text-gold-bright">{placementLabel(entry.rank)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
