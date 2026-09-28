"use client";

import { CLAN_REGISTRY, type BombState, type PublicPlayer } from "@yrud/shared";

// Manche 3 — who holds the bomb. It ticks faster and faster as its (secret)
// fuse burns down.
export function BombBanner({ bomb, players, myPlayerId }: { bomb: BombState; players: PublicPlayer[]; myPlayerId?: string }) {
  const holder = players.find((p) => p.id === bomb.holderId);
  const clan = CLAN_REGISTRY.find((c) => c.id === holder?.clan);
  const mine = !!myPlayerId && bomb.holderId === myPlayerId;
  const beat = Math.max(0.2, 1.2 - bomb.heat * 1.0);

  return (
    <div
      className={`flex w-full max-w-2xl items-center gap-3 rounded-2xl border-2 px-4 py-3 ${
        mine ? "border-crimson bg-crimson/20" : "border-border bg-void-deep/60"
      }`}
    >
      <span className="text-4xl" style={{ animation: `bomb-tick ${beat}s ease-in-out infinite` }}>
        💣
      </span>
      <div className="flex-1">
        <p className="font-display font-black text-ink">
          {mine ? "C'EST TOI QUI AS LA BOMBE !" : `${holder?.name ?? "Personne"} tient la bombe`}
          {clan && !mine && <span style={{ color: clan.color }}> ({clan.label})</span>}
        </p>
        <div className="my-1.5 h-2.5 w-full overflow-hidden rounded-full bg-void-deep/80">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.max(6, bomb.heat * 100)}%`,
              background: `linear-gradient(90deg, #e8c15a, ${bomb.heat > 0.6 ? "#ef4444" : "#f97316"})`,
              boxShadow: bomb.heat > 0.6 ? "0 0 10px rgba(239,68,68,0.8)" : undefined,
            }}
          />
        </div>
        <p className="text-xs text-ink-muted">
          Bombe {bomb.bombNumber}/{bomb.totalBombs} · bonne réponse = tu la refiles à un autre clan · explosion : −
          {bomb.penalty} pts pour tout le clan
        </p>
      </div>
    </div>
  );
}
