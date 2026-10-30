import { createPrices } from '../src/prices';

const PRICES: Record<string, number> = { apple: 120, bread: 250 };

describe('prices', () => {
  it('adds up a cart', async () => {
    const { cartTotal } = createPrices(async (id) => PRICES[id] ?? 0);
    const total = await cartTotal([
      { productId: 'apple', quantity: 2 },
      { productId: 'bread', quantity: 1 },
    ]);
    expect(total).toBe(490);
  });
});
