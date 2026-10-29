# DevDrill — Version 1.2 Plan: the AI module

> Status: built (A0–A5) on 2026-10-29, each milestone checked by a fresh reviewer. Tried against a local Ollama model (qwen3.5:4b); Claude, OpenAI, OpenCode and Custom are covered by tests with fakes, not yet by a real key.

## 1. Goal

Add AI where static checks can't judge: whether a review comment really caught an issue, and how good a working solution is. AI is **optional** (no provider set: the app works as today) and **never decides pass/fail** (tests and the review verdict still do). It gives feedback.

## 2. Decisions

- **Our own thin layer**, not LangChain: the features are single calls (judge, feedback, hint), so one small interface over each provider's official SDK or HTTP API is simpler to read and change.
- **Providers:** Claude (Anthropic SDK), OpenAI (OpenAI SDK), Ollama (local, no key), OpenCode (its local server), Custom (any OpenAI-compatible URL: DeepSeek, OpenRouter, LM Studio…).
- **All AI code in one folder**, `packages/server/src/ai/`. Adding a provider = one file in `providers/` + one line in `registry.ts`.
- **Keys stay on the machine:** saved in `~/.devdrill/ai.json` (mode 0600), used by the server only, never sent back to the browser (the UI only learns whether a key is set). The browser never talks to a provider.
- **Answers are JSON, validated.** A reply that doesn't validate is "the AI couldn't answer, try again", never a broken page.
- **A fake provider** for tests: CI never calls a real model.

## 3. Folder

```
packages/server/src/ai/
├── provider.ts      the AiProvider interface + shared types
├── registry.ts      provider id -> factory, with labels and defaults for Settings
├── config.ts        ai.json: provider, model, key, base URL (key never leaves the server)
├── service.ts       picks the configured provider, runs a feature, validates JSON
├── providers/       claude.ts, openai.ts, ollama.ts, opencode.ts, custom.ts, fake.ts
├── features/        judgeReview.ts, solutionFeedback.ts, hint.ts
└── prompts/         the prompt text, one file per feature
```

## 4. Milestones

Each: build → a fresh reviewer agent checks it → fix → commit. Commit after every step. Never push.

- **A0 — Core** (~3 h): interface, registry, config store, service with JSON validation, fake provider; `GET/PUT /ai/settings` (key redacted), `POST /ai/test`.
- **A1 — Providers** (~4 h): Claude, OpenAI, Custom, Ollama, OpenCode; each with "test connection".
- **A2 — Settings UI** (~3 h): an AI section: provider, model, key or URL, Test connection.
- **A3 — Judge reviews** (~half a day): after submitting a review, "Ask AI" judges each issue (caught / partly / missed, with a reason) and pre-ticks; the player can still change every tick.
- **A4 — Solution feedback** (~half a day): after solving a debug/feature challenge, AI reviews the diff from the starter: correctness risks, readability, a simpler way.
- **A5 — Hints, docs, release** (~3 h): an AI hint that nudges without giving the answer; README/CONTRIBUTING/plan; release smoke test with the fake provider.

**Done when:** with any one provider configured, a player gets an AI judgement of their review and AI feedback on a solved challenge; with none configured, nothing changes.

## 5. Notes from building

- **OpenCode runs tools.** Our requests switch off every tool OpenCode ships with. Tools from MCP servers a player added to OpenCode aren't covered by that list; players using OpenCode with MCP servers should know the model could call them.
- **Changing a provider's URL drops its saved key**, so a key can't be redirected to another server (in hosted mode anyone with the link can edit Settings).
