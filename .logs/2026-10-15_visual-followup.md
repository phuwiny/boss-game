# Visual follow-up — 2026-10-15

Continued the approved PLAN.md QA using the existing Playwright/Chrome runner and game-playtest workflow. This pass changes QA tooling and documentation only; no gameplay or production artwork changes.

## Coverage and results

- Generated and visually inspected three contact sheets: all nine poses × both directions × normal and star hue 0/120/240 = 72 samples per character, 216 total. Uses production CQ.Sprites.build/paint at 2× pixels, with baseline guides. No clipped character artwork observed; pose offsets remain consistent with the existing animations. Bobo remains mouthless. Mew eyes remain green and Aclaire blue across the inspected normal/star samples. This is a static pose/anchor inspection, not a measurement of temporal animation jitter or exhaustive testing of every hue.
- Castle image failure at 360×640 and 844×390: intentionally aborted the WebP request; verified the failure occurred, captured fallback menu, clicked normal start and confirmed Castle loaded. Menu labels/buttons remain legible in both screenshots. Removed interception, reloaded, and verified the asset decodes and the artwork returns.
- Castle WebP size: 89,438 bytes, below 400 KB. No concept image requests observed during tested menu/start/reload flows.
- Both browser runs exited 0 with no uncaught page errors. Recorded request failures are the intentionally blocked Castle image. QA script syntax check passed.

## Evidence

Directory: `.logs/2026-10-15_visual-followup/`

- `bobo-poses-directions-star.png`, `mew-poses-directions-star.png`, `aclaire-poses-directions-star.png`
- `360x640-castle-image-fallback.png`, `844x390-castle-image-fallback.png`
- Matching `castle-image-restored.png` screenshots
- `results-360x640.json`, `results-844x390.json`

Runner: `node tools/2026-10-13_browser-qa.cjs followup 360x640` (or `844x390`). Requires the existing installed Playwright/Chrome setup. The shared runner's date-prefixed summary is overwritten by its last run; the dated per-viewport files above preserve both results.

## Still open

Full level traversal and the broader gameplay matrix, shared portraits across all minigames, broader environmental-object visual coverage, and remaining V4 responsive/resilience coverage. Prior boss encounter results remain recorded separately in `.logs/2026-10-14_boss-special-qa.md`. Physical iOS/Android testing remains unavailable; emulation does not establish physical-device support. No commit, push, or deployment.
