# Normal-mode live playtest — 2026-10-16

Follow-up: all six previously missing normal pairs have now completed. See `2026-10-16_remaining-liveplay.md` for the expanded 3×3 normal-mode coverage; the table below records the scope of this earlier pass only.

Scope: continue V4 with actual keyboard play; preserve the approved resolution-only artwork and original four running frames. No game runtime, physics, stats, level or asset changes in this pass.

Added `tools/2026-10-16_qa-normal-liveplay.cjs`, invoked through the existing Chrome/Playwright runner. The controller reads live state, forecasts movement on copied players, and sends ordinary keyboard events. It does not teleport, precollect coins, change timers, grant powers or change HP. Forecasts approximate moving platforms and enemies as stationary; they are planning aids, not authoritative physics validation. A player snapshot equality guard checks that forecasting has not mutated the live player. Browser errors remain checked by the shared runner.

First probe: Grassland / Mew / normal / 844×390, seed `qa-normal-2026-10-16`, 240-second wall-time budget. Collected 39/40, one death, maximum x 11134.40, still playing at game time 239.93 seconds. **Incomplete, not a passed level-completion test.** Evidence: `.logs/2026-10-16_normal-liveplay/` (trace, screenshots, result). No uncaught browser errors. Screenshots show the distance-only controller repeatedly jumping beneath solid overhead platforms; this is a controller limitation, not evidence of an unreachable level.

Follow-up controller adds an explicit waypoint around an overhead platform, keeps that waypoint until the player rises above it, and rewards earlier predicted coin contact to reduce planning hesitation. Evidence from the follow-up is stored separately under `.logs/2026-10-16_normal-liveplay-routing/`. The CLI supports stage/character selection; that capability alone does not imply all combinations have been tested.

Command: `node tools/2026-10-13_browser-qa.cjs normal-liveplay 844x390 grassland mew`.

Full three-stage / three-character normal completion and physical-phone checks remain unverified unless explicitly recorded below. No commit or push in this pass.

Follow-up **passed Grassland/Mew completion**: 40/40 coins, game time 97.2667 seconds, one death, max x 11147.96, no remaining coins. Actual `won` state followed by replay reset to zero coins and pause/home passed; the outer runner reached its final error check with `errors: []`. Evidence: `normal-liveplay-routing/grassland-mew/results.json`, trace and screenshots. The final screenshot was captured during the result fade-in; the next run waits for that transition before capturing. This result covers this single seed/pair/viewport, not all normal-mode combinations.

**Passed Forest/Mew completion**: 40/40 coins, game time 99.9833 seconds, one death, max x 11062.15. Actual result/replay/pause/home and zero-coin reset passed. No uncaught browser errors. Final result screenshot was reviewed after its transition: heading, time, replay and home controls are fully visible at 844×390. Evidence: `normal-liveplay-routing/forest-mew/`, including a preserved `browser-summary.json`. Grassland's outer-runner summary was also preserved in its case directory before the next run.

Castle controller adds normal held `KeyX` input and a short-range boss tactic (face the boss, hold distance, jump when a fireball approaches). Boss HP, attacks and coin drops are untouched. This is separate from the earlier teleported arena fixtures.

**Passed Castle/Aclaire completion**: from the initial spawn to boss defeat and all 25/25 coins, game time 43.7583 seconds, one death, max x 5344.97, `bossDefeated: true`, no remaining coins. Replay reset and pause/home passed; the outer runner exited 0 with no uncaught browser errors. Final result screenshot visually reviewed: boss completion message, time, replay and home fit at 844×390. Evidence: `normal-liveplay-routing/castle-aclaire/`, including `browser-summary.json`.

## Coverage at end of this pass

| Stage | Normal completion verified here | Other normal characters |
| --- | --- | --- |
| Grassland | Mew, 40/40, 97.27 seconds | Bobo, Aclaire not completed in this pass |
| Forest | Mew, 40/40, 99.98 seconds | Bobo, Aclaire not completed in this pass |
| Castle | Aclaire, 25/25 and boss, 43.76 seconds | Bobo, Mew not completed in this pass |

Each successful case used one deterministic seed at 844×390. These results establish actual completion of all three scenes with the current artwork, not the full character/stage/viewport matrix. Earlier timed and fixture checks retain their original scope. Physical iOS/Android testing remains unavailable. No visual, animation or gameplay code was changed in this pass; only QA tooling and documentation. Syntax checks for both touched QA scripts and `git diff --check` passed (line-ending notices only).
