# Memory portraits and Stage 1 visual refresh — 2026-10-17

## QA inventory before implementation

| User-visible claim/state | Functional check | Visual evidence |
| --- | --- | --- |
| Memory cards show distinct Bobo, Mew, Aclaire portraits | Start Memory, reveal each character face with normal clicks; match and replay still work | Desktop and 390×844 screenshots with revealed and dense boards |
| Portraits remain readable on small cards | Check easy and harder deck sizes, face rendering, bounds and accessible card labels | Desktop landscape and mobile portrait close views |
| Stage 1 has refreshed grassland graphics while gameplay geometry stays fixed | Start Grassland, move and jump, inspect coins, ground, platforms, obstacles | Same viewport before/after screenshots plus an in-motion screenshot |
| Other stages and game rules remain intact | Start Forest and Castle smoke flow; run existing rule and art checks | Screenshots of unchanged stage entry where useful |
| Responsive layout works | Check title, Memory play, Stage 1 at desktop and 390×844 | Viewport screenshots and bounds |

Off-path checks: missing portrait file must fall back to current sprite; card flip while the image loads must not show a blank face. Stage 1 contrast must remain clear near a coin and a solid obstacle, including at narrow width. Hazard contrast was not checked in this pass.

## Baseline and results

### Implementation

- Built-in imagegen, using `assets/concepts/2026-10-14_character-lineup-final.png` as the identity/style reference, made three separate transparent square PNGs. Each prompt requested one character only, centered head-and-shoulders pixel art, no text or scenery, and explicitly retained Bobo's lack of a mouth, Mew's green eyes or Aclaire's two blue eyes. Original 1254×1254 outputs were normalized to 256×256 with nearest-neighbor scaling; all three alpha channels span 0–255. Final images: `assets/portraits/2026-10-17_{bobo,mew,aclaire}-memory-portrait.png` (40–68 KB).
- `js/memory.js` uses each portrait only on Memory card faces. The original character canvas is rendered underneath and remains visible until the new image completes successfully, including if the file fails. No character frame, movement, or animation was changed.
- `js/render.js` changes only Grassland palette, cached parallax hills/contours/trees, and a distant windmill. Stage data and collision are unchanged. Forest/Castle drawing branches are unchanged.
- Prompt design and alpha check followed the official [OpenAI image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) and [image generation guide](https://developers.openai.com/api/docs/guides/image-generation).

### QA results

| Check | Result | Evidence |
| --- | --- | --- |
| Stage 1 baseline versus updated first screen, coins, block and ground remain distinct | Pass, visual inspection at 844×390 | `2026-10-17_stage1-before.png`, `2026-10-17_stage1-final-preview.png` |
| Movement and jump while rendering updated Stage 1 | Pass, normal ArrowRight and Space input, zero page errors | `2026-10-17_stage1-motion-desktop.png` |
| Mobile Stage 1 layout at 390×844 | Pass, HUD and touch controls visible, zero page errors | `2026-10-17_stage1-after-mobile.png` |
| Hard Memory deck includes Bobo, Mew, Aclaire and portraits load | Pass, six portrait card instances marked ready; no page errors | `2026-10-17_memory-hard-desktop.png` |
| Hard Memory mobile layout | Pass, card container 366×820 within 390×844 viewport, no page errors | `2026-10-17_memory-hard-mobile.png` |
| All portraits unavailable | Pass, 6 images blocked, 0 ready images, 6 fallback canvases; completed 10/10 pairs and replayed to a new 20-card deck | `2026-10-17_memory-fallback.png` |
| Other stages launch | Pass, Forest and Castle each started with pause control visible and zero page errors | Browser smoke pass |
| Syntax and whitespace | Pass, `node --check` for both changed JS files and `git diff --check` | Command output |
| Memory rules | Pass, all 8 checks in `node tools/check-memory.js` | Command output |

`node tools/check-level.js` was started for a wider regression check, reported Grassland/Bobo 1086/1086 reachable points, then was stopped because it continued into a long simulation; this is not a complete pass. No level, spawn or physics files changed. Hazard-specific visual comparison and physical-device testing remain open.
