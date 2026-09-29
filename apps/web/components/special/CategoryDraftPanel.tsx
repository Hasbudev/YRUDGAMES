"use client";

import { CLAN_REGISTRY, type CategoryDraft, type PublicPlayer } from "@yrud/shared";
import { ClanBadge } from "@/components/yrud/ClanBadge";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";

const clanLabel = (id: string) => CLAN_REGISTRY.find((c) => c.id === id)?.label ?? id;

interface CategoryDraftPanelProps {
  draft: CategoryDraft;
  players: PublicPlayer[];
  // Set for a player: lets them vote during their clan's turn.
  myPlayerId?: string;
  onVote?: (category: string) => void;
  // What a right answer is worth to the clan playing its category.
  points?: number;
}

// Manche 1 — the clans pick their category one after the other (last in the
// standings first), each by a vote of its players who are here.
export function CategoryDraftPanel({ draft, players, myPlayerId, onVote, points }: CategoryDraftPanelProps) {
  const me = players.find((p) => p.id === myPlayerId);
  const done = draft.turn >= draft.order.length;
  const votingClan = done ? null : draft.order[draft.turn];
  const taken = new Set(Object.values(draft.assignments));
  const remaining = draft.categories.filter((c) => !taken.has(c));
  const myTurn = !!me && me.clan === votingClan && !!onVote;
  const iVoted = !!myPlayerId && draft.voterIds.includes(myPlayerId);
  const clanPresent = players.filter((p) => p.clan === votingClan && p.connected).length;

  return (
    <OrnatePanel className="animate-scene-enter w-full max-w-2xl">
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-gold-dim">Manche 1</p>
          <h2 className="font-display text-glow-gold text-2xl font-black text-gold-bright">Choix des catégories</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Chaque clan jouera seul les questions de sa catégorie, dans cet ordre
            {points ? (
              <>
                {" "}
                (<b className="text-emerald-300">+{points}</b> par bonne réponse)
              </>
            ) : null}
            . Les autres clans regardent.
          </p>
        </div>

        <ol className="flex flex-col gap-2">
          {draft.order.map((clan, i) => {
            const picked = draft.assignments[clan];
            const current = clan === votingClan;
            return (
              <li
                key={clan}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  current ? "border-gold bg-gold/10" : "border-border bg-void-deep/40"
                }`}
              >
                <span className="w-5 font-display font-black text-gold-dim">{i + 1}</span>
                <ClanBadge clanId={clan} seed={clan} size={30} />
                <span className="flex-1 font-medium text-ink">{clanLabel(clan)}</span>
                <span className={`font-display font-bold ${picked ? "text-gold-bright" : "text-ink-muted"}`}>
                  {picked ?? (current ? "vote en cours..." : "en attente")}
                </span>
              </li>
            );
          })}
        </ol>

        {votingClan && (
          <div className="flex flex-col items-center gap-3">
            {myTurn ? (
              <>
                <p className="font-display text-lg font-bold text-ink">
                  {iVoted ? "Vote enregistré — tu peux encore changer d'avis." : "À ton clan de choisir ! Vote :"}
                </p>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
                  {remaining.map((c) => (
                    <button key={c} type="button" onClick={() => onVote?.(c)} className="btn-gold flex flex-col items-center rounded-xl py-3">
                      <span className="font-display font-black">{c}</span>
                      <span className="text-xs opacity-80">{draft.voteCounts[c] ?? 0} vote(s)</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-ink-muted">
                Le clan <b className="text-ink">{clanLabel(votingClan)}</b> vote ({draft.voterIds.length}/{clanPresent}{" "}
                votes)... Catégories restantes : {remaining.join(", ")}
              </p>
            )}
          </div>
        )}
        {done && <p className="text-center text-sm text-ink-muted">Catégories choisies — Yrud va lancer la manche.</p>}
      </div>
    </OrnatePanel>
  );
}
