import type { BattleActivePokemon, BattleLogEntry, BattleSideSnapshot, BattleSnapshot, BoostStat } from "@yrud/shared";

export interface SideMeta {
  playerId: string;
  name: string;
}

export interface ParserState {
  snapshot: BattleSnapshot;
  sides: { p1: SideMeta; p2: SideMeta };
}

// Lines that are structurally necessary for the sim but carry nothing worth
// showing in a spectator log feed.
const NOISE_PREFIXES = [
  "t:", "gametype", "gen", "tier", "clearpoke", "poke", "teampreview",
  "start", "upkeep", "html", "player", "rule", "rated", "request",
];

function emptyActive(): BattleActivePokemon | null {
  return null;
}

export function createInitialParserState(p1: SideMeta, p2: SideMeta): ParserState {
  return {
    sides: { p1, p2 },
    snapshot: {
      p1: { playerId: p1.playerId, name: p1.name, active: emptyActive(), remainingCount: 0 },
      p2: { playerId: p2.playerId, name: p2.name, active: emptyActive(), remainingCount: 0 },
      field: { weather: null, terrain: null, pseudoWeathers: [], turn: 0 },
      winnerId: null,
    },
  };
}

function sideKeyOf(positional: string): "p1" | "p2" | null {
  // Positional identifiers look like "p1a: Charizard" or bare "p1"/"p2".
  if (positional.startsWith("p1")) return "p1";
  if (positional.startsWith("p2")) return "p2";
  return null;
}

function speciesOf(positional: string): string {
  const idx = positional.indexOf(": ");
  return idx === -1 ? positional : positional.slice(idx + 2);
}

function hpPercentFrom(hpField: string): { hpPercent: number; fainted: boolean } {
  if (hpField.includes("fnt")) return { hpPercent: 0, fainted: true };
  const [cur, max] = hpField.split(" ")[0].split("/").map(Number);
  if (!max) return { hpPercent: 0, fainted: false };
  return { hpPercent: Math.max(0, Math.min(100, Math.round((cur / max) * 100))), fainted: cur <= 0 };
}

function sideFor(snapshot: BattleSnapshot, key: "p1" | "p2"): BattleSideSnapshot {
  return snapshot[key];
}

export function applyProtocolChunk(chunk: string, state: ParserState): { state: ParserState; log: BattleLogEntry[] } {
  let snapshot: BattleSnapshot = {
    ...state.snapshot,
    p1: { ...state.snapshot.p1, active: state.snapshot.p1.active ? { ...state.snapshot.p1.active } : null },
    p2: { ...state.snapshot.p2, active: state.snapshot.p2.active ? { ...state.snapshot.p2.active } : null },
    field: { ...state.snapshot.field, pseudoWeathers: [...state.snapshot.field.pseudoWeathers] },
  };
  const log: BattleLogEntry[] = [];

  for (const rawLine of chunk.split("\n")) {
    const line = rawLine.trim();
    if (!line || !line.startsWith("|")) continue;
    const parts = line.slice(1).split("|");
    const type = parts[0];
    if (NOISE_PREFIXES.includes(type)) continue;

    switch (type) {
      case "teamsize": {
        const key = sideKeyOf(parts[1]);
        if (!key) break;
        const remainingCount = Number(parts[2]) || 0;
        snapshot = { ...snapshot, [key]: { ...sideFor(snapshot, key), remainingCount } };
        break;
      }
      case "switch":
      case "drag": {
        const key = sideKeyOf(parts[1]);
        if (!key) break;
        const { hpPercent, fainted } = hpPercentFrom(parts[3] ?? "0/0");
        // Stat boosts reset on switch-out — a fresh active always starts at 0.
        const active: BattleActivePokemon = { species: speciesOf(parts[1]), level: 100, hpPercent, fainted, boosts: {} };
        snapshot = { ...snapshot, [key]: { ...sideFor(snapshot, key), active } };
        log.push({ kind: "switch", actor: key, species: active.species });
        break;
      }
      case "move": {
        const key = sideKeyOf(parts[1]);
        log.push({ kind: "move", actor: key ?? parts[1], move: parts[2], target: parts[3] });
        break;
      }
      case "-damage":
      case "-heal": {
        const key = sideKeyOf(parts[1]);
        if (!key) break;
        const { hpPercent, fainted } = hpPercentFrom(parts[2] ?? "0/0");
        const prevActive = sideFor(snapshot, key).active;
        snapshot = {
          ...snapshot,
          [key]: { ...sideFor(snapshot, key), active: prevActive ? { ...prevActive, hpPercent, fainted } : prevActive },
        };
        log.push({ kind: "damage", target: key, hpPercent });
        break;
      }
      case "faint": {
        const key = sideKeyOf(parts[1]);
        if (!key) break;
        const prevActive = sideFor(snapshot, key).active;
        const side = sideFor(snapshot, key);
        snapshot = {
          ...snapshot,
          [key]: {
            ...side,
            active: prevActive ? { ...prevActive, hpPercent: 0, fainted: true } : prevActive,
            remainingCount: Math.max(0, side.remainingCount - 1),
          },
        };
        log.push({ kind: "faint", target: key });
        break;
      }
      case "-status": {
        const key = sideKeyOf(parts[1]);
        if (!key) break;
        const status = parts[2] as BattleActivePokemon["status"];
        const prevActive = sideFor(snapshot, key).active;
        snapshot = {
          ...snapshot,
          [key]: { ...sideFor(snapshot, key), active: prevActive ? { ...prevActive, status } : prevActive },
        };
        if (status) log.push({ kind: "status", target: key, status });
        break;
      }
      case "-boost":
      case "-unboost": {
        const key = sideKeyOf(parts[1]);
        if (!key) break;
        const stat = parts[2] as BoostStat;
        const amount = (Number(parts[3]) || 0) * (type === "-unboost" ? -1 : 1);
        const prevActive = sideFor(snapshot, key).active;
        if (prevActive) {
          const current = prevActive.boosts[stat] ?? 0;
          const next = Math.max(-6, Math.min(6, current + amount));
          snapshot = {
            ...snapshot,
            [key]: { ...sideFor(snapshot, key), active: { ...prevActive, boosts: { ...prevActive.boosts, [stat]: next } } },
          };
          log.push({ kind: "boost", target: key, stat, amount });
        }
        break;
      }
      case "-weather": {
        // Best-effort only — no duration data lives in the text protocol.
        // battleRunner overwrites this field wholesale from the live Battle
        // object (which does have duration), this just keeps the parser
        // independently correct and testable without that context.
        const weatherId = parts[1] === "none" ? null : parts[1];
        snapshot = {
          ...snapshot,
          field: { ...snapshot.field, weather: weatherId ? { id: weatherId, label: weatherId, durationTurns: null } : null },
        };
        if (weatherId) log.push({ kind: "weather", weather: weatherId });
        break;
      }
      case "-fieldstart": {
        const conditionId = (parts[1] ?? "").replace(/^move:\s*/, "");
        if (conditionId && !snapshot.field.pseudoWeathers.some((e) => e.id === conditionId)) {
          snapshot = {
            ...snapshot,
            field: {
              ...snapshot.field,
              pseudoWeathers: [...snapshot.field.pseudoWeathers, { id: conditionId, label: conditionId, durationTurns: null }],
            },
          };
        }
        log.push({ kind: "fieldstart", condition: conditionId });
        break;
      }
      case "-fieldend": {
        const conditionId = (parts[1] ?? "").replace(/^move:\s*/, "");
        snapshot = {
          ...snapshot,
          field: { ...snapshot.field, pseudoWeathers: snapshot.field.pseudoWeathers.filter((e) => e.id !== conditionId) },
        };
        break;
      }
      case "turn": {
        const turn = Number(parts[1]) || 0;
        snapshot = { ...snapshot, field: { ...snapshot.field, turn } };
        log.push({ kind: "turn", turn });
        break;
      }
      case "win": {
        const name = parts[1];
        const winnerId =
          name === state.sides.p1.name ? state.sides.p1.playerId : name === state.sides.p2.name ? state.sides.p2.playerId : null;
        snapshot = { ...snapshot, winnerId };
        log.push({ kind: "win", winnerName: name });
        break;
      }
      default: {
        if (line.startsWith("||") || type === "") break; // Showdown's own blank/system separators
        log.push({ kind: "text", text: line });
      }
    }
  }

  return { state: { ...state, snapshot }, log };
}
