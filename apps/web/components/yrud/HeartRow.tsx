import Image from "next/image";

interface HeartRowProps {
  lives: number;
  maxLives: number;
  size?: number;
}

export function HeartRow({ lives, maxLives, size = 14 }: HeartRowProps) {
  const base = Math.max(maxLives, 1);

  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: base }, (_, i) => (
        <Image
          key={i}
          src={i < lives ? "/play/heart-filled.png" : "/play/heart-empty.png"}
          alt=""
          width={size}
          height={size}
          className={i < lives ? "" : "opacity-60"}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}
