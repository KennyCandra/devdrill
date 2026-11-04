import express from 'express';
import type { Response } from 'express';
import { createStore } from './store';

const notFound = (res: Response) => res.status(404).json({ error: 'Article not found' });

export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());

  app.get('/articles', (req, res) => {
    res.json(store.list());
  });

  app.get('/authors/:author/articles', (req, res) => {
    res.json(store.byAuthor(req.params.author));
  });

  app.post('/articles', (req, res) => {
    if (store.find(req.body.slug)) {
      return res.status(409).json({ error: 'Slug is taken' });
    }
    const { slug, title, author } = req.body;
    res.status(201).json(store.add({ slug, title, author }));
  });

  app.get('/stats', (req, res) => {
    res.json(store.stats());
  });

  app.get('/articles/:slug', (req, res) => {
    const article = store.find(req.params.slug);
    if (!article) return notFound(res);
    res.json(article);
  });

  app.patch('/articles/:slug', (req, res) => {
    if (!store.find(req.params.slug)) return notFound(res);
    res.json(store.rename(req.params.slug, req.body.title));
  });

  app.delete('/articles/:slug', (req, res) => {
    if (!store.find(req.params.slug)) return notFound(res);
    store.remove(req.params.slug);
    res.sendStatus(204);
  });

  app.get('/articles/:slug/comments', (req, res) => {
    if (!store.find(req.params.slug)) return notFound(res);
    res.json(store.commentsOn(req.params.slug));
  });

  app.post('/articles/:slug/comments', (req, res) => {
    if (!store.find(req.params.slug)) return notFound(res);
    res.status(201).json(store.addComment(req.params.slug, req.body.text));
  });

  return app;
}
