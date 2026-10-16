# Remaining live-play coverage — 2026-10-16

Continue the six remaining normal stage/character pairs and six remaining timed pairs at 844×390 using real browser keyboard events. Normal acceptance requires all coins and the real result state; timed acceptance requires all coins or natural expiry of the 120-second timer, followed by the real result state. Both require replay reset, pause/home, screenshots and no uncaught browser errors. A four-minute wall-time timeout is incomplete coverage, never a pass.

Runner: `node tools/2026-10-13_browser-qa.cjs remaining-liveplay 844x390`.

The first Grassland/Bobo attempt was stopped while repeatedly failing the moving-platform section. Trace/screenshots are retained in `2026-10-16_remaining-liveplay/`; it did not produce a passing result. Updated only the QA controller: forecast moving-platform positions from copied objects for each simulated tick, keep the rider associated with the predicted platform, and retain candidates for all six first-input choices so waiting is not immediately discarded. Enemy movement remains an approximation. No live position/coin/HP/time/power edits, runtime changes or artwork changes.

The follow-up matrix writes per-case evidence and an incremental `summary.json` under `2026-10-16_remaining-liveplay-v2/`. Passing cases alone count toward coverage. Death counts describe this automated controller and do not establish human difficulty or control quality.

The v2 Grassland/Aclaire run ended incomplete at 39/40 after four minutes (18 deaths). Its result and screenshots are retained. The controller's overhead-route state could persist after death or apply to a remote coin that was not above the obstructing platform. The v3 controller clears the route after death and only adds an overhead detour when the target is above that platform. This fix affects QA only. The brief v2 Forest/Bobo attempt was interrupted before completion. V3 reuses the independently verified Bobo/Grassland pass and keeps its evidence path; other cases have separate v3 evidence.

## Normal mode — complete

All six remaining normal pairs reached the actual result state, collected all coins, passed replay reset and pause/home, and had no uncaught browser errors:

| Stage | Character | Coins | Game time (seconds) | Deaths |
| --- | --- | --- | --- | --- |
| Grassland | Bobo | 40/40 | 140.29 | 13 |
| Grassland | Aclaire | 40/40 | 218.10 | 48 |
| Forest | Bobo | 40/40 | 70.34 | 0 |
| Forest | Aclaire | 40/40 | 115.59 | 2 |
| Castle | Bobo | 25/25, boss defeated | 45.12 | 0 |
| Castle | Mew | 25/25, boss defeated | 41.96 | 0 |

Combined with the three earlier cases documented in `2026-10-16_normal-liveplay.md`, normal-mode completion now covers all three stages × all three characters for this seed and viewport. Grassland's high death counts expose the controller's unreliable ferry boarding; they do not establish a gameplay regression or a good human play experience. No game behavior was changed to make these tests pass.

## Timed mode — complete (results reviewed 2026-10-17)

| Stage | Character | Coins | Game time (seconds) | Outcome | Deaths |
| --- | --- | --- | --- | --- | --- |
| Grassland | Mew | 58/80 | 120 | Natural timeout | 1 |
| Grassland | Aclaire | 38/80 | 120 | Natural timeout | 19 |
| Forest | Bobo | 46/80 | 120 | Natural timeout | 2 |
| Forest | Aclaire | 66/80 | 120 | Natural timeout | 3 |
| Castle | Bobo | 45/45 | 97.54 | All coins and boss defeated | 4 |
| Castle | Mew | 45/45 | 52.97 | All coins and boss defeated | 0 |

All six reached their actual result screen and passed replay reset/pause/home with no uncaught browser errors. Final screenshots for all twelve cases were visually reviewed; headings, values and buttons remain visible. The complete runner summary is `2026-10-13_remaining-liveplay-browser.json`; per-case evidence and retained v2 evidence paths are indexed in `2026-10-16_remaining-liveplay-v3/summary.json`. Initial failed/interrupted attempts remain preserved and are not counted as passes.

The runner resumes completed cases from its saved evidence and prints `retainedPass`; a resumed run is not a fresh rerun of those cases. The completion audit on 2026-10-17 verifies saved results rather than replaying successful cases unnecessarily. Consolidated scope and handoff: `2026-10-17_browser-qa-handoff.md`.
