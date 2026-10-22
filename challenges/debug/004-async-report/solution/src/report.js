import { fetchOrders } from './orders.js';

// One row per store, in the order the stores were given, plus the day's total.
export async function buildDailyReport(storeIds, date) {
  // Promise.all waits for every store and keeps results in the order of storeIds,
  // no matter which store answers first.
  const rows = await Promise.all(
    storeIds.map(async (storeId) => {
      const orders = await fetchOrders(storeId, date);
      return {
        storeId,
        orderCount: orders.length,
        revenueCents: orders.reduce((sum, order) => sum + order.totalCents, 0),
      };
    }),
  );

  return {
    date,
    rows,
    totalRevenueCents: rows.reduce((sum, row) => sum + row.revenueCents, 0),
  };
}

export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
