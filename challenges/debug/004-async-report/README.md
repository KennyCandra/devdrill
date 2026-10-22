# Daily report is always empty

Every evening the operations team gets a sales report for each store. Since the move to the new orders service, the report arrives with **no rows and $0.00 revenue**, even on busy days.

The orders service is asynchronous: `fetchOrders` returns a promise, and some stores answer faster than others.

## Your task

Find out why the report is empty and fix it. The rows must stay in the same order as the `storeIds` you pass in. All tests must pass.

## Files

- `src/report.js`: builds the daily report
- `src/orders.js`: the orders service (pretend it's a real database; you shouldn't need to change it)
- `tests/report.test.js`: the existing tests
