# Daily report is always empty

Every evening the operations team gets a sales report for each store. Since the move to the new orders service, the report arrives with **no rows and $0.00 revenue**, even on busy days.

The orders service is asynchronous: `fetchOrders` returns a promise, and some stores answer faster than others.

## Your task

Find out why the report is empty and fix it. All tests must pass.

## What the report must look like

```js
await buildDailyReport(['north', 'east'], '2026-10-21');
// {
//   date: '2026-10-21',
//   rows: [
//     { storeId: 'north', orderCount: 2, revenueCents: 3700 },
//     { storeId: 'east', orderCount: 2, revenueCents: 1000 },
//   ],
//   totalRevenueCents: 4700,
// }
```

- **One row for every store you ask for**, in the **same order as `storeIds`**, no matter which store answers first.
- Each row has exactly these fields: `storeId`, `orderCount`, `revenueCents`.
- **A store with no orders that day still gets a row**, with `orderCount: 0` and `revenueCents: 0`.
- Only orders from the requested `date` count.
- No stores means `rows: []` and `totalRevenueCents: 0`.

## Files

- `src/report.js`: builds the daily report
- `src/orders.js`: the orders service (pretend it's a real database; you shouldn't need to change it)
- `tests/report.test.js`: the existing tests
