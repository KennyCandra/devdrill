import { createPrices } from '../src/prices.js';

const PRICES = { apple: 120, bread: 250 };

describe('prices', () => {
  it('adds up a cart', async () => {
    const { cartTotal } = createPrices(async (id) => PRICES[id]);
    const total = await cartTotal([
      { productId: 'apple', quantity: 2 },
      { productId: 'bread', quantity: 1 },
    ]);
    expect(total).toBe(490);
  });
});
