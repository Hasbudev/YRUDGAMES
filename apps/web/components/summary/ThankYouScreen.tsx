"use client";

import type { EventSummary } from "@yrud/shared";
import { OrnatePanel } from "@/components/quiz/OrnatePanel";
import { EndGameSummary } from "./EndGameSummary";

// Shown when the last manche is over, before Yrud announces the final
// battle: thanks everyone and shows the quiz's final standings.
export function ThankYouScreen({ summary, myPlayerId }: { summary: EventSummary; myPlayerId?: string | null }) {
  const me = summary.standings.find((s) => s.playerId === myPlayerId);
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <OrnatePanel className="animate-scene-enter w-full max-w-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-gold-dim">Fin des épreuves</p>
          <h1 className="font-display text-glow-gold text-3xl font-black text-gold-bright sm:text-4xl">
            Merci d&apos;avoir participé aux Yrud Games 2 !
          </h1>
          <p className="text-ink">
            Six manches, des bombes, des taupes et beaucoup de mauvaise foi. Merci à tous d&apos;être venus vous faire
            humilier dans l&apos;arène de Yrud.
          </p>
          {me && (
            <p className="font-display text-lg font-bold text-ink">
              Tu termines {me.placement === 1 ? "1er" : `${me.placement}e`} avec{" "}
              <span className="text-gold-bright">
                {me.points} pt{me.points === 1 ? "" : "s"}
              </span>
              .
            </p>
          )}
          <p className="animate-pulse text-sm font-semibold text-crimson-bright">
            ⚔ Les deux meilleurs vont s&apos;affronter dans la bataille finale… Yrud prépare l&apos;annonce.
          </p>
        </div>
      </OrnatePanel>
      <EndGameSummary summary={summary} myPlayerId={myPlayerId} title="Classement final des épreuves" />
    </div>
  );
}
