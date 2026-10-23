export interface InventoryOptions {
  /** The clock, in ms; tests pass a fake one. */
  now?: () => number;
}

const DEFAULT_TTL_MS = 15 * 60_000;

interface Reservation {
  sku: string;
  qty: number;
  expiresAt: number;
}

// Stock levels per product (sku), with reservations that hold units during checkout.
export function createInventory({ now = () => Date.now() }: InventoryOptions = {}) {
  const stock = new Map<string, number>(); // sku -> units on hand
  const reservations = new Map<string, Reservation>();
  let nextId = 1;

  function onHand(sku: string): number {
    return stock.get(sku) ?? 0;
  }

  function isActive(reservation: Reservation): boolean {
    return now() < reservation.expiresAt;
  }

  // Units on hand that nobody is holding.
  function available(sku: string): number {
    let held = 0;
    for (const r of reservations.values()) {
      if (r.sku === sku && isActive(r)) held += r.qty;
    }
    return onHand(sku) - held;
  }

  function checkQty(qty: number): void {
    if (!Number.isInteger(qty) || qty < 1) {
      throw new RangeError('qty must be a whole number of at least 1');
    }
  }

  // Returns the reservation if it's still active; expired ones are removed.
  function activeReservation(id: string): Reservation {
    const reservation = reservations.get(id);
    if (reservation && !isActive(reservation)) reservations.delete(id);
    if (!reservation || !isActive(reservation)) {
      throw new Error(`No active reservation ${id}`);
    }
    return reservation;
  }

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

    // Holds units during checkout. Returns the reservation id.
    reserve(sku: string, qty: number, { ttlMs = DEFAULT_TTL_MS }: { ttlMs?: number } = {}): string {
      checkQty(qty);
      if (qty > available(sku)) {
        throw new Error(`Not enough ${sku} in stock`);
      }
      const id = `r${nextId++}`;
      reservations.set(id, { sku, qty, expiresAt: now() + ttlMs });
      return id;
    },

    // Completes the purchase: the held units leave stock for good.
    confirm(id: string): void {
      const { sku, qty } = activeReservation(id);
      stock.set(sku, onHand(sku) - qty);
      reservations.delete(id);
    },

    // Cancels the reservation; the units become available again.
    release(id: string): void {
      activeReservation(id);
      reservations.delete(id);
    },

    available,
    onHand,
  };
}
