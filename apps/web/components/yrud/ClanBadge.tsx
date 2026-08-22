import Image from "next/image";
import { resolveClan } from "@yrud/shared";

interface ClanBadgeProps {
  clanId?: string | null;
  seed: string;
  size?: number;
  className?: string;
}

// The player's sole visual identity — a circular clan-crest badge (border +
// radial glow for a bit of presence) shown at whatever size the context
// calls for, from a small corner accent up to the main player-card portrait.
export function ClanBadge({ clanId, seed, size, className = "" }: ClanBadgeProps) {
  const clan = resolveClan(clanId, seed);
  // Most callers use this as a corner-overlay badge (className="absolute
  // ...") on top of an avatar. A Tailwind class conflict between that and a
  // hardcoded `relative` here would be a silent layout bug — "relative" and
  // "absolute" are the same CSS property, and which one wins depends on
  // Tailwind's generated stylesheet order, not the order classes appear in
  // this string. Setting position via inline style (which always wins over
  // classes) and skipping it entirely when the caller already opted into
  // "absolute" sidesteps that fight; the image still gets a real positioned
  // ancestor via the dedicated inner wrapper below, regardless of which one
  // the root ends up as.
  const callerPositions = className.includes("absolute") || className.includes("fixed") || className.includes("sticky");
  // `size` is a pixel value some callers pass explicitly; others size this
  // via className (e.g. "h-full w-full" to fill a pre-shaped card slot).
  // Leaving width/height out of `style` entirely when size is omitted is
  // what lets that className actually take effect — an inline style always
  // wins over a class for the same property, so a hardcoded fallback number
  // here would silently shrink the badge to that fixed size regardless of
  // what className asked for (exactly the bug that left the card art's own
  // placeholder-silhouette visible around the edges of an undersized badge).
  const glowRadius = Math.round((size ?? 40) * 0.4);

  return (
    <div
      title={clan.label}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${className}`}
      style={{
        position: callerPositions ? undefined : "relative",
        width: size,
        height: size,
        borderColor: clan.color,
        background: `radial-gradient(circle at 35% 30%, ${clan.color}55, ${clan.color}1a)`,
        boxShadow: `0 0 ${glowRadius}px ${clan.glow}`,
      }}
    >
      <div className="relative h-full w-full">
        <Image src={clan.logo} alt={clan.label} fill sizes={size ? `${size}px` : "100px"} className="object-cover" />
      </div>
    </div>
  );
}
