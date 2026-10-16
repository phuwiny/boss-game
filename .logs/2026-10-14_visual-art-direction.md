# Visual refresh — 2026-10-14

## Direction and user correction

User continued after reviewing generated concepts. Latest correction: Bobo has NO mouth; Aclaire has BLUE irises in both eyes. Removed the added Bobo smile from js/sprites.js; kept Aclaire's existing #5aa8ff / #2464c8 iris palette. Mew retains green eyes. Final concept: assets/concepts/2026-10-14_character-lineup-final.png. Earlier concept variants are not authoritative.

## Image generation

Built-in image_gen used with integration screenshots as references (main 0e6c593). Sources saved in assets/concepts; originals preserved in Codex generated_images. Runtime loads only assets/2026-10-14_castle-menu.webp: 1672×941, 89,438 bytes, quality 85, no resize. No concept PNG is loaded by the game.

Final character prompt:
Create a fresh clean redraw of this Coin Quest pixel-art lineup using the attached image as identity and style reference. Three full-body idle characters evenly spaced on ivory background with ground shadows. Left Bobo is round orange with blue headband, cream muzzle, two big eyes, brown feet and ABSOLUTELY NO MOUTH. Center Mew is blonde with charcoal beret, GREEN eyes, blue blouse/white collar/gold bow, orange skirt, white socks, dark shoes. Right Aclaire has orange ponytail hair, pink heart shirt, blue trousers, white shoes and TWO MATCHING BRIGHT LIGHT BLUE EYES. Draw Aclaire's face facing more toward camera so BOTH blue irises are clearly visible and unmistakably the same blue color. No purple eyes, no pink eyes, no mismatched eyes. Preserve overall proportions and detailed crisp 16-bit pixel-art shading, friendly faces. No text or UI. Redraw rather than preserving the source eye pixels.

Reference for final redraw: assets/concepts/2026-10-14_character-lineup-correction.png. The preceding precise eye edits retained purple in the small eye; final redraw fixes both, with slightly more frontal faces. It is a design reference, not an animation atlas.

Scene concept prompt summary: three stacked side-view panels, Grassland light blue sky/warm green foreground, Forest teal canopy/wood and moss, Castle plum masonry/moonlight/burgundy banners/orange torches. No UI, text, characters or collectibles; clear traversable edges and restrained background contrast.
Castle prompt summary: wide 16:9 pixel-art interior using Castle gameplay screenshot as identity reference, moonlit arched windows, gold-ring banners and torches, quieter upper left for HTML title and center focal point for mobile cropping; no text/UI/characters.

## Implementation and scope

Grassland earth/grass palette, stepped grass edge and soil clusters, brick highlights; Forest depth palette, cached trunk bark and canopy clusters; Castle cached wall joints, window frames/sills and column bands. These details use existing layer/tile caches, not extra per-frame geometry.
Characters retain original 54×48 frames, anchor x=32, nine poses and gameplay. Updated warm/cool palette, Mew skirt pleats and Aclaire hem. No physics, character stats, abilities, shot parameters, collision or spawn changes. Concept illustrations are palette/detail references, not a claim of pixel-identical runtime artwork.

## Checks

27 sprite/pose contracts passed before and after: dimensions, anchor, transparency, star recolor keeps silhouette, deterministic cached builds. These are preservation tests, not a RED→GREEN feature claim.
Syntax checks for changed JavaScript passed. Browser visual/performance and integration results will be appended after completion. Hardware phone/gamepad tests remain unavailable.

## Verification after the requested corrections

- Fresh reviewer found no important defects in the scoped renderer/sprite/menu mapping diff; separately ran sprite checks and syntax. Review did not claim hardware or visual playtest coverage.
- Main rule tests passed: RPS 10, Coin Rain 10, Memory 8; UI settings 4; input reset/native keyboard checks; sprite contracts 27.
- Browser smoke passed 360×640, 390×844, 640×360, 844×390 and 1366×768 with no uncaught page errors. Covers normal/timed starts on all three stages, pause/resume/home, large Boss controls bounds/non-overlap, Rain start/pause/resume/exit, Memory card interaction and manual navigation. Result: `.logs/2026-10-13_art-integration-browser.json`. The existing runner retains its original date prefix; integration-* screenshots were refreshed by this run.
- Inspected current Castle menu portrait, Castle gameplay landscape and the 27-pose contact sheet. Bobo is mouthless; Aclaire retains blue irises. Generated concepts are not used as runtime sprites.
- Initial separately-run render microbenchmarks were noisy (Castle p95 2.9 vs 6.1 ms); they do NOT establish the +20% budget. A paired same-canvas/state comparison was added to reduce scheduling/context bias. This measures CPU canvas submission time, not real-phone frame rate.
- No physical phone/gamepad test or new full Boss victory playthrough. PLAN.md leaves unverified checklist items open. No commit/push/deployment.

Paired benchmark result (640×360, 200 timed renders per version, same game object/canvas, alternating order): Grassland baseline/updated p95 1.1/4.0 ms; Forest 4.4/3.8 ms; Castle 3.8/4.2 ms. Medians 0.4/0.3, 0.5/0.5, 0.4/0.4 ms. Forest/Castle meet the +20% criterion in this sample; Grassland does not. Do not mark the global performance criterion passed. Browser canvas submission timing is noisy and GPU scheduling-sensitive; the remaining performance investigation and unverified V4 checks stay open. The user-requested mouth/eye correction and current visual implementation are complete, not the entire V4 validation plan.

Performance follow-up resolved: paced frame-interval comparison passed all 9 stage/round checks at 640×360; worst updated/baseline ratio 1.0141. Earlier unpaced submission benchmark is superseded for frame-cadence assessment. No renderer optimization needed for the tested states. See .logs/2026-10-14_performance-investigation.md. Physical device and complete Boss-combat QA remain distinct unverified items.
