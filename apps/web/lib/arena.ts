import type { ArenaSnapshot, PublicPlayer } from "@yrud/shared";

// The server only pushes a full state:sync snapshot on connect/reconnect and
// after admin actions — new joins arrive as a standalone "player:joined"
// event, so every client needs to merge it into its local snapshot itself.
export function mergePlayerJoined(
  snapshot: ArenaSnapshot | null,
  player: PublicPlayer
): ArenaSnapshot | null {
  if (!snapshot) return snapshot;
  const exists = snapshot.players.some((p) => p.id === player.id);
  return {
    ...snapshot,
    players: exists
      ? snapshot.players.map((p) => (p.id === player.id ? player : p))
      : [...snapshot.players, player],
  };
}
