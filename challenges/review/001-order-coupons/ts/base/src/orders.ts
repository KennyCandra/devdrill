// Prices are in dollars.

export interface Item {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  items: Item[];
}

export const SHIPPING_FEE = 5;

export function subtotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function orderTotal(order: Order): number {
  return subtotal(order) + SHIPPING_FEE;
}
