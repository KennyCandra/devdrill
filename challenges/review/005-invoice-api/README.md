# Add invoice details and a summary

## What this PR does

The customer portal can only list invoices today. This PR adds what the new invoice pages need:

- **`GET /invoices/:id`** returns one invoice, or `404` if it doesn't exist.
- **`GET /invoices/summary`** returns the total of each of the customer's invoices.
- **An error handler**, so that a failure answers with JSON instead of Express's HTML error page.

Good to know:

- **A customer may only ever see their own invoices.**
- **Customers must never see internal details of an error**, such as stack traces or file paths. They can be told that something went wrong.
- `requireUser` is already in production and works: it answers `401` for a bad token and otherwise puts the customer on `res.locals.user`.
- Express 5 passes errors from async routes to the error handler by itself, so the routes don't need `try`/`catch`.
- `/invoices/summary` is meant to come before `/invoices/:id`: Express uses the first route that matches.
- A customer can have **a few hundred invoices**, and `store.linesOf` takes about **20 ms** per call. Pages should load within a second.
- Amounts are whole cents, so adding them up can't lose anything to rounding.

## How it was tested

- Tests for the summary totals, for reading an invoice, for an invoice that doesn't exist, and that a failure answers `500` with JSON.

## Your review

Review it like a teammate would. Comment on what must change before merging, and on anything worth improving. If the PR is good as it is, approve it.
