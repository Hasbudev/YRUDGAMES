// Player avatars are Pokémon-type emblems — thematic, instantly recognizable,
// and needing no external art. Picked at join time; the server falls back to
// a deterministic hash of the player id for anyone who didn't pick one (old
// clients, reconnects) so every player always resolves to a real emblem.
export interface AvatarDefinition {
  id: string;
  label: string;
  color: string;
  glow: string;
}

export const AVATAR_REGISTRY: AvatarDefinition[] = [
  { id: "feu", label: "Feu", color: "#e0652c", glow: "rgba(224,101,44,0.55)" },
  { id: "eau", label: "Eau", color: "#4f8fe0", glow: "rgba(79,143,224,0.55)" },
  { id: "plante", label: "Plante", color: "#5fb85a", glow: "rgba(95,184,90,0.55)" },
  { id: "electrik", label: "Électrik", color: "#e8c14a", glow: "rgba(232,193,74,0.55)" },
  { id: "psy", label: "Psy", color: "#e0568f", glow: "rgba(224,86,143,0.55)" },
  { id: "tenebres", label: "Ténèbres", color: "#7d72a3", glow: "rgba(125,114,163,0.55)" },
  { id: "fee", label: "Fée", color: "#e8a0d0", glow: "rgba(232,160,208,0.55)" },
  { id: "dragon", label: "Dragon", color: "#6a5fd6", glow: "rgba(106,95,214,0.55)" },
];

function hashToIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % AVATAR_REGISTRY.length;
}

export function resolveAvatar(id: string | null | undefined, fallbackSeed: string): AvatarDefinition {
  const found = id ? AVATAR_REGISTRY.find((a) => a.id === id) : undefined;
  return found ?? AVATAR_REGISTRY[hashToIndex(fallbackSeed)];
}
