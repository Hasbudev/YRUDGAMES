import type { ArenaSnapshot, PublicPlayer, SpeedRoundScoreEntry } from "@yrud/shared";

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

// speedRound:progress is a lightweight per-answer broadcast (never a full
// state:sync) — merge it into the local snapshot so the arena's live score
// badges update on every correct answer, not just on the next full sync.
export function mergeSpeedProgress(
  snapshot: ArenaSnapshot | null,
  entry: SpeedRoundScoreEntry
): ArenaSnapshot | null {
  if (!snapshot?.speedRound) return snapshot;
  const scoreboard = snapshot.speedRound.scoreboard;
  const exists = scoreboard.some((s) => s.playerId === entry.playerId);
  return {
    ...snapshot,
    speedRound: {
      ...snapshot.speedRound,
      scoreboard: exists
        ? scoreboard.map((s) => (s.playerId === entry.playerId ? entry : s))
        : [...scoreboard, entry],
    },
  };
}
