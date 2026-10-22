import { createTodoList } from '../src/todos.js';

function sampleList() {
  const todos = createTodoList();
  todos.add('Buy milk', { tags: ['home', 'Errands'] });
  todos.add('Book flights to Cairo', { tags: ['travel'] });
  todos.add('Buy sunscreen', { tags: ['Travel'] });
  todos.add('Fix the bike', { tags: [] });
  return todos;
}

const titles = (todos) => todos.map((t) => t.title);

describe('search', () => {
  it('matches part of the title, ignoring case', () => {
    expect(titles(sampleList().search('BUY'))).toEqual(['Buy milk', 'Buy sunscreen']);
  });

  it('ignores spaces around the query', () => {
    expect(titles(sampleList().search('  bike '))).toEqual(['Fix the bike']);
  });

  it('returns everything for an empty query, in the order added', () => {
    expect(titles(sampleList().search(''))).toEqual([
      'Buy milk',
      'Book flights to Cairo',
      'Buy sunscreen',
      'Fix the bike',
    ]);
  });

  it('filters by tag, ignoring case', () => {
    expect(titles(sampleList().search('', { tag: 'travel' }))).toEqual([
      'Book flights to Cairo',
      'Buy sunscreen',
    ]);
  });

  it('combines the query and the tag', () => {
    expect(titles(sampleList().search('buy', { tag: 'TRAVEL' }))).toEqual(['Buy sunscreen']);
  });

  it('filters by status like list()', () => {
    const todos = sampleList();
    todos.complete(1);
    expect(titles(todos.search('buy', { status: 'open' }))).toEqual(['Buy sunscreen']);
    expect(titles(todos.search('buy', { status: 'done' }))).toEqual(['Buy milk']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(sampleList().search('zebra')).toEqual([]);
  });

  it('returns copies', () => {
    const todos = sampleList();
    todos.search('milk')[0].title = 'changed';
    expect(titles(todos.search('milk'))).toEqual(['Buy milk']);
  });
});
