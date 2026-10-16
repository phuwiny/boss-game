# Resolution follow-up QA — 2026-10-16

Accepted scope: original four run frames, original proportions, density=2 artwork only. No animation redesign.

Inventory: complete the remaining 390×844, 640×360 and 1366×768 shared-surface/shot/fallback checks, complementing 360×640 and 844×390 already verified. Compare current density2 against archived density1 raster artwork using the same current renderer, deterministic seed, fresh page/cache per sample and alternating order. Three stage/character pairs × three rounds × two variants, 40 warmup and 120 measured RAF frames. Paused world with running/star fixtures exercises the sprite cache; this is not a level playthrough or a physical-phone benchmark. Record frame cadence and CPU submission separately; acceptance is frame p95 within +20% for every round.

Remaining viewport run passed: 390×844, 640×360 and 1366×768; combined with the previous two sizes this completes the current density2 five-viewport matrix. All three shared character portraits, Castle crossfire/control bounds and blocked-art fallback passed per size. No uncaught errors. Visually reviewed 390×844 picker, 640×360 Castle crossfire and desktop title; source screenshots in `.logs/2026-10-16_resolution-qa/`, browser summary `.logs/2026-10-13_resolution-remaining-browser.json`.

Initial performance run failed the +20% gate in Grassland (updated p95 10.2/14.0 ms versus baseline 7.1/8.1 ms in two rounds). The original per-pixel fillStyle/fillRect path also showed higher submission p95 during star-frame cache construction. Preserved the failed data in `.logs/2026-10-16_resolution-performance-before.json`.

Implemented a backing-canvas fast path in `Sprites.paint`: convert supported hex/HSL colors to cached RGB values, populate ImageData, and upload once per newly built sprite canvas. It applies only at exact native size with identity transform, full opacity and source-over; scaled/transformed drawing uses the existing path. This changes cache construction, not frame selection, art geometry or gameplay.

Pixel-equivalence browser validation passed 108 frames (three characters × nine poses × normal/three star hues), maximum channel difference 0 and matching alpha against the previous Canvas fillRect path. Wing/float/guard checks at 844×390 passed after optimization with no uncaught errors; final Mew star/wing screenshot reviewed. Evidence: `.logs/2026-10-13_pixel-upload-browser.json` and `.logs/2026-10-16_pixel-upload/`. Raster and fallback contracts each passed 27 poses; syntax and diff whitespace checks passed. No commit/push in this follow-up.

After this change the same performance benchmark passed all three stage/character pairs × three rounds. Updated frame p95 was approximately 7.1–7.2 ms, all updated/baseline ratios ≤1.001 (well within +20%). Data: `.logs/2026-10-16_resolution-performance.json`; browser summary `.logs/2026-10-13_resolution-performance-browser.json`. This is local Chrome RAF cadence under the documented fixture, not physical-device FPS or full-game throughput.

Full normal-mode completion and real-device testing remain separate unchecked V4 items.

Asset footprint: archived density1 script 290,126 bytes (30,215 bytes gzip); current density2 script 1,135,217 bytes (104,669 bytes gzip). Gzip figures are local measurements, not a claim that the deployment enables compression. Source PNGs are still not requested by the game. No production gameplay changes planned in this QA pass.
