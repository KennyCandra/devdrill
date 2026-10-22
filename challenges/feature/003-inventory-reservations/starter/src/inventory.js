// Stock levels per product (sku). `now` can be passed in so tests control time.
export function createInventory({ now = () => Date.now() } = {}) {
  const stock = new Map(); // sku -> units on hand

  function onHand(sku) {
    return stock.get(sku) ?? 0;
  }

  function available(sku) {
    return onHand(sku);
  }

  function checkQty(qty) {
    if (!Number.isInteger(qty) || qty < 1) {
      throw new RangeError('qty must be a whole number of at least 1');
    }
  }

  return {
    addStock(sku, qty) {
      checkQty(qty);
      stock.set(sku, onHand(sku) + qty);
    },

    // Sells units straight away (in-store purchases). Throws if there aren't enough.
    sell(sku, qty) {
      checkQty(qty);
      if (qty > available(sku)) {
        throw new Error(`Not enough ${sku} in stock`);
      }
      stock.set(sku, onHand(sku) - qty);
    },

    available,
    onHand,
  };
}
