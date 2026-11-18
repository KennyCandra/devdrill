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

describe('one person at a time', () => {
  beforeEach(() => start(createApp()));

  it('returns the account of whoever is signed in', async () => {
    expect(await account('alice-token')).toEqual({ id: 1, name: 'Alice', theme: 'dark' });
    expect(await account('bob-token')).toEqual({ id: 2, name: 'Bob', theme: 'light' });
  });

  it('turns away a request with no token', async () => {
    const res = await fetch(`${base}/me`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Not signed in' });
  });

  it('adds a note and lists it', async () => {
    const res = await call('alice-token', '/me/notes', { text: 'Call Sam' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 2, ownerId: 1, text: 'Call Sam' });
    expect(await (await call('alice-token', '/me/notes')).json()).toEqual([
      { id: 2, ownerId: 1, text: 'Call Sam' },
    ]);
  });

  it('rejects a note that is too long', async () => {
    const res = await call('cara-token', '/me/notes', { text: 'This note is too long' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Note is too long' });
  });
});

describe('two people at once', () => {
  it('gives each person their own account', async () => {
    // Alice's lookups are slow, so Bob's request starts while hers is still running.
    await start(createApp(createStore({ latencyMs: { 1: 150, 2: 5 } })));
    const alice = account('alice-token');
    await sleep(20);
    const bob = account('bob-token');
    expect(await alice).toEqual({ id: 1, name: 'Alice', theme: 'dark' });
    expect(await bob).toEqual({ id: 2, name: 'Bob', theme: 'light' });
  });
});
