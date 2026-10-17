# Game manual: character portraits

- Updated `MANUAL.md` with Bobo, Mew and Aclaire portraits in the character section. Mew uses `2026-10-17_mew-memory-portrait-v2.png`, with forward gaze and a small open smile.
- Updated the version note to distinguish published v1.0 from v1.1 pre-release and described the Stage 1 Grassland backdrop.
- Added limited portrait image Markdown support to `js/manual.js` and responsive styling to `css/manual.css` so the same images display in `manual.html`.
- For the v1.1.1 PR, switched Memory Match's Mew card to the new portrait while retaining the sprite fallback.
- Checks: Node syntax check and `git diff --check` passed. A Node renderer check found all three portrait images in order with alt text.
- An initial browser check could not connect to the local test server. A later offline Chrome render of the manual decoded all three portraits and captured `2026-10-17_manual-portraits-qa.png`.
