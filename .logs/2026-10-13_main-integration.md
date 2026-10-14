# Main integration — 2026-10-13

## Scope and recovery

- User requested combining the pulled main with the existing visual/mobile work and adding a scene/character visual plan.
- Original feature HEAD: ca9f362; local main and origin/main at integration: 0e6c593 (PR #20).
- Saved all existing tracked/new work with stash 8d2b6f2fb8c63e28c38aa5600332edc528fd76f5, message `2026-10-13_visual-mobile-before-main-integration`. Kept the stash after applying as a recovery copy; do not reapply onto this already-integrated tree.
- Fast-forwarded codex/visual-mobile-refresh to main, applied stash, and resolved index.html / js/main.js conflicts. No commit, push or deployment.

## Resolution decisions

- Kept Castle stage, boss shooting/HP, dynamic coin descriptions, Rain/Memory screens, visiblePrimary focus lookup, renderer mobile camera/bottomInset and manual link from main.
- Retained visual menu, preferences, safe focus/input reset and pause toggles from existing work.
- Three stage cards; Castle menu has a deliberate CSS background until art is approved, avoiding a missing castle-menu image request.
- Boss fire button stacks above jump on narrow portrait screens so large touch controls do not overlap movement buttons.
- PLAN.md now distinguishes historical QA from integration and proposes V1–V4 for concept approval, scenes, character frames and regression. No new gameplay artwork implemented.

## QA inventory and evidence

- JavaScript syntax for every js/*.js: PASS.
- UI settings 4/4, input reset/native keyboard handling: PASS.
- Current main rule checks: RPS 10/10, Rain 10/10, Memory 8/8: PASS.
- Integration browser runner covers title/characters/pause/RPS entry; both normal/timed modes on all three stages; Rain start/pause/resume/exit; Memory level/card interaction/exit; manual navigation; large Boss controls bounds and overlap.
- Browser uses the previously documented regular Playwright fallback with bundled Node and installed Chrome. Sandbox localhost denied; rerun with approved escalation.
- First browser attempt exposed an ambiguous test selector (`summary` matched title and RPS). Scoped it to #screen-title; product behavior was not changed for this test issue.
- Runtime/screenshots: `.logs/2026-10-13_integration-browser.json` and `.logs/2026-10-13_screenshots/integration-*` (see final result appended below).
- Phone hardware, gamepad, complete Boss victory, full minigame completion and a full 120-second run have not been re-tested in this integration pass. Rule tests cover minigame logic; browser checks are smoke checks, not full completion claims.

## Final integration result

- Browser smoke matrix PASS: 360×640, 390×844, 640×360, 844×390, 1366×768; zero uncaught page errors in all five contexts.
- Reviewed generated Castle title/game screenshots in narrow portrait and landscape; primary mode buttons and large Boss controls remain visible. Castle art is a placeholder gradient pending visual plan approval.
- git diff --check and git diff --cached --check: PASS; no unmerged entries; main is an ancestor of HEAD.
- Preview server stopped after QA. Historical log preview references describe the earlier run, not an active server.
