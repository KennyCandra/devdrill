import { buildDailyReport, formatCents } from '../src/report.js';

describe('buildDailyReport', () => {
  it('has a row for every store', async () => {
    const report = await buildDailyReport(['north', 'east'], '2026-10-21');
    expect(report.rows).toHaveLength(2);
  });

  it('adds up the revenue for the day', async () => {
    const report = await buildDailyReport(['north'], '2026-10-21');
    expect(report.totalRevenueCents).toBe(3700);
  });
});

describe('formatCents', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(3700)).toBe('$37.00');
  });
});
