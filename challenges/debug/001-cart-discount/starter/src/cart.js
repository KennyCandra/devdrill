import { findCoupon } from './coupons.js';
import { calculateDiscount } from './discount.js';

export function createCart() {
  return { items: [], coupon: null };
}

export function addItem(cart, { sku, name, priceCents, quantity = 1 }) {
  const existing = cart.items.find((item) => item.sku === sku);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ sku, name, priceCents, quantity });
  }
  return cart;
}

// Returns true if the code was valid and applied.
export function applyCoupon(cart, code) {
  const coupon = findCoupon(code);
  if (!coupon) {
    return false;
  }
  cart.coupon = coupon;
  return true;
}

export function subtotal(cart) {
  return cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function total(cart) {
  const sub = subtotal(cart);
  return sub - calculateDiscount(cart.coupon, sub);
}
