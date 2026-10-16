# Browser QA handoff — 2026-10-17

The requested remaining gameplay checks are complete. Normal mode now has actual all-coin completion for all 3 stages × 3 characters at 844×390. Timed mode has a legitimate result for all 9 pairs: natural 120-second expiry or collecting every coin before expiry. This does not mean every timed pair collected every coin.

Evidence combines:

- `2026-10-16_normal-liveplay.md`: earlier normal Grassland/Mew, Forest/Mew and Castle/Aclaire completions.
- `2026-10-16_remaining-liveplay.md`: six additional normal completions and six additional timed results, including Castle/Bobo and Castle/Mew collecting all 45 coins and defeating the boss before expiry.
- `2026-10-15_liveplay.md`: the three earlier timed results (Grassland/Bobo, Forest/Mew, Castle/Aclaire). These retain their original seed/version scope; they were not rerun in this pass.
- `2026-10-16_resolution-final-qa.md`: density=2 visual coverage across five viewports, pixel-equivalence checks and local renderer performance measurements.

Each new successful case includes replay/home checks and no uncaught browser errors. Final screenshots were reviewed. QA reads live game state and sends real keyboard events; simulation only operates on copies to choose inputs. No teleporting, coin grants, HP overrides, timer edits or physics changes were used. Controller failures and incomplete attempts were preserved, then corrected in the QA tooling. In particular, high Grassland death counts are a controller limitation, not evidence about human difficulty or polished ferry navigation.

Artwork remains the approved resolution-only change: original four running frames, proportions and timing; backing resolution 108×96 with logical frame 54×48. This gameplay QA pass changed tooling and documentation only.

## Still outstanding

- Actual iOS/Android hardware testing, including multitouch, rotation, notch/gesture areas and background/resume behavior. Use `2026-10-16_real-device-checklist.md`; all device-result fields remain unverified.

Checkpoint follow-up: direct diff review, fresh checks and the exact file selection are documented in `2026-10-17_commit-review.md`. The checkpoint identity is available in Git history. Intermediate captures and rejected experimental art remain local; no push, merge or deployment is included.

Scope limits: representative deterministic seeds and one live-play viewport; not every seed, hardware configuration or minigame ending for every character. Browser emulation and local RAF measurements do not prove physical-phone performance.

Final audit: all 12 remaining-case records have valid completion conditions, replay/home success, zero browser errors and an existing final screenshot; the outer browser summary also has zero errors. Syntax checks passed for the three touched QA scripts, and `git diff --check` passed with line-ending notices only.

### Physical-device follow-up — 2026-10-17

พินรายงานผลทดสอบ https://phuwiny.github.io/boss-game/ บน Samsung Galaxy A26 5G, OneUI 8.5, Chrome 155.0.8059.81 วันที่ 17/10/2026: ผ่านทุกข้อที่ทดสอบได้ใน checklist (7 ข้อ) รวม multitouch, rotation, setting persistence, background/resume และ result/replay/home ส่วน fullscreen ไม่ได้ทดสอบเพราะไม่มีตัวเลือกให้เปิด ไม่ถือเป็น failure หรือหลักฐานว่า browser ไม่รองรับ

รายละเอียด: `.logs/2026-10-16_real-device-checklist.md` ผลนี้เป็นรายงานของผู้ใช้บนอุปกรณ์จริงหนึ่งเครื่อง ไม่ใช่การตรวจโดย agent และยังไม่ยืนยัน commit/build ที่ GitHub Pages ให้บริการขณะทดสอบ จึงยังไม่ผูกผลกับ commit ของ Draft Release v2.0.0 โดยอัตโนมัติ การทดสอบ iOS และ fullscreen ยังไม่มีผลยืนยัน
