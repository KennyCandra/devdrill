import { describe, expect, it } from 'vitest';
import { changedLines, functionSpans } from './lineDiff.js';

describe('changedLines', () => {
  it('marks every line of a new file', () => {
    expect([...changedLines(null, 'a\nb')]).toEqual([1, 2]);
  });

  it('marks added and changed lines, not moved-down ones', () => {
    const base = 'one\ntwo\nthree\n';
    const head = 'one\nnew\ntwo\nTHREE\n';
    expect([...changedLines(base, head)].sort()).toEqual([2, 4]);
  });

  it('marks nothing when only lines were removed', () => {
    expect(changedLines('a\nb\nc', 'a\nc').size).toBe(0);
  });
});

describe('functionSpans', () => {
  const source = [
    'export function total(items) {', // 1
    '  return items.length;', // 2
    '}', // 3
    'export const double = (n) => {', // 4
    '  return n * 2;', // 5
    '};', // 6
    'class Cart {', // 7
    '  add(item) {', // 8
    '    this.items.push(item);', // 9
    '  }', // 10
    '}', // 11
    'const api = { load: async () => 1 };', // 12
  ].join('\n');

  it('finds declarations, arrow functions, methods and object properties', () => {
    const spans = functionSpans('cart.js', source);
    expect(spans.get('total')).toEqual([[1, 3]]);
    expect(spans.get('double')).toEqual([[4, 6]]);
    expect(spans.get('add')).toEqual([[8, 10]]);
    expect(spans.get('load')).toEqual([[12, 12]]);
  });

  it('finds class fields, accessors, constructors and quoted names', () => {
    const cls = [
      'class Cart {', // 1
      '  constructor() {', // 2
      '    this.items = [];', // 3
      '  }', // 4
      '  get size() {', // 5
      '    return this.items.length;', // 6
      '  }', // 7
      '  clear = () => {', // 8
      '    this.items = [];', // 9
      '  };', // 10
      "  'add item'(item) {}", // 11
      '}', // 12
    ].join('\n');
    const spans = functionSpans('cart.js', cls);
    expect(spans.get('constructor')).toEqual([[2, 4]]);
    expect(spans.get('size')).toEqual([[5, 7]]);
    expect(spans.get('clear')).toEqual([[8, 10]]);
    expect(spans.get('add item')).toEqual([[11, 11]]);
  });

  it('treats Windows line endings like Unix ones', () => {
    expect(changedLines('a\r\nb\r\n', 'a\nb\n').size).toBe(0);
  });
});
