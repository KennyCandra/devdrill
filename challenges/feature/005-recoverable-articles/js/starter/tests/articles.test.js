import { createApp } from '../src/app.js';

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

function send(method, path, body) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const read = async (path) => (await fetch(`${base}${path}`)).json();

beforeEach(() => start(createApp()));

describe('articles', () => {
  it('lists articles', async () => {
    expect(await read('/articles')).toEqual([
      { slug: 'hello-world', title: 'Hello, world', author: 'ana' },
      { slug: 'second-post', title: 'A second post', author: 'ben' },
    ]);
  });

  it("lists an author's articles", async () => {
    const articles = await read('/authors/ben/articles');
    expect(articles.map((a) => a.slug)).toEqual(['second-post']);
  });

  it('creates an article, unless the slug is taken', async () => {
    const article = { slug: 'third', title: 'Third', author: 'ana' };
    const created = await send('POST', '/articles', article);
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual(article);
    const again = await send('POST', '/articles', article);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'Slug is taken' });
  });

  it('renames an article', async () => {
    const res = await send('PATCH', '/articles/hello-world', { title: 'Hi' });
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('Hi');
  });

  it('counts articles and comments', async () => {
    expect(await read('/stats')).toEqual({ articles: 2, comments: 3 });
  });

  it('lists and adds comments', async () => {
    const res = await send('POST', '/articles/second-post/comments', { text: 'More!' });
    expect(res.status).toBe(201);
    expect(await read('/articles/second-post/comments')).toEqual([
      { slug: 'second-post', text: 'Thanks for this.' },
      { slug: 'second-post', text: 'More!' },
    ]);
  });

  it('answers 404 for an article that does not exist', async () => {
    const res = await fetch(`${base}/articles/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Article not found' });
  });

  it('removes a deleted article', async () => {
    const res = await send('DELETE', '/articles/hello-world');
    expect(res.status).toBe(204);
    expect((await fetch(`${base}/articles/hello-world`)).status).toBe(404);
  });
});
