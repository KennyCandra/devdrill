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

const get = (token: string, path: string) =>
  fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });

describe('invoices', () => {
  beforeEach(() => start(createApp()));

  it("lists the customer's invoices", async () => {
    const res = await get('ana-token', '/invoices');
    expect((await res.json()).map((i: { id: number }) => i.id)).toEqual([10, 11]);
  });

  it('turns away a bad token', async () => {
    expect((await get('nope', '/invoices')).status).toBe(401);
  });
});
