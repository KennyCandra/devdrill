export interface Project {
  id: number;
  name: string;
}
//T
/** Ids reach the store from JSON and from code, so it takes either. */
type Id = number | string;
//T
export interface Task {
  id: number;
  projectId: Id;
  title: string;
  done: boolean;
}
//T
export type Store = ReturnType<typeof createStore>;
//T
export function createStore() {
  const projects: Project[] = [
    { id: 1, name: 'Website' },
    { id: 2, name: 'Mobile app' },
  ];
  const tasks: Task[] = [
    { id: 1, projectId: 1, title: 'Fix the header', done: false },
    { id: 2, projectId: 1, title: 'Write the docs', done: true },
    { id: 3, projectId: 2, title: 'Ship the beta', done: false },
  ];
  let nextTaskId = 4;

  return {
    listProjects: () => projects,
    findProject: (id: Id) => projects.find((p) => p.id === id),
    tasksIn: (projectId: Id) => tasks.filter((t) => t.projectId === projectId),
    findTask: (projectId: Id, taskId: Id) =>
      tasks.find((t) => t.projectId === projectId && t.id === taskId),
    addTask(projectId: Id, title: string) {
      const task = { id: nextTaskId++, projectId, title, done: false };
      tasks.push(task);
      return task;
    },
  };
}
