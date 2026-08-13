import type { BattleLogEntry } from "@yrud/shared";

const STATUS_LABEL: Record<string, string> = {
  brn: "brûlure",
  par: "paralysie",
  slp: "sommeil",
  frz: "gel",
  psn: "poison",
  tox: "poison grave",
};

// Common Showdown flavor tags that don't get their own structured
// BattleLogEntry kind — recognized here purely for display so the log feed
// reads as commentary instead of protocol jargon. Anything not in this list
// still shows (stripped of positional prefixes), just untranslated.
const FLAVOR_LABEL: Record<string, string> = {
  "-resisted": "...ce n'est pas très efficace...",
  "-supereffective": "C'est super efficace !",
  "-crit": "Coup critique !",
  "-immune": "Ça n'affecte pas l'adversaire...",
  "-miss": "L'attaque échoue !",
  "-fail": "Mais ça échoue !",
};

const STAT_LABEL: Record<string, string> = {
  atk: "Attaque",
  def: "Défense",
  spa: "Attaque Spé.",
  spd: "Défense Spé.",
  spe: "Vitesse",
  accuracy: "Précision",
  evasion: "Esquive",
};

function cleanRawLine(text: string): string {
  const parts = text.replace(/^\|+/, "").split("|");
  const tag = parts[0];
  if (FLAVOR_LABEL[tag]) return FLAVOR_LABEL[tag];
  return parts
    .map((p) => p.replace(/^p[12]a?:\s*/, ""))
    .filter(Boolean)
    .join(" ");
}

interface BattleLogFeedProps {
  entries: BattleLogEntry[];
  sideNames: { p1: string; p2: string };
}

function nameFor(side: string, sideNames: { p1: string; p2: string }): string {
  return side === "p1" ? sideNames.p1 : side === "p2" ? sideNames.p2 : side;
}

function describe(entry: BattleLogEntry, sideNames: { p1: string; p2: string }): string {
  switch (entry.kind) {
    case "move":
      return `${nameFor(entry.actor, sideNames)} utilise ${entry.move} !`;
    case "damage":
      return `${nameFor(entry.target, sideNames)} : ${entry.hpPercent}% PV`;
    case "faint":
      return `${nameFor(entry.target, sideNames)} est K.O. !`;
    case "status":
      return `${nameFor(entry.target, sideNames)} est affecté(e) par : ${STATUS_LABEL[entry.status] ?? entry.status} !`;
    case "boost": {
      const statLabel = STAT_LABEL[entry.stat] ?? entry.stat;
      const direction = entry.amount > 0 ? "augmente" : "diminue";
      return `${nameFor(entry.target, sideNames)} : ${statLabel} ${direction} !`;
    }
    case "weather":
      return `La météo devient ${entry.weather} !`;
    case "fieldstart":
      return `${entry.condition} entre en jeu !`;
    case "switch":
      return `${nameFor(entry.actor, sideNames)} envoie ${entry.species} !`;
    case "turn":
      return `— Tour ${entry.turn} —`;
    case "win":
      return `${entry.winnerName} remporte la bataille !`;
    case "text":
      return cleanRawLine(entry.text);
  }
}

export function BattleLogFeed({ entries, sideNames }: BattleLogFeedProps) {
  const recent = entries.slice(-25);
  return (
    <div className="panel flex max-h-40 w-full max-w-2xl flex-col gap-1 overflow-y-auto rounded-xl p-3 text-xs text-ink-muted">
      {recent.length === 0 ? (
        <p>La bataille commence...</p>
      ) : (
        recent.map((entry, i) => <p key={i}>{describe(entry, sideNames)}</p>)
      )}
    </div>
  );
}
