// Prices are in dollars.

export interface Item {
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  items: Item[];
}

/** E.g. { code: 'SPRING10', percent: 10 }. */
export interface Coupon {
  code: string;
  percent: number;
}

export const SHIPPING_FEE = 5;

export function subtotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function orderTotal(order: Order): number {
  const amount = subtotal(order);
  if (amount >= 50) {
    return amount;
  }
  return amount + SHIPPING_FEE;
}

export function applyCoupon(order: Order, coupon: Coupon): Order {
  for (const item of order.items) {
    item.price = item.price * (1 - coupon.percent / 100);
  }
  return order;
}
