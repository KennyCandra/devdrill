import express from 'express';
import { createStore } from './store';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** The limit from the query, or null if it isn't a whole number from 1 to MAX_LIMIT. */
function readLimit(value: unknown) {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const limit = Number(value);
  return limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());

  app.get('/messages', (req, res) => {
    const { limit: rawLimit, cursor } = req.query;
    // The old mobile app sends neither, and expects a plain list.
    if (rawLimit === undefined && cursor === undefined) return res.json(store.list());

    const limit = readLimit(rawLimit);
    if (limit === null) {
      return res.status(400).json({ error: 'limit must be a whole number from 1 to 100' });
    }
    if (cursor !== undefined && (typeof cursor !== 'string' || !/^\d+$/.test(cursor))) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }

    // The cursor is the id of the page's last message. Ids never change, so adding or
    // deleting messages (even that one) can't move the place it marks.
    const after = cursor === undefined ? 0 : Number(cursor);
    const rest = store.list().filter((m) => m.id > after);
    const items = rest.slice(0, limit);
    const hasMore = rest.length > limit;
    res.json({ items, nextCursor: hasMore ? String(items[items.length - 1].id) : null });
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
