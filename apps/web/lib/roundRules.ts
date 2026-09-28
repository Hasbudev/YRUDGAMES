// Display helpers for a manche's RoundRules — shared by the rules card the
// players see and the admin's round panel, so both always word things alike.

export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

function pts(n: number): string {
  return `${signed(n)} pt${Math.abs(n) === 1 ? "" : "s"}`;
}

// "+2 pts" for a fixed value, "+1 à +3 pts" when the manche's questions differ.
export function rangeLabel([lo, hi]: [number, number]): string {
  return lo === hi ? pts(lo) : `${signed(lo)} à ${signed(hi)} pts`;
}

// Penalties are stored as [worst, best] (both <= 0).
export function penaltyLabel([worst, best]: [number, number]): string {
  if (worst === 0 && best === 0) return "Aucune pénalité";
  if (worst === best) return pts(worst);
  return best === 0 ? `jusqu'à ${pts(worst)}` : `${signed(worst)} à ${signed(best)} pts`;
}

export function secondsLabel(range: [number, number] | null): string {
  if (!range) return "Pas de chrono";
  const [lo, hi] = range;
  return lo === hi ? `${lo} s` : `${lo} à ${hi} s`;
}
