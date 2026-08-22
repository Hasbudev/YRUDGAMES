import Image from "next/image";
import { ClanBadge } from "@/components/yrud/ClanBadge";

interface PlayerIdentity {
  name: string;
  clan?: string | null;
  playerId: string;
}

interface BattleHeaderProps {
  left: PlayerIdentity;
  right: PlayerIdentity;
  eventCode?: string;
}

function IdentityChip({ player, align }: { player: PlayerIdentity; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <ClanBadge clanId={player.clan} seed={player.playerId} size={30} className="shrink-0" />
      <span className="truncate font-display text-xs font-bold text-ink sm:text-sm">{player.name}</span>
    </div>
  );
}

export function BattleHeader({ left, right, eventCode }: BattleHeaderProps) {
  return (
    <div className="flex w-full max-w-3xl items-center gap-3">
      <div className="w-24 shrink-0 sm:w-40">
        <IdentityChip player={left} align="left" />
      </div>
      <div className="relative min-w-0 flex-1">
        <Image src="/fight/header-bar.png" alt="Yrud Games" width={598} height={92} priority className="h-auto w-full" />
        {eventCode && (
          <span
            className="absolute flex items-center justify-center overflow-hidden font-mono text-[10px] font-bold tracking-wide text-gold-bright sm:text-xs"
            style={{ left: "67%", right: "20%", top: "39%", bottom: "35%" }}
          >
            {eventCode}
          </span>
        )}
      </div>
      <div className="w-24 shrink-0 sm:w-40">
        <IdentityChip player={right} align="right" />
      </div>
    </div>
  );
}
