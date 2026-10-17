# Grassland concept background — 2026-10-17

Requested after checkpoint commit `1cbfcba`: make Stage 1's background look like the approved scene concept.

## Implementation

- Source: the top Grassland panel of `assets/concepts/2026-10-14_scene-concepts.png` (already tracked). The renderer samples source x=180–1440, y=8–255: blue pixel mountains, cloudscape and warm green hills, omitting the foreground floor, brick, and the neighboring scene panels.
- A mirrored second copy is cached in the parallax Canvas so the horizontal join remains continuous as the camera moves. The upper 95 logical pixels fade into the existing sky on tall mobile viewports. The original procedural hills remain the fallback if the image fails to load.
- Coins, ground tiles, blocks, player sprites, collision, spawn, and stage data remain unchanged. The previously added ground/tree palette still applies. The source PNG adds approximately 1.85 MB to the first Grassland asset load; no other stage requests it.

## QA inventory and results

| Claim/state | Functional check | Visual evidence/result |
| --- | --- | --- |
| Concept mountains and green hills appear behind the live Stage 1 | Start normal Grassland at 844×390; verify the floor/brick/coins remain in front | `2026-10-17_stage1-concept-desktop.png` |
| Tall mobile sky has no hard image edge | Start normal Grassland at 390×844; inspect transition above the mountains and touch controls | `2026-10-17_stage1-concept-mobile.png` |
| Movement works with the new background | Hold ArrowRight and jump with Space; check for page errors | `2026-10-17_stage1-concept-motion.png`; zero errors |
| Missing concept image still leaves a playable scene | Abort `2026-10-14_scene-concepts.png` request and launch Grassland | `2026-10-17_stage1-concept-fallback.png`; procedural scene visible, zero errors |
| Other stages are unaffected | Launch Forest and Castle, check game controls and errors | Both launched with pause visible, zero errors |

`node --check js/render.js` and `git diff --check` passed. These are browser emulation checks, not physical-device results or a full playthrough/performance benchmark.
