import { paginate } from '../src/paginate.js';
import { showingLabel } from '../src/catalog.js';

const products = Array.from({ length: 25 }, (_, i) => `product-${i + 1}`);

describe('paginate', () => {
  it('shows every product exactly once across all pages', () => {
    const seen = [];
    for (let page = 1; page <= 3; page++) seen.push(...paginate(products, page).items);
    expect(seen).toEqual(products);
  });

  it('starts page 2 right after page 1 ends', () => {
    expect(paginate(products, 2).items[0]).toBe('product-11');
    expect(paginate(products, 2).items.at(-1)).toBe('product-20');
  });

  it('works with one product per page', () => {
    expect(paginate(['a', 'b'], 2, 1).items).toEqual(['b']);
  });

  it('regression: an empty list still has one (empty) page', () => {
    expect(paginate([], 1)).toMatchObject({ items: [], totalPages: 1, hasNext: false });
  });
});

describe('showingLabel', () => {
  it('describes the last, partial page', () => {
    expect(showingLabel(products, 3)).toBe('Showing 21–25 of 25');
  });

  it('describes a middle page', () => {
    expect(showingLabel(products, 2)).toBe('Showing 11–20 of 25');
  });
});
