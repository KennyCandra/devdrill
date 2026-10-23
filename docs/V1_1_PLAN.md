# DevDrill — Version 1.1 Plan: Review mode

> Status: draft, waiting for Ahmed's OK. v1 (Debug + Feature) is built; its playtest and publish are still open.

## 1. Goal

Practice reviewing a pull request: read someone else's change, find what's wrong, say why, and decide whether it can merge. Graded **without AI**, against an answer key of planted issues. The AI module (LangChain, later) adds a second opinion on how well each comment is explained; nothing here depends on it.

## 2. Scope

| In v1.1                                               | Not in v1.1                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Review mode: a PR as a diff, line comments, a verdict | AI grading of comment quality → AI module                               |
| Static grading by location against an answer key      | Running or editing the PR's code                                        |
| 3 review challenges, each in JS and TS                | More debug/feature challenges (rule: none until every version is built) |
| Results with found / missed issues and the answer key | Threads, replies, suggested-change blocks                               |
| Validator + CI for review challenges                  |                                                                         |

## 3. What the player does

1. Opens a review challenge: the left panel shows the **PR description** (title, what it changes, why).
2. The middle shows the **diff** of each changed file (Monaco diff editor, read-only; side by side, or inline on narrow windows).
3. Clicks a line in the new code → writes a **comment** and picks a **category**: bug, security, performance, readability, tests.
4. Picks a **verdict**: Approve or Request changes.
5. **Submits the review.**
6. Results: which issues were found, which were missed, what the comments that matched nothing were.

## 4. Challenge format

```
challenges/review/001-short-name/
├── challenge.json        # mode: "review", same fields as today (hints, difficulty…)
├── README.md             # the PR description
├── js/
│   ├── base/             # the code before the PR
│   ├── head/             # the code after the PR (only the files that change, layered on base/)
│   └── issues.json       # the answer key for this language's line numbers
└── ts/  (same)
```

`issues.json`:

```json
[
  {
    "id": "missing-await",
    "file": "src/orders.js",
    "lines": [14, 16],
    "category": "bug",
    "severity": "must",
    "title": "The total is computed before the orders load",
    "explanation": "fetchOrders() returns a promise; without await, orders is a Promise and reduce() throws."
  }
]
```

- **severity:** `must` (blocks merging), `should` (worth a comment), `nit` (optional style point).
- Same `id`s in `js/` and `ts/`: only `file` and `lines` may differ.

**Validator rules (new, for review):**

1. `base/` and `head/` exist; `head/` changes at least one file.
2. Every issue points at a file in the diff, and its lines are changed or added lines in `head/`.
3. At least one `must` issue; ids are unique and the same in every language.
4. If `head/` has tests, they **pass** (CI is green, so the bugs are ones tests missed).
5. Same zero-dependency and import rules as today; TS type-checks.
6. README needs no `## Data` section for review (the code is the data); it does need the PR's intent, so rules the code breaks are stated.

## 5. Grading (no AI)

- A comment **matches** an issue when it's on the same file, within the issue's lines **± 2**.
- An issue is **found** if any comment matches it. One comment counts for one issue (the closest).
- The category is shown as right or wrong but doesn't decide "found" (it's feedback, not a trap).
- **Solved** = every `must` issue found **and** the verdict is Request changes.
- Comments that match nothing are listed as "Not in the answer key": not penalised. They may be good points; the AI module will judge them later.
- Shown score: `must` found 2/2, `should` 1/2, `nit` 0/1.

**What's hidden until solved** (same idea as hidden tests today): after an unsolved submit, missed issues show only their category and severity ("1 missed bug, must fix"), not where they are. The full answer key needs a confirm, like "View solution" today.

## 6. Server

| Method    | Path                       | Does                                                          |
| --------- | -------------------------- | ------------------------------------------------------------- |
| GET       | `/challenges/:id/diff`     | Changed files: `{ path, base, head }` (review only)           |
| GET / PUT | `/workspaces/:id/review`   | The player's draft: comments + verdict (autosaved)            |
| POST      | `/workspaces/:id/submit`   | For review: grade the draft → `ReviewResult`, update progress |
| GET       | `/challenges/:id/solution` | For review: the answer key (`issues.json`)                    |

- Drafts live in `workspaces/<lang>/<id>/review.json`, so per-language progress and Reset work as today.
- Same security as every other route (token, Host/Origin checks, JSON only); comment text is length-capped.
- Grading is a pure function with its own unit tests.

## 7. Screens

1. **Challenge list:** a third mode tab, **Review**.
2. **Review workspace:** PR description (left) · changed files + diff (middle) · comments list + verdict + Submit (right). Comments show inline under their line in the diff.
3. **Results:** per issue: found/missed, your matching comment, the explanation (once solved or confirmed). Then "Not in the answer key", time and attempts.

## 8. Milestones

Each milestone: build → a fresh reviewer agent (no context) checks it → fix → commit. A commit after every step.

### R0 — Format, types, validator (~3 hours)

- Shared types: `ReviewIssue`, `ReviewComment`, `ReviewDraft`, `ReviewResult`; `mode: "review"`.
- Loader accepts `challenges/review/`; validator checks the rules in section 4.
- One tiny fixture challenge for validator tests.

### R1 — First review challenge (~2 hours)

- `review-001`: an easy PR (JS + TS) with one `must` bug, one `should`, one `nit`.

### R2 — Server (~4 hours)

- Diff, draft and submit routes; grading function with unit tests; answer-key gating; progress.

### R3 — Review workspace UI (~1 day)

- Monaco diff editor, click-a-line comments shown inline, comments list, verdict, autosave, timer.

### R4 — Results + list (~half a day)

- Review results screen, answer key behind a confirm, the Review tab in the list.

### R5 — Two more challenges, docs, release (~half a day)

- `review-002` (security) and `review-003` (async/performance), JS + TS.
- README, CONTRIBUTING (how to write a review challenge), this plan's status; release build + smoke test.

**Done when:** you can open a review challenge from `npx devdrill`, comment on the diff, submit, and see what you found and missed.

## 9. Open decisions (need Ahmed)

1. Line tolerance **± 2**: fine, or stricter?
2. Solved needs the **Request changes** verdict: keep?
3. Three challenges as listed in R1/R5: OK as the only new ones until every version is built?
