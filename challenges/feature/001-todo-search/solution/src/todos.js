// An in-memory todo list. Each list has its own ids, starting at 1.
export function createTodoList() {
  const todos = [];
  let nextId = 1;

  function find(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) throw new Error(`No todo with id ${id}`);
    return todo;
  }

  // Callers get copies, so they can't change stored todos by accident.
  function copy(todo) {
    return { ...todo, tags: [...todo.tags] };
  }

  function matchesStatus(todo, status) {
    if (status === 'open') return !todo.done;
    if (status === 'done') return todo.done;
    return true;
  }

  return {
    add(title, { tags = [] } = {}) {
      const trimmed = title.trim();
      if (!trimmed) throw new Error('A todo needs a title.');
      const todo = { id: nextId++, title: trimmed, tags: [...tags], done: false };
      todos.push(todo);
      return copy(todo);
    },

    complete(id) {
      find(id).done = true;
    },

    // status: 'all' (default), 'open' or 'done'.
    list({ status = 'all' } = {}) {
      return todos.filter((todo) => matchesStatus(todo, status)).map(copy);
    },

    // Case-insensitive title search; tag (case-insensitive) and status are optional filters.
    search(query, { tag, status = 'all' } = {}) {
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
