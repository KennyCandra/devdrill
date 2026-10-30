// Prices come from the price service, which is slow: about 200 ms per call.
// fetchPrice(productId) resolves to a price in cents, or rejects if the service is down.

export function createPrices(fetchPrice) {
  async function getPrice(productId) {
    return fetchPrice(productId);
  }

  async function cartTotal(items) {
    const prices = await Promise.all(items.map((item) => getPrice(item.productId)));
    return items.reduce((sum, item, i) => sum + prices[i] * item.quantity, 0);
  }

  return { getPrice, cartTotal };
}
