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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function call(token, path, body) {
  return fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const account = async (token) => (await call(token, '/me')).json();

beforeEach(() => start(createApp(createStore({ latencyMs: { 1: 150, 2: 5, 3: 40 } }))));

describe('overlapping requests', () => {
  it('keeps a note with the person who sent it', async () => {
    const adding = call('alice-token', '/me/notes', { text: 'Call Sam' });
    await sleep(20);
    await account('bob-token');
    const note = await (await adding).json();
    expect(note.ownerId).toBe(1);
    const bobsNotes = await (await call('bob-token', '/me/notes')).json();
    expect(bobsNotes.map((n) => n.text)).toEqual(['Buy milk']);
  });

  it('gives each person their own notes', async () => {
    const alice = call('alice-token', '/me/notes');
    await sleep(20);
    const bob = call('bob-token', '/me/notes');
    expect(await (await alice).json()).toEqual([]);
    expect(await (await bob).json()).toEqual([{ id: 1, ownerId: 2, text: 'Buy milk' }]);
  });

  it('answers everyone correctly when many run at once', async () => {
    const tokens = ['alice', 'bob', 'cara', 'bob', 'alice', 'cara', 'bob'];
    const names = { alice: 'Alice', bob: 'Bob', cara: 'Cara' };
    const answers = [];
    for (const who of tokens) {
      answers.push(account(`${who}-token`));
      await sleep(5);
    }
    const got = await Promise.all(answers);
    expect(got.map((a) => a.name)).toEqual(tokens.map((who) => names[who]));
  });

  it('does not make a quick request wait for a slow one', async () => {
    const finished = [];
    const alice = account('alice-token').then(() => finished.push('alice'));
    await sleep(20);
    const bob = account('bob-token').then(() => finished.push('bob'));
    await Promise.all([alice, bob]);
    expect(finished).toEqual(['bob', 'alice']);
  });

  it('regression: an unknown token is never signed in', async () => {
    await account('alice-token');
    const unknown = await call('nobody', '/me');
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual({ error: 'Not signed in' });
    expect((await fetch(`${base}/me`)).status).toBe(401);
  });
});
