# Coin Quest — รายงานตรวจภาพและมือถือ

วันที่ 2026-10-13 · Branch `codex/visual-mobile-refresh` · Base `ca9f362`

## ผลส่งมอบ

หน้าแรกธีมผจญภัย 16-bit พร้อมภาพสองด่าน เมนูที่รองรับจอแนวตั้ง/แนวนอน วิธีเล่นแบบเปิด/ปิดได้ ปุ่มสัมผัสสองขนาดพร้อมจำค่า HUD มือถือแบบย่อ และการตั้งค่าเสียง/เพลง/เต็มจอใน pause ใช้โค้ดและกติกาเกมเดิมเป็นฐาน

## Environment และวิธีทดสอบ

- Installed Chrome แบบ headless ผ่าน Playwright ใน bundled Node.js; local HTTP server อยู่ process เดียวกับ QA
- ขอและได้รับ escalation สำหรับ browser/local networking หลัง sandbox บล็อก 127.0.0.1
- อ่าน `playwright-interactive` แล้ว แต่ persistent Node REPL โหลด module ไม่สำเร็จ (export error / EPERM) จึงใช้ regular Playwright scripts แทน ไม่ได้อ้างว่าใช้ interactive skill runtime สำเร็จ
- Browser contexts ใหม่สำหรับแต่ละขนาดจอ, touch emulation และ CDP multi-touch input ใช้ทดสอบการกดจริงใน browser; read-only `CQ.debug` ใช้ตรวจผล
- การจัด state ใช้เฉพาะ dense HUD และ baseline result และระบุไว้แยกจากการเล่นจริง

## ผลตรวจอัตโนมัติ

| ตรวจ | ผล |
|---|---|
| `node tools/2026-10-13_check-ui-settings.js` | PASS 4/4; ค่า valid/invalid, reload, storage ใช้ไม่ได้, ไม่เปลี่ยน record key เดิม |
| `node tools/2026-10-13_check-input.js` | PASS; jump/reset/blur, Space บน native setting, Escape ออกจาก menu |
| `node tools/check-rps.js` | PASS 7/7 รวม AI simulation 2,000 เกม |
| `node --check` ไฟล์ JavaScript ที่เปลี่ยนและไฟล์ QA ใหม่ | PASS |
| `git diff --check` | PASS; Git มีเพียงข้อความแจ้งการแปลง LF/CRLF |
| `browser-qa.cjs final` | PASS ทั้ง 5 viewports, uncaught page errors = 0 |
| `browser-qa.cjs extended` | PASS fallback, dense records/insets, frame samples และ timed play จริง |
| `browser-qa.cjs resilience` | PASS หลังแก้รูปโหลดผิดพลาด + แถบลอยตัว Mew |

หลักฐาน machine-readable: `2026-10-13_final-browser.json`, `2026-10-13_extended-browser.json`, `2026-10-13_resilience-browser.json` ในโฟลเดอร์นี้

## Functional และ visual coverage

| Viewport | ผล |
|---|---|
| 360×640 | title/character selection, ปุ่มเริ่มทั้งสองโหมดในจอ, gameplay, pause, RPS, controls ทั้งสองขนาด ผ่าน |
| 390×844 | หน้าจอแนวตั้ง, Forest art, persist/reload, touch interaction ผ่าน |
| 640×360 | จอแนวนอนเตี้ย, dense HUD, ปุ่ม large, pause, RPS action buttons ผ่าน |
| 844×390 | landscape layout, Mew float และ timed result ผ่าน |
| 1366×768 | desktop menu, keyboard, HUD และ fullscreen เข้า/ออก ผ่าน |

- เลือกทั้งสองด่านและ reload แล้วคงค่า; hero ตรงกับด่านที่เลือก
- เข้า normal ด้วยตัวละครทั้งสาม, timed ด้วย Grassland, ตรวจ Mew air jump/float และค่า guard ของ Aclaire
- เปลี่ยนขนาดปุ่ม standard/large, reload, เปิด/ปิด/เปิดเสียงและเพลง โดยปุ่มสองตำแหน่งแสดงสถานะตรงกัน
- สัมผัสเดินพร้อมกระโดด, ลากจากขวาไปซ้าย, touch cancel, หมุน viewport ขณะกด และซ่อน controls เมื่ออยู่ใน overlay ผ่าน
- Pause หยุดเวลา, resume, restart, retry และ home ใช้งานได้
- วิธีเล่นเปิด/ปิดได้; native radio ใช้ Space ได้โดยไม่สั่งเกม; reduced motion ปิด animation ของ card
- จำลองภาพและฟอนต์โหลดไม่ได้ รวมถึง storage get/set โยน exception: ยังเลือกและเริ่มเกมได้ ไม่มี broken-image icon หลังแก้ fallback
- ตรวจจอที่มีสถิติเก่าและ safe insets จำลองซ้าย/ขวา 24 px พร้อมปุ่ม large

Visual review ตรวจ screenshots ของหน้าแรก desktop/portrait/landscape, Forest, picker, pause, dense HUD, Mew float, fallback, records, RPS และ result แยกจาก functional assertions ไม่พบปุ่มเริ่มหลุด initial viewport, HUD ชนปุ่ม pause, controls ทับกัน หรือข้อความหลักถูกตัดในสถานะที่ตรวจแล้ว Character picker และรายละเอียดวิธีเล่นอนุญาตให้เลื่อนใน card ได้

## การเล่นจบจริงและ frame timing

- เล่นโหมด timed ด้วย Mew ผ่าน keyboard direction/jump พร้อม pause/resume จนครบ **120 วินาที**: **17 เหรียญ, พลาด 3 ครั้ง**
- ใช้เวลาสำรวจ/ทดสอบรอบนี้ 123.957 วินาที กด retry และ home ต่อจนยืนยัน state ถูกต้อง ไม่แก้ game state เพื่อให้จบ
- Same Chrome/host/1366×768, 120 requestAnimationFrame samples: baseline median **6.9 ms**, p95 **7.2 ms**; updated median **7.0 ms**, p95 **7.2 ms** เป็น browser-host sample ไม่ใช่ผล FPS บนโทรศัพท์จริง

## ข้อบกพร่องที่พบและแก้

1. การปรับ layout เมื่อ first touch ซ้ำล้างนิ้วเดินใน multi-touch — ไม่ resize ซ้ำเมื่ออยู่ใน touch mode แล้ว
2. Deferred default focus แย่ง focus จาก radio ที่ผู้เล่นเพิ่งเลือก — เคารพ focus ที่อยู่ในหน้าปัจจุบัน
3. กลับจากเมนูหลังเลื่อนแล้ว title ค้างตำแหน่งเลื่อน — reset card scroll เมื่อเปลี่ยนหน้าจอ
4. Global key handler แย่ง Space จาก native controls และข้าม Escape — ปล่อย native keys และคง Escape เป็น menu shortcut
5. CSS specificity ทำให้ touch controls ยังแสดงหลัง pause overlay — เพิ่ม selector ให้ซ่อนจริง
6. RPS จอแนวนอนเตี้ยดัน action buttons ลงนอก initial viewport — ใช้ fighter/card grid พร้อม bounds assertion
7. ภาพที่ล้มเหลวก่อน error listener ติดตั้งแสดง broken-image icon — ตรวจ complete/naturalWidth ตอนเริ่มด้วย

## ข้อจำกัดและการส่งต่อ

- ยังไม่ได้ทดสอบ Safari iOS/Android Chrome, notch/browser toolbar หรือพักแอปบนอุปกรณ์จริง รวมถึง gamepad จริง
- Blur/reset มี unit check; ไม่อ้างว่าทดสอบ OS app switching จริง
- Independent reviewer ถูกเรียกตาม skill แล้ว แต่หยุดด้วย usage limit; มินติตรวจ diff โดยตรงแทน
- ไม่มีการเปลี่ยน physics/levels/spawning/stats จึงไม่รันตัวจำลอง reachability ทั้งปีซ้ำ
- เก็บต้นฉบับ PNG และ WebP ใน `assets/`; prompts อยู่ใน `2026-10-13_imagegen.md`
- Browser QA sessions ปิดแล้ว; local preview ที่ `http://127.0.0.1:8001` ตั้งใจเปิดค้างให้พินลองเล่น (process session 54378)
- ยังไม่ commit, merge, push หรือ publish; source และ log อยู่ใน repo ตามคำขอ
