import express from 'express';
import { authenticate, currentUser } from './auth';
import { createStore } from './store';

export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());
  app.use('/me', authenticate(store));

  app.get('/me', async (req, res) => {
    const settings = await store.loadSettings(currentUser().id);
    res.json({ id: currentUser().id, name: currentUser().name, theme: settings.theme });
  });

  app.get('/me/notes', async (req, res) => {
    const settings = await store.loadSettings(currentUser().id);
    const notes = await store.notesOf(currentUser().id);
    res.json(settings.newestFirst ? [...notes].reverse() : notes);
  });

  app.post('/me/notes', async (req, res) => {
    const settings = await store.loadSettings(currentUser().id);
    if (req.body.text.length > settings.maxNoteLength) {
      return res.status(400).json({ error: 'Note is too long' });
    }
    res.status(201).json(await store.addNote(currentUser().id, req.body.text));
  });

  return app;
}
