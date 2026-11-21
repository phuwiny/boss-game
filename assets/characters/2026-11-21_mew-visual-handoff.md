# Mew — float and dead3 artwork handoff to Claude

User scope: artwork only; Claude integrates code. Visual proposal awaits review in context.

## Assets

- `2026-11-21_mew-float.png`: new standalone float frame, distinct from jumpApex.
- `2026-11-21_mew-dead3.png`: standalone replacement defeat frame.
- `2026-11-21_mew-motion-v2-dead3-frames.png`: copy of approved 432x384 motion sheet with only dead3 replaced. Cell index 14, zero-based column 2 / row 3, rectangle x=216 y=288 w=108 h=96. All other 15 cells, including empty final slot and all jumping poses, are byte-identical to the old sheet.
- `2026-11-21_mew-float-dead3-preview.png`: Idle, unchanged jumpApex, new float, old dead3, new dead3 at physical 1x and enlarged 2x.
- `2026-11-21_mew-float-dead3-source.png`: imagegen original; first pose is scale calibration only, not a replacement for jumpUp.
- `2026-11-21_mew-float-dead3-metrics.json`: normalization dimensions and bounds.

## Locked contract

54x48 logical, density 2, 108x96 physical, ax=32 logical (64 physical). Binary transparency and minimum 2px transparent border. Shared scaling calibrated to existing Idle height; do not resize each pose independently. No running/jumping production frame was changed.

## Integration

Route Mew's floating state to its own float image. Use jumpApex when the character has no float image, retaining the existing legacy fallback when v2 is unavailable. Check per-character image availability, not merely a global pose name. Do not replace jumpApex or add float globally to all sheets as though each had an extra frame.

Point only Mew's motion sheet to the dated dead3 revision, or copy the supplied dead3 into cell 14. Preserve existing death timing: dead3 begins at t >= 0.6s. This requires no death-state timing changes.

## Validation and review

Artwork normalization and unchanged-cell assertions PASS. Existing stage4-art-integration checkout passed `node tools/2026-10-15_check-character-art.cjs` and `node tools/2026-10-22_qa-haunted.cjs visual` before integration. These are baseline results; Claude must rerun both after wiring the new assets and inspect float fallback, death timing and character proportions in-game. No runtime files were edited for this delivery.
