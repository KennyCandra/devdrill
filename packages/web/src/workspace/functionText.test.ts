import { describe, expect, it } from 'vitest';
import { holdsFunction } from './functionText';

describe('holdsFunction', () => {
  it('accepts functions assigned to a name', () => {
    expect(holdsFunction('total = (order) => {')).toBe(true);
    expect(holdsFunction('load: async () => 1')).toBe(true);
    expect(holdsFunction('apply = function (x) {')).toBe(true);
    expect(holdsFunction('double = n => n * 2')).toBe(true);
    expect(holdsFunction('parse = (raw: string): Order => {')).toBe(true);
  });

  it('rejects values that only contain a function', () => {
    expect(holdsFunction('names = items.map((x) => x.name)')).toBe(false);
    expect(holdsFunction('config = { onSave: () => {} }')).toBe(false);
    expect(holdsFunction('order = { items: [] }')).toBe(false);
  });
});
