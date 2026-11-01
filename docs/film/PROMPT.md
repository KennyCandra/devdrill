# Prompt pack: Read the code

A 14-second character loop for DevDrill, written for Claude Code running Opus 5.5 at effort high.

A 2 cm rubber duck stands on a laptop keyboard, re-running failing tests by stomping on the return key. It stomps faster and faster, then gives up, goes quiet, and finally reads the code. Four stomps on delete remove the stray ` - 1`, the tests turn green, and morning comes. Smug look at the lens, submit, next challenge, night again.

The bug and the test output are real: `challenges/debug/002-pagination`, run with Vitest on 2026-11-01 (2 failed, 3 passed; 5 passed after the fix).

**Status:** not rendered yet. Every number below is a target, not a measurement.

## The prompt

Paste this as is, from the root of this repo.

```text
BRAND: hero a soft vinyl rubber duck toy, 2 cm tall, warm yellow, orange beak, glossy black cartoon eyes with lids, tiny scarf in DevDrill blue (#3794ff). Build it in code from three.js geometry, no external assets. It stands on a laptop keyboard and presses keys by stomping on them.
FORMAT: 1920x1080, 16:9, 60 fps, 14.0 s = 840 frames, seamless loop (renderAt(14) == renderAt(0) in pose and velocity). Single HTML at docs/film/read-the-code.html, three.js 0.160 via importmap, `window.renderAt(t)` pure function of t, seeded random only, `?t=` freezes a frame. Edit nothing outside docs/film/.
SET: generic open laptop on a desk, no logos. Keyboard with a `return` key and a `delete` key two rows above it. Handwritten sticky note on the bezel: "npx devdrill". That note is the only call to action. Film logic: return presses the blue button on screen, delete deletes at the caret.
SCREEN (crisp canvas texture 2048+ px): a simplified DevDrill workspace at about 200% zoom so it reads on camera. Dark theme; take colors from packages/web/src/index.css, Inter for UI, JetBrains Mono for code. See docs/screenshot.jpg for the look. Top bar: "DevDrill / Pagination skips an item". Tab: paginate.js. Code, from challenges/debug/002-pagination/js/starter/src/paginate.js, lines 7-11, with line 9 reading `const end = start + pageSize - 1;` and a thin caret just before its semicolon. Below it the tests panel. FAIL state: "3 passed 2 failed", rows "paginate > puts 10 products on a full page" with "expected [ 'product-1', 'product-2', …(7) ] to have a length of 10 but got 9", and "showingLabel > describes the first page" with "expected 'Showing 1–9 of 25' to be 'Showing 1–10 of 25'". PASS state: "5 passed", all rows green. Bottom bar: "Run tests", blue "Submit". Never highlight line 9: the app never points at the bug, only the duck's gaze does.
TWO WORLDS: NIGHT: navy room, dark window, the screen is the key light, faint red spill on the keys. MORNING: warm sun through the window, pale wall, soft green spill. Render both whole rooms and mix them in linear light before one tone map.
LOOK: quality of a studio miniature, shallow depth of field on the props behind (mug, plant, cable, stack of books), but the screen stays readable. No screen-space overlays, no watermarks, no decorative particles.
BEATS
- 0.00-0.30 Frame 0 = cover: NIGHT, FAIL, duck crouched on return, determined. Stomp at 0.30: "Running…", then the same FAIL.
- 0.30-2.60 Stomps at 1.30 and 2.10. Same result. Tilts its head at the screen, then at the key.
- 2.60-6.80 It stomps faster and faster, intervals 0.60 -> 0.18 s, a tantrum becoming a dance. Under 0.34 s the panel stays on "Running…", so red never flashes more than 3 times a second.
- 7.00-7.60 Belly-flop on return. FAIL. Silence.
- 7.60-9.60 It stops. Slow push-in over its shoulder. Eyes scan the code line by line, stop on line 9, blink, widen.
- 10.00-11.20 Hops to delete. Four stomps at 10.30, 10.50, 10.70, 10.90 each remove one character of " - 1". Line 9 now reads `const end = start + pageSize;`. Hops back.
- 11.50-12.70 Stomp on return. PASS at 11.75, the room eases into MORNING. Relieved shuffle.
- 12.70-13.20 The only lens look: smug.
- 13.20-14.00 Stomp: "Solved" with a blue "Next challenge" button. Stomp at 13.60: the room eases back to NIGHT, the screen fades in 200 ms to frame 0, duck back in its crouch.
MOTION: anticipation, action, overshoot, settle on every stomp; each key travels down and back; eyes lead body 6-8 frames; breathing and blinks always; scarf and wings swing. Solve contacts at load: feet just touch the keycap, never through it. No intersections.
CAMERA: 50 mm equiv, slightly low 3/4 from the keyboard's right so the duck, both keys and the screen read; tiny eased push-in during the stomps, the slow push-in on the reading, ends matching frame 0. At most 0.5 degrees per frame.
SAFETY: largest frame-to-frame brightness jump 25 luma levels, no pure white or black frame.
SOUND (synthesized, OfflineAudioContext), each 1 frame after its event: soft keycap thock on return, higher tick on delete (rising across the four), stomps accelerate into the beat of a short loop, silence 7.0-7.6, tiny eye ticks while reading, soft low tone on FAIL, relief chime on PASS, smug "ting". Master -14 LUFS, true peak <= -2 dBTP.
CHECK before you finish, measuring rather than judging by eye: collisions on all 840 frames, brightness steps, camera speed, the seam between frames 839 and 0, red flashes per second, loudness. Report the numbers.
```

## Every beat on its frame

| Time          | Frame     | Picture                             | Sound                   |
| ------------- | --------- | ----------------------------------- | ----------------------- |
| 0.00 s        | f0        | Cover: night, red tests, crouched   | Low room tone           |
| 0.30 s        | f18       | First stomp, same failure           | Thock, low tone         |
| 2.60–6.80 s   | f156–f408 | Stomps speed up, tantrum into dance | Thocks lock into a beat |
| 7.00 s        | f420      | Belly-flop, still failing           | Big thock, then silence |
| 7.60–9.60 s   | f456–f576 | Reads the code, eyes stop on line 9 | Tiny eye ticks          |
| 10.30–10.90 s | f618–f654 | Four stomps on delete remove ` - 1` | Four rising ticks       |
| 11.75 s       | f705      | 5 passed, morning arrives           | Relief chime            |
| 12.70 s       | f762      | The only lens look: smug            | Smug "ting"             |
| 13.60 s       | f816      | Next challenge, night returns       | Thock into the loop     |
| 14.00 s       | f840 = f0 | Crouched on return: the loop closes | Loop                    |

## Make your own

Only the BRAND line and the bug change. To use Clawd instead, you need the mascot kit in this repo, then swap BRAND for:

```text
BRAND: hero Soft Clawd from the kit v2 (`mascot/clawd.js` + `mascot/clawd.glb`, emotions in `mascot/emotions/`). 2 cm toy standing on a laptop keyboard, pressing keys by stomping on them.
```

## Render it smooth

1. Open the file with `?t=` so it draws only the time you ask for.
2. Capture every frame at 2x (3840 x 2160) in headless Chrome, averaging 8 sub-frames in linear light over 0.45 of a frame.
3. Check brightness per frame on the encoded film: no step above 25 luma levels.
4. Encode H.264 High, yuv420p, bt709 tags, CRF 14, preset slow, `+faststart`, then mux the audio as AAC 192k.
