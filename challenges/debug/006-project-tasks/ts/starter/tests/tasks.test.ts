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

describe('projects', () => {
  it('lists every project', async () => {
    const res = await fetch(`${base}/projects`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 1, name: 'Website' },
      { id: 2, name: 'Mobile app' },
    ]);
  });
});

describe('tasks', () => {
  it("lists a project's tasks", async () => {
    const res = await fetch(`${base}/projects/2/tasks`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: 3, projectId: 2, title: 'Ship the beta', done: false },
    ]);
  });

  it('finds one task', async () => {
    const res = await fetch(`${base}/projects/1/tasks/2`);
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('Write the docs');
  });

  it('answers 404 for a project that does not exist', async () => {
    const res = await fetch(`${base}/projects/99/tasks`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Project not found' });
  });
});
