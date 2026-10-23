// An order: { items: [{ name, price, quantity }] }, prices in dollars.

export const SHIPPING_FEE = 5;

export function subtotal(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function orderTotal(order) {
  return subtotal(order) + SHIPPING_FEE;
}
