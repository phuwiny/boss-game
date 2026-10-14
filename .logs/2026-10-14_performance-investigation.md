# Renderer frame-time investigation — 2026-10-14

Question: does the scene-detail refresh regress renderer frame-time by more than 20% versus main 0e6c593 on the same host/browser?

## Diagnosis and protocol

The earlier microbenchmark repeatedly submitted hundreds of canvas renders in one JavaScript task. It timed command submission and intermittent browser/GPU queue stalls, not presented-frame cadence. Its p95 varied between stages/runs and is not sufficient evidence of a gameplay frame-rate regression.

Added tools/2026-10-14_qa-performance.cjs, launched through the existing local Chrome runner with `performance 640x360`.

- Load reference Renderer from Git HEAD without touching game files or changing branches.
- Enter each stage and pause simulation using UI. Preserve the same game object, camera, viewport, canvas, DPR and fixed render time for both versions.
- Suppress the live draw callback only while the QA harness owns the canvas; restore in finally. No product code change.
- Reference has its own tile/layer caches built from the same level. Both versions use the current sprite implementation: this comparison isolates scene rendering, not sprite build cost.
- Draw once per requestAnimationFrame. Record frame intervals and CPU submission duration separately.
- Three rounds per stage, alternating baseline/updated order; 20 warmup frames plus 120 measured frames per version/round.
- Report every round. Require EVERY round's updated/baseline p95 frame-interval ratio to stay within the plan's 1.20 threshold; report median and worst ratios. All raw rounds remain in the JSON.
- This is desktop Chrome mobile-viewport emulation. It cannot establish physical phone GPU performance or worst-case Boss combat frame rate.

## Result

PASS: all 9 stage/round comparisons within +20%; zero uncaught browser errors. Stored raw run: .logs/2026-10-13_performance-browser.json; validated result with worst ratios: .logs/2026-10-14_performance-results.json.

| Scene | Baseline p95 range (ms) | Updated p95 range (ms) | Worst ratio |
|---|---:|---:|---:|
| Grassland | 7.1 | 7.1–7.2 | 1.0141 |
| Forest | 7.1–7.2 | 7.1–7.2 | 1.0000 |
| Castle | 7.1–7.6 | 7.1–7.2 | 1.0141 |

No runtime optimization was justified by this evidence. The earlier unpaced submission timing was not a valid proxy for frame cadence; exact attribution of its stalls to GPU or scheduler is not proven. Current results resolve the scoped performance gate for the measured start-of-stage states only. They do not certify worst-case combat or physical devices.

Syntax and git diff --check passed. Existing gameplay code and artwork unchanged by this follow-up. QA browser/server closed normally. No commit/push.
