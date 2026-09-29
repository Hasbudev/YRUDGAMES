"use client";

import { useState } from "react";
import { CLAN_REGISTRY, SLIDER_TRICKS, type ArenaSnapshot, type SliderTrick } from "@yrud/shared";

const clanLabel = (id: string) => CLAN_REGISTRY.find((c) => c.id === id)?.label ?? id;

// Yrud Games 2's picking order: Paldea (last in the standings), then Yrud,
// then Rapepolofia. Still editable in the panel before launching the vote.
const DEFAULT_DRAFT_ORDER = ["paldea", "yrud", "rapepolofia"];

interface SpecialRoundsPanelProps {
  snapshot: ArenaSnapshot;
  onStartDraft: (order: string[]) => void;
  onCloseVote: () => void;
  onSkipSteal: () => void;
  onSliderTrick: (trick: SliderTrick) => void;
}

// Yrud's controls for the Yrud Games 2 special manches: the clans' category
// vote (manche 1), the bomb (manche 3), the winner's steal (manche 4).
export function SpecialRoundsPanel({ snapshot, onStartDraft, onCloseVote, onSkipSteal, onSliderTrick }: SpecialRoundsPanelProps) {
  const [order, setOrder] = useState<string[]>(DEFAULT_DRAFT_ORDER);
  const draft = snapshot.categoryDraft;
  const categories = snapshot.roundRules?.categories;
  const beforeQuestions = snapshot.phase === "lobby" || snapshot.phase === "intro" || snapshot.phase === "roundIntro";
  const showDraft = !!draft || (!!categories && beforeQuestions);
  const nameOf = (id: string | null) => snapshot.players.find((p) => p.id === id)?.name ?? "?";

  const sliderLive = snapshot.phase === "question" && snapshot.question?.theme === "slider";
  if (!showDraft && !snapshot.bomb && !snapshot.steal && !sliderLive && !snapshot.answeringClan) return null;

  return (
    <div className="panel-ornate flex w-full flex-col gap-4 rounded-2xl p-4 text-sm">
      {showDraft && (
        <div className="flex flex-col gap-3">
          <p className="pl-5 font-display font-semibold text-gold-bright">Manche 1 — Choix des catégories</p>
          {!draft || draft.turn >= draft.order.length ? (
            <>
              <p className="text-ink-muted">
                Ordre de choix (le clan dernier au classement choisit en premier) — chaque clan vote parmi ses
                joueurs présents :
              </p>
              <div className="flex flex-wrap gap-2">
                {order.map((clan, i) => (
                  <select
                    key={i}
                    value={clan}
                    onChange={(e) => {
                      const next = [...order];
                      const j = next.indexOf(e.target.value);
                      [next[i], next[j]] = [next[j], next[i]];
                      setOrder(next);
                    }}
                    className="rounded-lg border border-border bg-void-deep/60 px-3 py-2 text-ink"
                  >
                    {CLAN_REGISTRY.map((c) => (
                      <option key={c.id} value={c.id}>
                        {i + 1}. {c.label}
                      </option>
                    ))}
                  </select>
                ))}
                <button type="button" onClick={() => onStartDraft(order)} className="btn-gold">
                  {draft ? "Relancer le vote" : "Lancer le vote"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-ink">
                Vote de <b>{clanLabel(draft.order[draft.turn])}</b> :{" "}
                {draft.categories
                  .filter((c) => !Object.values(draft.assignments).includes(c))
                  .map((c) => `${c} (${draft.voteCounts[c] ?? 0})`)
                  .join(" · ")}
              </p>
              <button type="button" onClick={onCloseVote} className="btn-crimson">
                Clore le vote
              </button>
            </div>
          )}
          {draft && draft.turn >= draft.order.length && (
            <p className="text-ink-muted">
              La manche se jouera clan par clan, dans l&apos;ordre ci-dessous.
            </p>
          )}
          {draft && Object.keys(draft.assignments).length > 0 && (
            <ul className="flex flex-col gap-1 text-ink">
              {Object.entries(draft.assignments).map(([clan, cat]) => (
                <li key={clan}>
                  {clanLabel(clan)} → <b className="text-gold-bright">{cat}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {snapshot.answeringClan && !snapshot.bomb && (
        <p className="pl-5 text-ink">
          🏳 Au tour de <b className="text-gold-bright">{clanLabel(snapshot.answeringClan)}</b> — seuls ses joueurs
          répondent, les autres regardent.
        </p>
      )}

      {sliderLive && (
        <div className="flex flex-wrap items-center gap-2 pl-5">
          <p className="font-display font-semibold text-gold-bright">Coups tordus sur le curseur :</p>
          {SLIDER_TRICKS.map((t) => (
            <button key={t.id} type="button" onClick={() => onSliderTrick(t.id)} className="btn-crimson">
              {t.label}
            </button>
          ))}
        </div>
      )}

      {snapshot.bomb && (
        <p className="pl-5 text-ink">
          💣 Bombe {snapshot.bomb.bombNumber}/{snapshot.bomb.totalBombs} — tenue par le clan{" "}
          <b>{snapshot.bomb.holderClan ? clanLabel(snapshot.bomb.holderClan) : "—"}</b> · mèche{" "}
          {Math.round(snapshot.bomb.heat * 100)} %
        </p>
      )}

      {snapshot.steal && (
        <div className="flex flex-wrap items-center gap-3 pl-5">
          <p className="text-ink">
            🦹 Vol de {snapshot.steal.amount} pts —{" "}
            {snapshot.steal.pendingIds.length
              ? `en attente de ${snapshot.steal.pendingIds.map(nameOf).join(", ")}`
              : snapshot.steal.done.map((d) => `${nameOf(d.thiefId)} → ${nameOf(d.victimId)} (−${d.amount})`).join(", ") ||
                "annulé"}
          </p>
          {snapshot.steal.pendingIds.length > 0 && (
            <button type="button" onClick={onSkipSteal} className="rounded-lg border border-border px-3 py-1 text-ink-muted">
              Annuler le vol
            </button>
          )}
        </div>
      )}
    </div>
  );
}
