//T
//T
//T
//T
export function createStore() {
  const projects = [
    { id: 1, name: 'Website' },
    { id: 2, name: 'Mobile app' },
  ];
  const tasks = [
    { id: 1, projectId: 1, title: 'Fix the header', done: false },
    { id: 2, projectId: 1, title: 'Write the docs', done: true },
    { id: 3, projectId: 2, title: 'Ship the beta', done: false },
  ];
  let nextTaskId = 4;

  return {
    listProjects: () => projects,
    findProject: (id) => projects.find((p) => p.id === id),
    tasksIn: (projectId) => tasks.filter((t) => t.projectId === projectId),
    findTask: (projectId, taskId) =>
      tasks.find((t) => t.projectId === projectId && t.id === taskId),
    addTask(projectId, title) {
      const task = { id: nextTaskId++, projectId, title, done: false };
      tasks.push(task);
      return task;
    },
  };
}
