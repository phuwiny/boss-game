# Character concept rebuild — 2026-10-15

User approved reopening V3 to match the approved concept, followed by seed review, animation work and integration. Previous procedural-sprite QA remains historical evidence, not acceptance of the new raster artwork.

Reference: `assets/concepts/2026-10-14_character-lineup-final.png` (inspected before generation).

Generated with built-in imagegen, transparent_background=true; no CLI/API fallback. Original saved at `C:/Users/Nilanull/.codex/generated_images/01a1345c-6fce-7793-a825-779d19a9cace/exec-38e88cf0-9ea0-4269-ad8f-47b3856c1e3a.png`; copied non-destructively to `assets/concepts/2026-10-15_character-seeds-v1.png`.

Prompt specification: identity-preserving production seed lineup, exactly Bobo/Mew/Aclaire left to right, same slightly-right three-quarter platformer view and reference costume/proportions. Bobo short round orange body, blue headband/tails, cream face, dark eyes, brown boots, absolutely no mouth. Mew golden long hair, black beret, green eyes, blue blouse/white collar/yellow bow, orange skirt, white socks/brown shoes. Aclaire orange ponytail/pink tie, blue eyes, pink white-heart shirt, blue pants, white/blue sneakers. Crisp limited-palette pixel clusters, plum outlines, warm upper-left highlights. Readable around 40-pixel human height; Bobo remains shorter. Aligned feet, generous transparent gaps. No floor, shadows, labels, scenery, panels or extra characters. Preserve approved expression and identity; seed review before animation strips.

Visual inspection of generated full-size output: all three characters present; Bobo mouth absent, Mew eyes green, Aclaire eyes blue; characteristic outfits and silhouettes retained. This is NOT yet a normalized sprite sheet. The review HTML displays the approved reference, new seed and approximate 1×/2×/4× scale examples; it does not claim an in-engine screenshot or validated animation.

Review artifact: `assets/concepts/2026-10-15_character-review.html`. Human height near 40 CSS pixels is an initial readability target, not a changed collision box. No production sprite/renderer/gameplay code replaced in this pass.

## Approved seed and implementation

Pinz approved the seed with “โอเคครับ”. Generated a complete nine-pose set per character using built-in imagegen and that seed as the reference. Initial horizontal Bobo/Mew strips had insufficient gutters and were not shipped. Retried each character as a single coherent 3×3 sheet (same all-frames-at-once principle, more space per pose). Raw approved-direction outputs:

- Bobo: generated `exec-fc436265-c3ac-46f3-a3aa-46542b575b35.png` → `assets/characters/2026-10-15_bobo-source.png`
- Mew: generated `exec-f3c97874-7545-4264-81ca-06e72f60aa13.png` → `assets/characters/2026-10-15_mew-source.png`
- Aclaire: generated `exec-dada154f-8acd-4325-973b-de9d3b26b181.png` → `assets/characters/2026-10-15_aclaire-source.png`

Animation prompt set: square production sheet, exactly 3×3 isolated complete characters, transparent background, fixed scale and right-facing three-quarter view; row-major idle, blink, run1 contact, run2 passing, run3 opposite contact, run4 opposite passing, jump, fall, upright hurt/dead. Large transparent gutters; no cropping, labels, scenery, floor or shadows. Preserve approved character identity, palette, outfit and plum outline with crisp pixel clusters. Bobo: orange round creature, cream face, blue headband/tails, brown boots, no arms and absolutely no mouth. Mew: golden long hair, black beret, green eyes, blue blouse/white collar/yellow bow, orange skirt, white socks/brown shoes. Aclaire: orange ponytail/pink tie, blue eyes, pink white-heart shirt, blue pants, white/blue sneakers. No wings/weapons baked into artwork; existing effects remain separate.

`tools/2026-10-15_build-character-art.cjs` splits the equal cells, validates blank margins, applies one shared scale per character, thresholds alpha, reduces the palette and anchors the core silhouette within 54×48 frames at x=32. It exports 27 PNG frames, a preview and packed pixel data. This is mechanical asset preparation with sharp, not redraw/generation. The skill's square-strip normalizer was not used because the existing API requires rectangular 54×48 frames with an asymmetric x=32 anchor and these outputs are 3×3 sheets.

Runtime uses the generated `js/2026-10-15_character-art.js` (290,126 bytes before the Mew-mask correction; final size unchanged, roughly 31 KB gzip when served compressed). No raw PNG source/concept download, fetch, image decode or new runtime dependency. `CQ.Sprites.build/paint` stays compatible with the renderer and minigames; procedural drawing remains the missing/malformed-data fallback. Physics, hitbox, weapon damage and ability stats were not changed. Generated normal frames are cached by the existing renderer.

QA inventory: select raster frames for all poses; preserve silhouettes under star recolor; keep masks off identity features; load failure still permits play; shared portraits in picker/title/RPS/Rain/Memory; all stage/character/mode starts; shots/boss projectiles and both control sizes; wing/float/guard; left/right contact sheets; no uncaught errors. Physical devices and full-level completion are explicitly outside this visual pass.

## Verification

- New contract test failed before integration (`source` undefined), then passed all 27 frames with star mask and missing/malformed fallback checks. Original 27 procedural contracts also pass.
- `concept all`: five viewports 360×640, 390×844, 640×360, 844×390, 1366×768 passed. All three portraits were captured on shared surfaces; RPS/Memory canvases have visible pixels. Fifteen Castle crossfire cases passed with staged arena position and real shots; 18 stage/character/mode combinations received a one-second real-input smoke check at 844×390. These are not full playthroughs.
- Aborted the art script request on a fresh navigation at each viewport: all three characters still started with procedural fallback, and raster art returned after reload. Five browser summaries have no uncaught errors.
- Actual screenshot review found Mew's orange hair shadows included in the skirt's star mask. Added a failing check, restricted Mew recolor to its blue blouse, rebuilt data, and verified the check passes. This preserves hair and skirt color while the blouse and existing aura communicate the star effect.
- Final effects recheck at 360×640 and 844×390 passed: wing/star timer fixtures, real keyboard air jump/float/facing, positioned enemy triggers Aclaire guard. Final Mew contact sheet visually confirms unchanged golden hair for sampled hues 0/120/240. Browser errors are empty in both runs. The animation preview loaded and its direction/star controls were exercised at 844×390 without uncaught errors. JavaScript syntax checks and `git diff --check` passed.

Evidence: `.logs/2026-10-13_concept-browser.json`, `.logs/2026-10-15_concept-qa/`; final recolor screenshots are in `final-effects/` and supersede the initial star screenshots. Animation viewer: `assets/characters/2026-10-15_animation-preview.html`, using the same runtime frame data at 4× scale.

Remaining wider V4 scope: complete normal-mode traversals/full combinations and real-phone tests. Historical performance results do not establish a new physical-device frame-rate result for this version. No commit/push in this pass.
