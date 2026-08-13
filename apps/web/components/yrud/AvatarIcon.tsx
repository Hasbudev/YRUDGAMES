import { resolveAvatar } from "@yrud/shared";

// Hand-drawn 24x24 glyphs, one per Pokémon type emblem — no external art
// dependency, and stylistically flat/geometric to match the rest of the UI.
const ICON_PATHS: Record<string, string> = {
  feu: "M12 2c-1 3-4 4-4 8a4 4 0 0 0 8 0c0-1-.5-2-1-3 1 0 2 1 2 3a5 5 0 0 1-10 0c0-5 3-6 5-8z",
  eau: "M12 2c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z",
  plante: "M4 20c8 0 16-6 16-16-10 0-16 6-16 16zM4 20c2-6 6-10 12-13",
  electrik: "M13 2 4 14h6l-1 8 9-12h-6l1-8z",
  psy: "M2 12c2-4 6-7 10-7s8 3 10 7c-2 4-6 7-10 7s-8-3-10-7z",
  tenebres: "M20 12a8 8 0 1 1-8-8 6 6 0 0 0 8 8z",
  fee: "M12 2c.5 4 2 6 6 8-4 2-5.5 4-6 8-.5-4-2-6-6-8 4-2 5.5-4 6-8z",
  dragon: "M4 20 8 8l4 6 4-6 4 12z",
};

interface AvatarIconProps {
  avatarId?: string | null;
  seed: string;
  size?: number;
  className?: string;
}

export function AvatarIcon({ avatarId, seed, size = 32, className = "" }: AvatarIconProps) {
  const avatar = resolveAvatar(avatarId, seed);
  const path = ICON_PATHS[avatar.id];

  return (
    <div
      title={avatar.label}
      className={`flex shrink-0 items-center justify-center rounded-full border-2 ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: avatar.color,
        background: `radial-gradient(circle at 35% 30%, ${avatar.color}55, ${avatar.color}1a)`,
        boxShadow: `0 0 ${Math.round(size * 0.4)}px ${avatar.glow}`,
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} fill={avatar.color}>
        {avatar.id === "psy" ? (
          <>
            <path d={path} />
            <circle cx="12" cy="12" r="3" fill="#050409" />
          </>
        ) : (
          <path d={path} />
        )}
      </svg>
    </div>
  );
}
