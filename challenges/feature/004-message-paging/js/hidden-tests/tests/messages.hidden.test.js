import { createApp } from '../src/app.js';
import { createStore } from '../src/store.js';

let server;
let base;

function start(app) {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

afterEach(
  () =>
    new Promise((resolve) => {
      server.close(() => resolve());
    }),
);

const TEXTS = ['a', 'b', 'c', 'd', 'e', 'f'];

beforeEach(() => start(createApp(createStore(TEXTS))));

async function page(query) {
  const res = await fetch(`${base}/messages?${query}`);
  expect(res.status).toBe(200);
  return res.json();
}

const textsOf = (body) => body.items.map((m) => m.text);
const cursor = (value) => `cursor=${encodeURIComponent(value)}`;
const remove = (id) => fetch(`${base}/messages/${id}`, { method: 'DELETE' });
const add = (text) =>
  fetch(`${base}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

describe('paging', () => {
  it('returns the first page and a cursor', async () => {
    expect(await page('limit=2')).toEqual({
      items: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
      ],
      nextCursor: expect.any(String),
    });
  });

  it('continues after the cursor', async () => {
    const first = await page('limit=2');
    const second = await page(`limit=3&${cursor(first.nextCursor)}`);
    expect(textsOf(second)).toEqual(['c', 'd', 'e']);
    const last = await page(`limit=3&${cursor(second.nextCursor)}`);
    expect(textsOf(last)).toEqual(['f']);
    expect(last.nextCursor).toBeNull();
  });

  it('ends with a null cursor when the last page is full', async () => {
    const first = await page('limit=3');
    expect(first.nextCursor).toEqual(expect.any(String));
    const last = await page(`limit=3&${cursor(first.nextCursor)}`);
    expect(textsOf(last)).toEqual(['d', 'e', 'f']);
    expect(last.nextCursor).toBeNull();
    expect((await page('limit=6')).nextCursor).toBeNull();
  });

  it('uses a limit of 20 when only a cursor is given', async () => {
    const first = await page('limit=1');
    for (let i = 0; i < 30; i++) await add(`more ${i}`);
    const next = await page(cursor(first.nextCursor));
    expect(next.items).toHaveLength(20);
    expect(next.items[0].text).toBe('b');
    expect(next.nextCursor).toEqual(expect.any(String));
  });

  it('rejects limits outside 1 to 100', async () => {
    for (const limit of ['0', '101', '-1', '2.5', 'abc', '']) {
      const res = await fetch(`${base}/messages?limit=${limit}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'limit must be a whole number from 1 to 100' });
    }
    expect((await page('limit=100')).items).toHaveLength(6);
  });

  it('rejects a limit with junk after the number', async () => {
    const res = await fetch(`${base}/messages?limit=5abc`);
    expect(res.status).toBe(400);
  });

  it('rejects a cursor it never gave out', async () => {
    const res = await fetch(`${base}/messages?limit=2&cursor=not-a-cursor`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid cursor' });
  });

  it('skips nothing when an earlier message is deleted', async () => {
    const first = await page('limit=2');
    await remove(1);
    const second = await page(`limit=2&${cursor(first.nextCursor)}`);
    expect(textsOf(second)).toEqual(['c', 'd']);
  });

  it("still works when the cursor's own message is deleted", async () => {
    const first = await page('limit=2');
    await remove(2);
    const second = await page(`limit=2&${cursor(first.nextCursor)}`);
    expect(textsOf(second)).toEqual(['c', 'd']);
  });

  it('repeats nothing when a message is added', async () => {
    const first = await page('limit=4');
    await add('g');
    const second = await page(`limit=4&${cursor(first.nextCursor)}`);
    expect(textsOf(second)).toEqual(['e', 'f', 'g']);
    expect(second.nextCursor).toBeNull();
  });

  it('regression: the old list has no paging at all', async () => {
    const res = await fetch(`${base}/messages`);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(6);
  });
});
