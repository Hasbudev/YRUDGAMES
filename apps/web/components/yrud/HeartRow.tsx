const HEART_PATH = "M12 4.4C10.5 2.6 8 2 6 3.4 3 5.5 3 9 6 12l6 6 6-6c3-3 3-6.5 0-8.6-2-1.4-4.5-.8-6 1z";

interface HeartRowProps {
  lives: number;
  maxLives: number;
  size?: number;
}

export function HeartRow({ lives, maxLives, size = 14 }: HeartRowProps) {
  const base = Math.max(maxLives, 1);
  const bonus = Math.max(0, lives - base);

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: base }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size}>
          <path
            d={HEART_PATH}
            fill={i < lives ? "var(--color-crimson-bright)" : "none"}
            stroke={i < lives ? "var(--color-crimson-bright)" : "var(--color-ink-muted)"}
            strokeWidth={1.5}
            opacity={i < lives ? 1 : 0.4}
          />
        </svg>
      ))}
      {Array.from({ length: bonus }, (_, i) => (
        <svg key={`bonus-${i}`} viewBox="0 0 24 24" width={size} height={size} className="drop-shadow-[0_0_4px_rgba(232,193,90,0.8)]">
          <path d={HEART_PATH} fill="var(--color-gold-bright)" stroke="var(--color-gold-bright)" strokeWidth={1.5} />
        </svg>
      ))}
    </span>
  );
}
