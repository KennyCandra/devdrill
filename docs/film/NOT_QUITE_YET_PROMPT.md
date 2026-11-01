# Prompt pack: Not quite yet

A 24-second film of one real DevDrill session, written for Claude Code running Opus 5.5 at effort high. No character, no 3D room: only the app and a cursor.

Someone fixes a real async bug with the fix most people reach for. The visible tests turn green. They submit, and the app answers "Not quite yet": 6 of 8, because the rows now come back in the wrong order. They go back, fix it properly, and get "Solved".

**What's real:** the bug, all three code states and their test counts come from `challenges/debug/004-async-report`, run with Vitest on 2026-11-01. The labels come from `packages/web/src`.

**Status:** not rendered yet. Timings are targets, not measurements.

## The prompt

Paste this as is, from the root of this repo.

```text
BRAND: the hero is the real DevDrill app, challenge "Daily report is always empty" (challenges/debug/004-async-report, JavaScript). No mascot, no people, no 3D, no device or room. Tone: an honest screen recording of someone practicing, a little better framed.
FORMAT: 1920x1080, 16:9, 60 fps, 24.0 s = 1440 frames, not a loop. Single HTML at docs/film/not-quite-yet.html, DOM and CSS laid out at 1440x810 and scaled up, `window.renderAt(t)` pure function of t, seeded random only, `?t=` freezes a frame. Edit nothing outside docs/film/, and leave the read-the-code files as they are. docs/film/tools/ has render and check scripts; reuse what fits.
SESSION (do this before any picture): copy js/starter to a temp folder, add the hidden tests, and run the app's Vitest on each code state below. Save the real results to docs/film/session.json. Every test name, count and message on screen comes from that file. Expected: BUG 1 passed 2 failed; FIRST FIX 3 of 3 visible, 6 of 8 with hidden; REAL FIX 8 of 8. If a result differs, stop and report it.
- BUG: starter src/report.js, line 7 `storeIds.forEach(async (storeId) => {`, line 14 `});`.
- FIRST FIX: line 7 `await Promise.all(storeIds.map(async (storeId) => {`, line 14 `}));`. It still calls rows.push.
- REAL FIX: `const rows = [];` and the blank line after it are gone, then `const rows = await Promise.all(storeIds.map(async (storeId) => {`, `return {` in place of `rows.push({`, `};` closing it, `}));` closing the map.
SET: reproduce the real screens from packages/web/src (pages/Workspace.tsx, pages/Results.tsx, components/TestPanel.tsx, components/TaskPanel.tsx, index.css). Dark theme, its exact colors, Inter and JetBrains Mono, VS Code syntax colors from editor/monacoSetup.ts, lucide icons. docs/screenshot.jpg shows the workspace. Use the app's real wording, including "Running tests…", "Submitting…", "Back to the code" and "Details unlock when you solve the challenge." Top bar timer starts at 11:40 and ticks in real seconds; the results page's Active time matches it.
LOOK: indistinguishable from the app. No screen-space overlays, captions, callouts, watermarks, device frames or particles. Never highlight the bug: no glow, no line marker, no zoom onto it that the cursor did not earn. The app's own animations only, 200 ms or less.
BEATS
- 0.00-3.00 Workspace, BUG, tests "1 passed 2 failed" with the real errors. Nothing moves but the timer. The cursor drifts down the code and stops at line 7.
- 3.00-6.50 Types the FIRST FIX at human speed, with one typo corrected by backspace, then line 14.
- 6.50-8.00 ⌘↵. "Running…", then "3 passed". All green.
- 8.00-9.60 A short still moment. The cursor moves to Submit without hurry. Click.
- 9.60-10.20 "Submitting…".
- 10.20-14.50 Results page, red X: "Not quite yet", "The visible tests pass, but 2 hidden tests fail. Hidden tests check edge cases the visible ones don't; re-read the task for clues." Tests passed 6 / 8, Attempts 1. Silence. Hold long enough to read. From 12.00 ease down to the first row: "keeps the rows in the same order as the stores given, even when some answer faster", its "hidden" tag, and "From the task: “One row for every store you ask for, in the same order as storeIds, no matter which store answers first.”" This is the film's point; give it room.
- 14.50-15.00 Clicks "Back to the code".
- 15.00-19.50 The cursor rests on rows.push for one beat. Then three quick edits to the REAL FIX, each one a visible human decision.
- 19.50-20.10 ⌘⇧↵. "Submitting…".
- 20.10-22.00 Green check: "Solved", "Every test passes, including the hidden ones.", Tests passed 8 / 8, Attempts 2, and the real "Next:" button.
- 22.00-24.00 Hard cut to a plain terminal: `npx devdrill` typed, caret blinking. Nothing else. This is the only call to action.
MOTION: the cursor is the performance: natural acceleration, slight overshoot, small corrections, real pauses before decisions. Typing has uneven rhythm, faster on familiar words like "await". No perfect straight lines, no constant speed.
CAMERA: no 3D. A 2D crop of the page, from full view to at most 1.35x, eased, at most one slow move per screen. Text stays sharp at every scale, so re-render at scale, never scale pixels.
SOUND (synthesized, OfflineAudioContext), each 1 frame after its event: real-feeling foley only: soft keyboard keys with slight per-key variation, trackpad click, low room tone. No music, no chimes, no success or failure sounds; the app has none. Full silence but the room tone on "Not quite yet". Master -16 LUFS, true peak <= -2 dBTP.
CHECK before you finish, measuring rather than judging by eye: run the real app with DEVDRILL_HOME set to a temp folder (never the real ~/.devdrill), play this exact session in headless Chrome, screenshot each of the five states at 1440x810, and compare them with the matching film frames side by side. Fix every difference in wording, spacing and color. Then check every on-screen test string against session.json, text sharpness at the largest crop, cursor speed, and loudness. Report the numbers and anything the real app did differently from this prompt.
```

## Every beat on its frame

| Time          | Frame       | Picture                               | Sound                |
| ------------- | ----------- | ------------------------------------- | -------------------- |
| 0.00–3.00 s   | f0–f180     | Workspace, 1 passed 2 failed, reading | Room tone            |
| 3.00–6.50 s   | f180–f390   | Types the fix everyone reaches for    | Keys, one backspace  |
| 6.50–8.00 s   | f390–f480   | Run: 3 passed                         | Two keys             |
| 9.60 s        | f576        | Clicks Submit                         | Trackpad click       |
| 10.20 s       | f612        | "Not quite yet", 6 / 8                | Room tone only       |
| 12.00–14.50 s | f720–f870   | Eases to the hidden test and its rule | Room tone only       |
| 15.00–19.50 s | f900–f1170  | Three edits to the real fix           | Keys                 |
| 20.10 s       | f1206       | "Solved", 8 / 8                       | None                 |
| 22.00–24.00 s | f1320–f1440 | Terminal: `npx devdrill`              | Keys, then room tone |

## Render it smooth

1. Open the file with `?t=` so it draws only the time you ask for.
2. Capture every frame at 2x (3840 x 2160) in headless Chrome, re-laying out the DOM at each crop so text stays sharp.
3. Encode H.264 High, yuv420p, bt709 tags, CRF 14, preset slow, `+faststart`, then mux the audio as AAC 192k.
