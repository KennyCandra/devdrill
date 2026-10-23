# Pagination skips an item

The product catalog shows 10 products per page. A shop owner noticed that some products never show up on any page, even though search finds them.

Pages start at 1. Every product must appear on exactly one page, in order. An empty list still has one (empty) page.

```js
const products = ['product-1', 'product-2', /* … */ 'product-25'];

paginate(products, 2);
// {
//   items: ['product-11', 'product-12', /* … */ 'product-20'], // 10 items
//   page: 2,
//   pageSize: 10,
//   totalPages: 3,
//   hasPrevious: true,
//   hasNext: true,
// }

paginate(products, 3).items;  // ['product-21', /* … */ 'product-25']: the last 5
showingLabel(products, 3);    // 'Showing 21–25 of 25'
paginate([], 1);              // { items: [], page: 1, pageSize: 10, totalPages: 1, hasPrevious: false, hasNext: false }
```

## Your task

Find out why products go missing and fix it. All tests must pass.

## Files

- `src/paginate.js`: splits a list into pages (pages start at 1)
- `src/catalog.js`: builds the "Showing 11–20 of 45" label under the list
- `tests/paginate.test.js`: the existing tests
