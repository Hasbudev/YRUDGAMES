import type { Battle } from "pokemon-showdown";
import type { BattleFieldSnapshot, FieldEffectInfo } from "@yrud/shared";

// French display names for the effect ids Yrud can trigger or that come up
// often from real team play. Anything not listed falls back to its raw id
// rather than failing — new effects still show, just untranslated.
const EFFECT_LABELS: Record<string, string> = {
  raindance: "Pluie",
  primordialsea: "Pluie éternelle",
  sunnyday: "Soleil",
  desolateland: "Soleil extrême",
  sandstorm: "Tempête de sable",
  snow: "Neige",
  hail: "Grêle",
  trickroom: "Distorsion",
  gravity: "Gravité",
  psychicterrain: "Terrain Psychique",
  electricterrain: "Terrain Électrique",
  grassyterrain: "Terrain Herbu",
  mistyterrain: "Terrain Brumeux",
};

function labelFor(id: string): string {
  return EFFECT_LABELS[id] ?? id;
}

// Duration isn't carried in the protocol text stream — it only lives on the
// live Battle object's EffectState — so field state is read straight from
// `battle.field`/`battle.turn` after every update rather than tracked from
// parsed log lines (which would drift and can't know duration at all).
export function readFieldState(battle: Battle): BattleFieldSnapshot {
  const field = battle.field;

  const weather: FieldEffectInfo | null = field.weather
    ? { id: field.weather, label: labelFor(field.weather), durationTurns: field.weatherState.duration ?? null }
    : null;

  const terrain: FieldEffectInfo | null = field.terrain
    ? { id: field.terrain, label: labelFor(field.terrain), durationTurns: field.terrainState.duration ?? null }
    : null;

  const pseudoWeathers: FieldEffectInfo[] = Object.entries(field.pseudoWeather).map(([id, state]) => ({
    id,
    label: labelFor(id),
    durationTurns: state.duration ?? null,
  }));

  return { weather, terrain, pseudoWeathers, turn: battle.turn };
}
