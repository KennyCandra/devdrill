# DevDrill: UI redesign brief

Redesign the interface of DevDrill, a working app. The logic stays as it is; we will rebuild the visual layer by hand from your design, one page at a time.

Source code: https://github.com/KennyCandra/devdrill (UI in `packages/web/src`). Screenshots of every screen are in `screens/`, listed in section 4.

## 1. The product

**DevDrill** is an open-source app for practising interview skills that still matter now AI writes much of the code: working with code you didn't write. The tagline is "In the era of AI, practice the skills you actually need."

- **Who uses it:** software developers preparing for interviews or sharpening their skills, alone, in focused sessions of 10 to 30 minutes.
- **How it runs:** on the player's own machine. `npx devdrill` starts a local server and opens the browser.
- **No accounts:** no sign-in, profiles, cloud or social features. Please don't design any of these.
- **Voice:** plain and direct, like a good senior teammate. No hype, mascots, confetti or sounds.

There are three kinds of challenge, 12 in total today, and more are coming (next: Express backend problems). Each one comes in JavaScript and TypeScript.

| Mode    | The player...                                                              | How it's judged                                                                                                                    |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Debug   | finds and fixes a bug in unfamiliar code                                   | Visible tests while working; **Submit** also runs hidden tests that check edge cases                                               |
| Feature | adds a feature without breaking anything                                   | Same as Debug                                                                                                                      |
| Review  | reads a pull request, comments on lines, then approves or requests changes | Only the verdict is auto-checked. The player then compares with an answer key and **ticks what they caught**, which sets the score |

**AI is optional** (the player connects a provider in Settings). It can give a hint, give feedback on a solved challenge, and judge review comments. It never decides pass or fail. Every AI element must have a clean "AI is off" version.

## 2. What is fixed, and what is open

**Fixed**

- **Stack:** React 19, Tailwind CSS 4, CSS variables for colour, Lucide icons.
- **Editors:** Monaco (the VS Code editor) stays for code and diffs. Its theme colours can change, and comments inside the diff are our own HTML that we can restyle.
- **Light and dark:** both, plus "match system".
- **Resizable panels** in both workspaces, with sizes remembered.
- **Accessibility:** keyboard use, visible focus, status not shown by colour alone, reduced-motion support.
- **Motion:** small and fast, 200 ms or less.
- **The app never hints at where the bug is.** Nothing in the design may highlight the problem area of the code before the player finds it.
- **Peeking takes a choice:** solutions and answers are never on screen by default.

**Open: please rethink these**

- Colours, type, spacing, hierarchy, component style and page layouts.
- The navigation and the home page.
- How results and scores are presented.
- Wording, as long as the meaning stays.
- **The VS Code look is the current style, not a requirement.** It should still feel like a serious tool for developers, and it has to sit comfortably around a code editor.

## 3. Main user flows

1. **Debug or Feature:** Home → pick a challenge → read the task → edit code → run tests (repeat) → Submit → Results. If solved: compare with the reference solution, see the hidden tests, get AI feedback, go to the next challenge. If not: back to the code.
2. **Review:** Home → pick a pull request → read its description and diff → comment on lines → pick a verdict → Submit → compare with the answer key → tick what was caught → optionally ask the AI to judge → next challenge.
3. **Set up AI:** Settings → pick provider → enter model, URL or key → Test connection.

## 4. Screens

Screenshots use 1440 px width. **AI text in them is sample text**, and the AI-on screens used a stand-in provider.

### Home / challenge list

`01-list-new-player-dark`, `02-list-returning-player-dark`, `03-list-no-matches`, `18-list-light`

- **Header:** tagline, one-line description, language dropdown (JavaScript / TypeScript; more languages later).
- **Progress card:** "2 of 12 solved", percent, progress bar, and one main button: "Continue: ..." or "Start: ...". When all are solved: "Every challenge solved. Nice work."
- **Filters:** mode tabs (All, Debug, Feature, Review), difficulty, status, search by title or tag.
- **List rows:** status icon (not started, in progress, solved), title, mode, difficulty badge, estimated minutes.
- **"How it works":** three steps. They currently describe only Debug and Feature.
- **States:** loading, load error, no matches with "Clear filters".

The list must keep working with 50 or more challenges.

### Debug / Feature workspace

`04-workspace-start`, `05-workspace-tests-failing-hints`, `05b-workspace-ai-hint`, `06-workspace-reset-dialog`, `19-workspace-light`

- **Top bar:** logo, back to Challenges, title, difficulty, mode, language dropdown, Results link (after a first submit), save state, timer (click to hide), Settings.
- **Task panel:** a note on what "done" means in this mode, then the task as Markdown, with headings, lists, code blocks and tables. It must read well when narrow (min 180 px).
- **Hints, pinned under the task:** revealed one at a time ("Need a hint?", then "Next hint (2 of 3)"), plus "Ask AI for a hint" when AI is on.
- **File tree:** folders, file icons, active file, unsaved dot.
- **Editor:** file tabs with close button and unsaved dot, then Monaco. If a file changed on disk, a banner offers "Keep mine" and "Load their version".
- **Test panel:** see below.
- **Bottom bar:** Reset, Run tests (with shortcut), Submit (primary). Both show a busy state.

**Test panel states:** nothing run yet, running, passed and failed counts with duration, timed out, couldn't run, a file that couldn't load, console output (per test and outside tests, stderr tinted). Test rows have a pass, fail or skipped icon, a name, and for failures a monospace error. Hidden tests carry a "hidden" tag; while unsolved they show a "From the task" quote instead of details, plus "Details unlock when you solve the challenge." Failures sort first.

### Results (Debug / Feature)

`07-results-not-solved`, `08-results-solved`, `08b-results-ai-feedback`, `09-results-solution-diff`

- **Outcome:** "Solved", or "Not quite yet" with a specific reason, such as "2 visible tests still fail."
- **Stats:** tests passed, active time, attempts, best time.
- **Actions:** Next challenge (primary when solved) or Back to the code (primary when not), Compare with / Show the solution, See the hidden tests (only after solving).
- **Solution view:** read-only Monaco diff, with a switch between "Your code" and "Starter" against the reference solution, and file tabs when several files changed. Before solving, a confirmation appears first.
- **Hidden tests view:** read-only Monaco with file tabs.
- **AI feedback (solved only):** a summary, then up to 6 points tagged Good, Risk, Readability or Simpler, each with an optional `file:line`.
- **Full test list** at the bottom.
- **State not shown:** "No results yet", when nothing has been submitted.

### Review workspace

`10-review-start`, `11-review-comments-verdict`, `12-review-writing-comment`, `20-review-light`

- **Top bar:** as in the Debug workspace, with a simpler save state.
- **Left:** task panel holding the pull request description, plus written hints.
- **Centre:** changed-file tabs (new-file icon, comment count), then the Monaco diff. Hovering a line in the new code shows a **+** in the gutter. Selected lines can also be commented on. Comments appear inline in the diff under their lines, and commented lines are tinted.
- **Right, "Your review":** counter (3/7), a how-to card when idle, a "Comment on lines 12–13" button when lines are selected, or the comment form. Below that, the list of comments (click to jump, Edit, Delete). The **Verdict** (Approve / Request changes) is pinned at the bottom.
- **Comment form:** file and lines, "Whole function" button (widens the comment to the function around it), text area with a character count, Cancel, Add/Save comment.
- **Bottom bar:** Reset, status or error message, Submit review (primary).

**Limits:** 7 comments, 40 lines per comment, 1000 characters per comment. A clean pull request needs no comments, only an approval.

### Review results

`13-review-results`, `14-review-results-ai-judged`, `21-review-results-light`

- **Outcome:** "Passed: the right call" or "Not passed: the wrong call", with why.
- **Stats:** your score (updates live as boxes are ticked), best score, attempts, best time.
- **AI strip:** "Ask AI to judge", a busy state (it can take a minute), "Judge again", or a pointer to Settings when AI is off.
- **Answer key:** up to 5 issue cards. Each has severity (Must fix, Should fix, Nit), its share of the score, title, file, lines, type, an explanation, the player's comments on those lines (or "None."), the AI verdict and reason (caught, partly, missed), and an **"I caught this"** checkbox.
- **Your other comments:** comments near no issue, which may still be good points.
- **Clean pull request:** no cards, "Nothing to find", and a score of 100.

This page is the heart of Review mode and currently the weakest: see section 7.

### Settings

`17-settings-dark`, `22-settings-light`

- **Appearance:** Match system, Dark, Light.
- **Language:** dropdown, with a note that code and progress are kept separately per language.
- **Practice:** "Show a timer" checkbox.
- **AI:**
  - Provider dropdown: Off, Claude, OpenAI, Ollama, OpenCode, Custom.
  - Fields vary by provider: model, server URL, API key. Saved keys are never shown, only a note that one is saved, with a Remove link. Changing the URL shows a warning that the saved key will be removed.
  - Save, Test connection, and a success or error message with timing.
- **Progress:** "Reset all progress" (danger, with confirmation).

### System screens and dialogs

`15-no-token`, `16-not-found`, `06-workspace-reset-dialog`

- **Full-page messages:** connecting; "Open the link from your terminal" (no valid token); server unreachable with Try again; page not found; challenge couldn't open.
- **Confirmation dialogs:** reset files, start the review over, see the solution before solving, reset all progress.

## 5. Shared components

Button (primary, secondary, ghost, danger; busy and disabled), difficulty badge, severity and AI-verdict tags, dropdown, segmented tabs, search field, text input, text area, checkbox, stat tile, progress bar, keyboard hint, spinner, hint card, quoted comment card, confirmation dialog, full-page status message, top bar, bottom action bar, panel header, resize handle, Markdown styles for the task panel, comment card inside the diff.

## 6. Current visual system

Replace freely. Listed so you can see what exists.

- **Fonts:** Inter for UI (13 px base, which is small), JetBrains Mono for code, file names, timer and test output.
- **Icons:** Lucide outline.
- **Rule:** one primary button per screen.

| Token                | Dark                  | Light                 |
| -------------------- | --------------------- | --------------------- |
| Background           | `#1e1e1e`             | `#ffffff`             |
| Side panel           | `#252526`             | `#f8f8f8`             |
| Bars                 | `#181818`             | `#f3f3f3`             |
| Hover                | `#2a2d2e`             | `#e8e8e8`             |
| Active               | `#37373d`             | `#e4e6f1`             |
| Border               | `#2b2b2b`             | `#e5e5e5`             |
| Strong border        | `#3c3c3c`             | `#d4d4d4`             |
| Text                 | `#cccccc`             | `#1f1f1f`             |
| Muted text           | `#8b8b8b`             | `#616161`             |
| Accent               | `#3794ff`             | `#005fb8`             |
| Primary button       | `#0e639c`             | `#005fb8`             |
| Success / background | `#73c991` / `#1e3a2a` | `#2e7d32` / `#e6f4ea` |
| Danger / background  | `#f48771` / `#4b1818` | `#c72e0f` / `#fdecea` |
| Warning / background | `#e2c08d` / `#3b3018` | `#7a4d00` / `#fdf1d6` |

**Keyboard shortcuts:** ⌘/Ctrl+S saves, ⌘/Ctrl+Enter runs tests (in a review: starts or adds a comment), ⌘/Ctrl+Shift+Enter submits.

## 7. Known weak spots

- **Generic look:** it reads as a VS Code clone with no identity of its own.
- **Logo:** a bug icon, but the product isn't only about bugs. Debug is one mode of three, and the old name "BugHunt" was dropped for this reason. A new mark would help.
- **Review results:** the score sits at the top while the ticking happens far below, the page is long, and each card repeats the same structure with little hierarchy. The player should easily see "what I caught, what I missed".
- **Review workspace:** three columns are crowded. Inline comments get cut off, and the verdict is easy to overlook.
- **Results:** four stats wrap into an orphan tile on a second row, and the action row can hold four similar buttons.
- **Home:** the list is plain, with no sense of modes or a path through the challenges. Best review scores aren't shown. "How it works" ignores Review mode.
- **Small text:** 11 to 13 px is used nearly everywhere, and muted grey is heavily used.
- **Empty states:** illustrations were planned but never added, so they are text only.
- **Wording bug:** the Review note says "Comments that point at nothing real count against you." That is no longer true. Comments no longer affect the score, and only the verdict and the ticks count.
- **TypeScript file icons:** only JavaScript files get the code and test icons in the file tree.

## 8. Please deliver

1. **Tokens:** colour (light and dark), type scale, spacing, radius, elevation, as CSS variables.
2. **Components:** everything in section 5, with hover, focus, disabled and busy states.
3. **Screens:**
   - Home
   - Debug workspace, including the test panel states
   - Results, solved and not solved
   - Review workspace
   - Review results, with and without AI
   - Settings
   - One system screen and one dialog
4. **Both themes** for each screen, and a Monaco colour theme to match.
5. **Short notes** on the main layout decisions and anything you changed about a flow, so we can check it fits the app.

Target 1280 to 1920 px wide. The workspaces need at least 720 px. Home, Results and Settings should also work on small screens, while editing code on a phone is not a goal.

Use real content from the screenshots, including long task text, long file paths and error output, so the design holds up with real data.
