# Load messages a page at a time

`GET /messages` returns every message at once. A busy room has thousands, and the new web app wants to load them a page at a time.

**The old mobile app also calls this route, and it can't be updated quickly.** It must keep working.

## What to build

Add `limit` and `cursor` query parameters to `GET /messages`:

- With neither `limit` nor `cursor`, `GET /messages` stays exactly as it is today: a plain list of every message.
- With either one, the result is `{ items, nextCursor }`: up to `limit` messages, oldest first, and `nextCursor` is text you can pass back.
- With a `cursor`, the page starts right after the last message of the page that cursor came from.
- `nextCursor` is `null` when there are no more messages, even when the last page is exactly full.
- A `cursor` with no `limit` uses a limit of 20.
- A `limit` that isn't a whole number from 1 to 100 is `400` with `{ error: 'limit must be a whole number from 1 to 100' }`.
- A `cursor` that can't be read is `400` with `{ error: 'Invalid cursor' }`.
- Paging never skips or repeats a message when messages are added or deleted between pages. This holds even if the message the cursor came from was deleted.

What a cursor looks like inside is up to you.

```js
// GET /messages?limit=2
({
  items: [
    { id: 1, text: 'Hello' },
    { id: 2, text: 'Anyone here?' },
  ],
  nextCursor: 'some text you choose',
});

// GET /messages?limit=2&cursor=<that text>
({
  items: [{ id: 3, text: 'Yes!' }],
  nextCursor: null,
});
```

The existing tests pass now and must keep passing.

## Contract

Only `GET /messages` changes. `POST /messages` and `DELETE /messages/:id` work as they do today.

The examples start from the messages the app begins with: `Hello` (id 1), `Anyone here?` (id 2) and `Yes!` (id 3). A cursor's text is up to you, so the examples write it as `<cursor>`. Send a cursor back exactly as you got it.

### `GET /messages` with neither `limit` nor `cursor`

Answers `200` with a plain list of every message, as today:

```js
// GET /messages
[
  { id: 1, text: 'Hello' },
  { id: 2, text: 'Anyone here?' },
  { id: 3, text: 'Yes!' },
];
```

### `GET /messages` with a `limit`, and no `cursor`

Answers `200`. `items` has up to `limit` messages, oldest first. `nextCursor` is text when more messages follow, and `null` when none do.

```js
// GET /messages?limit=2
({
  items: [
    { id: 1, text: 'Hello' },
    { id: 2, text: 'Anyone here?' },
  ],
  nextCursor: '<cursor>',
});

// GET /messages?limit=3, all three fit, so the page is full and it's the last one
({
  items: [
    { id: 1, text: 'Hello' },
    { id: 2, text: 'Anyone here?' },
    { id: 3, text: 'Yes!' },
  ],
  nextCursor: null,
});

// GET /messages?limit=100
({
  items: [
    { id: 1, text: 'Hello' },
    { id: 2, text: 'Anyone here?' },
    { id: 3, text: 'Yes!' },
  ],
  nextCursor: null,
});
```

### `GET /messages` with a `cursor`

Answers `200`. The page starts right after the last message of the page the cursor came from. With no `limit`, the limit is 20.

```js
// GET /messages?limit=2&cursor=<cursor from the first page>
({
  items: [{ id: 3, text: 'Yes!' }],
  nextCursor: null,
});

// GET /messages?cursor=<cursor from GET /messages?limit=1>
({
  items: [
    { id: 2, text: 'Anyone here?' },
    { id: 3, text: 'Yes!' },
  ],
  nextCursor: null,
});
```

### Errors

A `limit` that isn't a whole number from 1 to 100 is refused. This includes `0`, `101`, `-1`, `2.5`, `abc`, `5abc` and an empty `limit=`.

```js
// GET /messages?limit=0 (or any value listed above)
// answers 400 and
({ error: 'limit must be a whole number from 1 to 100' });

// GET /messages?limit=2&cursor=not-a-cursor
// answers 400 and
({ error: 'Invalid cursor' });
```

### Paging while messages change

Paging never skips or repeats a message, even when messages are added or deleted between pages. These examples start with `GET /messages?limit=1`, which answers with `Hello` and a `<cursor>`.

```js
// DELETE /messages/1, answers 204
// GET /messages?limit=2&cursor=<cursor>
({
  items: [
    { id: 2, text: 'Anyone here?' },
    { id: 3, text: 'Yes!' },
  ],
  nextCursor: null,
});
```

```js
// GET /messages?limit=2, answers Hello and Anyone here?, with a <cursor>
// DELETE /messages/2, answers 204
// GET /messages?limit=2&cursor=<cursor>
({ items: [{ id: 3, text: 'Yes!' }], nextCursor: null });
```

```js
// GET /messages?limit=2, answers Hello and Anyone here?, with a <cursor>
// POST /messages with { "text": "New" }, answers 201 and
({ id: 4, text: 'New' });
// GET /messages?limit=2&cursor=<cursor>
({
  items: [
    { id: 3, text: 'Yes!' },
    { id: 4, text: 'New' },
  ],
  nextCursor: null,
});
```

## Data

**Message**

| Field  | Type         | Meaning                                         |
| ------ | ------------ | ----------------------------------------------- |
| `id`   | whole number | The message; newer messages have bigger ids     |
| `text` | text         | What it says                                    |

**Routes**

| Route                 | Result                                          |
| --------------------- | ----------------------------------------------- |
| `GET /messages`       | See above                                       |
| `POST /messages`      | `201`, the new **Message**; the body is `{ text }` |
| `DELETE /messages/:id` | `204`, or `404` with `{ error: 'Message not found' }` |

**Functions**

| Function             | Takes                                          | Returns                 |
| -------------------- | ---------------------------------------------- | ----------------------- |
| `createApp(store)`   | **Store** (optional)                           | The Express app         |
| `createStore(texts)` | list of text (optional): the first messages    | A **Store**             |
| `store.list()`       | nothing                                        | list of **Message**, oldest first |
| `store.add(text)`    | text                                           | the new **Message**     |
| `store.remove(id)`   | whole number                                   | true if it was removed  |

## Files

- `src/app`: the routes
- `src/store`: the messages, kept in memory
- `tests/messages.test`: the existing tests
