import express from 'express';
import { createStore } from './store.js';
import { tasksRouter } from './tasksRouter.js';

export function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());

  app.get('/projects', (req, res) => {
    res.json(store.listProjects());
  });

  app.use('/projects/:projectId/tasks', tasksRouter(store));

  return app;
}
