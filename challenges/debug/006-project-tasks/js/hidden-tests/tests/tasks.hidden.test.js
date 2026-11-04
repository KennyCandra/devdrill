import { createApp } from '../src/app.js';

let server;
let base;

function start(app) {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

afterEach(
  () =>
    new Promise((resolve) => {
      server.close(() => resolve());
    }),
);

beforeEach(() => start(createApp()));

function addTask(projectId, body) {
  return fetch(`${base}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('project tasks', () => {
  it('answers 404 on every task route for a missing project', async () => {
    const answers = await Promise.all([
      fetch(`${base}/projects/99/tasks/1`),
      addTask(99, { title: 'Nowhere' }),
    ]);
    for (const res of answers) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Project not found' });
    }
  });

  it('only finds a task under its own project', async () => {
    const res = await fetch(`${base}/projects/2/tasks/1`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Task not found' });
    expect((await fetch(`${base}/projects/1/tasks/1`)).status).toBe(200);
  });

  it('treats an id that only starts with a real id as not found', async () => {
    for (const id of ['1abc', '1.0', '0x1']) {
      const project = await fetch(`${base}/projects/${id}/tasks`);
      expect(project.status).toBe(404);
      expect(await project.json()).toEqual({ error: 'Project not found' });
    }
    const task = await fetch(`${base}/projects/1/tasks/1abc`);
    expect(task.status).toBe(404);
    expect(await task.json()).toEqual({ error: 'Task not found' });
  });

  it("gives a new task its project's number", async () => {
    const res = await addTask(2, { title: 'Fix login' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 4, projectId: 2, title: 'Fix login', done: false });
  });

  it('lists a new task in its project', async () => {
    await addTask(2, { title: 'Fix login' });
    const titles = (await (await fetch(`${base}/projects/2/tasks`)).json()).map(
      (t) => t.title,
    );
    expect(titles).toEqual(['Ship the beta', 'Fix login']);
    const other = await (await fetch(`${base}/projects/1/tasks`)).json();
    expect(other).toHaveLength(2);
  });

  it('regression: rejects a task with no title', async () => {
    const res = await addTask(1, { title: '' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Title is required' });
    const noBody = await fetch(`${base}/projects/1/tasks`, { method: 'POST' });
    expect(noBody.status).toBe(400);
  });
});
