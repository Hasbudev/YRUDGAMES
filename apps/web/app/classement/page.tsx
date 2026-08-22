"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { listLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ClanBadge } from "@/components/yrud/ClanBadge";

// Measured directly off leaderboard-table.png (723x683) — the asset bakes in
// the 10 rank badges (1-10, correct numbers already) and 10 empty row slots;
// only the avatar + name + score need to be laid over it as real HTML. Row
// spacing isn't perfectly uniform (the rank 1-3 medallions are taller than
// the plain diamond badges below them), so each row's exact top/height was
// detected by scanning the source PNG for its divider lines pixel-by-pixel
// rather than assumed — a fixed-step formula drifted out of alignment by
// the later rows.
const ROW_BANDS = [
  { topPct: 21.083, heightPct: 7.394 },
  { topPct: 28.477, heightPct: 8.053 },
  { topPct: 36.53, heightPct: 7.833 },
  { topPct: 44.363, heightPct: 7.321 },
  { topPct: 51.684, heightPct: 6.881 },
  { topPct: 58.565, heightPct: 6.955 },
  { topPct: 65.52, heightPct: 6.955 },
  { topPct: 72.474, heightPct: 6.881 },
  { topPct: 79.356, heightPct: 6.955 },
  { topPct: 86.31, heightPct: 6.369 },
];
const NAME_LEFT_PCT = (165 / 723) * 100;
const NAME_WIDTH_PCT = ((530 - 165) / 723) * 100;
const SCORE_LEFT_PCT = (540 / 723) * 100;
const SCORE_WIDTH_PCT = ((660 - 540) / 723) * 100;
const MAX_ROWS = 10;

// Placeholder standings until a real soirée has actually finished — swap out
// once /api/leaderboard has genuine data (real names, from the RPPLF Discord,
// bots excluded).
const MOCK_ENTRIES: LeaderboardEntry[] = [
  { name: "Tchoupi", clan: "rapepolofia", eventsPlayed: 3, wins: 2, bestPlacement: 1, totalCorrectAnswers: 2580 },
  { name: "Hasbulla", clan: "yrud", eventsPlayed: 3, wins: 1, bestPlacement: 1, totalCorrectAnswers: 2145 },
  { name: "Remysse", clan: "paldea", eventsPlayed: 2, wins: 0, bestPlacement: 2, totalCorrectAnswers: 1980 },
  { name: "juyen", clan: "rapepolofia", eventsPlayed: 2, wins: 0, bestPlacement: 3, totalCorrectAnswers: 1725 },
  { name: "Dieu Shykimi", clan: "paldea", eventsPlayed: 2, wins: 0, bestPlacement: 4, totalCorrectAnswers: 1540 },
  { name: "Kindy", clan: "yrud", eventsPlayed: 1, wins: 0, bestPlacement: 4, totalCorrectAnswers: 1320 },
  { name: "Kthuloutre", clan: "rapepolofia", eventsPlayed: 1, wins: 0, bestPlacement: 5, totalCorrectAnswers: 1150 },
  { name: "Moyerf", clan: "paldea", eventsPlayed: 1, wins: 0, bestPlacement: 6, totalCorrectAnswers: 980 },
  { name: "scanziromain", clan: "yrud", eventsPlayed: 1, wins: 0, bestPlacement: 7, totalCorrectAnswers: 820 },
  { name: "Bastien_", clan: "rapepolofia", eventsPlayed: 1, wins: 0, bestPlacement: 8, totalCorrectAnswers: 650 },
];

export default function ClassementPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    listLeaderboard()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  const usingMock = entries !== null && entries.length === 0;
  const rows = (usingMock ? MOCK_ENTRIES : (entries ?? [])).slice(0, MAX_ROWS);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url(/art/classement/bg2.png)" }}>
      <div className="pointer-events-none absolute top-[10%] left-[4%] hidden h-[42vh] max-h-[400px] w-[100px] opacity-70 xl:block">
        <Image src="/art/reglement/torch.png" alt="" fill className="object-contain object-top" />
      </div>
      <div className="pointer-events-none absolute top-[10%] right-[4%] hidden h-[42vh] max-h-[400px] w-[100px] scale-x-[-1] opacity-70 xl:block">
        <Image src="/art/reglement/torch.png" alt="" fill className="object-contain object-top" />
      </div>

      <div className="relative z-10 w-full">
        <SiteHeader />
      </div>

      <div className="relative z-10 flex w-full flex-1 items-center justify-center px-6 py-6">
        <div className="flex w-full max-w-3xl -translate-y-8 flex-col items-center gap-4 lg:-translate-y-12">
          <div className="relative w-full max-w-xl" style={{ height: "min(34vh, 380px)" }}>
            <Image src="/art/classement/classement.png" alt="Classement — Meilleurs conquérants" fill className="object-contain" priority />
          </div>

          {usingMock && (
            <p className="-mt-2 text-xs tracking-wide text-ink-muted uppercase">
              Exemple — remplacé par le vrai classement dès la fin d&apos;une soirée
            </p>
          )}

          {entries === null && <p className="text-sm text-ink-muted">Chargement du classement...</p>}

          {rows.length > 0 && (
            <div className="relative w-full max-w-2xl" style={{ aspectRatio: "723/683" }}>
              <Image src="/art/classement/leaderboard-table.png" alt="" fill className="object-contain" />
              {rows.map((entry, i) => (
                <div
                  key={entry.name}
                  className="absolute flex items-center gap-2"
                  style={{ top: `${ROW_BANDS[i].topPct}%`, height: `${ROW_BANDS[i].heightPct}%`, left: `${NAME_LEFT_PCT}%`, width: `${NAME_WIDTH_PCT}%` }}
                >
                  <ClanBadge clanId={entry.clan} seed={entry.name} size={26} className="shrink-0" />
                  <p className="truncate text-sm font-bold text-ink sm:text-base">{entry.name}</p>
                </div>
              ))}
              {rows.map((entry, i) => (
                <div
                  key={`${entry.name}-score`}
                  className="absolute flex items-center justify-center"
                  style={{ top: `${ROW_BANDS[i].topPct}%`, height: `${ROW_BANDS[i].heightPct}%`, left: `${SCORE_LEFT_PCT}%`, width: `${SCORE_WIDTH_PCT}%` }}
                >
                  <p
                    className="text-sm font-bold text-gold-bright sm:text-base"
                    title={`${entry.wins} victoire(s) · ${entry.totalCorrectAnswers} bonne(s) réponse(s) au total`}
                  >
                    {entry.totalCorrectAnswers}
                  </p>
                </div>
              ))}
            </div>
          )}

          {entries && entries.length > MAX_ROWS && (
            <p className="text-xs text-ink-muted">+{entries.length - MAX_ROWS} autre(s) dresseur(s) classé(s).</p>
          )}
        </div>
      </div>
    </div>
  );
}
