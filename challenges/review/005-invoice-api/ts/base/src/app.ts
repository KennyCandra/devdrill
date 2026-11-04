import express from 'express';
import { requireUser } from './auth';
import { createStore } from './store';

export function createApp(store = createStore()) {
  const app = express();
  app.use('/invoices', requireUser(store));

  app.get('/invoices', async (req, res) => {
    res.json(await store.invoicesOf(res.locals.user.id));
  });

  return app;
}
