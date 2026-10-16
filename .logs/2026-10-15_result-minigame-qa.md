# Result and minigame completion QA — 2026-10-15

Continuation of the approved remaining QA after the responsive/environment pass. Uses the existing Playwright/Chrome fallback. No production changes planned.

## Inventory and fixture boundary

Main-game result matrix: Grassland/Forest/Castle × normal/timed × all five standard viewports, with Aclaire selected to include a long character label. For normal mode, precollect all but the final coin and place that coin at the player; for timed mode, advance time to the limit. These are UI fixtures, NOT evidence of real traversal, boss defeat, score, or time. In particular the Castle normal result text is staged. Custom seed avoids writing main-game records.

Check result heading and key element bounds, capture screenshots, use actual replay button and verify fresh time/coin count, produce a second staged result and use the result-home button.

Minigames: Memory each character, remembering the legitimate visible preview then clicking real pairs; RPS Aclaire through actual legal choices to a rules-decided outcome; Rain Aclaire natural idle-loss path. No RNG override or state writes in this completion script. Minigame records can be written to the isolated browser context, which is discarded after the run; they do not affect the user's browser profile. Check result and replay/exit flows. Viewport 844×390.

## Main result results

All 30 cases passed, exit 0; no uncaught browser errors. Result heading, subtitle, score/time and both buttons remain within the viewport. Replay resets coin count and timer; result-home returns to title. Visually reviewed portrait and landscape result screenshots, including the longest Castle/Aclaire normal text and desktop result. No clipping observed in reviewed samples.

Evidence: `.logs/2026-10-15_results-qa/` contains all 30 screenshots and per-viewport JSON. `.logs/2026-10-13_results-browser.json` contains the full run including browser errors. Staged normal result shows 00:00.0; that is a fixture value, not a valid gameplay record. No production fix needed.

## Minigame completion and visual defect

The initial 844×390 run completed all three Memory characters using actual preview/click inputs, then Aclaire RPS won in 17 rounds (55 choices, 84.6 seconds), and Aclaire Coin Rain naturally lost after 53 seconds (20 caught items, 24 points). Replay and exit worked. No uncaught page errors. These are real rule-driven outcomes, with no state writes. Initial functional results are preserved as `2026-10-15_minigames-complete/initial-functional-results.json`.

Screenshot inspection found a real Memory layout defect despite functional success: the result content was taller than the overlay and vertically centered, clipping the heading above its top edge and the last button below its bottom edge. Added a browser assertion for heading/button rectangles relative to the overlay. RED reproduced at 844×390: heading top -0.39 versus overlay top 13; final button bottom 390.41 versus overlay bottom 377.

Fix in css/style.css: align overflowing content from the top with automatic block margins to retain centering when space allows, and use compact result typography/spacing at height <=420px. Touch buttons retain their existing target size. No game rules, timing or storage logic changed. The three-character 844×390 rerun passed the new assertion; the screenshot shows the heading and all buttons inside the panel.

Final verification: Memory real wins/replay/exit plus heading/button bounds passed all three characters × five viewports = 15 cases, exit 0, no uncaught page errors. Reviewed updated 360×640, 640×360 and 844×390 results; headline and all three buttons fit. New/modified QA scripts passed syntax checks and `git diff --check` passed. RPS/Rain completion was not repeated after the Memory-only CSS fix because its selectors are scoped to `.mem-result`. Main result matrix likewise uses a separate screen. No commit/push in this continuation.

Evidence: `.logs/2026-10-15_minigames-complete/`, including `844x390-memory-before-fix.png`, updated character result screenshots, RPS/Rain result screenshots and per-viewport JSON. Broader unassisted main-level completion and physical devices remain distinct open items.
