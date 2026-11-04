import express from 'express';
import { authenticate } from './auth.js';
import { createStore } from './store.js';

export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());
  app.use('/me', authenticate(store), async (req, res, next) => {
    await store.recordVisit(res.locals.user.id);
    next();
  });

  app.get('/me', async (req, res) => {
    const { id, name } = res.locals.user;
    const settings = await store.loadSettings(id);
    res.json({ id, name, theme: settings.theme });
  });

  app.get('/me/notes', async (req, res) => {
    const { id } = res.locals.user;
    const settings = await store.loadSettings(id);
    const notes = await store.notesOf(id);
    res.json(settings.newestFirst ? [...notes].reverse() : notes);
  });

  app.post('/me/notes', async (req, res) => {
    const { id } = res.locals.user;
    const settings = await store.loadSettings(id);
    if (req.body.text.length > settings.maxNoteLength) {
      return res.status(400).json({ error: 'Note is too long' });
    }
    res.status(201).json(await store.addNote(id, req.body.text));
  });

  return app;
}
