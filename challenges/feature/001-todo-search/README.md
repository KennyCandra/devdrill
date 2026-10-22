# Add search to the todo list

Users with long todo lists keep asking for a search box. Add a `search` method to the list returned by `createTodoList()`.

## What `search(query, options)` should do

- Return the todos whose **title contains `query`**, ignoring upper/lower case.
- Ignore spaces around the query. An **empty query** matches every todo.
- `options.tag` (optional): only todos that have this exact tag, ignoring case (`'trav'` doesn't match `'travel'`).
- `options.status` (optional): `'all'` (default), `'open'` or `'done'`, the same as `list()`.
- Results come back in the order the todos were added.
- Like `list()`, return copies: changing a result must not change the stored todo.

```js
const todos = createTodoList();
todos.add('Buy milk', { tags: ['home'] });
todos.add('Book flights', { tags: ['travel'] });

todos.search('BUY');               // [{ title: 'Buy milk', ... }]
todos.search('', { tag: 'Travel' }); // [{ title: 'Book flights', ... }]
```

The existing tests pass now and must keep passing.

## Files

- `src/todos.js`: the todo list
- `tests/todos.test.js`: the existing tests
