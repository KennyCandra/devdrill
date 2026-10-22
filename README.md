# BugHunt

> **In the era of AI, practice the skills you actually need.**
>
> _"BugHunt" is a working name; the final one is still being picked._

AI writes a lot of code now. What's left for you, and what interviews increasingly test, is **working with code you didn't write**: finding why it's broken, and changing it without breaking what already works.

BugHunt gives you small, realistic JavaScript projects to practice exactly that, in a VS Code-style editor in your browser. Everything runs on your own machine.

```bash
npx bughunt
```

Requires [Node.js](https://nodejs.org) 22.12 or newer.

## How it works

There are two kinds of challenges:

- **Debug**: something is broken. Read the code, find the cause, fix it.
- **Feature**: add a feature to working code. The existing tests pass at the start and must keep passing.

Each challenge has a short task description, a few files, and tests.

1. **Run tests** (`⌘/Ctrl + Enter`) runs the visible tests, as often as you like.
2. **Submit** (`⌘/Ctrl + Shift + Enter`) also runs **hidden tests** that check the edge cases. Fixing only the symptom the visible tests show usually isn't enough.
3. **Results** tell you what passed and failed. Hidden tests show only their names until you solve the challenge. After solving, you can compare your code with the reference solution.

Hints come one at a time, from "where to look" to "almost the answer". There's an optional timer.

**Honor system:** the hidden tests and solutions ship with the app, and you can read them if you go looking. It's practice; the only person you'd be fooling is yourself.

## Challenges

| Mode    | Challenge                       | Difficulty |
| ------- | ------------------------------- | ---------- |
| Debug   | Cart total ignores discount     | Easy       |
| Debug   | Pagination skips an item        | Easy       |
| Debug   | Leaderboard sorts wrong         | Easy       |
| Debug   | Daily report is always empty    | Medium     |
| Debug   | Settings leak between users     | Medium     |
| Feature | Add search to the todo list     | Easy       |
| Feature | Rate limit each user separately | Medium     |
| Feature | Hold stock during checkout      | Medium     |

New challenges are very welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Options

```
npx bughunt --port 4000   # use a specific port (default 3000, or a free one)
npx bughunt --no-open     # don't open a browser; just print the link
npx bughunt --help
```

## Your data and safety

- Your code, progress and settings live in `~/.bughunt`. Settings → "Reset all progress" starts over.
- The server listens on `127.0.0.1` only. Because your code runs on your machine, the API is locked down so other websites can't reach it: it checks the Host and Origin headers, requires JSON, and needs a secret token. That's why the app opens with a link ending in `#token=…`.
- Your tests run with the app's own Vitest; challenges have no dependencies and nothing is installed per challenge.

## Development

```bash
npm install
npm run dev        # API server + Vite with hot reload; open the "Dev UI" link it prints
npm run check      # lint, format check, typecheck, tests, and challenge validation
npm run validate   # only validate challenges
npm run build:release && npm pack ./release   # build and pack the publishable package
```

The repo is an npm workspace:

- `packages/server`: the Express API, test runner and workspace manager
- `packages/web`: the React + Vite UI (Monaco editor, Tailwind)
- `packages/shared`: TypeScript types shared by both
- `challenges/`: the challenges
- `scripts/`: challenge validation, dev runner, release build
- `docs/V1_PLAN.md`: the plan and the decisions behind it

## License

[MIT](LICENSE)
