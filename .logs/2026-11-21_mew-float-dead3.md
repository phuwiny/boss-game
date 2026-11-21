# Mew float and dead3 proposal

Status: Artwork handoff complete. Pinz requested artwork only; Claude owns integration. Visual approval of the new poses remains pending.

Two new PNGs: `assets/characters/2026-11-21_mew-float.png` and `2026-11-21_mew-dead3.png`. Review: `2026-11-21_mew-float-dead3-preview.png`. Both are 108x96, density 2, logical 54x48, anchor ax=32, binary alpha, at least 2px transparent border. Shared scaling uses the existing 86px Idle silhouette as calibration; local anatomy still requires visual review.

Imagegen used the approved `2026-11-15_mew-motion-v2-source.png`. Prompt: three equal cells, original jumpUp as scale reference, new upright floating pose with arms outward/loose knees/hair lifting, new gently backward-leaning cartoon defeat fall with closed eyes; preserve black beret, golden hair, green eyes, blue blouse, orange skirt, white socks, brown shoes and head/body scale. No scenery or effects. Generated original: `C:/Users/Nilanull/.codex/generated_images/01a16c7c-9c65-7013-8086-e51d6bfb8df0/exec-bf7da75d-40e3-4ebc-a064-80e596aa9ea6.png`, copied into the project as dated source. Normalization is reproducible with `tools/2026-11-21_normalize-mew-poses.py`.

Important checkout mismatch: primary boss-game checkout is on claude/trusting-brahmagupta-ga1msg and uses old jump/fall/dead poses. The user's cited jumpApex/dead3 renderer is in `C:/Users/Nilanull/.codex/worktrees/stage4-art-integration/boss-game`. Per user clarification, deliver artwork under primary boss-game assets for Claude to integrate into the intended checkout. Existing index.html edits and unrelated untracked files were preserved.

No jumpUp/jumpApex/jumpFall, old motion sheet or runtime file has been modified. Integration must route Mew floating to a per-character float frame with jumpApex fallback for missing float, and replace only Mew dead3 cell. Global pose entries alone do not prove every character has a float image.

Checks: normalization assertions PASS. Existing target checkout character-art QA PASS (27 raster frames and Stage 4 manifest geometry). Visual QA PASS, exit 0: stages 1–3 pixel-identical to baseline, Haunted House assets/fallback/responsive checks passed at five viewport sizes. This is baseline verification, not validation of an integrated revision. Used bundled Node/Playwright and installed its required Chromium headless shell. Screenshots are in `.logs/2026-11-21_mew-baseline-qa/`.
