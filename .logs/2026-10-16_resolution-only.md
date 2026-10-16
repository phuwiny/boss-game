# Resolution-only correction — 2026-10-16

Pinz rejected the attempted new run poses because their scale/proportions changed. Explicit new scope: do not change the run animation; improve resolution only.

Restored the original three 3×3 source sheets and all nine poses per character, including the original four running frames. Removed run5–8 and the eight-phase selector; restored the exact original main-game, menu and Coin Rain timing expressions. Experimental run sheets remain on disk as unused drafts, not runtime assets. No new image generation in this correction.

The original per-character shared scale, per-pose rounded logical dimensions, x anchor and baseline are retained. Resample those same source crops with Lanczos at 108×96 rather than nearest-neighbor at 54×48. The public frame dimensions remain 54×48, ax=32; density=2 specifies the backing pixels. Renderer caches 108×96 canvases, then draws them at the existing logical size. Character-only high-quality downsampling is enabled for game/menu/Rain/Memory; other pixel graphics are unchanged. The preview uses the restored four-frame loop too.

Checks: 27 raster contracts (including Mew star mask/fallback), 27 procedural fallback contracts, and comparison against archived v1 visible bounds with at most one logical pixel sampling tolerance passed. JavaScript syntax and diff whitespace checks passed.

Browser validation at 844×390 and 360×640 passed: backing canvases are 108×96 while frame metadata stays 54×48/ax32 for every character/pose; 18 stage/character/mode one-second real-input smoke cases at 844×390, all shared portraits, Castle shots/control bounds, wing/float/guard, and blocked-art fallback on both sizes. No uncaught errors. Reviewed actual game and Memory screenshots, including portrait Memory. Evidence and per-viewport summaries are in `.logs/2026-10-16_resolution-qa/`. These are focused visual/functional checks, not full-level playthroughs or physical-phone verification. Previous V4 results are not used as proof of this correction.

Sources: `assets/characters/2026-10-15_<id>-source.png`; final per-pose exports: `2026-10-16_<id>-<pose>-hd.png`. Existing normalized preview and animation preview paths updated for the user's open page. Historical v1 data/preview retained for comparison. No commit/push.
