// The RPPLF community's three clans — a separate axis from the elemental
// avatar emblem (that's personal flavor; this is which faction a player
// reps). Picked at join time; same deterministic-hash fallback pattern as
// avatars.ts so every player always resolves to a real clan even if an old
// client never sent one.
export interface ClanDefinition {
  id: string;
  label: string;
  color: string;
  glow: string;
  logo: string;
}

export const CLAN_REGISTRY: ClanDefinition[] = [
  { id: "rapepolofia", label: "Rapepolofia", color: "#5fb85a", glow: "rgba(95,184,90,0.55)", logo: "/clans/RAPEPOLOFIA.webp" },
  { id: "paldea", label: "Paldea", color: "#c23b6b", glow: "rgba(194,59,107,0.55)", logo: "/clans/paldea.png" },
  // Yrud fields his own clan in the event — his sbires get no gameplay
  // bonus, just his favoritism (see the elimination/finale caption pools).
  { id: "yrud", label: "Yrud", color: "#e8c15a", glow: "rgba(232,193,90,0.55)", logo: "/clans/Yrud.png" },
];

function hashToIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % CLAN_REGISTRY.length;
}

export function resolveClan(id: string | null | undefined, fallbackSeed: string): ClanDefinition {
  const found = id ? CLAN_REGISTRY.find((c) => c.id === id) : undefined;
  return found ?? CLAN_REGISTRY[hashToIndex(fallbackSeed)];
}
