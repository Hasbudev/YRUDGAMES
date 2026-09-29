"use client";

import { CLAN_REGISTRY, type BombState, type PublicPlayer } from "@yrud/shared";

const clanDef = (id: string | null | undefined) => CLAN_REGISTRY.find((c) => c.id === id);

// Manche 3 — which clan holds the bomb (only it answers), how close it is to
// going off, and at reveal what that clan's vote did with it.
export function BombBanner({ bomb, players, myPlayerId }: { bomb: BombState; players: PublicPlayer[]; myPlayerId?: string }) {
  const myClan = players.find((p) => p.id === myPlayerId)?.clan;
  const holder = clanDef(bomb.holderClan);
  const mine = !!myClan && bomb.holderClan === myClan;
  const beat = Math.max(0.2, 1.2 - bomb.heat * 1.0);
  const outcome = bomb.lastOutcome;
  const outcomeClan = clanDef(outcome?.clan);
  const passedTo = clanDef(outcome?.passedTo);

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
        {outcome ? (
          <p className="font-display font-black text-ink">
            <span style={{ color: outcomeClan?.color }}>{outcomeClan?.label ?? outcome.clan}</span>{" "}
            {outcome.votes === 0
              ? "n'a pas répondu"
              : `a voté ${outcome.correct ? "juste" : "faux"} (${outcome.majorityVotes}/${outcome.votes} voix)`}
            {outcome.exploded
              ? " — BOUM !"
              : outcome.correct
                ? passedTo
                  ? ` → la bombe passe à ${passedTo.label}`
                  : ""
                : " → la bombe reste et chauffe !"}
          </p>
        ) : (
          <p className="font-display font-black text-ink">
            {mine ? "TON CLAN A LA BOMBE — votez juste pour la refiler !" : (
              <>
                Le clan <span style={{ color: holder?.color }}>{holder?.label ?? "?"}</span> a la bombe — tu regardes
              </>
            )}
          </p>
        )}
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
          Bombe {bomb.bombNumber}/{bomb.totalBombs} · seul le clan qui l&apos;a répond, la majorité décide · juste = elle
          passe au clan suivant · faux = elle reste et se rapproche de l&apos;explosion (−{bomb.penalty} pts divisés par
          le nombre de votants, pour chaque joueur du clan — votez tous !)
        </p>
      </div>
    </div>
  );
}
