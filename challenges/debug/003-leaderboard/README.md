# Leaderboard sorts wrong

The game's weekly leaderboard looked fine in testing. Now that real players are scoring over 1,000 points, the top player shows up near the bottom.

Players with the same score share a rank, and the next score gets the next rank (1, 2, 2, 3).

## Your task

Find out why the order is wrong and fix it. All tests must pass.

## Files

- `src/leaderboard.js`: ranks the players
- `tests/leaderboard.test.js`: the existing tests
