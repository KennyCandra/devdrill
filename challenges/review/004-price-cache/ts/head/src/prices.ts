// Prices come from the price service, which is slow: about 200 ms per call.
// fetchPrice(productId) resolves to a price in cents, or rejects if the service is down.

export type FetchPrice = (productId: string) => Promise<number>;

export interface CartItem {
  productId: string;
  quantity: number;
}

export function createPrices(fetchPrice: FetchPrice, now: () => number = Date.now) {
  const cache = new Map<string, { price: Promise<number>; at: number }>();

  async function getPrice(productId: string): Promise<number> {
    const cached = cache.get(productId);
    if (cached && now() - cached.at < 3600000) {
      return cached.price;
    }
    const price = fetchPrice(productId);
    cache.set(productId, { price, at: now() });
    return price;
  }

  async function cartTotal(items: CartItem[]): Promise<number> {
    let total = 0;
    for (const item of items) {
      const price = await getPrice(item.productId);
      total += price * item.quantity;
    }
    return total;
  }

  return { getPrice, cartTotal };
}
