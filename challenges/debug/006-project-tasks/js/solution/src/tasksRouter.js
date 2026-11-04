import express from 'express';

export function tasksRouter(store) {
  // mergeParams: :projectId is defined where this router is mounted, not on its own paths.
  const router = express.Router({ mergeParams: true });

  router.use((req, res, next) => {
    // URL params are text; the ids in the store are numbers.
    if (!store.findProject(Number(req.params.projectId))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    next();
  });

  router.get('/', (req, res) => {
    res.json(store.tasksIn(Number(req.params.projectId)));
  });

  router.get('/:taskId', (req, res) => {
    const task = store.findTask(Number(req.params.projectId), Number(req.params.taskId));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  });

  router.post('/', (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json(store.addTask(Number(req.params.projectId), title));
  });

  return router;
}
