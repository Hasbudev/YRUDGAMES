import { toID } from "pokemon-showdown";
import type { Battle, BattleStream } from "pokemon-showdown";
import type { InterferenceType } from "@yrud/shared";

// Weather/Trick Room/Gravity go through Showdown's own structured
// `/editbattle` command (confirmed live in the Step 0 spike — it logs the
// change correctly and it's mechanically real, not narrated). Poison-all has
// no structured editbattle equivalent, so it calls Pokemon#setStatus
// directly on the live Battle object instead (also confirmed in the spike:
// the call self-logs a proper `-status` protocol line for the active mon).
export function applyInterference(
  stream: BattleStream,
  battle: Battle,
  type: InterferenceType,
  optionId?: string
): { ok: true } | { error: string } {
  switch (type) {
    case "weather": {
      if (!optionId) return { error: "Choisis une météo." };
      stream.write(`>editbattle weather ${optionId}`);
      return { ok: true };
    }
    case "trickroom": {
      stream.write(">editbattle fieldcondition trickroom");
      return { ok: true };
    }
    case "gravity": {
      stream.write(">editbattle fieldcondition gravity");
      return { ok: true };
    }
    case "poisonAll": {
      for (const side of battle.sides) {
        const active = side.active[0];
        if (active && !active.fainted) active.setStatus(toID("tox"));
      }
      return { ok: true };
    }
    case "swap":
      return { error: "Cette interférence n'est pas encore disponible." };
    default:
      return { error: "Interférence inconnue." };
  }
}
