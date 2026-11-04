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

const get = (token, path) =>
  fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });

describe('invoices', () => {
  beforeEach(() => start(createApp()));

  it("lists the customer's invoices", async () => {
    const res = await get('ana-token', '/invoices');
    expect((await res.json()).map((i) => i.id)).toEqual([10, 11]);
  });

  it('turns away a bad token', async () => {
    expect((await get('nope', '/invoices')).status).toBe(401);
  });
});
