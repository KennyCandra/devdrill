// Ranks players by score, highest first. Equal scores share a rank (1, 2, 2, 3).
export function rankPlayers(players) {
  const scores = [...new Set(players.map((p) => p.score))].sort((a, b) => b - a);

  return players
    .map((player) => ({ ...player, rank: scores.indexOf(player.score) + 1 }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}

// The top `count` ranks, which can be more than `count` players when there are ties.
export function podium(players, count = 3) {
  return rankPlayers(players).filter((player) => player.rank <= count);
}
