import type { BattleFieldSnapshot } from "@yrud/shared";

const RAIN_IDS = ["raindance", "primordialsea"];
const SUN_IDS = ["sunnyday", "desolateland"];
const SAND_IDS = ["sandstorm"];
const SNOW_IDS = ["snow", "hail"];

const TERRAIN_COLOR: Record<string, string> = {
  psychicterrain: "rgba(224,86,143,0.35)",
  electricterrain: "rgba(232,193,74,0.35)",
  grassyterrain: "rgba(95,184,90,0.35)",
  mistyterrain: "rgba(232,160,208,0.35)",
};

// Fixed, deterministic drop/particle fields — no Math.random at render time
// (avoids SSR/client hydration mismatches), same approach as ArenaBackdrop.
const RAIN_DROPS: Array<[number, number, number]> = Array.from({ length: 24 }, (_, i) => [
  (i * 4.3) % 100,
  (i % 7) * 0.15,
  0.5 + (i % 4) * 0.08,
]);
const SNOW_FLAKES: Array<[number, number, number]> = Array.from({ length: 18 }, (_, i) => [
  (i * 5.7) % 100,
  (i % 9) * 0.4,
  3 + (i % 5) * 0.6,
]);
const SAND_STREAKS: Array<[number, number, number]> = Array.from({ length: 10 }, (_, i) => [
  (i * 9.5) % 90,
  (i % 5) * 0.5,
  1.4 + (i % 3) * 0.3,
]);

function RainEffect() {
  return (
    <div className="absolute inset-0 opacity-70">
      {RAIN_DROPS.map(([left, delay, duration], i) => (
        <span
          key={i}
          className="absolute top-0 h-10 w-px bg-gradient-to-b from-transparent via-sky-300/70 to-transparent"
          style={{ left: `${left}%`, animation: `rain-fall ${duration}s linear ${delay}s infinite` }}
        />
      ))}
      <div className="absolute inset-0 bg-blue-500/5" />
    </div>
  );
}

function SnowEffect() {
  return (
    <div className="absolute inset-0">
      {SNOW_FLAKES.map(([left, delay, duration], i) => (
        <span
          key={i}
          className="absolute top-0 h-1.5 w-1.5 rounded-full bg-white/80"
          style={{ left: `${left}%`, animation: `snow-fall ${duration}s linear ${delay}s infinite` }}
        />
      ))}
      <div className="absolute inset-0 bg-sky-100/5" />
    </div>
  );
}

function SandEffect() {
  return (
    <div className="absolute inset-0">
      {SAND_STREAKS.map(([top, delay, duration], i) => (
        <span
          key={i}
          className="absolute h-1 w-16 rounded-full bg-amber-700/50"
          style={{ top: `${top}%`, animation: `sand-drift ${duration}s linear ${delay}s infinite` }}
        />
      ))}
      <div className="absolute inset-0 bg-amber-800/10" />
    </div>
  );
}

function SunEffect() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div
        className="h-[140%] w-[140%] rounded-full bg-[conic-gradient(rgba(246,211,116,0.18),transparent_20%,transparent_80%,rgba(246,211,116,0.18))]"
        style={{ animation: "sun-ray-spin 18s linear infinite" }}
      />
      <div
        className="absolute h-40 w-40 rounded-full bg-amber-300/30 blur-2xl"
        style={{ animation: "sun-pulse 3s ease-in-out infinite" }}
      />
    </div>
  );
}

function TrickRoomEffect() {
  return (
    <div
      className="absolute inset-0 [background-image:repeating-linear-gradient(45deg,rgba(106,95,214,0.12)_0,rgba(106,95,214,0.12)_10px,transparent_10px,transparent_20px),repeating-linear-gradient(-45deg,rgba(217,88,74,0.1)_0,rgba(217,88,74,0.1)_10px,transparent_10px,transparent_20px)]"
      style={{ animation: "trickroom-warp 4s ease-in-out infinite" }}
    />
  );
}

function GravityEffect() {
  return (
    <div
      className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-purple-900/30"
      style={{ animation: "gravity-pulse 2.5s ease-in-out infinite" }}
    />
  );
}

export function FieldEffectOverlay({ field }: { field: BattleFieldSnapshot }) {
  const weatherId = field.weather?.id.toLowerCase() ?? "";
  const hasTrickRoom = field.pseudoWeathers.some((e) => e.id === "trickroom");
  const hasGravity = field.pseudoWeathers.some((e) => e.id === "gravity");
  const terrainColor = field.terrain ? TERRAIN_COLOR[field.terrain.id] : undefined;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {RAIN_IDS.includes(weatherId) && <RainEffect />}
      {SUN_IDS.includes(weatherId) && <SunEffect />}
      {SAND_IDS.includes(weatherId) && <SandEffect />}
      {SNOW_IDS.includes(weatherId) && <SnowEffect />}
      {hasTrickRoom && <TrickRoomEffect />}
      {hasGravity && <GravityEffect />}
      {terrainColor && (
        <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(to top, ${terrainColor}, transparent)` }} />
      )}
    </div>
  );
}
