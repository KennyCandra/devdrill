import express from 'express';
import type { Store } from './store';

export function tasksRouter(store: Store) {
  // mergeParams: :projectId is defined where this router is mounted, not on its own paths.
  const router = express.Router({ mergeParams: true });

  // URL params are text; the ids in the store are numbers.
  const toId = (text: string) => (String(Number(text)) === text ? Number(text) : NaN);

  router.use((req, res, next) => {
    if (!store.findProject(toId(req.params.projectId))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    next();
  });

  router.get('/', (req, res) => {
    res.json(store.tasksIn(toId(req.params.projectId)));
  });

  router.get('/:taskId', (req, res) => {
    const task = store.findTask(toId(req.params.projectId), toId(req.params.taskId));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/', (req, res) => {
    const { title } = req.body ?? {};
    if (!title) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json(store.addTask(toId(req.params.projectId), title));
  });

  return router;
}
