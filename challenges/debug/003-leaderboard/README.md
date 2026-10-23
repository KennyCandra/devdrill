# Leaderboard sorts wrong

The game's weekly leaderboard looked fine in testing. Now that real players are scoring over 1,000 points, the top player shows up near the bottom.

Players with the same score share a rank, and the next score gets the next rank (1, 2, 2, 3). Ties are listed alphabetically. Scores can be negative.

`rankPlayers` returns new objects with a `rank` added; it must **not change the array or the player objects you pass in**. `podium(players, 3)` returns everyone whose rank is 3 or better, so ties can make it more than 3 players.

## What it should return

```js
const players = [
  { name: 'Cai', score: 300 },
  { name: 'Ben', score: 1500 },
  { name: 'Ana', score: 1500 },
  { name: 'Dee', score: 25 },
];

rankPlayers(players);
// [
//   { name: 'Ana', score: 1500, rank: 1 },
//   { name: 'Ben', score: 1500, rank: 1 },   // tie: same rank, alphabetical
//   { name: 'Cai', score: 300, rank: 2 },
//   { name: 'Dee', score: 25, rank: 3 },
// ]

podium(players, 2).map((p) => p.name); // ['Ana', 'Ben', 'Cai']: ranks 1 and 2
```

## Your task

Find out why the order is wrong and fix it. All tests must pass.

## Data

**Player** (what you pass in)

| Field   | Type   | Meaning                   |
| ------- | ------ | ------------------------- |
| `name`  | text   | Player name               |
| `score` | number | Points; can be negative   |

**Ranked player** (what you get back): a **Player** plus

| Field  | Type                 | Meaning                        |
| ------ | -------------------- | ------------------------------ |
| `rank` | whole number, from 1 | 1 is the best; ties share one  |

**Functions**

| Function                     | Returns                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `rankPlayers(players)`       | a new list of **Ranked players**, best first                  |
| `podium(players, count = 3)` | list of **Ranked players** whose rank is `count` or better    |

## Files

- `src/leaderboard`: ranks the players
- `tests/leaderboard.test`: the existing tests
