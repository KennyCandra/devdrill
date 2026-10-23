export interface Todo {
  id: number;
  title: string;
  tags: string[];
  done: boolean;
}

export type Status = 'all' | 'open' | 'done';

// An in-memory todo list. Each list has its own ids, starting at 1.
export function createTodoList() {
  const todos: Todo[] = [];
  let nextId = 1;

  function find(id: number): Todo {
    const todo = todos.find((t) => t.id === id);
    if (!todo) throw new Error(`No todo with id ${id}`);
    return todo;
  }

  // Callers get copies, so they can't change stored todos by accident.
  function copy(todo: Todo): Todo {
    return { ...todo, tags: [...todo.tags] };
  }

  function matchesStatus(todo: Todo, status: Status): boolean {
    if (status === 'open') return !todo.done;
    if (status === 'done') return todo.done;
    return true;
  }

  return {
    add(title: string, { tags = [] }: { tags?: string[] } = {}): Todo {
      const trimmed = title.trim();
      if (!trimmed) throw new Error('A todo needs a title.');
      const todo: Todo = { id: nextId++, title: trimmed, tags: [...tags], done: false };
      todos.push(todo);
      return copy(todo);
    },

    complete(id: number): void {
      find(id).done = true;
    },

    list({ status = 'all' }: { status?: Status } = {}): Todo[] {
      return todos.filter((todo) => matchesStatus(todo, status)).map(copy);
    },

    // Case-insensitive title search; tag (case-insensitive) and status are optional filters.
    search(query: string, { tag, status = 'all' }: { tag?: string; status?: Status } = {}): Todo[] {
      const needle = query.trim().toLowerCase();
      const wantedTag = tag?.toLowerCase();
      return todos
        .filter((todo) => matchesStatus(todo, status))
        .filter((todo) => todo.title.toLowerCase().includes(needle))
        .filter((todo) => !wantedTag || todo.tags.some((t) => t.toLowerCase() === wantedTag))
        .map(copy);
    },
  };
}
