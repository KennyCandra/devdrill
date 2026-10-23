export interface InventoryOptions {
  /** The clock, in ms; tests pass a fake one. */
  now?: () => number;
}

// Stock levels per product (sku).
export function createInventory({ now = () => Date.now() }: InventoryOptions = {}) {
  const stock = new Map<string, number>(); // sku -> units on hand

  function onHand(sku: string): number {
    return stock.get(sku) ?? 0;
  }

  function available(sku: string): number {
    return onHand(sku);
  }

  function checkQty(qty: number): void {
    if (!Number.isInteger(qty) || qty < 1) {
      throw new RangeError('qty must be a whole number of at least 1');
    }
  }

  // Not used yet: reservations will need the clock.
  void now;

  return {
    addStock(sku: string, qty: number): void {
      checkQty(qty);
      stock.set(sku, onHand(sku) + qty);
    },

    // Sells units straight away (in-store purchases). Throws if there aren't enough.
    sell(sku: string, qty: number): void {
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
