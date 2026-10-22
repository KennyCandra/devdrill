import { buildDailyReport } from '../src/report.js';

describe('buildDailyReport', () => {
  it('keeps the rows in the same order as the stores given, even when some answer faster', async () => {
    const report = await buildDailyReport(['north', 'south', 'east'], '2026-10-21');
    expect(report.rows.map((row) => row.storeId)).toEqual(['north', 'south', 'east']);
  });

  it('counts orders and revenue per store', async () => {
    const report = await buildDailyReport(['east', 'south'], '2026-10-21');
    expect(report.rows).toEqual([
      { storeId: 'east', orderCount: 2, revenueCents: 1000 },
      { storeId: 'south', orderCount: 1, revenueCents: 9900 },
    ]);
    expect(report.totalRevenueCents).toBe(10900);
  });

  it('only counts orders from the requested day', async () => {
    const report = await buildDailyReport(['east'], '2026-10-20');
    expect(report.rows[0]).toMatchObject({ orderCount: 1, revenueCents: 7000 });
  });

  it('gives a store with no orders a zero row', async () => {
    const report = await buildDailyReport(['north'], '2026-01-01');
    expect(report.rows).toEqual([{ storeId: 'north', orderCount: 0, revenueCents: 0 }]);
  });

  it('regression: no stores means an empty report', async () => {
    const report = await buildDailyReport([], '2026-10-21');
    expect(report).toEqual({ date: '2026-10-21', rows: [], totalRevenueCents: 0 });
  });
});
