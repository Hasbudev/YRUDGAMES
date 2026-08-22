import Image from "next/image";
import type { BattleFieldSnapshot } from "@yrud/shared";

const RAIN_IDS = ["raindance", "primordialsea"];
const SUN_IDS = ["sunnyday", "desolateland"];
const SAND_IDS = ["sandstorm"];
const SNOW_IDS = ["snow", "hail"];

function weatherChip(weatherId: string): { src: string; w: number; h: number } | null {
  if (RAIN_IDS.includes(weatherId)) return { src: "/fight/weather-rain-card.png", w: 283, h: 120 };
  if (SUN_IDS.includes(weatherId)) return { src: "/fight/weather-sunny-card.png", w: 283, h: 120 };
  if (SAND_IDS.includes(weatherId)) return { src: "/fight/weather-sand-card.png", w: 283, h: 120 };
  if (SNOW_IDS.includes(weatherId)) return { src: "/fight/weather-snow-card.png", w: 261, h: 120 };
  return null;
}

function Chip({ src, w, h, durationTurns }: { src: string; w: number; h: number; durationTurns: number | null }) {
  return (
    <div className="relative h-10 sm:h-12" style={{ aspectRatio: `${w}/${h}` }}>
      <Image src={src} alt="" fill sizes="120px" className="object-contain" />
      {durationTurns !== null && (
        <span
          className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-gold/50 bg-void-deep px-1 font-mono text-[9px] font-bold text-gold-bright shadow-[0_0_6px_rgba(0,0,0,0.6)]"
          title={`${durationTurns} tour${durationTurns > 1 ? "s" : ""} restant${durationTurns > 1 ? "s" : ""}`}
        >
          {durationTurns}
        </span>
      )}
    </div>
  );
}

// Compact "active effects" row — only the effects genuinely in play get
// shown, never all four weather states as a permanent legend. Each chip
// carries a small turn-counter badge when Showdown reports a duration
// (indefinite effects like Primordial Sea report none, so nothing is shown
// there rather than fabricating a countdown).
export function EffectIndicators({ field }: { field: BattleFieldSnapshot }) {
  const weather = field.weather ? weatherChip(field.weather.id.toLowerCase()) : null;
  const trickRoom = field.pseudoWeathers.find((e) => e.id === "trickroom");
  const gravity = field.pseudoWeathers.find((e) => e.id === "gravity");

  if (!weather && !trickRoom && !gravity) return null;

  return (
    <div className="pointer-events-none flex items-center gap-2">
      {weather && <Chip {...weather} durationTurns={field.weather?.durationTurns ?? null} />}
      {trickRoom && <Chip src="/fight/chip-distortion.png" w={172} h={103} durationTurns={trickRoom.durationTurns} />}
      {gravity && <Chip src="/fight/chip-gravity.png" w={172} h={103} durationTurns={gravity.durationTurns} />}
    </div>
  );
}
