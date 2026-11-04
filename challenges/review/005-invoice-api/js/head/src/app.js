import express from 'express';
import { requireUser } from './auth.js';
import { createStore } from './store.js';

export function createApp(store = createStore()) {
  const app = express();
  app.use('/invoices', requireUser(store));

  app.get('/invoices', async (req, res) => {
    res.json(await store.invoicesOf(res.locals.user.id));
  });

  app.get('/invoices/summary', async (req, res) => {
    const invoices = await store.invoicesOf(res.locals.user.id);
    const summary = [];
    for (const invoice of invoices) {
      const lines = await store.linesOf(invoice.id);
      const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
      summary.push({ id: invoice.id, number: invoice.number, totalCents });
    }
    res.json(summary);
  });

  app.get('/invoices/:id', async (req, res) => {
    const invoice = await store.findInvoice(Number(req.params.id));
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  });

  // Express treats a handler as an error handler only if it takes all four arguments.
  app.use((err, req, res, _next) => {
    res.status(500).json({ error: err.message, stack: err.stack });
  });

  return app;
}
