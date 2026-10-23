// An order: { items: [{ name, price, quantity }] }, prices in dollars.
// A coupon: { code, percent }, e.g. { code: 'SPRING10', percent: 10 }.

export const SHIPPING_FEE = 5;

export function subtotal(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function orderTotal(order) {
  const amount = subtotal(order);
  if (amount >= 50) {
    return amount;
  }
  return amount + SHIPPING_FEE;
}

export function applyCoupon(order, coupon) {
  for (const item of order.items) {
    item.price = item.price * (1 - coupon.percent / 100);
  }
  return order;
}
