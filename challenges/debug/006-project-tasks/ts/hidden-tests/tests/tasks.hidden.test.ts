import type { Express, Server } from 'express';
import { createApp } from '../src/app';

let server: Server;
let base: string;

function start(app: Express): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
}

afterEach(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

beforeEach(() => start(createApp()));

function addTask(projectId: number | string, body: object) {
  return fetch(`${base}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('project tasks', () => {
  it('only finds a task under its own project', async () => {
    const res = await fetch(`${base}/projects/2/tasks/1`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Task not found' });
    expect((await fetch(`${base}/projects/1/tasks/1`)).status).toBe(200);
  });

  it('treats an id that only starts with a real id as not found', async () => {
    const project = await fetch(`${base}/projects/1abc/tasks`);
    expect(project.status).toBe(404);
    expect(await project.json()).toEqual({ error: 'Project not found' });
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
      (t: { title: string }) => t.title,
    );
    expect(titles).toEqual(['Ship the beta', 'Fix login']);
    const other = await (await fetch(`${base}/projects/1/tasks`)).json();
    expect(other).toHaveLength(2);
  });

  it('regression: rejects a task with no title', async () => {
    const res = await addTask(1, { title: '' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Title is required' });
  });
});
