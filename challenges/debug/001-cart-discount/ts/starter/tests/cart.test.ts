import { addItem, applyCoupon, createCart, subtotal, total, type NewItem } from '../src/cart';

function cartWith(...items: NewItem[]) {
  const cart = createCart();
  for (const item of items) addItem(cart, item);
  return cart;
}

const mug = { sku: 'MUG', name: 'Coffee mug', priceCents: 1200 };
const shirt = { sku: 'TEE', name: 'T-shirt', priceCents: 2000 };

describe('subtotal', () => {
  it('adds up price x quantity for every item', () => {
    const cart = cartWith({ ...mug, quantity: 2 }, shirt);
    expect(subtotal(cart)).toBe(4400);
  });

  it('merges repeated items into one line', () => {
    const cart = cartWith(mug, mug);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(2);
  });
});

describe('coupons', () => {
  it('rejects unknown coupon codes', () => {
    const cart = cartWith(mug);
    expect(applyCoupon(cart, 'NOPE')).toBe(false);
    expect(total(cart)).toBe(1200);
  });

  it('applies a fixed coupon', () => {
    const cart = cartWith(shirt);
    applyCoupon(cart, 'FIVEOFF');
    expect(total(cart)).toBe(1500);
  });

  it('applies a percent coupon', () => {
    const cart = cartWith(shirt);
    applyCoupon(cart, 'SAVE10');
    expect(total(cart)).toBe(1800);
  });
});
