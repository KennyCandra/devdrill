import type { Express, Server } from 'express';
import { createApp } from '../src/app';
import { createStore } from '../src/store';

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function call(token: string, path: string, body?: object) {
  return fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const account = async (token: string) => (await call(token, '/me')).json();

/** The store, with a delay of its own on everything that happens after signing in. */
function withDelays(ms: Record<number, number>) {
  const store = createStore();
  const delayed = async (userId: number) => {
    await sleep(ms[userId] ?? 1);
  };
  return {
    ...store,
    recordVisit: async (id: number) => {
      await delayed(id);
      return store.recordVisit(id);
    },
    loadSettings: async (id: number) => {
      await delayed(id);
      return store.loadSettings(id);
    },
    notesOf: async (id: number) => {
      await delayed(id);
      return store.notesOf(id);
    },
    addNote: async (id: number, text: string) => {
      await delayed(id);
      return store.addNote(id, text);
    },
  };
}

beforeEach(() => start(createApp(withDelays({ 1: 150, 2: 5, 3: 40 }))));

describe('overlapping requests', () => {
  it('keeps a note with the person who sent it', async () => {
    const adding = call('alice-token', '/me/notes', { text: 'Call Sam' });
    await sleep(20);
    await account('bob-token');
    const note = await (await adding).json();
    expect(note.ownerId).toBe(1);
    const bobsNotes = await (await call('bob-token', '/me/notes')).json();
    expect(bobsNotes.map((n: { text: string }) => n.text)).toEqual(['Buy milk']);
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
    const names: Record<string, string> = { alice: 'Alice', bob: 'Bob', cara: 'Cara' };
    const answers = [];
    for (const who of tokens) {
      answers.push(account(`${who}-token`));
      await sleep(5);
    }
    const got = await Promise.all(answers);
    expect(got.map((a) => a.name)).toEqual(tokens.map((who) => names[who]));
  });

  it('does not make a quick request wait for a slow one', async () => {
    const finished: string[] = [];
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
