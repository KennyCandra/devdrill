// A stand-in for the orders database. Each store answers after a different delay,
// like real services do.
export interface Order {
  storeId: string;
  /** YYYY-MM-DD */
  date: string;
  totalCents: number;
}

const ORDERS: Order[] = [
  { storeId: 'north', date: '2026-10-21', totalCents: 2500 },
  { storeId: 'north', date: '2026-10-21', totalCents: 1200 },
  { storeId: 'south', date: '2026-10-21', totalCents: 9900 },
  { storeId: 'east', date: '2026-10-21', totalCents: 450 },
  { storeId: 'east', date: '2026-10-21', totalCents: 550 },
  { storeId: 'east', date: '2026-10-20', totalCents: 7000 },
  { storeId: 'west', date: '2026-10-21', totalCents: 3100 },
];

const LATENCY_MS: Record<string, number> = { north: 15, south: 2, east: 8, west: 120 };

export async function fetchOrders(storeId: string, date: string): Promise<Order[]> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS[storeId] ?? 5));
  return ORDERS.filter((order) => order.storeId === storeId && order.date === date);
}
