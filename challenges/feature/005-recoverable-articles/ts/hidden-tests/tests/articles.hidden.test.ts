import type { Express, Server } from 'express';
import { createApp } from '../src/app';

let server: Server;
let base: string;

function start(app: Express): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

afterEach(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

function send(method: string, path: string, body?: object) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const read = async (path: string) => (await fetch(`${base}${path}`)).json();

const SLUG = 'hello-world';
const ARTICLE = { slug: SLUG, title: 'Hello, world', author: 'ana' };

beforeEach(() => start(createApp()));

describe('deleting', () => {
  beforeEach(async () => {
    expect((await send('DELETE', `/articles/${SLUG}`)).status).toBe(204);
  });

  it('hides the article from the list', async () => {
    expect((await read('/articles')).map((a: { slug: string }) => a.slug)).toEqual([
      'second-post',
    ]);
  });

  it("hides the article from its author's list", async () => {
    expect(await read('/authors/ana/articles')).toEqual([]);
  });

  it('answers 404 on every route for that article', async () => {
    const calls = [
      send('GET', `/articles/${SLUG}`),
      send('PATCH', `/articles/${SLUG}`, { title: 'New' }),
      send('DELETE', `/articles/${SLUG}`),
      send('GET', `/articles/${SLUG}/comments`),
      send('POST', `/articles/${SLUG}/comments`, { text: 'Hi' }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Article not found' });
    }
  });

  it('leaves the article and its comments out of the stats', async () => {
    expect(await read('/stats')).toEqual({ articles: 1, comments: 1 });
  });

  it('keeps the slug taken', async () => {
    const res = await send('POST', '/articles', { ...ARTICLE, title: 'Copy' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Slug is taken' });
  });
});

describe('restoring', () => {
  it('brings the article back exactly as it was', async () => {
    await send('DELETE', `/articles/${SLUG}`);
    const res = await send('POST', `/articles/${SLUG}/restore`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ARTICLE);
    expect(await read(`/articles/${SLUG}`)).toEqual(ARTICLE);
    expect(await read('/authors/ana/articles')).toEqual([ARTICLE]);
  });

  it('brings the comments back and counts them again', async () => {
    await send('DELETE', `/articles/${SLUG}`);
    await send('POST', `/articles/${SLUG}/restore`);
    expect(await read(`/articles/${SLUG}/comments`)).toEqual([
      { slug: SLUG, text: 'First!' },
      { slug: SLUG, text: 'Nice post.' },
    ]);
    expect(await read('/stats')).toEqual({ articles: 2, comments: 3 });
  });

  it('answers 404 for an article that never existed', async () => {
    const res = await send('POST', '/articles/nope/restore');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Article not found' });
  });

  it('answers 409 for an article that is not deleted', async () => {
    const res = await send('POST', `/articles/${SLUG}/restore`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Article is not deleted' });
  });
});

describe('shape', () => {
  it('adds no new fields to any response', async () => {
    const other = { slug: 'second-post', title: 'A second post', author: 'ben' };
    await send('DELETE', `/articles/${SLUG}`);
    expect(await read('/articles')).toEqual([other]);
    expect(await read('/authors/ben/articles')).toEqual([other]);
    await send('POST', `/articles/${SLUG}/restore`);
    const restored = await read('/articles');
    expect(restored).toHaveLength(2);
    expect(restored).toEqual(expect.arrayContaining([ARTICLE, other]));
    const renamed = await send('PATCH', `/articles/${SLUG}`, { title: 'Hi' });
    expect(await renamed.json()).toEqual({ ...ARTICLE, title: 'Hi' });
  });
});
