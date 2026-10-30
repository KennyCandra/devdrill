import { createPrices } from '../src/prices.js';

const PRICES = { apple: 120, bread: 250 };
const MINUTE = 60 * 1000;

function fakeService() {
  const calls = [];
  const fetchPrice = async (id) => {
    calls.push(id);
    return PRICES[id];
  };
  return { calls, fetchPrice };
}

describe('prices', () => {
  it('adds up a cart', async () => {
    const { cartTotal } = createPrices(fakeService().fetchPrice);
    const total = await cartTotal([
      { productId: 'apple', quantity: 2 },
      { productId: 'bread', quantity: 1 },
    ]);
    expect(total).toBe(490);
  });

  it('asks the service once per product within an hour', async () => {
    const service = fakeService();
    let time = 0;
    const { getPrice } = createPrices(service.fetchPrice, () => time);
    expect(await getPrice('apple')).toBe(120);
    time = 30 * MINUTE;
    expect(await getPrice('apple')).toBe(120);
    expect(service.calls).toEqual(['apple']);
  });

  it('asks again after an hour', async () => {
    const service = fakeService();
    let time = 0;
    const { getPrice } = createPrices(service.fetchPrice, () => time);
    await getPrice('apple');
    time = 61 * MINUTE;
    await getPrice('apple');
    expect(service.calls).toEqual(['apple', 'apple']);
  });
});
