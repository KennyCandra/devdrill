# Pagination skips an item

The product catalog shows 10 products per page. A shop owner noticed that some products never show up on any page, even though search finds them.

Pages start at 1. Every product must appear on exactly one page, in order. Page size can be any number, including 1. An empty list still has one (empty) page. The label under the list shows which products the page holds, like "Showing 21–25 of 25" on a last, partial page.

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

## Data

**Page** (what `paginate` returns)

| Field         | Type                  | Meaning                             |
| ------------- | --------------------- | ----------------------------------- |
| `items`       | list (same type as the input) | The items on this page      |
| `page`        | whole number, from 1  | This page's number                  |
| `pageSize`    | whole number          | How many items a full page holds    |
| `totalPages`  | whole number, 1 or more | How many pages there are          |
| `hasPrevious` | true/false            | Is there a page before this one?    |
| `hasNext`     | true/false            | Is there a page after this one?     |

**Functions**

| Function                                | Returns                                  |
| --------------------------------------- | ---------------------------------------- |
| `paginate(items, page, pageSize = 10)`  | a **Page**. Throws if `page` isn't a whole number of at least 1 |
| `showingLabel(products, page, pageSize = 10)` | text like `"Showing 11–20 of 45"`  |

## Files

- `src/paginate`: splits a list into pages (pages start at 1)
- `src/catalog`: builds the "Showing 11–20 of 45" label under the list
- `tests/paginate.test`: the existing tests
