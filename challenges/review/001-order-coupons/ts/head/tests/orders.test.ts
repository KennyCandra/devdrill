import { applyCoupon, orderTotal, subtotal, type Order } from '../src/orders';

const order: Order = {
  items: [
    { name: 'Notebook', price: 4, quantity: 3 },
    { name: 'Pen', price: 1.5, quantity: 2 },
  ],
};

describe('orders', () => {
  it('adds up the items', () => {
    expect(subtotal(order)).toBe(15);
  });

  it('adds shipping to the total', () => {
    expect(orderTotal(order)).toBe(20);
  });

  it('applies a coupon', () => {
    const discounted = applyCoupon(order, { code: 'SPRING10', percent: 10 });
    expect(discounted.items).toHaveLength(2);
  });
});
