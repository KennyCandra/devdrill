// Prices come from the price service, which is slow: about 200 ms per call.
// fetchPrice(productId) resolves to a price in cents, or rejects if the service is down.

export type FetchPrice = (productId: string) => Promise<number>;

export interface CartItem {
  productId: string;
  quantity: number;
}

export function createPrices(fetchPrice: FetchPrice) {
  async function getPrice(productId: string): Promise<number> {
    return fetchPrice(productId);
  }

  async function cartTotal(items: CartItem[]): Promise<number> {
    const prices = await Promise.all(items.map((item) => getPrice(item.productId)));
    return items.reduce((sum, item, i) => sum + (prices[i] ?? 0) * item.quantity, 0);
  }

  return { getPrice, cartTotal };
}
