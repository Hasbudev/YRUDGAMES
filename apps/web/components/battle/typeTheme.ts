// Standard competitive Pokémon type colors — a move's type only ever
// influences icon + accent color + glow (never card shape/layout), per the
// final-battle design brief.
export const TYPE_COLORS: Record<string, string> = {
  Normal: "#A8A878",
  Fire: "#F08030",
  Water: "#6890F0",
  Electric: "#F8D030",
  Grass: "#78C850",
  Ice: "#98D8D8",
  Fighting: "#C03028",
  Poison: "#A040A0",
  Ground: "#E0C068",
  Flying: "#A890F0",
  Psychic: "#F85888",
  Bug: "#A8B820",
  Rock: "#B8A038",
  Ghost: "#705898",
  Dragon: "#7038F8",
  Dark: "#705848",
  Steel: "#B8B8D0",
  Fairy: "#EE99AC",
};

export const TYPE_LABELS: Record<string, string> = {
  Normal: "Normal",
  Fire: "Feu",
  Water: "Eau",
  Electric: "Électrik",
  Grass: "Plante",
  Ice: "Glace",
  Fighting: "Combat",
  Poison: "Poison",
  Ground: "Sol",
  Flying: "Vol",
  Psychic: "Psy",
  Bug: "Insecte",
  Rock: "Roche",
  Ghost: "Spectre",
  Dragon: "Dragon",
  Dark: "Ténèbres",
  Steel: "Acier",
  Fairy: "Fée",
};

// Small flat glyphs, one per type — same hand-drawn style as AvatarIcon so
// the battle UI and the arena portraits read as one visual language.
const TYPE_PATHS: Record<string, string> = {
  Normal: "M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0z",
  Fire: "M12 2c-1 3-4 4-4 8a4 4 0 0 0 8 0c0-1-.5-2-1-3 1 0 2 1 2 3a5 5 0 0 1-10 0c0-5 3-6 5-8z",
  Water: "M12 2c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z",
  Electric: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  Grass: "M4 20c8 0 16-6 16-16-10 0-16 6-16 16zM4 20c2-6 6-10 12-13",
  Ice: "M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M12 2 9 5m3-3 3 3M12 22l-3-3m3 3 3-3",
  Fighting: "M6 4h4l1 3h2l1-3h4l-2 6 2 4-3 6h-4l-1-3h-2l-1 3H6l2-6-2-4z",
  Poison: "M12 2c3 3 6 7 6 11a6 6 0 0 1-12 0c0-4 3-8 6-11zm0 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  Ground: "M2 16h20M4 16l3-8h10l3 8M9 16v-4h6v4",
  Flying: "M2 12c4-6 9-8 10-8-2 3-2 5-2 5s6-3 12-1c-4 2-7 2-7 2s5 1 7 4c-6-1-9 0-9 0s3 2 3 5c-3-2-5-4-5-4s-1 4-4 5c1-3 1-5 1-5s-4 1-6-3z",
  Psychic: "M12 2a5 5 0 0 1 5 5c0 2-1 3-2 4l-1 1v2h2v2h-2v2h-4v-2H8v-2h2v-2l-1-1c-1-1-2-2-2-4a5 5 0 0 1 5-5z",
  Bug: "M9 4a3 3 0 0 1 6 0v2a3 3 0 0 1-6 0zm3 5c-4 0-7 3-7 7a4 4 0 0 0 4 4c0-2 1-4 3-4s3 2 3 4a4 4 0 0 0 4-4c0-4-3-7-7-7z",
  Rock: "M5 18 8 8l4-3 4 3 3 10H5z",
  Ghost: "M12 3a7 7 0 0 0-7 7v9l2.5-2 2 2 2.5-2.5L14.5 19l2-2 2.5 2v-9a7 7 0 0 0-7-7z",
  Dragon: "M4 20 8 8l4 6 4-6 4 12z",
  Dark: "M20 12a8 8 0 1 1-8-8 6 6 0 0 0 8 8z",
  Steel: "M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z",
  Fairy: "M12 2c.5 4 2 6 6 8-4 2-5.5 4-6 8-.5-4-2-6-6-8 4-2 5.5-4 6-8z",
};

export function TypeIcon({ type, size = 16, className = "" }: { type: string; size?: number; className?: string }) {
  const path = TYPE_PATHS[type] ?? TYPE_PATHS.Normal;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d={path} />
    </svg>
  );
}

export function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.Normal;
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
