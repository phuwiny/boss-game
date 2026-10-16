## Changes
Refresh Coin Quest's scene artwork, character visuals and mobile interface for v2. Character artwork uses 108×96 backing images at the original 54×48 logical size, preserving the original four running frames, proportions and animation timing. Bobo has no mouth, Mew retains green eyes and Aclaire has blue eyes.

Improve responsive game controls and shared character portraits, including the Memory result screen on short viewports. Include reproducible asset tooling and browser QA evidence.

## Validation
- Character art and procedural sprite checks, settings and keyboard reset checks, and RPS/Rain/Memory checks passed.
- Asset rebuild reproduced all 29 checked outputs byte for byte; JavaScript syntax and staged whitespace checks passed.
- Normal mode: all-coin completion across all 3 stages × 3 characters. Timed mode: valid results across all 9 pairs; not every pair collected all coins.
- Visual checks covered five viewport sizes. New live-play cases passed replay/home checks with no uncaught browser errors.
- Local renderer checks passed; these do not establish real-phone performance. Earlier timed cases retain their original seed/version scope.

## Remaining verification
Actual iOS/Android testing is pending: multitouch, rotation, safe areas, background/resume and performance. Follow `.logs/2026-10-16_real-device-checklist.md`. See `.logs/2026-10-17_browser-qa-handoff.md` for evidence and scope limits.

Draft Release v2.0.0 is being prepared against this branch's latest commit. This PR does not merge or publish the release.
