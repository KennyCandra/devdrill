# Pagination skips an item

The product catalog shows 10 products per page. A shop owner noticed that some products never show up on any page, even though search finds them.

Pages start at 1. Every product must appear on exactly one page, in order. An empty list still has one (empty) page.

## Your task

Find out why products go missing and fix it. All tests must pass.

## Files

- `src/paginate.js`: splits a list into pages (pages start at 1)
- `src/catalog.js`: builds the "Showing 11–20 of 45" label under the list
- `tests/paginate.test.js`: the existing tests
