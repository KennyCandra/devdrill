import { createTodoList } from '../src/todos';

describe('todo list', () => {
  it('adds todos with ids starting at 1', () => {
    const todos = createTodoList();
    expect(todos.add('Buy milk').id).toBe(1);
    expect(todos.add('Walk the dog').id).toBe(2);
  });

  it('trims titles and rejects empty ones', () => {
    const todos = createTodoList();
    expect(todos.add('  Buy milk  ').title).toBe('Buy milk');
    expect(() => todos.add('   ')).toThrow('needs a title');
  });

  it('lists open and done todos', () => {
    const todos = createTodoList();
    const milk = todos.add('Buy milk');
    todos.add('Walk the dog');
    todos.complete(milk.id);
    expect(todos.list({ status: 'done' }).map((t) => t.title)).toEqual(['Buy milk']);
    expect(todos.list({ status: 'open' }).map((t) => t.title)).toEqual(['Walk the dog']);
    expect(todos.list()).toHaveLength(2);
  });

  it('returns copies from list()', () => {
    const todos = createTodoList();
    todos.add('Buy milk', { tags: ['home'] });
    todos.list()[0].tags.push('changed');
    expect(todos.list()[0].tags).toEqual(['home']);
  });
});
