// Coupons currently offered by the store.
// `value` is a percentage for percent coupons and cents for fixed coupons.
export const COUPONS = {
  SAVE10: { code: 'SAVE10', type: 'percent', value: 10 },
  SAVE25: { code: 'SAVE25', type: 'percent', value: 25 },
  FIVEOFF: { code: 'FIVEOFF', type: 'fixed', value: 500 },
};

export function findCoupon(code) {
  return COUPONS[code.trim().toUpperCase()] ?? null;
}
