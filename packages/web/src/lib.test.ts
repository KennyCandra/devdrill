import { afterEach, describe, expect, it } from 'vitest';
import { readToken } from './api/client';
import { buildTree } from './components/FileTree';
import { challengePath, parseRoute } from './router';

describe('buildTree', () => {
  it('nests files in folders, folders first, both sorted', () => {
    const tree = buildTree(['src/b.js', 'package.json', 'src/a.js', 'tests/x.test.js']);
    expect(tree.map((n) => n.name)).toEqual(['src', 'tests', 'package.json']);
    expect(tree[0]?.children?.map((n) => n.path)).toEqual(['src/a.js', 'src/b.js']);
    expect(tree[2]?.children).toBeNull();
  });

  it('keeps a file and a folder with the same name apart', () => {
    const tree = buildTree(['lib', 'lib/x.js']);
    expect(tree.map((n) => [n.name, n.children === null])).toEqual([
      ['lib', false],
      ['lib', true],
    ]);
  });
});

describe('router', () => {
  it.each([
    ['/', { name: 'list' }],
    ['/challenge/debug-001-cart-discount', { name: 'workspace', id: 'debug-001-cart-discount' }],
    ['/challenge/a%2Fb/', { name: 'workspace', id: 'a/b' }],
    ['/settings', { name: 'settings' }],
    ['/challenge/x/results', { name: 'results', id: 'x' }],
    ['/nope', { name: 'notFound' }],
  ])('parses %s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });

  it('round-trips ids through challengePath', () => {
    expect(parseRoute(challengePath('a b/c'))).toEqual({ name: 'workspace', id: 'a b/c' });
  });
});

describe('readToken', () => {
  afterEach(() => {
    sessionStorage.clear();
    history.replaceState(null, '', '/');
  });

  it('takes the token from the hash, stores it, and removes it from the address bar', () => {
    history.replaceState(null, '', '/challenge/x#token=abc123');
    expect(readToken()).toBe('abc123');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/challenge/x');
    expect(sessionStorage.getItem('bughunt-token')).toBe('abc123');
  });

  it('falls back to the stored token after a reload', () => {
    sessionStorage.setItem('bughunt-token', 'stored');
    expect(readToken()).toBe('stored');
  });

  it('returns null when there is no token anywhere', () => {
    expect(readToken()).toBeNull();
  });
});
