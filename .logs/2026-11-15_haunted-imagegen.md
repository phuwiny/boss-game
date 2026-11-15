# Haunted House image generation — 2026-11-15

Status: concept, `run1` seeds, and final image handoff approved by Pinz on 2026-11-15. Scene, environment sprites, and all three 4×4 character motion source sheets are prepared. Game integration remains pending.

## Concept

- Mode: built-in imagegen, opaque pixel-art concept; no API key or CLI fallback.
- References inspected: `assets/concepts/2026-10-14_scene-concepts.png` and `assets/concepts/2026-10-14_character-lineup-final.png`.
- Original generated output: `C:/Users/Nilanull/.codex/generated_images/01a1daaa-7bd2-7e41-89ef-ab4122790153/exec-123782b9-4017-4400-865b-13438a64aa72.png`.
- Project copy: `assets/concepts/2026-11-15_haunted-concept.png` (2,023,569 bytes).
- User output copy: `D:/ai_workspace/codex/2026-11-15_haunted-concept.png`.
- No optimization: this is a review concept, not a game-loaded asset. The 1 MB runtime asset budget will be checked after production assets exist.

Prompt:

> Use case: stylized-concept. Asset type: one review board defining the visual direction for Stage 4 Haunted House of Coin Quest, a family-friendly 16-bit pixel-art side-scrolling browser platformer. Create a single coherent wide pixel-art concept image with a playable-looking haunted mansion room as the main scene and clearly separated visual samples along the lower portion, without frames or labels. The mansion interior has deep indigo and plum wallpaper, moonlit arched windows, aged wood floor, dark brick walls, cobwebs and small candles; spooky and mysterious yet playful and suitable for children. Show both active solid and inactive ghosted purple and orange switch blocks: purple has unmistakable crescent-moon/circle motifs, orange has square or jack-o-lantern motifs, with dashed edges on ghosted blocks, so they remain distinct in grayscale. Show a small physical switch, a three-tile-wide vertical moving platform on rails, one mischievous hopping pumpkin, one fire-spitting pumpkin with glowing warning eyes, and a distinct eerie green ghost-fire projectile. Include a few gold coins and a safe legible path. Art direction matches a polished SNES-era platformer: crisp square pixel clusters, strong dark outlines, three-step shading, readable silhouettes at game scale, deep violet and midnight blue with pumpkin orange and spectral green accents. Wide landscape composition. No characters Bobo/Mew/Aclaire, no typography, letters, logos, watermark, UI, gore, realistic skulls, or photorealism. This is a concept review image, not a production sprite sheet.

Visual review: the image includes the mansion interior, both color states and their distinct motifs, switch, vertical platform, both pumpkin behaviors, ghost fire, and a sample strip. It contains no visible text, logos, or UI. A grayscale production check and tile-grid validation remain for the sprite assets.

Pinz approved this concept on 2026-11-15.

## Scene and environment deliverables

Generated each image with built-in imagegen and saved the original under `assets/concepts/2026-11-15_haunted-*-source.png`. The matching unmodified originals also remain in the Codex `generated_images` directory above. `sharp` was installed only in the OS temporary directory for deterministic crop, resize, palette PNG, and WebP encoding; it is not a game dependency. The game code was not changed.

| Asset | Generated original filename | Delivery | Bytes |
|---|---|---|---:|
| Menu | `exec-27592f48-0500-4490-94b1-978b94b44b93.png` | `assets/2026-11-15_haunted-menu.webp` (1672×941, WebP quality 85) | 205054 |
| Background | `exec-93e145ad-ad73-49ed-8fed-b60d689646ca.png` | `assets/2026-11-15_haunted-bg.png` (1672×941, center crop, nearest resize, 32-color PNG) | 514074 |
| Tile motifs | `exec-5fc299ee-ec13-48da-a816-2dd799464a3a.png` | `assets/haunted/2026-11-15_tiles.png` (5×64×64; fifth one-way tile derived from platform source) | 12559 |
| Switch blocks | `exec-e41dfd01-159a-4a8d-b4f0-3219e6cb509f.png` | `assets/haunted/2026-11-15_switch-blocks.png` (7×64×64) | 14871 |
| Vertical platform | `exec-6dc4d8e6-6f7a-431f-90a2-89380579dabe.png` | `assets/haunted/2026-11-15_vplatform.png` (192×64 platform cell plus 64×64 rail cell; platform art 188×24 inside the cell) | 5923 |
| Hopping pumpkin | `exec-d4c69abf-f0ce-4059-bd99-1c0328fc1703.png` | `assets/haunted/2026-11-15_pumpkin-hop.png` (6×64×64) | 13586 |
| Fire pumpkin | `exec-950f2d6b-b76f-4dc2-a84d-ede259e07d35.png` | `assets/haunted/2026-11-15_pumpkin-fire.png` (4×2 cells, 64×64 each) | 17326 |
| Ghost fireball | `exec-4b94373b-8cc6-49a5-8771-3bdbfdbda3ef.png` | `assets/haunted/2026-11-15_fireball.png` (4×32×32) | 2697 |
| Decor | `exec-ffe86539-f121-48a5-acf8-d6b010433703.png`, bat supplement `exec-3ed4fc5b-e380-441d-8641-05a48073945c.png` | `assets/haunted/2026-11-15_decor.png` (9×64×64) | 14419 |

Production image bytes listed above total **800,509**, below the 1 MB environment budget. Full character motion sheet cost remains to be measured. The source PNGs and review previews are outside the runtime budget.

Prompt ledger (each entry records the generation request; all requested no text, logo, watermark, UI, gore, or photorealism):

- **Menu:** wide 16-bit Haunted House menu card; central moonlit arched window, old violet wallpaper/brick, wood corridor, cobwebs, candles, two mischievous pumpkin types, purple crescent and orange square switch-block accents; center legible after narrow crop.
- **Background:** wide parallax rear interior only; repeating indigo/plum wallpaper, moonlit arches, distant furniture, columns, candles and webs; no foreground floor, blocks, platforms, enemies, coins, or playable geometry.
- **Tiles:** transparent four-motif row of worn wood floor top and middle, dark haunted brick, and iron spikes; 32×32 logical tile at 2× density, dark outline and three-level pixel shading.
- **Switch blocks:** transparent seven-motif row of purple solid/ghosted crescent blocks, orange solid/ghosted square/pumpkin blocks, idle/depressed/lit switch; ghosted states have dashed borders and color-independent motifs.
- **Vertical platform:** transparent source with a three-tile-wide wood lift with purple trim and one narrow vertical metal rail; same pixel palette and clean silhouette.
- **Hopping pumpkin:** transparent six-pose horizontal source: idle, crouch, airborne hop, hit, and two cartoon burst phases; same small orange pumpkin and green stem across active poses.
- **Fire pumpkin:** transparent 4×2 eight-pose source: idle, two green-eye warning frames, firing, hit flash, three burst frames; no projectile baked in.
- **Ghost fireball:** transparent four-frame mint/lime spectral fire loop at 16×16 logical size, distinct from orange boss fireball.
- **Decor:** transparent eight-motif source with three candle flames, two web poses, portrait, lantern, bat; supplemental two-frame bat source has raised/lowered wings and the same plum/yellow identity.

## Character run1 seeds

Each seed generation edited the existing `assets/characters/2026-10-15_<id>-idle-v2.png` as the identity reference and requested a transparent side-by-side comparison, idle left and new right-facing run-contact pose right, feet aligned and proportions unchanged. The imagegen originals were copied to `assets/characters/2026-11-15_<id>-run1-seed-source.png`; the right poses were then mechanically cropped and sized to the height of the shipped idle silhouette inside a 108×96 transparent frame. The resulting `assets/characters/2026-11-15_<id>-run1-seed.png` are review seeds, not integrated game frames.

| Character | Generated original filename | Idle/run opaque height | Identity constraint |
|---|---|---|---|
| Bobo | `exec-b98a5b02-c8e1-4b05-b8ef-73c9e72ab667.png` | 52/52 px | round orange body, cream face, blue headband, brown boots, no mouth or arms |
| Mew | `exec-b0106fd5-9ad9-46e6-9eaf-b40ae57c4684.png` | 86/86 px | golden hair, green eyes, black beret, dark blue blouse, orange skirt |
| Aclaire | `exec-4882672f-6daa-40d2-9eff-7bd3f490d201.png` | 86/86 px | orange side ponytail, blue eyes, pink heart shirt, blue pants, alternating arm swing |

`assets/characters/2026-11-15_motion-seed-preview.png` compares shipped idle and generated run1 at actual 1× frame size and nearest-neighbor 3× enlargement. `assets/haunted/2026-11-15_preview.png` places the environment assets on dark and light backgrounds and includes a grayscale switch-block strip.

Checks: normalized sprite sheets have the required cell dimensions and a fully transparent 2-pixel border (zero occupied border pixels across all six regular sheets); grayscale mean pixel difference between purple and orange active blocks is 44.33/255. Visual inspection confirms moon versus face/square motifs remain different in grayscale. The rail tile's visual seam and all animation timing still need engine integration/QA by the gameplay owner.

Pinz approved all three `run1` seeds on 2026-11-15.

## Full motion source sheets

Built-in imagegen edited each character's approved side-by-side `run1` seed and shipped `idle` sprite as identity references. The production source images are:

| Character | Original generated output | Cleaned source sheet | Preview frame sheet | Source bytes | Frame bytes |
|---|---|---|---|---:|---:|
| Bobo | `exec-115fc251-0680-4076-a150-47274b853971.png` | `assets/characters/2026-11-15_bobo-motion-v2-source.png` | `assets/characters/2026-11-15_bobo-motion-v2-frames.png` | 976603 | 34420 |
| Mew | `exec-cd14f28a-462e-4e44-8407-92a9077725c2.png` | `assets/characters/2026-11-15_mew-motion-v2-source.png` | `assets/characters/2026-11-15_mew-motion-v2-frames.png` | 1238767 | 50403 |
| Aclaire | `exec-e48ff69d-dbfc-4a71-9562-d41e9cf94613.png` | `assets/characters/2026-11-15_aclaire-motion-v2-source.png` | `assets/characters/2026-11-15_aclaire-motion-v2-frames.png` | 1221097 | 52018 |

All originals are under `C:/Users/Nilanull/.codex/generated_images/01a1daaa-7bd2-7e41-89ef-ab4122790153/`. Source copies were cleaned by setting pixels with alpha ≤16 to fully transparent; this removes nearly invisible imagegen residue at cell edges and in the last cell. No pose or opaque pixel was redrawn. The separate frame sheets are **preview/normalization references**, not `js/*-character-art.js` runtime data. Each has 16 cells of 108×96 physical pixels (54×48 logical at density 2) with cell 16 empty. Mechanical normalization uses one scale per character, based on the existing idle silhouette height, and preserves the 2-pixel physical margin. The gameplay owner can choose the final `ax = 32` anchor and pack the frames into the runtime format.

Generation prompt for each character, with the corresponding character name and identity details substituted:

> Use case: game-asset. Input image 1 is the APPROVED [character] idle/run1 seed comparison; input image 2 is the shipped idle sprite. Create a transparent-background 4-by-4 source sprite sheet of the SAME character for Stage 4 Haunted House of the family-friendly 16-bit platformer Coin Quest. EXACTLY 15 full-body frames, with the bottom-right cell completely empty. Every cell is equal sized; one isolated character pose centered in each of the first 15 cells, with wide truly transparent gutters and no figure touching a cell edge. Read left-to-right, top-to-bottom in this EXACT order: row 1 run1, run2, run3, run4; row 2 run5, run6, run7, run8; row 3 jumpUp, jumpApex, jumpFall, land; row 4 dead1, dead2, dead3, EMPTY. The eight run frames form one full contact-down-pass-up cycle for alternating legs, with the feet on the same baseline; run1 must closely match the approved seed. jumpUp stretches with arms/body raised, jumpApex curls slightly, jumpFall extends down, land crouches; dead1 surprised, dead2 dizzy tumbling, dead3 cartoon falling, no injury. Preserve [character identity details]. All poses face RIGHT in the same three-quarter game view; match approved seed palette, crisp pixel clusters, dark plum outlines, three-step shading, and consistent silhouette size. No labels, numbers, grid lines, floor, shadows, effects, weapons, scenery, UI, logo, watermark, clipping, extra characters, or opaque background. This is a source sheet for later mechanical normalization into 54×48 logical frames at density 2; keep large margins.

Character identity details in those prompts: Bobo = round orange creature, cream face, blue headband tails, brown boots, no mouth or arms, short idle scale. Mew = long golden hair, green eyes, black beret, dark blue blouse, pale collar, yellow bow, orange skirt, white socks, brown shoes, idle head width and scale. Aclaire = orange short hair and side ponytail, blue eyes, pink shirt with white heart, blue pants, white/blue sneakers, idle head width and scale, alternating arm swing.

Previews: `assets/characters/2026-11-15_motion-v2-overview.png` shows all 45 poses at 1× alongside the shipped idle frames. Individual `assets/characters/2026-11-15_<id>-motion-v2-preview.png` show every pose at 1× and nearest-neighbor 3× alongside the idle reference.

Validation: for each source sheet, all first 15 slots contain a sprite, the last slot is fully transparent, and every slot has a transparent 2-pixel edge. For each normalized preview, the first 15 slots contain a frame and the last is empty. Eight run-frame hashes are unique per character. Frame sheets retain the shipped idle silhouette height for `run1`: Bobo 52 physical pixels, Mew 86, Aclaire 86. Environment images plus all three frame sheets total **937,350 bytes**, under the 1,000,000-byte art target. This is an asset-size estimate; the exact final runtime packed size and rendered gameplay must be checked after integration. No code, CSS, or HTML files were edited for this handoff.

Remaining: gameplay owner integrates art and validates renderer alignment, rail seam, motion timing, visibility under darkness, browser fallback, and performance. Pinz approved the final image handoff for commit on 2026-11-15, satisfying section 4 of the handoff document.
