# Let deleted articles be restored

Authors keep deleting articles by accident, and today `DELETE /articles/:slug` removes them and their comments for good. Support wants a way to bring them back.

## What to build

Change `DELETE /articles/:slug` so that the article can be restored, and add a route that restores it. **To everyone using the API, a deleted article must still look deleted.**

- A deleted article is gone from `GET /articles` and from `GET /authors/:author/articles`.
- Every other route for a deleted article is `404` with `{ error: 'Article not found' }`, including its comments, `PATCH` and a second `DELETE`.
- `GET /stats` counts neither the deleted article nor its comments.
- A deleted article's slug stays taken: `POST /articles` with it is `409`, as for any other article, so it can always be restored.
- `POST /articles/:slug/restore` brings a deleted article back with its comments, and answers `200` with the article.
- Restoring an article that doesn't exist is `404` with `{ error: 'Article not found' }`.
- Restoring an article that isn't deleted is `409` with `{ error: 'Article is not deleted' }`.
- Articles in responses have the same fields as today: nothing new, whether or not they were ever deleted.

```js
// DELETE /articles/hello-world answers 204, then
// GET /articles/hello-world answers 404 and
({ error: 'Article not found' });

// POST /articles/hello-world/restore answers 200 and
({ slug: 'hello-world', title: 'Hello, world', author: 'ana' });
```

The existing tests pass now and must keep passing.

## Data

**Article**

| Field    | Type | Meaning                   |
| -------- | ---- | ------------------------- |
| `slug`   | text | Its address; it's unique  |
| `title`  | text | Its title                 |
| `author` | text | Who wrote it              |

**Comment**

| Field  | Type | Meaning                    |
| ------ | ---- | -------------------------- |
| `slug` | text | The article it belongs to  |
| `text` | text | What it says               |

**Routes today**

| Route                            | Result                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `GET /articles`                  | `200`, list of **Article**                                |
| `GET /authors/:author/articles`  | `200`, list of that author's **Article**                  |
| `GET /articles/:slug`            | `200`, one **Article**                                    |
| `POST /articles`                 | `201`, the new **Article**, or `409` with `{ error: 'Slug is taken' }` |
| `PATCH /articles/:slug`          | `200`, the **Article** with its new `title`               |
| `DELETE /articles/:slug`         | `204`                                                     |
| `GET /articles/:slug/comments`   | `200`, list of its **Comment**                            |
| `POST /articles/:slug/comments`  | `201`, the new **Comment**; the body is `{ text }`        |
| `GET /stats`                     | `200`, `{ articles, comments }`: how many of each         |

**Functions**

| Function            | Takes                | Returns                      |
| ------------------- | -------------------- | ---------------------------- |
| `createApp(store)`  | **Store** (optional) | The Express app              |
| `createStore()`     | nothing              | A **Store** with sample data |

The sample data is two articles, `hello-world` by `ana` and `second-post` by `ben`. `hello-world` has two comments and `second-post` has one.

## Files

- `src/app`: the routes
- `src/store`: the articles and comments, kept in memory
- `tests/articles.test`: the existing tests
