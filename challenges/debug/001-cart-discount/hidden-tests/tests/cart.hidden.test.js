import { addItem, applyCoupon, createCart, total } from '../src/cart.js';

describe('coupons (hidden)', () => {
  it('rounds the percent discount once on the whole cart, not per item', () => {
    // Per item: 83.25 -> 83, twice = 166 off. Whole cart: 166.5 -> 167 off.
    const cart = createCart();
    addItem(cart, { sku: 'A', name: 'A', priceCents: 333 });
    addItem(cart, { sku: 'B', name: 'B', priceCents: 333 });
    applyCoupon(cart, 'SAVE25');
    expect(total(cart)).toBe(499);
  });

  it('rounds percent discounts to the nearest cent', () => {
    const cart = createCart();
    addItem(cart, { sku: 'A', name: 'A', priceCents: 999 });
    applyCoupon(cart, 'SAVE10');
    expect(total(cart)).toBe(899);
  });

  it('accepts codes typed in lower case with spaces', () => {
    const cart = createCart();
    addItem(cart, { sku: 'A', name: 'A', priceCents: 1000 });
    expect(applyCoupon(cart, ' save10 ')).toBe(true);
    expect(total(cart)).toBe(900);
  });

  it('regression: a fixed coupon never pushes the total below zero', () => {
    const cart = createCart();
    addItem(cart, { sku: 'A', name: 'A', priceCents: 300 });
    applyCoupon(cart, 'FIVEOFF');
    expect(total(cart)).toBe(0);
  });
});
