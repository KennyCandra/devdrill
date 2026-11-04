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

  it('adds up each invoice in the summary', async () => {
    const res = await get('ana-token', '/invoices/summary');
    expect(await res.json()).toEqual([
      { id: 10, number: 'A-10', totalCents: 1750 },
      { id: 11, number: 'A-11', totalCents: 900 },
    ]);
  });

  it('returns one invoice', async () => {
    const res = await get('ana-token', '/invoices/10');
    expect(await res.json()).toEqual({ id: 10, customerId: 1, number: 'A-10' });
  });

  it('answers 404 for an invoice that does not exist', async () => {
    const res = await get('ana-token', '/invoices/99');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Invoice not found' });
  });
});

describe('errors', () => {
  it('answers a failure with JSON', async () => {
    const failing = {
      ...createStore(),
      invoicesOf: async () => {
        throw new Error('database is down');
      },
    };
    await start(createApp(failing));
    const res = await get('ana-token', '/invoices');
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
