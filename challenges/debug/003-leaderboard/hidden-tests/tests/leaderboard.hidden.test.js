import { podium, rankPlayers } from '../src/leaderboard.js';

describe('rankPlayers', () => {
  it('gives tied players the same rank, and the next score the next rank', () => {
    const ranked = rankPlayers([
      { name: 'Ana', score: 1500 },
      { name: 'Ben', score: 1500 },
      { name: 'Cai', score: 300 },
      { name: 'Dee', score: 25 },
    ]);
    expect(ranked.map((p) => [p.name, p.rank])).toEqual([
      ['Ana', 1],
      ['Ben', 1],
      ['Cai', 2],
      ['Dee', 3],
    ]);
  });

  it('handles negative scores', () => {
    const ranked = rankPlayers([
      { name: 'Ana', score: -5 },
      { name: 'Ben', score: 10 },
      { name: 'Cai', score: -20 },
    ]);
    expect(ranked.map((p) => p.name)).toEqual(['Ben', 'Ana', 'Cai']);
  });

  it('regression: does not change the array it was given', () => {
    const players = [
      { name: 'Ana', score: 1 },
      { name: 'Ben', score: 2 },
    ];
    rankPlayers(players);
    expect(players.map((p) => p.name)).toEqual(['Ana', 'Ben']);
    expect(players[0]).not.toHaveProperty('rank');
  });
});

describe('podium', () => {
  it('includes everyone tied for third place', () => {
    const top = podium([
      { name: 'Ana', score: 2000 },
      { name: 'Ben', score: 1000 },
      { name: 'Cai', score: 500 },
      { name: 'Dee', score: 500 },
      { name: 'Eli', score: 90 },
    ]);
    expect(top.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Cai', 'Dee']);
  });
});
