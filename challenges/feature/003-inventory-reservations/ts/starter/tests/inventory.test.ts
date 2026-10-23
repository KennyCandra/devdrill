import { createInventory } from '../src/inventory';

describe('inventory', () => {
  it('adds stock', () => {
    const inv = createInventory();
    inv.addStock('sneakers', 3);
    inv.addStock('sneakers', 2);
    expect(inv.available('sneakers')).toBe(5);
    expect(inv.onHand('sneakers')).toBe(5);
  });

  it('sells stock', () => {
    const inv = createInventory();
    inv.addStock('sneakers', 3);
    inv.sell('sneakers', 2);
    expect(inv.available('sneakers')).toBe(1);
  });

  it("can't sell more than it has", () => {
    const inv = createInventory();
    inv.addStock('sneakers', 1);
    expect(() => inv.sell('sneakers', 2)).toThrow('Not enough');
    expect(inv.available('sneakers')).toBe(1);
  });

  it('rejects quantities that are not whole positive numbers', () => {
    const inv = createInventory();
    expect(() => inv.addStock('sneakers', 0)).toThrow(RangeError);
    expect(() => inv.addStock('sneakers', 1.5)).toThrow(RangeError);
  });

  it('knows nothing about products it never stocked', () => {
    expect(createInventory().available('hat')).toBe(0);
  });
});
