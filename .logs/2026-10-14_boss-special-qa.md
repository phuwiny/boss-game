# Boss combat and special-state QA — 2026-10-14

Requested scope: Boss combat for Bobo/Mew/Aclaire (shooting, damage, HP depletion, defeat/victory, replay), and visual checks for wings, Mew floating, star and Aclaire guard.

## Test boundary

Use fixed custom seeds, which do not write daily/all-time records. Browser through existing regular Playwright fallback, installed Chrome, local server. No production code changes planned; failures first classified as QA-driver issues versus product defects.

Boss encounter fixtures skip traversal by placing the player near the arena. The loss scenario leaves HP/guard/boss values intact, drives contact using keyboard, and checks real damage/death/respawn. Victory scenario restarts through UI, places player near boss and marks only non-boss coins collected. Full boss HP, original damage/cooldown/pattern/timers remain intact. Movement, firing, dodging and dropped-coin collection use keyboard. This is a full encounter test, NOT an unassisted start-to-finish whole-level playthrough.

Special-state fixtures give wing/star timers to make the visual states reproducible, then use keyboard for jumping, airjump and Mew floating; positioned real enemy triggers guard. Stage screenshots are evidence of rendering; fixtures do not claim natural item acquisition.

## QA coverage inventory

- Three characters: HP reaches zero, death animation, automatic respawn with HP=5 and undefeated boss HP=50.
- Aclaire guard consumed before HP damage and recovered on new life.
- Real player shots reduce full boss HP; boss attacks occur; boss death releases five coins.
- Keyboard collection produces result; replay resets HP, boss HP, collected coins.
- Wings grounded/airborne, left/right; Mew floating timer decreases under held input.
- Star and wings combined, guard-use invulnerability, portrait and landscape; inspect screenshots for player cropping/HUD-control obstruction.
- No uncaught browser errors; use custom seed to avoid records pollution.

## Driver issue found before combat

Clicking the already-selected character closes the picker by design. Initial driver tried clicking the now-hidden OK button. Corrected driver to click OK only when visible; no product bug or product change.

## Final results

Boss encounter, Chrome 844×390: all three characters passed HP depletion/death/automatic respawn, shooting from boss HP 50 to defeat, boss attacks, dropped-coin collection, result and replay reset. Bobo finished with HP 4 in 10.8 s, Mew HP 2 in 13.7 s, Aclaire HP 5 in 7.7 s. Aclaire guard consumption observed. No uncaught browser errors.

Initial Mew driver attempt died with boss HP 3. Preserved in `2026-10-14_boss-special/initial-attempt.json`. Moving closer and facing the boss immediately after retreating made the driver pass; no HP, damage, cooldown or physics changes. The complete second run is in `results.json` and per-character combat traces.

Effects: all three characters passed at 360×640 and 844×390. Real keyboard jump/airjump, Mew floating with decreasing timer, left/right facing, staged star+wing timers, and Aclaire guard triggered by contact. No horizontal overflow or uncaught browser errors. Results are in `effects-360x640.json` and `effects-844x390.json`.

### Visual defect fixed

Screenshot review found wing feathers mostly covered by the hero's hair/body. `drawHero` drew the small wing behind the larger hero silhouette. Repositioning alone left too little visible, so the final change draws the cached wing at 2× pixel scale and offsets its attachment behind the shoulder. This changes only rendering. Repeated both effects viewports after the final change; feather tips now remain visible on the reviewed grounded, airborne, floating and left/right star screenshots without covering HUD or controls. Guard screenshots include the next blink frame to show both invulnerability feedback and the visible character.

Bobo retains no mouth; Aclaire retains blue eye colors (#5aa8ff/#2464c8), including star state. No character-face changes in this follow-up. Sprite contract checks passed all 27 character/pose combinations including star palette/transparency; renderer and QA script syntax checks passed.

### Evidence and limits

Screenshots and JSON: `.logs/2026-10-14_boss-special/`. Representative files: `360x640-bobo-wing-ground.png`, `360x640-mew-floating.png`, `360x640-aclaire-star-wing-left.png`, `844x390-aclaire-star-wing-right.png`, `844x390-aclaire-guard-used-next-frame.png`, and each character's `844x390-*-result.png`.

This verifies controlled full boss encounters, not traversal of the complete Castle level. Effects use staged timers, not natural item collection. Browser emulation is not physical iOS/Android validation. Boss combat passed before the wing-only rendering correction; effects and syntax checks were repeated afterward. No claim of exhaustive visual coverage of every pose/frame or of real-device performance. No commit or push performed.
