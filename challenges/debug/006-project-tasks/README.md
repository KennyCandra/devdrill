# Every project's tasks return 404

Bug report from the web team:

> The tasks page is broken for everyone. Every project says "Project not found", even though `GET /projects` lists them all.

Find out why and fix it, so every route below works.

## How it should work

| Route                                  | Result                                                      |
| -------------------------------------- | ----------------------------------------------------------- |
| `GET /projects`                        | `200`, list of **Project**                                  |
| `GET /projects/:projectId/tasks`       | `200`, list of that project's **Task**                      |
| `GET /projects/:projectId/tasks/:taskId` | `200`, one **Task**                                       |
| `POST /projects/:projectId/tasks`      | `201`, the new **Task**; the body is `{ title }`            |

Rules:

- If the project doesn't exist, every task route is `404` with `{ error: 'Project not found' }`.
- A task is only found under the project it belongs to; under any other project it's `404` with `{ error: 'Task not found' }`.
- An id that isn't exactly a real id, like `1abc`, is treated as not found.
- A new task's `projectId` is the project's number, not text: `1`, not `'1'`.
- A new task then shows up in its project's list.
- A new task needs a non-empty `title`; otherwise it's `400` with `{ error: 'Title is required' }`.

```js
// GET /projects/2/tasks
[{ id: 3, projectId: 2, title: 'Ship the beta', done: false }];

// POST /projects/2/tasks with { "title": "Fix login" } answers 201 and
({ id: 4, projectId: 2, title: 'Fix login', done: false });
```

## Data

**Project**

| Field  | Type         | Meaning      |
| ------ | ------------ | ------------ |
| `id`   | whole number | The project  |
| `name` | text         | Its name     |

**Task**

| Field       | Type         | Meaning                    |
| ----------- | ------------ | -------------------------- |
| `id`        | whole number | The task                   |
| `projectId` | whole number | The project it belongs to  |
| `title`     | text         | What to do                 |
| `done`      | true/false   | Whether it's finished      |

**Functions**

| Function            | Takes                 | Returns                          |
| ------------------- | --------------------- | -------------------------------- |
| `createApp(store)`  | **Store** (optional)  | The Express app                  |
| `createStore()`     | nothing               | A **Store** with sample data     |
| `tasksRouter(store)`| **Store**             | The Express router for the tasks |

## Files

- `src/app`: the app and where routes are mounted
- `src/tasksRouter`: the task routes
- `src/store`: the data, kept in memory
- `tests/tasks.test`: the tests
