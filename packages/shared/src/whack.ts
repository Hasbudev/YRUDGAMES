// Chasse-taupes ("whack") minigame — shared by the server (validates every
// hit and scores it) and the clients (draw the same board). Both derive the
// exact same spawn schedule from the seed the server picks when the game
// starts, so nothing but that seed has to travel over the wire.

export type MoleKind = "taupiqueur" | "remysse" | "tchoupi" | "rudy" | "artymasion";

export interface MoleKindDef {
  kind: MoleKind;
  label: string;
  // Points for tapping it (before Rudy's boost, which only multiplies gains).
  points: number;
  // Relative spawn frequency.
  weight: number;
  // Drop the real sprite at apps/web/public/whack/<kind>.png — until then the
  // client falls back to `fallbackSprite`, or a name badge.
  fallbackSprite?: string;
  effect?: "boost" | "popup";
  description: string;
}

// Tapping Rudy multiplies every gain for a while (not Tchoupi's loss).
export const RUDY_BOOST_MULTIPLIER = 1.3;
export const RUDY_BOOST_MS = 6700;
// "×1,1" — the multiplier as shown on screen.
export const RUDY_BOOST_LABEL = `×${String(RUDY_BOOST_MULTIPLIER).replace(".", ",")}`;

export const MOLE_KINDS: Record<MoleKind, MoleKindDef> = {
  taupiqueur: {
    kind: "taupiqueur",
    label: "Taupiqueur",
    points: 1,
    weight: 58,
    fallbackSprite: "https://play.pokemonshowdown.com/sprites/gen5/diglett.png",
    description: "+1 pt",
  },
  remysse: { kind: "remysse", label: "Remysse", points: 5, weight: 10, description: "+5 pts" },
  tchoupi: {
    kind: "tchoupi",
    label: "Tchoupi",
    points: -5,
    weight: 18,
    fallbackSprite: "/sprites/zeratchoupi.png",
    description: "−5 pts",
  },
  rudy: {
    kind: "rudy",
    label: "Rudy",
    points: 0,
    weight: 6,
    fallbackSprite: "/sprites/yrud.png",
    effect: "boost",
    description: `Points ${RUDY_BOOST_LABEL} pendant ${String(RUDY_BOOST_MS / 1000).replace(".", ",")} s`,
  },
  artymasion: {
    kind: "artymasion",
    label: "Artymasion",
    points: 0,
    weight: 8,
    effect: "popup",
    description: "Une énorme popup « avis » te bouche l'écran 3 s",
  },
};

export const WHACK_HOLES = 9;
// The game's only background music (apps/web/public), looped: the
// ZeraTchoupi voice message.
export const WHACK_MUSIC_URL = "/pranks/zeratchoupi-vocal.ogg";
export const ARTY_POPUP_MS = 3000;
// How late a hit may reach the server after the mole went back down —
// covers network latency, not reflexes.
export const WHACK_HIT_GRACE_MS = 1200;

export interface Mole {
  id: number;
  hole: number;
  kind: MoleKind;
  appearAt: number; // ms since the game started
  hideAt: number;
}

export interface WhackHit {
  moleId: number;
  atMs: number;
}

// Small deterministic PRNG (mulberry32) — same seed, same board everywhere.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(from: number, to: number, p: number): number {
  return from + (to - from) * p;
}

// Gets faster as the game goes on: a new mole every ~1 s at the start down
// to every ~0.3 s at the end, each staying up 1.5 s then only 0.65 s.
export function whackSchedule(seed: number, durationMs: number): Mole[] {
  const random = rng(seed);
  const kinds = Object.values(MOLE_KINDS);
  const totalWeight = kinds.reduce((s, k) => s + k.weight, 0);
  const pickKind = (): MoleKind => {
    let r = random() * totalWeight;
    for (const k of kinds) {
      r -= k.weight;
      if (r < 0) return k.kind;
    }
    return "taupiqueur";
  };

  const moles: Mole[] = [];
  const holeFreeAt = Array<number>(WHACK_HOLES).fill(0);
  let t = 800;
  while (t < durationMs - 400) {
    const p = t / durationMs;
    const visible = Math.round(lerp(1500, 650, p));
    const free = holeFreeAt.map((at, hole) => (at <= t ? hole : -1)).filter((h) => h >= 0);
    if (free.length > 0) {
      const hole = free[Math.floor(random() * free.length)];
      const hideAt = Math.min(t + visible, durationMs);
      moles.push({ id: moles.length, hole, kind: pickKind(), appearAt: t, hideAt });
      holeFreeAt[hole] = hideAt + 150;
    }
    t += Math.round(lerp(1000, 300, p) * (0.75 + random() * 0.5));
  }
  return moles;
}

// Score of a list of hits, in the order they were made. Rudy boosts every
// gain (not Tchoupi's loss) for RUDY_BOOST_MS after being tapped. Can go
// negative — the caller floors the player's total, not this.
export function whackScore(schedule: Mole[], hits: WhackHit[]): number {
  let score = 0;
  let boostUntil = -Infinity;
  for (const hit of hits) {
    const mole = schedule[hit.moleId];
    if (!mole) continue;
    const def = MOLE_KINDS[mole.kind];
    if (def.effect === "boost") boostUntil = hit.atMs + RUDY_BOOST_MS;
    const boosted = def.points > 0 && hit.atMs < boostUntil;
    score += boosted ? def.points * RUDY_BOOST_MULTIPLIER : def.points;
  }
  return Math.round(score);
}
