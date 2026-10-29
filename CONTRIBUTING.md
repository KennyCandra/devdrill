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
├── challenge.json       # shared by every language
├── README.md            # the task, shown in the app; shared, so describe data in plain words
├── js/                  # the JavaScript version
│   ├── starter/         # what the player gets: code + visible tests
│   │   ├── package.json # { "type": "module" } and no dependencies
│   │   ├── src/...
│   │   └── tests/*.test.js
│   ├── hidden-tests/    # same layout as starter; files named *.hidden.test.js
│   └── solution/        # ONLY the files that change, copied over starter/
└── ts/                  # the TypeScript version: the same, with .ts files
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

### Languages

Write the JavaScript version first, then the TypeScript one (or the other way round). Both share the README, hints and `hiddenTestRules`, so **test names must be the same** in both.

For TypeScript:

- Import without extensions: `import { total } from './cart'`.
- Give everything real types, but **never a type that gives the bug away**. If a union type would make the bug a type error (like `'percent' | 'fixed'` against a `'percentage'` typo), use the type real code would have at that boundary (e.g. `string`, because the value comes from JSON).
- `describe`, `it`, `expect` and `vi` are globals; don't import them.
- No `any` outside tests, and no `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`.
- The validator type-checks in strict mode, with the same settings as the editor: the starter (with its visible tests) and the full solution must have no type errors.

### 3. Write it so it's fair

- **README:** name files without an extension (`src/cart`, `tests/cart.test`): the README and hints are shown for every language. Describe the symptom like a bug report, or the feature like a ticket. Every rule the hidden tests check must be in the README; a correct solution must never fail because of something unstated. Show an example of the exact result (fields, order, empty cases): playtesters miss rules written only in prose.
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

1. **Metadata:** `challenge.json` is valid, its `id` is mode + folder name, the folder is named `NNN-kebab-case`, and `README.md` has a `## Data` section and an example of the exact result in a ` ```js ` block. The README and hints name no `.js`/`.ts` files.
2. **Plain code, no dependencies:** only `.js`/`.mjs` files in `js/` and `.ts` files in `ts/`; `starter/package.json` has `"type": "module"` and no dependencies; only relative or `node:` imports, no computed `import()`, no `createRequire`. Don't import from `vitest`: `describe`, `it` and `expect` are globals.
3. **Every test runs:** no symlinks, no `vitest.config.*` or `vite.config.*`, no `.skip` / `.only` / `.todo` / `.skipIf` / `.runIf`.
4. **Layout:** hidden test files are named `*.hidden.test.js` (or `.ts`) and don't share a path with a starter file; `solution/` doesn't contain tests or `package.json`.
5. **Debug:** at least one visible and one hidden test fail on `starter/`; everything passes on `solution/`.
6. **Feature:** all visible tests pass on `starter/`; at least one hidden test fails; everything passes on `solution/`.
7. **Same tests:** the solution run runs exactly the same tests as the starter run, and `js/` and `ts/` have the same test names.
8. **Every hidden test has a rule:** each hidden test is in `hiddenTestRules`, and its sentence appears in the README (bold and code ticks are ignored when comparing).
9. **TypeScript type-checks:** in `ts/`, the starter and the full solution have no type errors (strict mode), no `any` outside tests and no `@ts-` comments that switch checks off.

### 5. Playtest

Run `npm run dev` and solve it in the app without looking at the solution. Then ask someone else to try it. Adjust the README, hints, difficulty and estimate based on what you saw.

### Review challenges

A review challenge is a pull request to review instead of code to fix. It lives in `challenges/review/NNN-name/`:

```
challenges/review/001-order-coupons/
├── challenge.json    # "mode": "review"; no hiddenTestRules
├── README.md         # the PR description; needs a "## What this PR does" section
├── js/
│   ├── base/         # the code before the PR (with package.json)
│   ├── head/         # only the files the PR changes, as they are after it
│   └── issues.json   # the answer key ([] for a PR with nothing wrong)
└── ts/  (same)
```

Each entry in `issues.json`:

```json
{
  "id": "coupon-mutates-order",
  "file": "src/orders.js",
  "lines": [18, 23],
  "function": "applyCoupon",
  "type": "mutates-shared-state",
  "alsoAccept": [],
  "severity": "must",
  "title": "applyCoupon changes the cart's order instead of returning a new one",
  "explanation": "Why it's wrong, and what to do instead."
}
```

- `type` is an id from `challenges/review/issue-types.json` (shared types, plus some per language), shown as a label next to the issue in the answer key. (`alsoAccept` is optional and currently unused: players' comments have no type; they grade themselves against the key.)
- `severity`: `must` blocks merging (the right verdict is then "Request changes"), `should` is worth a comment, `nit` is a style point. A PR with no `must` issue should be approved. Severity also weighs the player's self-graded score: must 3, should 2, nit 1.
- `lines` are in the head version. With `function`, they must be exactly that function; without, at most 40 lines.
- At most 5 issues: players get 7 comments, so the comment limit never gives the count away.
- Each issue's `lines` decide which of the player's comments appear under it in the results, so keep them on the code a reviewer would point at.

Make it fair:

- **The README states every rule the issues rely on** ("never send `passwordHash` to the browser", "the original order must stay unchanged"). A reviewer can't be wrong about an unstated rule.
- **Nothing else in the PR is arguably wrong.** Read it as a picky reviewer: every point you'd comment on is either in the key, or fixed, or explained in the README ("coupons are already validated"). Otherwise careful players' comments end up under "other comments", next to nothing in the key.
- **The PR's own tests pass**: the issues are what tests and the compiler missed.
- Some reviews should be clean PRs: approving good code is part of the skill.

The validator checks the layout, that the PR compiles and its tests pass, that every issue points at lines the PR changed (and at its function), and that `js/` and `ts/` have the same issues.

### Security note for reviewers

Challenge code runs on players' machines. Every challenge PR is reviewed by a maintainer before merging: look for anything that reads or writes outside the project, touches the network, or spawns processes.

## Code contributions

```bash
npm install
npm run dev     # app with hot reload
npm run check   # must pass before you open a PR
```

Keep PRs focused, add tests for behavior changes, and explain the "why" in the description. `docs/V1_PLAN.md` explains the design decisions; if a change goes against one, say so in the PR.
