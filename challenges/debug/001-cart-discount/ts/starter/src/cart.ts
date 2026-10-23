import { findCoupon, type Coupon } from './coupons';
import { calculateDiscount } from './discount';

export interface CartItem {
  sku: string;
  name: string;
  /** Price of one unit in cents (1999 = $19.99). */
  priceCents: number;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  coupon: Coupon | null;
}

/** What addItem takes: quantity defaults to 1. */
export type NewItem = Omit<CartItem, 'quantity'> & { quantity?: number };

export function createCart(): Cart {
  return { items: [], coupon: null };
}

export function addItem(cart: Cart, { sku, name, priceCents, quantity = 1 }: NewItem): Cart {
  const existing = cart.items.find((item) => item.sku === sku);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ sku, name, priceCents, quantity });
  }
  return cart;
}

// Returns true if the code was valid and applied.
export function applyCoupon(cart: Cart, code: string): boolean {
  const coupon = findCoupon(code);
  if (!coupon) {
    return false;
  }
  cart.coupon = coupon;
  return true;
}

export function subtotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

export function total(cart: Cart): number {
  const sub = subtotal(cart);
  return sub - calculateDiscount(cart.coupon, sub);
}
