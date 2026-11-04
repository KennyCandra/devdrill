import express from 'express';

export function tasksRouter(store) {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!store.findProject(req.params.projectId)) {
      return res.status(404).json({ error: 'Project not found' });
    }
    next();
  });

  router.get('/', (req, res) => {
    res.json(store.tasksIn(req.params.projectId));
  });

  router.get('/:taskId', (req, res) => {
    const task = store.findTask(req.params.projectId, req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/', (req, res) => {
    const { title } = req.body ?? {};
    if (!title) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json(store.addTask(req.params.projectId, title));
  });

  return router;
}
