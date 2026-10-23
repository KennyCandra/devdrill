import { podium, rankPlayers } from '../src/leaderboard';

describe('rankPlayers', () => {
  it('ranks small scores', () => {
    const ranked = rankPlayers([
      { name: 'Ana', score: 40 },
      { name: 'Ben', score: 90 },
      { name: 'Cai', score: 70 },
    ]);
    expect(ranked.map((p) => p.name)).toEqual(['Ben', 'Cai', 'Ana']);
  });

  it('puts the highest score first, even above 1,000', () => {
    const ranked = rankPlayers([
      { name: 'Ana', score: 900 },
      { name: 'Ben', score: 1200 },
      { name: 'Cai', score: 80 },
    ]);
    expect(ranked[0]).toMatchObject({ name: 'Ben', rank: 1 });
  });
});

describe('podium', () => {
  it('returns the top three', () => {
    const top = podium([
      { name: 'Ana', score: 10 },
      { name: 'Ben', score: 30 },
      { name: 'Cai', score: 20 },
      { name: 'Dee', score: 5 },
    ]);
    expect(top.map((p) => p.name)).toEqual(['Ben', 'Cai', 'Ana']);
  });
});
