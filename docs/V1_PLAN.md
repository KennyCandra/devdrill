# DevDrill — Version 1 Plan

> Name: **DevDrill** (chosen 2026-10-22; "BugHunt" was the working name). Status: v1 built (M0–M6); waiting on playtest and publish.

## 1. Goal

A local, open-source practice tool for the AI-era interview skills:

1. **Debug** — find and fix a bug so the tests pass.
2. **Feature** — add a feature without breaking existing behavior.
3. **Review** — review a PR and catch the planted issues _(v1.1, not in v1)_.

Users run `npx devdrill`, a local server starts, and the browser opens. Nothing runs in the cloud.

## 2. Version 1 scope

| In v1                               | Not in v1                                |
| ----------------------------------- | ---------------------------------------- |
| Debug mode                          | Review mode → **v1.1**                   |
| Feature mode                        | AI hints (bring your own key) → **v1.2** |
| 5 debug + 3 feature challenges (JS) | Progress dashboard / streaks             |
| Written hints                       | Other languages                          |
| Optional timer                      | Accounts, cloud, leaderboards            |
| Results screen + reference solution | Anti-cheating (honor system)             |
| Challenge validation script + CI    |                                          |
| `npx devdrill` works                |                                          |

## 3. Stack

| Part            | Choice                                            |
| --------------- | ------------------------------------------------- |
| Language        | TypeScript                                        |
| Runtime         | Node.js ≥ 22                                      |
| Server          | Express                                           |
| UI              | React + Vite + Tailwind                           |
| Editor          | Monaco (`@monaco-editor/react`)                   |
| Challenge tests | Vitest (bundled with the app)                     |
| Storage         | Local JSON files in `~/.devdrill/`                |
| Repo            | npm workspaces monorepo                           |
| Quality         | ESLint + Prettier, Vitest for the app's own tests |
| License         | MIT                                               |

## 4. Repo structure

```
devdrill/
├── package.json                 # npm workspaces
├── packages/
│   ├── shared/src/types.ts      # API + challenge types
│   ├── server/src/
│   │   ├── index.ts             # start server on 127.0.0.1, open browser
│   │   ├── routes/              # challenges, workspaces, settings
│   │   └── services/
│   │       ├── challengeLoader.ts
│   │       ├── workspaceManager.ts
│   │       ├── testRunner.ts
│   │       └── progressStore.ts
│   └── web/src/
│       ├── pages/               # ChallengeList, Workspace, Results, Settings
│       ├── components/          # FileTree, Editor, TestPanel, TaskPanel, Timer, HintBox
│       └── api/client.ts
├── challenges/
│   ├── debug/NNN-slug/
│   └── feature/NNN-slug/
├── scripts/validate-challenges.ts
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
└── README.md
```

## 5. Challenge format

```
challenges/debug/001-cart-discount/
├── challenge.json
├── README.md          # task text (left panel)
├── starter/           # buggy code + visible tests (copied to user's workspace)
├── hidden-tests/      # added only on Submit; mirrors starter layout, files named *.hidden.test.js
└── solution/          # only the files that change, copied on top of starter/
```

`challenge.json`:

```json
{
  "id": "debug-001-cart-discount",
  "mode": "debug",
  "title": "Cart total ignores discount",
  "difficulty": "easy",
  "estimatedMinutes": 15,
  "tags": ["math"],
  "hints": ["Look at where the coupon is applied."]
}
```

**Challenge rules (enforced by the validation script):**

1. **Zero dependencies.** Plain ESM JavaScript, `"type": "module"`. No `npm install` per challenge.
2. **Tests use Vitest globals** (`describe`, `it`, `expect`) with no `import ... from "vitest"`, because the workspace has no `node_modules`.
3. **Debug:** at least one visible and at least one hidden test **fails** on `starter/`; **all** tests pass on `solution/`.
4. **Feature:** all visible (existing) tests pass on `starter/`; at least one hidden (new-feature) test fails on `starter/`; **all** tests pass on `solution/`.
5. `README.md` and every `challenge.json` field are present and valid.

## 6. Starting challenges

All plain JS modules, no HTTP, small (≤ ~150 lines each).

| #   | Mode    | Title                       | Bug / task                                            | Difficulty |
| --- | ------- | --------------------------- | ----------------------------------------------------- | ---------- |
| 1   | Debug   | Cart total ignores discount | Coupon applied to wrong value                         | Easy       |
| 2   | Debug   | Pagination skips an item    | Off-by-one in slice range                             | Easy       |
| 3   | Debug   | Leaderboard sorts wrong     | `.sort()` without comparator sorts numbers as strings | Easy       |
| 4   | Debug   | Report is always empty      | Missing `await` in an async loop                      | Medium     |
| 5   | Debug   | Settings leak between users | Shared default object mutated (shallow copy)          | Medium     |
| 6   | Feature | Todo search                 | Add case-insensitive search + tag filter              | Easy       |
| 7   | Feature | Per-user rate limit         | Extend a global limiter to per-user limits            | Medium     |
| 8   | Feature | Inventory reservations      | Add reserve/expire without breaking stock counts      | Medium     |

Each one is playtested by Ahmed before merge. Feedback → edit → re-validate.

## 7. Local data

```
~/.devdrill/
├── workspaces/<challengeId>/    # user's working copy (from starter/)
├── progress.json
└── settings.json
```

`progress.json`:

```json
{
  "challenges": {
    "debug-001-cart-discount": {
      "status": "solved",
      "attempts": 3,
      "bestTimeMs": 725000,
      "solvedAt": "2026-10-22T10:00:00Z"
    }
  }
}
```

`status`: `not_started` | `in_progress` | `solved`.

`settings.json`: `{ "timerEnabled": true, "theme": "system" }` (the timer is on by default; it can be turned off in Settings, decided 2026-10-23)

## 8. Server API

All under `/api`. Server binds to `127.0.0.1` only.

| Method    | Path                          | Does                                                                                  |
| --------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| GET       | `/challenges`                 | List summaries + user status                                                          |
| GET       | `/challenges/:id`             | Detail: README, hints, mode, metadata                                                 |
| POST      | `/challenges/:id/start`       | Create workspace if missing, return file tree                                         |
| GET       | `/workspaces/:id`             | File list of the workspace                                                            |
| GET       | `/workspaces/:id/files?path=` | Read a file                                                                           |
| PUT       | `/workspaces/:id/files?path=` | Save `{ content, baseMtimeMs? }` → `{ path, size, mtimeMs }`; 409 if the file changed |
| POST      | `/workspaces/:id/reset`       | Re-copy `starter/`                                                                    |
| POST      | `/workspaces/:id/run`         | Run visible tests → `TestResult`                                                      |
| POST      | `/workspaces/:id/submit`      | Run visible + hidden tests → `SubmitResult`, update progress                          |
| GET       | `/challenges/:id/solution`    | Reference files (shown from Results screen)                                           |
| GET / PUT | `/settings`                   | Read / update settings                                                                |
| GET       | `/session`                    | Token check for the UI; lets a second launch find this server                         |
| DELETE    | `/workspaces/:id/files?path=` | Delete a file                                                                         |
| DELETE    | `/progress`                   | Reset progress **and** every workspace                                                |

**How tests run:**

- **Run:** `vitest run --globals --reporter=json` inside the workspace, using the app's bundled Vitest binary.
- **Submit:** copy the workspace + `hidden-tests/` into a temp folder, run there, delete the temp folder. The user's workspace never contains hidden tests.
- **Timeout:** 30 seconds. On timeout, kill the process and return "Tests timed out (infinite loop?)".

**Port:** try 3000; if busy, fall back to a free port.

**One server per data folder:** `~/.devdrill/server.json` (mode 0600) holds pid, port and token. A second launch opens the running server instead of starting a rival. A restart reuses the token and port, so open tabs keep working.

**Pinned test config:** every run uses `packages/server/assets/vitest.config.mjs` via `--config`, so a `vitest.config.js` in the workspace can't skip hidden tests.

**Security:**

Binding to localhost is not enough: any website the user visits can send requests to `localhost`. Since `/run` executes code, a forged request would be remote code execution. So:

1. Bind to `127.0.0.1` only.
2. **Host check:** reject requests whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` (blocks DNS rebinding).
3. **Origin check:** reject any request with an `Origin` header that is not the app's own origin (blocks CSRF).
4. **JSON only:** every write request must be `Content-Type: application/json` (forces a CORS preflight for cross-site requests).
5. **Session token:** a random token generated at startup, put in the URL the browser opens, and required on every `/api` request.
6. Every `path` is resolved and rejected if it leaves the workspace folder (no `../`, no absolute paths, no symlinks out).
7. Challenge `id` must match a loaded challenge (no arbitrary folders).

## 9. Screens (v1)

1. **Challenge list:** mode tabs (Debug / Feature), difficulty + status filters, search.
2. **Workspace:** task panel (README + hints + optional timer), file tree, Monaco editor (autosave), test panel, Reset / Run / Submit buttons.
3. **Results:** pass/fail per test (hidden tests named only after Submit), time, attempts, buttons: View solution / Retry / Next.
4. **Settings:** timer default, theme, reset progress.

### Visual design (agreed 2026-10-22)

- **Look:** like VS Code. Dark-first with a light mode, flat surfaces, thin borders, resizable panels.
- **Colors:** neutral grays; one blue accent (primary button, selected file); green/red only for test results.
- **Fonts:** Inter for UI, JetBrains Mono for code, file names, timer, and test output.
- **Motion:** tiny animations only (≤ 200 ms): panel/hover transitions, test rows fading in, a short success state when tests turn green. No confetti, no sounds.
- **Illustrations:** a few small SVGs (empty states, results screen, 404) downloaded from a free illustration library (likely unDraw, to confirm), recolored to the accent, and embedded in the web package as files. No runtime dependency.
- **Icons:** one outline icon set (e.g. Lucide).
- **Shortcuts:** `Cmd/Ctrl+S` save, `Cmd/Ctrl+Enter` run tests, `Cmd/Ctrl+Shift+Enter` submit.
- One primary button per screen. The app never highlights the bug.

## 10. Milestones

### M0 — Repo setup (~1 hour)

- [x] `git init`, MIT license, README stub
- [x] npm workspaces: `shared`, `server`, `web`
- [x] TypeScript, ESLint, Prettier configs
- [x] CI: install → lint → typecheck → test

**Done when:** `npm run lint`, `npm run typecheck`, and `npm test` pass locally and in CI.

### M1 — First challenge + validation script (~1–2 hours)

- [x] Challenge #1 (cart discount): starter, hidden tests, solution, README, json
- [x] **Spike:** confirm Vitest `--globals` runs tests in a folder with no `node_modules` (works, 2026-10-22)
- [x] `scripts/validate-challenges.ts` implements rules 1–5
- [x] CI runs validation

**Done when:** `npm run validate` prints ✅ for challenge #1 and ❌ if the solution is broken on purpose.

### M2 — Server core (~3–4 hours)

- [x] `challengeLoader`, `workspaceManager`, `testRunner`, `progressStore`
- [x] All routes from section 8
- [x] Security middleware: Host check, Origin check, JSON-only, session token (section 8)
- [x] Port fallback when 3000 is busy
- [x] Move `vitest` into the server's runtime `dependencies` (the app runs it for users)
- [x] Unit tests: path traversal blocked, test JSON parsed, timeout works, reset restores starter, forged Origin/Host rejected

**Done when:** a full solve works with `curl`: start → edit file → run → submit → progress shows `solved`.

### M3 — UI: list + workspace (~1 day)

- [x] Vite + React + Tailwind setup, `/api` proxy to Express
- [x] Vite proxy needs `changeOrigin: true` (Host check) and the server started with `DEVDRILL_DEV_ORIGIN=http://localhost:5173`
- [x] Token: read from `#token=` on load, keep in `sessionStorage`, send as `x-devdrill-token`; call `GET /api/session` first and show a clear "reopen the link from the terminal" screen on 401
- [x] Autosave sends `baseMtimeMs`; on 409 offer reload
- [x] Web tsconfig: `"jsx": "react-jsx"`, `types: ["vite/client"]`; ESLint React hooks plugin
- [x] `vitest.config.ts` → `test.projects` (web: happy-dom, server: node)
- [x] Challenge list page
- [x] Workspace: task panel, file tree, Monaco with autosave, test panel, Run / Reset

**Done when:** Ahmed can open challenge #1 in the browser, edit code, and see tests turn green.

Deferred from the M3 review (not blocking v1):

- The workspace needs ≥ 720 px; narrower windows scroll sideways (it's a desktop tool).
- List filters reset when you come back from a challenge (could live in the URL).
- Reset keeps the challenge "In progress" in the list, which can look odd.
- Saving on page close uses `keepalive`, which browsers cap at 64 KB per request.

### M4 — Submit, results, timer (~half a day)

- [x] Submit button + results page
- [x] Reference solution viewer
- [x] Optional timer (from settings, toggle in workspace)
- [x] Settings page

**Done when:** the full debug loop works end to end, and progress survives a server restart.

### M5 — Feature mode + all challenges (~1 day + playtesting)

- [x] Feature-mode validation rule (rule 4)
- [x] Challenges #2–#8 written and validated
- [ ] Ahmed playtests each one and we adjust
- [x] Workspace labels for feature mode ("Existing tests must keep passing")

**Done when:** all 8 challenges pass validation and Ahmed has played each one.

### M6 — Release (~2–3 hours)

- [x] Build: web → static files served by Express; single `bin` entry
- [x] Static UI: keep the Host check, never put the token in HTML, send `Content-Security-Policy: frame-ancestors 'none'`, JSON 404 for unknown `/api`
- [x] Ship `assets/vitest.config.mjs` with the bundle and point `CHALLENGE_CONFIG` at it
- [x] Bundle the server with tsup/esbuild (inlines shared types, avoids `rootDir` issues); `tsconfig.build.json` excluding tests
- [x] Tarball smoke test also with `npm i --ignore-scripts` (esbuild postinstall not needed)
- [x] `npx` smoke test from a packed tarball (`npm pack`) in an empty folder
- [x] README: what it is, screenshot, `npx devdrill`, how to contribute, and a note that hidden tests and solutions are readable on purpose (honor system)
- [x] `CONTRIBUTING.md`: how to add a challenge + validation rules
- [ ] Pick the final name, check npm availability, publish

**Done when:** a fresh machine with Node ≥ 22 can run `npx <name>` and solve a challenge.

## 11. Definition of done (v1)

1. `npx <name>` opens the app in the browser.
2. All 8 challenges are playable and pass validation in CI.
3. Debug and feature loops work: edit → run → submit → results → solution.
4. Progress and settings persist across restarts.
5. Path traversal, timeout, and CSRF/DNS-rebinding protections are covered by tests.
6. README + CONTRIBUTING are written.

## 12. Risks

| Risk                                                | Mitigation                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| Vitest won't run in a folder without `node_modules` | **Resolved:** M1 spike passed                                     |
| Challenges too easy / unclear                       | Ahmed playtests every one before merge                            |
| Malicious community challenges                      | Every challenge PR reviewed by a maintainer; zero-dependency rule |
| Scope creep                                         | Anything not in section 2 goes to a GitHub issue labeled `later`  |
| Name taken on npm                                   | Check in M6; keep the name in one config constant                 |

## 13. Open decisions (need Ahmed)

1. ~~**Final project name.**~~ **DevDrill** (`npx devdrill`), chosen 2026-10-22.
2. ~~**GitHub org or personal account.**~~ Personal: [KennyCandra/devdrill](https://github.com/KennyCandra/devdrill), linked from the release `package.json`.
3. **Playtest** the 8 challenges (M5) and adjust README, hints and estimates.
4. **Publish:** `npm run build:release && npm publish ./release` (after 1–3).

## 13b. Added after the v1 build (from Ahmed's playtest, 2026-10-23)

- console.log output shown under each test.
- Every README: a "What it should return" example and a language-neutral "Data" section (validator-enforced).
- Each hidden test names the README rule it checks (`hiddenTestRules`, validator-enforced); a failing hidden test shows that rule; hidden test code unlocks after solving.
- **TypeScript:** every challenge in `js/` and `ts/`; language dropdown on the list, in Settings and inside a challenge; progress, workspaces and results per language; type errors shown in the editor but tests still run.

## 14. Later (not v1)

- Review mode (v1.1) and AI hints (v1.2), as in section 2.
- Smaller download: limit Monaco to JavaScript and JSON (about half the 15 MB UI is unused language support).
