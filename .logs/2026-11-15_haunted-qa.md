# Haunted House art integration QA — 2026-11-15

Branch: `codex/stage4-art-integration`, based on approved art commit `5011588`.
This log covers the art integration and the Stage 4 browser checks run on Windows Chrome.

## Integrated

- Haunted House menu and stage card use `assets/2026-11-15_haunted-menu.webp`.
- Background, tiles, switch blocks, vertical platform/rail, pumpkins, ghost fire and decor load through `Image` and fall back to the existing procedural renderer while pending or on error.
- The approved 4×4 motion frame sheets load only for Stage 4. Eight run frames, three jump phases, land, and three death phases use the existing 54×48 logical frame and `ax = 32`. Idle, blink, star recolor, and failed image loads use the original nine-pose art. Stages 1–3 remain on their original renderer.
- The 12 game-loaded image files total **937,350 bytes**, under the 1,000,000-byte art budget. Source, concept, and preview files are not loaded by the game.

## Automated checks

| Check | Result |
|---|---|
| `node tools/2026-10-15_check-character-art.cjs` | PASS: original 27 poses, star masks, fallback, v2 manifest geometry and sheet paths |
| `node tools/2026-10-22_qa-haunted.cjs logic` | PASS: switch states, fixed 40 coins, pumpkin combat, checkpoint return, stages 1–3 smoke |
| `node tools/2026-10-22_qa-haunted.cjs visual` | PASS: new art loaded, 8 distinct Bobo run frames, renderer selects v2 and original fallback, block opacity and grayscale motifs, pumpkin/fire/track, all image requests blocked with keyboard play continuing; stages 1–3 pixel identical to baseline `3a7c233` |
| `node tools/2026-10-22_qa-haunted.cjs dark` | PASS: player light, distant darkness, spike/block contrast, fire pumpkin light, offscreen canvas reuse |
| `node tools/2026-10-22_qa-haunted.cjs motion` | PASS: jump/land/lean/death motion, cobweb sway, pumpkin breathing, candle flicker; Grassland baseline pixel identical |
| `node tools/2026-10-22_qa-haunted.cjs timed` | PASS: real keyboard input, 120 seconds elapsed, result screen reached (2 coins collected in this run) |
| `node tools/check-rps.js`, `node tools/check-rain.js`, `node tools/check-memory.js` | PASS |
| `node tools/check-haunted.js` | PASS: 32 parsing, switch, pumpkin and fixed-coin reachability checks |
| `git diff --check`, JS syntax checks | PASS |

The visual phase saved four states (start, switched, fire pumpkin, pause) for each of **360×640, 390×844, 640×360, 844×390, 1366×768** in `.logs/2026-11-15_haunted-screens/`. The viewport capture harness starts the game at the target size and asserts that the canvas is painted before saving screenshots.

Performance phase, Chrome with 4× CPU slowdown, six rounds per viewport: at 1366×768, pooled RAF p95 was **4.10 ms Haunted / 10.40 ms Castle** (ratio 0.394); at 390×844, **7.50 ms / 6.70 ms** (ratio 1.119). Both meet the plan's ≤1.2× Castle gate. Measurements are browser/host specific.

## Remaining coverage

- Full normal-mode playthrough collecting all 40 coins with each of Bobo, Mew, and Aclaire has not been completed. The existing liveplay planner handles stages 1–3 and does not plan switch toggles for Stage 4; fixture-based logic and browser QA above do not replace this end-to-end check.
- The exhaustive `check-level.js haunted` run was stopped after its first Bobo scenario reached all 44/44 targets; completing every character/checkpoint/colour scenario is still pending. The focused `check-haunted.js` suite passed all 32 checks.
- iOS/Android devices, physical gamepad, and background/resume behavior were not tested.
- The 20 viewport screenshots are browser captures. They should be reviewed for final art alignment and readability on target devices before release.
