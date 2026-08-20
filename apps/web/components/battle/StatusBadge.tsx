import Image from "next/image";
import type { BattleStatus } from "@yrud/shared";

const ASSET: Record<BattleStatus, { src: string; w: number; h: number }> = {
  brn: { src: "/fight/status-brn.png", w: 163, h: 46 },
  psn: { src: "/fight/status-psn.png", w: 168, h: 46 },
  tox: { src: "/fight/status-tox.png", w: 183, h: 46 },
  par: { src: "/fight/status-par.png", w: 163, h: 46 },
  frz: { src: "/fight/status-frz.png", w: 168, h: 46 },
  slp: { src: "/fight/status-slp.png", w: 168, h: 46 },
};

// Every art variant but "brn" already bakes its own label — the sheet's
// only mislabeled badge (a flame icon reading "PSN") had that text painted
// out during asset prep, so this is the one state needing a text overlay.
export function StatusBadge({ status, className = "" }: { status: BattleStatus; className?: string }) {
  const asset = ASSET[status];
  return (
    <span className={`relative inline-block h-5 ${className}`} style={{ aspectRatio: `${asset.w}/${asset.h}` }}>
      <Image src={asset.src} alt="" fill sizes="80px" className="object-contain" />
      {status === "brn" && (
        <span
          className="absolute flex items-center justify-center text-[9px] font-bold tracking-wide text-orange-100"
          style={{ left: "37%", right: "3%", top: "22%", bottom: "22%" }}
        >
          BRN
        </span>
      )}
    </span>
  );
}

// Tiny colored dot for reserve team slots — full badges would be too heavy
// at that scale.
const DOT_COLOR: Record<BattleStatus, string> = {
  brn: "#e0652c",
  psn: "#a855f7",
  tox: "#7c1fa2",
  par: "#eab308",
  frz: "#67e8f9",
  slp: "#94a3b8",
};

export function StatusDot({ status }: { status: BattleStatus }) {
  return <span className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ background: DOT_COLOR[status] }} title={status.toUpperCase()} />;
}
