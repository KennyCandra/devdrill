# Contributing

Thanks for helping! The most valuable contribution is a **good challenge**. Code fixes and improvements are welcome too.

## Adding a challenge

### 1. Pick a realistic problem

- **Debug:** a bug a real developer could plausibly write: an off-by-one, a shared reference, a missing `await`, a typo in a magic string. The bug should sit where the cause isn't obvious from the symptom.
- **Feature:** a small feature in working code where the obvious implementation breaks something that already works. The "don't break it" part is the lesson.

Keep it small: a few files and under ~150 lines. Someone should finish it in 10–30 minutes.

### 2. Create the folder

```
challenges/<debug|feature>/<NNN-short-name>/
├── challenge.json
├── README.md            # the task, shown in the app
├── starter/             # what the player gets: code + visible tests
│   ├── package.json     # { "type": "module" } and no dependencies
│   ├── src/...
│   └── tests/*.test.js
├── hidden-tests/        # same layout as starter; files named *.hidden.test.js
└── solution/            # ONLY the files that change, copied over starter/
```

Name the folder `NNN-short-name` with the next free number in that mode (look at the existing folders; numbers are per mode). Copy an existing challenge as a template.

`challenge.json`:

```json
{
  "id": "debug-006-short-name",
  "mode": "debug",
  "title": "Invoice totals are off by a cent",
  "difficulty": "easy",
  "estimatedMinutes": 15,
  "tags": ["arrays", "async"],
  "hints": ["Where to look", "The concept", "Almost the answer"],
  "hiddenTestRules": {
    "invoices > rounds each line before adding": "Each line is rounded to the cent before the lines are added up."
  }
}
```

The `id` is the mode plus the folder name.

`hiddenTestRules` maps every hidden test (its `"describe > test"` name) to the README sentence it checks, copied word for word. When a player's Submit fails that test, the app shows them that sentence so they know which rule they missed.

### 3. Write it so it's fair

- **README:** describe the symptom like a bug report, or the feature like a ticket. Every rule the hidden tests check must be in the README; a correct solution must never fail because of something unstated. Show an example of the exact result (fields, order, empty cases): playtesters miss rules written only in prose.
- **Data:** add a `## Data` section with a table for every object (field, type, meaning) and every function (what it takes, what it returns). Write types in plain words, like "text", "whole number", "true/false", "list of **Todo**", "**Coupon** or null", so the description works for any language. Players can't see types in plain JavaScript, so this is where they learn the shapes.
- **Visible tests:** for debug, at least one fails at the start. For feature, all pass at the start.
- **Hidden tests:** check the edge cases a symptom-only fix misses. Try to beat your own challenge: hardcode the visible test's values, special-case inputs, add a `sleep`. If a hack passes everything, add a test. Prefix pure regression tests with `regression:`.
- **Hints:** three steps, from "how to look" (e.g. "add a console.log here") to "the concept" to "almost the answer".
- **Solution:** a clean fix, with a comment only where the reason isn't obvious.

### 4. Validate

```bash
npm run validate -- challenges/debug/006-short-name
```

It also checks that your number isn't already used in that mode.

The validator checks:

1. **Metadata:** `challenge.json` is valid, its `id` is mode + folder name, the folder is named `NNN-kebab-case`, and `README.md` has a `## Data` section and an example of the exact result in a ` ```js ` block.
2. **Plain JavaScript, no dependencies:** only `.js`/`.mjs` files; `starter/package.json` has `"type": "module"` and no dependencies; only relative or `node:` imports, no computed `import()`, no `createRequire`. Don't import from `vitest`: `describe`, `it` and `expect` are globals.
3. **Every test runs:** no symlinks, no `vitest.config.*` or `vite.config.*`, no `.skip` / `.only` / `.todo` / `.skipIf` / `.runIf`.
4. **Layout:** hidden test files are named `*.hidden.test.js` and don't share a path with a starter file; `solution/` doesn't contain tests or `package.json`.
5. **Debug:** at least one visible and one hidden test fail on `starter/`; everything passes on `solution/`.
6. **Feature:** all visible tests pass on `starter/`; at least one hidden test fails; everything passes on `solution/`.
7. **Same tests:** the solution run runs exactly the same tests as the starter run.
8. **Every hidden test has a rule:** each hidden test is in `hiddenTestRules`, and its sentence appears in the README (bold and code ticks are ignored when comparing).

### 5. Playtest

Run `npm run dev` and solve it in the app without looking at the solution. Then ask someone else to try it. Adjust the README, hints, difficulty and estimate based on what you saw.

### Security note for reviewers

Challenge code runs on players' machines. Every challenge PR is reviewed by a maintainer before merging: look for anything that reads or writes outside the project, touches the network, or spawns processes.

## Code contributions

```bash
npm install
npm run dev     # app with hot reload
npm run check   # must pass before you open a PR
```

Keep PRs focused, add tests for behavior changes, and explain the "why" in the description. `docs/V1_PLAN.md` explains the design decisions; if a change goes against one, say so in the PR.
