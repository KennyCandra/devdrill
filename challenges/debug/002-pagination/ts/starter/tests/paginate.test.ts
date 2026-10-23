import { paginate } from '../src/paginate';
import { showingLabel } from '../src/catalog';

const products = Array.from({ length: 25 }, (_, i) => `product-${i + 1}`);

describe('paginate', () => {
  it('counts the pages', () => {
    expect(paginate(products, 1).totalPages).toBe(3);
  });

  it('knows when there are more pages', () => {
    expect(paginate(products, 1)).toMatchObject({ hasPrevious: false, hasNext: true });
    expect(paginate(products, 3)).toMatchObject({ hasPrevious: true, hasNext: false });
  });

  it('puts 10 products on a full page', () => {
    expect(paginate(products, 1).items).toHaveLength(10);
  });

  it('rejects page 0', () => {
    expect(() => paginate(products, 0)).toThrow(RangeError);
  });
});

describe('showingLabel', () => {
  it('describes the first page', () => {
    expect(showingLabel(products, 1)).toBe('Showing 1–10 of 25');
  });
});
