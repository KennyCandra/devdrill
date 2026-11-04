import express from 'express';
import { createStore } from './store';

export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());

  app.get('/messages', (req, res) => {
    res.json(store.list());
  });

  app.post('/messages', (req, res) => {
    res.status(201).json(store.add(req.body.text));
  });

  app.delete('/messages/:id', (req, res) => {
    if (!store.remove(Number(req.params.id))) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.sendStatus(204);
  });

  return app;
}
