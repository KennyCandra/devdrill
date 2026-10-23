# DevDrill — Version 1.1 Plan: Review mode

> Status: agreed with Ahmed on 2026-10-23. v1 (Debug + Feature) is built; its playtest and publish are still open.

## 1. Goal

Practice reviewing a pull request: read someone else's change, find what's wrong, say why, and decide whether it can merge. Graded **without AI**, against an answer key of planted issues. The AI module (LangChain, later) adds a second opinion on each comment's explanation, and may add review points of its own; nothing here depends on it.

## 2. Scope

| In v1.1                                                          | Not in v1.1                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Review mode: a PR as a diff, structured comments, a verdict      | AI grading of explanations, AI review points → AI module                |
| Static grading by location **and** issue type                    | Running or editing the PR's code                                        |
| 3 review challenges (one of them a clean PR)                     | More debug/feature challenges (rule: none until every version is built) |
| Results with found / missed issues, false alarms, the answer key | Threads, replies, suggested-change blocks                               |
| Validator + CI for review challenges                             |                                                                         |

## 3. What the player does

1. Opens a review challenge: the left panel shows the **PR description** (title, what it changes, why).
2. The middle shows the **diff** of each changed file (Monaco diff editor, read-only).
3. Adds a **comment**, which is a structured claim:
   - **Where:** a line range in the new code, or a **whole function** (click it and the selection snaps to the function). A selection is never wider than one function.
   - **What:** an **issue type** from a fixed list (section 5), e.g. "missing await", "off-by-one", "unvalidated input".
   - **Why:** a short explanation in their own words (required; graded by the AI module later, not here).
4. Picks a **verdict**: **Approve** or **Request changes**. Some PRs are clean: Approve with no comments is then the right review.
5. **Submits the review.** At most **7 comments** per PR, whatever the PR: a PR has at most 5 issues, so the cap never tells how many there are.
6. Results: issues found and missed, false alarms, the verdict.

## 4. Challenge format

```
challenges/review/001-short-name/
├── challenge.json        # mode: "review", same fields as today (hints, difficulty…)
├── README.md             # the PR description
├── js/
│   ├── base/             # the code before the PR
│   ├── head/             # the code after the PR (only the files that change, layered on base/)
│   └── issues.json       # the answer key for this language ([] for a clean PR)
└── ts/  (same)
```

**Languages:** a review challenge follows the selected language, like debug and feature. A challenge is in every language where the same PR makes sense (e.g. backend code); one that only makes sense in one language (e.g. a TS-typing PR) has only that folder. The format and grading are the same for all.

`issues.json`:

```json
[
  {
    "id": "missing-await",
    "file": "src/orders.js",
    "lines": [14, 16],
    "type": "missing-await",
    "severity": "must",
    "title": "The total is computed before the orders load",
    "explanation": "fetchOrders() returns a promise; without await, orders is a Promise and reduce() throws."
  }
]
```

- **lines** or **function**: an issue is either a line range or a whole function (`"function": "applyCoupon"`).
- **type:** one of the issue types for that language (section 5).
- **severity:** `must` (blocks merging), `should` (worth a comment), `nit` (optional style point).
- Same `id`s in every language folder; only `file`, `lines`/`function` and language-specific `type`s may differ.

**Validator rules (new, for review):**

1. `base/` and `head/` exist; `head/` changes at least one file.
2. Every issue points at a file in the diff; its lines (or function) are changed or added in `head/`.
3. **0 to 5 issues**; ids unique and the same in every language; every `type` exists for that language.
4. If `head/` has tests, they **pass** (CI is green, so the bugs are ones tests missed).
5. Same zero-dependency and import rules as today; TS type-checks.
6. README needs no `## Data` section for review (the code is the data); it does need the PR's intent, so rules the code breaks are stated.

## 5. Issue types

One list per language, in `challenges/review/issue-types.json`: a shared base plus language-specific types. Grouped in the picker by category.

| Category    | Examples (shared)                                                                  | Language-specific examples        |
| ----------- | ---------------------------------------------------------------------------------- | --------------------------------- |
| Bug         | off-by-one, missing await, wrong condition, mutates shared state, null not handled | TS: unsafe type assertion / `any` |
| Security    | unvalidated input, injection, secret or private data exposed                       |                                   |
| Performance | repeated work in a loop, sequential awaits that could run together                 |                                   |
| Readability | unclear name, function does too much, dead code                                    |                                   |
| Tests       | missing test for new behaviour, test doesn't check the result                      |                                   |

Later languages add their own (Python: mutable default argument…).

## 6. Grading (no AI)

- A comment **matches** an issue when its location **overlaps** the issue (its lines, or anywhere in its function) **and** its issue type is the same.
- An issue is **found** if a comment matches it. One comment counts for one issue.
- A comment that matches no issue is a **false alarm**.
- **Verdict:** Request changes is right when the PR has a `must` issue; otherwise Approve is right.
- **Solved** = every `must` issue found **and** the right verdict **and** at most **1** false alarm.
- Shown: `must` 2/2 · `should` 1/2 · `nit` 0/1 · false alarms 1 · verdict ✓.

So guessing doesn't pay: approving everything fails buggy PRs, rejecting everything fails clean ones, and spraying comments costs false alarms.

**What's hidden until solved** (same idea as hidden tests today): after an unsolved submit, missed issues show only their category and severity ("1 missed bug, must fix"), not where or what. The full answer key needs a confirm, like "View solution" today.

## 7. Server

| Method    | Path                        | Does                                                                 |
| --------- | --------------------------- | -------------------------------------------------------------------- |
| GET       | `/challenges/:id/diff`      | Changed files `{ path, base, head }` and each file's function ranges |
| GET       | `/review/issue-types?lang=` | The issue-type list for a language                                   |
| GET / PUT | `/workspaces/:id/review`    | The player's draft: comments + verdict (autosaved)                   |
| POST      | `/workspaces/:id/submit`    | For review: grade the draft → `ReviewResult`, update progress        |
| GET       | `/challenges/:id/solution`  | For review: the answer key (`issues.json`)                           |

- Function ranges come from the TypeScript parser (it reads JS too), so "whole function" selections and function-level issues line up.
- Drafts live in `workspaces/<lang>/<id>/review.json`, so per-language progress and Reset work as today.
- Same security as every other route; the 7-comment cap and comment length are checked on the server.
- Grading is a pure function with its own unit tests.

## 8. Screens

1. **Challenge list:** a third mode tab, **Review**.
2. **Review workspace:** PR description (left) · changed files + diff (middle) · comments list (n/7) + verdict + Submit (right). Comments show inline under their lines in the diff.
3. **Results:** per issue: found/missed and your matching comment; false alarms; the explanation (once solved or confirmed); time and attempts.

## 9. Milestones

Each milestone: build → a fresh reviewer agent (no context) checks it → fix → commit. A commit after every step.

### R0 — Format, types, validator (~3 hours)

- Shared types: `ReviewIssue`, `ReviewComment`, `ReviewDraft`, `ReviewResult`, `IssueType`; `mode: "review"`.
- `issue-types.json`; loader accepts `challenges/review/`; validator checks section 4.
- A tiny fixture challenge for validator tests.

### R1 — First review challenge (~2 hours)

- `review-001`: an easy PR (JS + TS) with one `must` bug, one `should`, one `nit`.

### R2 — Server (~4 hours)

- Diff (with function ranges), issue types, draft and submit routes; grading with unit tests; answer-key gating; progress.

### R3 — Review workspace UI (~1 day)

- Monaco diff editor, line/function selection, comment form (type picker + why), inline comments, n/7 counter, verdict, autosave, timer.

### R4 — Results + list (~half a day)

- Review results screen, answer key behind a confirm, the Review tab in the list.

### R5 — Two more challenges, docs, release (~half a day)

- `review-002` (security, JS + TS) and `review-003` (a **clean** PR that tempts false alarms).
- README, CONTRIBUTING (how to write a review challenge), this plan's status; release build + smoke test.

**Done when:** you can open a review challenge from `npx devdrill`, comment on the diff, submit, and see what you found, missed and flagged wrongly.
