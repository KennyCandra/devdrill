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

beforeEach(() => start(createApp()));

describe('messages', () => {
  it('lists every message, oldest first', async () => {
    const res = await fetch(`${base}/messages`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 1, text: 'Hello' },
      { id: 2, text: 'Anyone here?' },
      { id: 3, text: 'Yes!' },
    ]);
  });

  it('adds a message', async () => {
    const res = await fetch(`${base}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'New one' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 4, text: 'New one' });
  });

  it('deletes a message', async () => {
    const res = await fetch(`${base}/messages/2`, { method: 'DELETE' });
    expect(res.status).toBe(204);
    const left = await (await fetch(`${base}/messages`)).json();
    expect(left.map((m: { id: number }) => m.id)).toEqual([1, 3]);
  });

  it('answers 404 when deleting a message that does not exist', async () => {
    const res = await fetch(`${base}/messages/99`, { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Message not found' });
  });
});
