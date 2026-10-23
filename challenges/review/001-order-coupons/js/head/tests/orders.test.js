import { applyCoupon, orderTotal, subtotal } from '../src/orders.js';

const order = {
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

  it('ships orders of $50 or more for free', () => {
    const big = { items: [{ name: 'Backpack', price: 50, quantity: 1 }] };
    expect(orderTotal(big)).toBe(50);
  });

  it('applies a coupon', () => {
    const cart = { items: [{ name: 'Lamp', price: 20, quantity: 1 }] };
    const discounted = applyCoupon(cart, { code: 'SPRING10', percent: 10 });
    expect(discounted.items).toHaveLength(1);
  });
});
