import { createInventory } from '../src/inventory';

function setup(units = 3) {
  let time = 0;
  const inv = createInventory({ now: () => time });
  inv.addStock('sneakers', units);
  return { inv, advance: (ms: number) => (time += ms) };
}

describe('reservations', () => {
  it('holds units: they are no longer available but still on hand', () => {
    const { inv } = setup(3);
    inv.reserve('sneakers', 2);
    expect(inv.available('sneakers')).toBe(1);
    expect(inv.onHand('sneakers')).toBe(3);
  });

  it("can't reserve more than is available", () => {
    const { inv } = setup(3);
    inv.reserve('sneakers', 2);
    expect(() => inv.reserve('sneakers', 2)).toThrow();
    expect(inv.available('sneakers')).toBe(1);
  });

  it('gives every reservation its own id', () => {
    const { inv } = setup(3);
    const a = inv.reserve('sneakers', 1);
    const b = inv.reserve('sneakers', 1);
    expect(typeof a).toBe('string');
    expect(a).not.toBe(b);
  });

  it('confirm takes the units out of stock for good', () => {
    const { inv } = setup(3);
    inv.confirm(inv.reserve('sneakers', 2));
    expect(inv.onHand('sneakers')).toBe(1);
    expect(inv.available('sneakers')).toBe(1);
  });

  it('release makes the units available again', () => {
    const { inv } = setup(3);
    inv.release(inv.reserve('sneakers', 2));
    expect(inv.available('sneakers')).toBe(3);
    expect(inv.onHand('sneakers')).toBe(3);
  });

  it('stops holding units once the reservation expires', () => {
    const { inv, advance } = setup(3);
    inv.reserve('sneakers', 2, { ttlMs: 1000 });
    advance(999);
    expect(inv.available('sneakers')).toBe(1);
    advance(1);
    expect(inv.available('sneakers')).toBe(3);
  });

  it('holds for 15 minutes by default', () => {
    const { inv, advance } = setup(1);
    inv.reserve('sneakers', 1);
    advance(15 * 60_000 - 1);
    expect(inv.available('sneakers')).toBe(0);
    advance(1);
    expect(inv.available('sneakers')).toBe(1);
  });

  it("can't confirm an expired, released or unknown reservation", () => {
    const { inv, advance } = setup(3);
    const expired = inv.reserve('sneakers', 1, { ttlMs: 100 });
    advance(100);
    expect(() => inv.confirm(expired)).toThrow();

    const released = inv.reserve('sneakers', 1);
    inv.release(released);
    expect(() => inv.confirm(released)).toThrow();
    expect(() => inv.confirm('nope')).toThrow();
    expect(inv.onHand('sneakers')).toBe(3);
  });

  it("can't release an unknown, already released or expired reservation", () => {
    const { inv, advance } = setup(3);
    expect(() => inv.release('nope')).toThrow();

    const once = inv.reserve('sneakers', 1);
    inv.release(once);
    expect(() => inv.release(once)).toThrow();

    const expired = inv.reserve('sneakers', 1, { ttlMs: 100 });
    advance(100);
    expect(() => inv.release(expired)).toThrow();
  });

  it("can't confirm the same reservation twice", () => {
    const { inv } = setup(3);
    const id = inv.reserve('sneakers', 1);
    inv.confirm(id);
    expect(() => inv.confirm(id)).toThrow();
    expect(inv.onHand('sneakers')).toBe(2);
  });

  it('in-store sales respect reservations', () => {
    const { inv } = setup(2);
    inv.reserve('sneakers', 2);
    expect(() => inv.sell('sneakers', 1)).toThrow('Not enough');
  });

  it('keeps products separate', () => {
    const { inv } = setup(2);
    inv.addStock('hat', 5);
    inv.reserve('hat', 4);
    expect(inv.available('sneakers')).toBe(2);
    expect(inv.available('hat')).toBe(1);
  });
});
