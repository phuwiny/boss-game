# Remaining visual/mobile QA — 2026-10-15

Continuation after checkpoint `df3faff`, using the approved PLAN.md and game-playtest workflow. QA tooling/documents only; no production gameplay changes in this pass.

## Inventory and boundaries

- Shared portraits: three characters in picker/title/RPS/Coin Rain/Memory; five viewports (360×640, 390×844, 640×360, 844×390, 1366×768).
- Castle: each character's projectile alongside original boss fire, HP HUD, standard/large controls. Arena positioning is a fixture; HP/damage/timers unchanged. Desktop controls are hidden normally, so bounds checks only apply to visible buttons.
- Stage/mode matrix: all 18 character/stage/mode combinations receive one second of real move/jump/fire input at 844×390, then pause/home. This is a smoke test, not full-level traversal or completion.
- Regression: existing keyboard/touch/rotation/pause/settings/fullscreen/reduced-motion flow on current code, plus stored-record preservation, manual navigation and all three stages with art/fonts/storage blocked.
- Environment: paused-world camera snapshots centered on existing tile/object types. No collision, spawning or gameplay edits; these are visual fixtures, not traversal tests.

## Driver corrections

Memory randomly selects 10 of 12 faces on Hard, so not every deck includes all three heroes. An initial assertion incorrectly assumed otherwise. The visual fixture now passes a fixed RNG only to the next MemoryRules.newGame call, then immediately restores the original function. This ensures all hero cards are available without changing production randomness.

Initial picker/title screenshots caught fade transitions. Dedicated settled screenshots in `2026-10-15_regression/` wait 350 ms and scroll the relevant card into view; these supersede the initial matrix picker/title screenshots for visual signoff.

## Matrix results

Matrix run exited 0 across all five viewports. All 18 smoke combinations passed, as did 15 character/viewport Castle checks. No uncaught page errors or failed local-resource requests in these matrix flows. Screenshots reviewed include all three character identities across picker/title/RPS/Rain/Memory, portrait and landscape Memory previews, and the three shot types with boss fire. No missing portraits or unintended face changes observed. Bobo remains mouthless and Aclaire blue-eyed. Narrow Castle viewport shows a partial boss at the right camera edge; control buttons remain within bounds and mutually separate, and this is not a claim that the entire arena fits on portrait screens.

Evidence: `.logs/2026-10-15_remaining-qa/`, `.logs/2026-10-13_matrix-browser.json`. Memory fixtures are labeled above. Minigame result/complete-play coverage is separate from portrait inspection.

## Regression and environment results

Regression run exited 0 across all five viewports: simultaneous touch move/jump, touch cancel, held-input reset during viewport rotation, pause freezing time, restart, audio setting synchronization, native keyboard controls, settings persistence, reduced motion, desktop fullscreen enter/exit, manual navigation, and old-record values preserved after settings changes/reload. All three stages start when assets/fonts/storage are blocked. No uncaught page errors. Intentional blocked requests are expected in the isolated fallback context; this is not a claim of zero network errors there. Evidence: `.logs/2026-10-15_regression/` and `.logs/2026-10-13_regression-browser.json`.

Environment run exited 0. Visually reviewed 34 camera-centered samples (11 Grassland, 12 Forest, 11 Castle), covering every nonempty tile type present plus moving platforms, slime/boar types, checkpoint and item types present in the selected seed. Ground edges, platform outlines, spikes and item/foe silhouettes remain identifiable in these samples. Castle has no spring sample because that tile type is absent. A paused snapshot cannot prove moving-platform animation/collision behavior or readability at every placement. Evidence: `.logs/2026-10-15_environment/`.

Current Castle large controls also passed simulated left/right 24px and bottom 20px insets at 360×640 and 640×360: controls stay inside usable bounds and separate. Screenshots reviewed. This is CSS-inset simulation, not real notch/OS/browser-chrome testing.

Syntax checks passed for the new QA modules and modified runner. No production changes were needed. PLAN.md now separates completed responsive checks from the still-open latest-version result-screen matrix. Real iOS/Android hardware, full-level unassisted completion, full minigame result flows and exhaustive enemy/item placements remain outside this pass. No new commit/push performed.
