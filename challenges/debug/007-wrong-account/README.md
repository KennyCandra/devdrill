# Users sometimes see someone else's account

A worrying report from support:

> Alice opened her account page and saw **Bob's name** next to her own theme. When she reloaded it was fine. We can't reproduce it on a quiet test server, and it only seems to happen when the site is busy.

Find out why and fix it.

## How it should work

Every route needs an `Authorization: Bearer <token>` header.

| Route            | Result                                           |
| ---------------- | ------------------------------------------------ |
| `GET /me`        | `200`, an **Account** for the signed-in person   |
| `GET /me/notes`  | `200`, list of their **Note**                    |
| `POST /me/notes` | `201`, the new **Note**; the body is `{ text }`  |

Rules:

- Every request is answered for the person whose token it carries, however many run at once.
- A note always belongs to the person who sent it, even while other requests are running.
- Each person only ever gets their own notes.
- One person's slow request must not hold up anyone else's.
- A request with a missing or unknown token is `401` with `{ error: 'Not signed in' }`, even right after someone else's request.
- A note longer than the person's `maxNoteLength` is `400` with `{ error: 'Note is too long' }`.

```js
// GET /me with the header Authorization: Bearer alice-token
({ id: 1, name: 'Alice', theme: 'dark' });

// POST /me/notes with { "text": "Call Sam" } answers 201 and
({ id: 2, ownerId: 1, text: 'Call Sam' });
```

The sample data: Alice has no notes yet, and Bob has one note, `Buy milk`. Cara's notes can be up to 10 characters long. Other examples:

```js
// GET /me with the header Authorization: Bearer bob-token
({ id: 2, name: 'Bob', theme: 'light' });

// GET /me/notes with the header Authorization: Bearer alice-token
[];

// GET /me/notes with the header Authorization: Bearer bob-token
[{ id: 1, ownerId: 2, text: 'Buy milk' }];

// POST /me/notes with cara-token and { "text": "This note is too long" }
// answers 400 and
({ error: 'Note is too long' });

// GET /me or GET /me/notes with no token, or with an unknown token
// answers 401 and
({ error: 'Not signed in' });
```

## Data

**Account**

| Field   | Type         | Meaning                |
| ------- | ------------ | ---------------------- |
| `id`    | whole number | The person             |
| `name`  | text         | Their name             |
| `theme` | text         | From their settings    |

**Note**

| Field     | Type         | Meaning           |
| --------- | ------------ | ----------------- |
| `id`      | whole number | The note          |
| `ownerId` | whole number | Who it belongs to |
| `text`    | text         | What it says      |

**Settings**

| Field           | Type         | Meaning                       |
| --------------- | ------------ | ----------------------------- |
| `theme`         | text         | Their theme                   |
| `newestFirst`   | true/false   | The order they want notes in  |
| `maxNoteLength` | whole number | The longest note they can add |

**Functions**

| Function               | Takes                                                     | Returns                                 |
| ---------------------- | --------------------------------------------------------- | --------------------------------------- |
| `createApp(store)`     | **Store** (optional)                                      | The Express app                         |
| `createStore(options)` | `latencyMs` (optional): how slow each person's lookups are | A **Store**; tests use it to overlap requests |
| `authenticate(store)`  | **Store**                                                 | The Express middleware that signs people in |

The test accounts are Alice (`alice-token`), Bob (`bob-token`) and Cara (`cara-token`).

## Files

- `src/app`: the routes
- `src/auth`: who is signed in
- `src/store`: the data, with a delay like a real database
- `tests/account.test`: the tests
