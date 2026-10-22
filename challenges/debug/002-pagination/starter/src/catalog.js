import { paginate } from './paginate.js';

// The label under the product list, e.g. "Showing 11–20 of 45".
export function showingLabel(products, page, pageSize = 10) {
  const result = paginate(products, page, pageSize);
  if (result.items.length === 0) {
    return `Showing 0 of ${products.length}`;
  }
  const first = (page - 1) * pageSize + 1;
  const last = first + result.items.length - 1;
  return `Showing ${first}–${last} of ${products.length}`;
}
