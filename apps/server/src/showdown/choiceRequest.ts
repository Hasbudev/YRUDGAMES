import type { BattleChoiceRequest, BattleMoveOption, BattleSwitchOption } from "@yrud/shared";

// Showdown's own request JSON (from a `|request|` protocol line) — trimmed
// to the fields we actually read. Loosely typed on purpose: it's raw
// JSON.parse output from an external protocol, not our own domain type.
interface RawPokemonEntry {
  details: string;
  condition: string;
  active?: boolean;
}
interface RawMoveEntry {
  id: string;
  move: string;
  pp?: number;
  maxpp?: number;
  disabled?: string | boolean;
}
interface RawChoiceRequest {
  wait?: boolean;
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  active?: { moves: RawMoveEntry[]; trapped?: boolean; maybeTrapped?: boolean }[];
  side?: { pokemon: RawPokemonEntry[] };
}

export function parseChoiceRequest(raw: RawChoiceRequest): BattleChoiceRequest | null {
  if (!raw || raw.wait) return null;

  const switchOptions: BattleSwitchOption[] = (raw.side?.pokemon ?? []).map((p, i) => ({
    slot: i + 1,
    species: p.details.split(",")[0].trim(),
    fainted: p.condition.includes("fnt"),
    isActive: Boolean(p.active),
  }));

  if (raw.teamPreview) {
    return { teamPreview: true, forceSwitch: false, trapped: false, moves: [], switchOptions };
  }

  if (raw.forceSwitch) {
    return { teamPreview: false, forceSwitch: true, trapped: false, moves: [], switchOptions };
  }

  if (raw.active) {
    const activeMon = raw.active[0];
    const moves: BattleMoveOption[] = (activeMon?.moves ?? []).map((m) => ({
      id: m.id,
      name: m.move,
      pp: m.pp ?? 0,
      maxPp: m.maxpp ?? 0,
      disabled: Boolean(m.disabled),
    }));
    const trapped = Boolean(activeMon?.trapped);
    return { teamPreview: false, forceSwitch: false, trapped, moves, switchOptions };
  }

  return null;
}
