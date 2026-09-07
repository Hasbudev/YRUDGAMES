import type { BattleLogEntry } from "@yrud/shared";
import { OrnateScrollArea } from "@/components/site/OrnateScrollArea";

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
  "-immune": "Ça n'affecte pas l'adversaire...",
  "-miss": "L'attaque échoue !",
  "-fail": "Mais ça échoue !",
};

// Reasons Showdown gives for "cant" — a move failing to even attempt (not
// the same as -fail, which is a move that fired but had no effect). Falls
// back to a generic "ne peut pas attaquer" for reasons not listed here
// (e.g. an ability like Truant, or a held-in-place volatile).
const CANT_REASON_LABEL: Record<string, string> = {
  par: "est paralysé(e) et ne peut pas attaquer !",
  frz: "est gelé(e) et ne peut pas attaquer !",
  slp: "dort profondément...",
  flinch: "a eu une hésitation et ne peut pas attaquer !",
  nopp: "n'a plus de PP pour cette capacité !",
  recharge: "doit récupérer après son attaque !",
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

// Catch-all for the long tail of obscure protocol tags with no dedicated
// BattleLogEntry kind (e.g. -activate, -setboost, -zpower...). Whatever
// isn't explicitly translated above must never show its raw tag token —
// dropping it and keeping only the descriptive parts is what actually
// guarantees no literal "-something" jargon leaks into the log, rather
// than relying on every possible tag being individually listed here.
function cleanRawLine(text: string): string {
  const parts = text.replace(/^\|+/, "").split("|");
  const tag = parts[0];
  if (FLAVOR_LABEL[tag]) return FLAVOR_LABEL[tag];
  const rest = parts
    .slice(1)
    .map((p) => p.replace(/^p[12]a?:\s*/, ""))
    .filter(Boolean);
  return rest.length > 0 ? rest.join(" ") : tag.replace(/^-/, "");
}

function nameFor(side: string, sideNames: { p1: string; p2: string }): string {
  return side === "p1" ? sideNames.p1 : side === "p2" ? sideNames.p2 : side;
}

function describe(entry: BattleLogEntry, sideNames: { p1: string; p2: string }): string {
  switch (entry.kind) {
    case "move":
      return `${nameFor(entry.actor, sideNames)} utilise ${entry.move} !`;
    case "damage": {
      const name = nameFor(entry.target, sideNames);
      if (entry.isHeal) {
        return entry.sourceLabel
          ? `${name} regagne de la vie (${entry.sourceLabel}) : ${entry.hpPercent}% PV`
          : `${name} regagne de la vie : ${entry.hpPercent}% PV`;
      }
      return entry.sourceLabel
        ? `${name} (${entry.sourceLabel}) : ${entry.hpPercent}% PV`
        : `${name} : ${entry.hpPercent}% PV`;
    }
    case "crit":
      return "Coup critique !";
    case "supereffective":
      return "C'est super efficace !";
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
    case "tie":
      return "Match nul — aucun des deux Pokémon n'a survécu !";
    case "sidestart":
      return `${entry.condition} entre en jeu du côté de ${nameFor(entry.target, sideNames)} !`;
    case "sideend":
      return `${entry.condition} disparaît du côté de ${nameFor(entry.target, sideNames)} !`;
    case "ability":
      return `${nameFor(entry.target, sideNames)} — Talent : ${entry.ability} !`;
    case "item":
      return `${nameFor(entry.target, sideNames)} révèle : ${entry.item} !`;
    case "enditem":
      return `${nameFor(entry.target, sideNames)} — ${entry.item} est consommé !`;
    case "volatilestart":
      return `${nameFor(entry.target, sideNames)} : ${entry.effect} !`;
    case "volatileend":
      return `${nameFor(entry.target, sideNames)} : fin de ${entry.effect} !`;
    case "terastallize":
      return `${nameFor(entry.target, sideNames)} se téracristallise en type ${entry.teraType} !`;
    case "cant": {
      const reason = CANT_REASON_LABEL[entry.reason];
      return reason ? `${nameFor(entry.target, sideNames)} ${reason}` : `${nameFor(entry.target, sideNames)} ne peut pas attaquer !`;
    }
    case "curestatus":
      return `${nameFor(entry.target, sideNames)} est soigné(e) !`;
    case "formechange":
      return `${nameFor(entry.target, sideNames)} change de forme : ${entry.species} !`;
    case "transform":
      return `${nameFor(entry.target, sideNames)} se transforme en ${entry.species} !`;
    case "text":
      return cleanRawLine(entry.text);
  }
}

interface BattleLogProps {
  entries: BattleLogEntry[];
  sideNames: { p1: string; p2: string };
}

export function BattleLog({ entries, sideNames }: BattleLogProps) {
  const recent = entries.slice(-40);
  return (
    <div className="w-full rounded-xl border border-gold/30 bg-gradient-to-b from-panel-raised to-panel shadow-[inset_0_1px_0_rgba(232,193,90,0.08)]">
      <p className="border-b border-gold/15 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gold-dim">
        Journal de combat
      </p>
      <OrnateScrollArea maxHeight="220px" className="px-3.5 py-2.5" autoScrollToBottom>
        <div className="flex flex-col gap-1 text-[13px] leading-snug text-ink-muted">
          {recent.length === 0 ? (
            <p>La bataille commence...</p>
          ) : (
            recent.map((entry, i) => <p key={i}>{describe(entry, sideNames)}</p>)
          )}
        </div>
      </OrnateScrollArea>
    </div>
  );
}
