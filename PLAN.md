# Coin Quest — Visual & Mobile Experience Plan

## งานใหม่ 2026-10-17 — Memory portraits และภาพ Stage 1

ขอบเขต: ใช้ภาพอ้างอิงตัวละครที่อนุมัติแล้วสร้าง portrait โปร่งใสเฉพาะการ์ด Memory Match; คง sprite และ animation ระหว่างเล่นตามชุดเดิมที่พินขอรักษาไว้ ปรับกราฟิก Grassland ใน renderer โดยไม่เปลี่ยน collision, spawn, physics, จำนวนเหรียญ หรือฉาก Forest/Castle

- [x] เก็บภาพ Stage 1 เดิมและรายการตรวจ QA ใน `.logs/2026-10-17_portrait-stage1-qa.md`
- [x] สร้าง portrait Bobo/Mew/Aclaire แยกไฟล์ 256×256 แบบโปร่งใสและรักษาเอกลักษณ์ใบหน้า
- [x] ใช้ portrait บนการ์ด Memory พร้อม fallback เป็น sprite เดิมเมื่อโหลดภาพไม่สำเร็จ
- [x] เพิ่มมิติฉากหลัง Grassland และปรับต้นไม้/สีพื้นโดยคงข้อมูลด่านเดิม
- [x] ตรวจใน browser ทั้ง desktop/mobile, การหงาย/จับคู่การ์ด, ภาพหาย, Stage 1 ขณะเล่น และ regression test; บันทึกหลักฐานและขอบเขตที่ยังไม่ได้ตรวจใน log

ภาพใช้ imagegen built-in จาก `assets/concepts/2026-10-14_character-lineup-final.png` เป็น style/identity reference. แนวทางการเขียน prompt และตรวจ alpha อ้างอิง OpenAI Docs เรื่อง image prompting และ image generation. งานนี้ไม่รวมการแก้ 9 ท่าเดิมของตัวละคร

วันที่: 2026-10-13 · อัปเดต 2026-10-17 · สถานะ: **ภาพละเอียดขึ้นและท่าวิ่งเดิมผ่าน QA ห้าขนาดจอ; gameplay matrix บน Chrome ครบแล้ว เหลือตรวจอุปกรณ์จริง**

## ขอบเขตที่พินอนุมัติเพิ่ม — 2026-10-15

**ปรับขอบเขตล่าสุด 2026-10-16:** พินยกเลิกการเปลี่ยนท่าวิ่งหลังพบสัดส่วนของชุดทดลองผิดไป ใช้ภาพ source ชุดเดิม 9 ท่าต่อตัว (วิ่ง 4 เฟรม) และจังหวะเดิม เพิ่มเฉพาะความละเอียดจาก 54×48 เป็น backing pixels 108×96 โดยคง logical frame 54×48 และ anchor เดิม ไม่ใช้ภาพ `run-v2-source` หรือ run5–8 ในเกม ตรวจเทียบขอบเขตภาพกับข้อมูล v1 พร้อม QA แยกใน `.logs/2026-10-16_resolution-only.md`

- [x] ตรวจภาพ density=2 ครบห้าขนาดจอหลังพินรับภาพ: shared portraits, Castle crossfire และ art-load fallback ครบสามตัว; ไม่มี uncaught errors ดู `.logs/2026-10-16_resolution-final-qa.md`
- [x] เทียบความลื่น density=1/2 ด้วย renderer เดียวกัน: แก้ต้นทุนสร้างแคชภาพ แล้วผล RAF p95 ผ่านเกณฑ์ +20% ครบสามฉาก × สามรอบ (Chrome เครื่องนี้ ไม่ใช่มือถือจริง)

งาน V3 เดิมด้านล่างเป็นการปรับ procedural sprite และมีผลตรวจของรุ่นนั้นเท่านั้น ยังไม่ถือว่าภาพตรง concept ที่อนุมัติ พินอนุมัติให้ทำภาพจริงตามลำดับต่อไปนี้แล้ว:

- [x] V3.1 พินอนุมัติ seed pose ทั้งสามตัวใน `assets/concepts/2026-10-15_character-seeds-v1.png` หลังตรวจหน้าเทียบ concept และตัวอย่างขนาดเล็ก
- [x] V3.2 สร้างภาพชุด 9 ท่าต่อตัวด้วย imagegen แล้ว normalize ด้วยสเกลร่วมกันต่อตัว; ภาพ preview และ PNG ครบ 27 เฟรมอยู่ใน `assets/characters/`
- [x] V3.3 โหลดข้อมูลพิกเซลที่สร้างจากภาพผ่าน `js/2026-10-15_character-art.js` ใช้ API frame เดิมทุกหน้า พร้อม procedural fallback; ไม่เปลี่ยน hitbox/ค่าการเล่น
- [x] V3.4 ตรวจภาพร่วมกันห้าขนาดจอ, 18 stage/character/mode smoke cases, Castle crossfire 15 กรณี, fallback ครบสามตัว และภาพซ้าย/ขวา 216 ช่อง; แก้สีดาวไม่ให้เปลี่ยนผม Mew แล้วตรวจเอฟเฟกต์ซ้ำสองแนวจอ ดู `.logs/2026-10-15_character-concept-rebuild.md` (ไม่ใช่เล่นครบทุกด่าน)

ต้องคง Bobo ไม่มีปาก, Mew ตาเขียว, Aclaire ตาฟ้า ใช้ภาพ raster โปร่งใสตาม concept เป็นเป้าหมายใหม่; ข้อเสนอเดิมที่จำกัดเฉพาะ procedural sprite ถูกแทนที่สำหรับงานตัวละครรอบนี้ ผล QA เก่ายังเก็บไว้เป็นหลักฐานของรุ่นเดิม ไม่ใช้รับรองภาพใหม่ล่วงหน้า

## อัปเดตหลังรวม main — 2026-10-13

ฐานที่รวมจาก main คือ `0e6c593` (PR #20) รวมเข้า `codex/visual-mobile-refresh` แบบ fast-forward แล้วนำงานภาพเดิมกลับมารวม โดยมี stash สำรอง; บันทึก checkpoint `df3faff` แล้ววันที่ 2026-10-15 ยังไม่ push งาน QA หลัง checkpoint อยู่ใน working tree

เวอร์ชันล่าสุดมี **Grassland, Forest, Castle/Boss Stage**, ระบบยิงและ HP, RPS, Coin Rain, Memory Match และ `manual.html` จึงต้องครอบคลุมสิ่งเหล่านี้ในการทำภาพรอบใหม่ ส่วน checklist และผล QA ในหัวข้อ 1–7 ด้านล่างเป็นประวัติงานบนฐานเก่า `ca9f362` ไม่ใช่หลักฐานว่าฟีเจอร์ใหม่ผ่าน QA แล้ว ดูผลรวมเวอร์ชันใน `.logs/2026-10-13_main-integration.md`

### Design brief รอบต่อไป — ร่างเพื่อพินตรวจ

เป้าหมาย: ให้ฉากและตัวละครระหว่างเล่นเข้าชุดกับเมนู 16-bit adventure อ่านง่ายบนมือถือ และยังแยกพื้นยืน อันตราย เหรียญ และกระสุนได้ทันที คงรูปแบบการเล่น สถิติ ความสามารถ hitbox ระยะยิง และตำแหน่งเกิดเดิม

เสนอ **คง Canvas renderer และ procedural sprites เดิม** แล้วปรับ palette, silhouette และรายละเอียดผ่านโค้ด ใช้ imagegen สร้าง concept/reference และภาพเมนู Castle ก่อน หากภายหลังเลือกใช้ sprite atlas ให้แยกเป็นงานเพิ่มเติม เพราะต้องทำ loader, frame metadata และ fallback ใหม่

| ส่วน | ทิศทางที่เสนอ | สิ่งที่ต้องอ่านออกระหว่างเล่น |
|---|---|---|
| Grassland | ฟ้าสว่าง หญ้าเขียวอุ่น ดินน้ำตาล เนินหลังสีอ่อน | ขอบพื้นชัด เหรียญทองไม่กลืนฟ้า/หญ้า |
| Forest | เขียวอมฟ้า แสงลอดเรือนยอด ไม้/รากสีอุ่น ลดรายละเอียดด้านหลัง | เงามืดไม่กลืนตัวละคร หนามและหมูป่าแยกจากพุ่มไม้ |
| Castle/Boss | หินม่วงเทา แสงคบเพลิงส้ม ฉากหลังเข้ม | แยกกระสุนผู้เล่น/บอส สัญญาณโจมตี พื้นปลอดภัย และ HP |
| Bobo | คงตัวกลมสีส้ม เพิ่มแสงเงาและรูปหน้าที่อ่านง่าย | silhouette กลมและทิศหันชัด |
| Mew | คงเอกลักษณ์สาวน้อยโทนน้ำเงิน/ส้ม ให้ท่าลอยตัวชัด | ท่ากระโดด/ตก ปีก และกระสุนลมไม่กลืนฉาก |
| Aclaire | คงเอกลักษณ์นักกีฬาโทนชมพู/น้ำเงิน เสริมท่าวิ่ง | ท่าทางคล่องตัว สถานะ guard และกระสุนไฟชัด |

พินให้ดำเนินการต่อหลังเห็น concept และแก้รายละเอียดวันที่ 2026-10-14: Bobo ไม่มีปาก, Aclaire ตาสีฟ้าทั้งสองข้าง ส่วน Mew คงตาสีเขียว ใช้ `assets/concepts/2026-10-14_character-lineup-final.png` เป็น reference ล่าสุด ไม่ดึง Aclaire redesign จาก branch อื่นมาใช้

### V1 — ล็อกภาพอ้างอิงและงบ asset

**Files:** `.logs/YYYY-MM-DD_visual-art-direction.md`, `assets/YYYY-MM-DD_castle-menu.webp`, concept files ชื่อวันที่

- [x] เก็บภาพฉาก/ตัวละครจาก main ที่รวมแล้ว ทั้ง desktop และ 360×640/640×360 เป็น baseline ใหม่
- [x] ใช้ imagegen ทำ concept ฉากทั้งสามและ lineup ตัวละคร โดยอ้างอิงภาพเกมจริง กำหนดสี/มุมกล้อง/สัดส่วนเดิม ไม่มีข้อความฝังในภาพ
- [x] ให้พินตรวจ lineup และภาพ Castle ก่อนนำไปทำ production; บันทึก prompt/reference/ข้อเสนอที่เลือกใน log
- [x] Castle menu ใช้ WebP ไม่เกิน 400 KB; concept ต้นฉบับไม่โหลดใน runtime; ตรวจ URL และ fallback เมื่อโหลดล้มเหลว

**ตรวจรับ:** ภาพอ้างอิงอนุมัติครบทุกตัว/ฉาก พร้อม palette และรายการสิ่งที่ต้องคงเดิม Castle ใช้ `assets/2026-10-14_castle-menu.webp` (89,438 bytes) พร้อมพื้นสี fallback

### V2 — เปลี่ยนภาพฉากทีละฉาก

**Files:** `js/render.js`, `css/style.css`, `js/main.js` เฉพาะการเลือกภาพเมนู; อ่าน `js/level.js`, `js/stage-castle.js` เป็นข้อจำกัด geometry

- [x] ปรับ Grassland ก่อน แล้ว Forest และ Castle ตาม concept ที่อนุมัติ: background layers, tile surfaces, decorations และสีแสง
- [x] คง API `renderer.setLevel(lv, theme)`, camera และ touch bottom inset เดิม; ห้ามเปลี่ยน tile collision หรือ spawn เพื่อแก้ปัญหาภาพ
- [x] ตรวจภาพตัวอย่างชนิดพื้นและ moving platforms รวมศัตรู/หนาม/ธง/ไอเทมที่มีในทั้งสามฉาก ผ่าน camera fixtures 34 จุด; ไม่ใช่การตรวจทุกตำแหน่งหรือการเล่นผ่านอุปสรรคจริง
- [x] ตรวจ Castle ขณะมีบอส กระสุนผู้เล่นทั้งสามชนิด HP และปุ่มยิงขนาดใหญ่พร้อมกัน ทั้งแนวตั้ง/แนวนอน รวม 15 character/viewport cases
- [x] บันทึก before/after ทีละฉากและผล frame-time ด้วย viewport/seed/state เดียวกัน

**ตรวจรับ:** ทั้งสามฉากผ่านเกมจริง normal/timed ไม่มี artwork บังขอบพื้นหรือเส้นทาง; p95 frame-time ไม่เกิน baseline ใหม่ +20% บนเครื่องเดียวกัน หากเกินต้องลดรายละเอียดแล้วตรวจซ้ำ

### V3 — ตัวละครและ animation

**Files:** `js/sprites.js`, `js/render.js`; อ่าน `js/characters.js`, `js/world.js`, `js/boss.js` แต่ไม่เปลี่ยนค่าการเล่น

**Interface ที่ต้องคง:** `CQ.Sprites.build(id, poseName, hue)` คืน `{w,h,ax,px}`; `CQ.Sprites.paint(ctx,f,x,y,z)`; `CQ.Sprites.wing(i)`; frame ปัจจุบัน 54×48, anchor x=32 และเท้าขอบล่าง คงค่าเหล่านี้เพื่อไม่ให้เกิดการลอย/กระตุกระหว่างเฟรม

- [x] ปรับทีละตัว Bobo → Mew → Aclaire ตาม lineup ที่อนุมัติ ครบ idle, blink, run1–4, jump, fall, dead
- [x] ตรวจซ้าย/ขวาทุก pose และตัวอย่าง hue ดาว 0/120/240; contact sheet 216 ช่องอยู่ใน `.logs/2026-10-15_visual-followup/` (ไม่ใช่การตรวจทุกเฉดระหว่าง animation)
- [x] รักษาปีก ท่าลอยตัว guard/อมตะ และการยิงแสง/ลม/ไฟให้มองออก โดยไม่เปลี่ยน cooldown/damage/physics; หลักฐาน 2026-10-14 boss-special และ 2026-10-15 remaining-qa
- [x] ตรวจภาพเดียวกันใน character picker, title preview, RPS, Coin Rain และ Memory Match ที่ใช้ภาพตัวละครร่วมกัน; Memory ใช้ deck fixture ให้มีตัวละครครบ
- [x] เพิ่ม Node checks เฉพาะ contract ของ frame: จำนวน pixel = w×h, anchor อยู่ใน frame, pose ทุกตัวสร้างได้, สีโปร่งใสและ hue ทำงาน; ไม่ใช้ test แทนการตรวจภาพ

**ตรวจรับ:** ภาพทั้งสามตัวได้รับการตรวจที่ขนาดแสดงจริงและ contact sheet; ไม่มีเท้าเลื่อน/ภาพตัดขอบ; ความสามารถและการยิงทำงานเหมือนฐาน main

### V4 — รวมภาพและตรวจ regression

**Files:** `tools/2026-10-13_qa-integration.cjs`, เครื่องมือ QA ที่เกี่ยวข้อง, `README.md`, `MANUAL.md` เฉพาะภาพ/คำอธิบายที่เปลี่ยน, `.logs/YYYY-MM-DD_visual-gameplay-qa.md`

- [x] รัน syntax และ unit checks ของ input/settings/RPS/Rain/Memory รวม frame contract ใหม่
- [x] เล่นทั้งสามฉาก สองโหมด และสามตัวละครบน Chrome: โหมดปกติเก็บครบทุกคู่ ส่วนจับเวลาจบด้วยเก็บครบหรือหมดเวลา; Boss ยิง/โดนโจมตี/แพ้/ชนะและมินิเกมครบสามเกมมีหลักฐานแยกตามรายการด้านล่าง ไม่ใช่ทุก seed/อุปกรณ์/ผลลัพธ์ของมินิเกมทุกตัวละคร
- [x] เล่นโหมดปกติจบจริงครบ 3 ฉาก × 3 ตัวละครที่ 844×390 รวมผลเดิมและอีก 6 คู่ใน `.logs/2026-10-16_remaining-liveplay.md`; Castle ปราบบอสครบทั้งสามตัว พร้อม result/replay/home และไม่มี uncaught errors (หนึ่ง seed ต่อคู่ ไม่ใช่ทุก seed หรืออุปกรณ์จริง)
- [x] โหมดจับเวลาอีก 6 คู่ผ่าน: Grassland/Mew 58 เหรียญ, Grassland/Aclaire 38, Forest/Bobo 46, Forest/Aclaire 66 จบเมื่อครบ 120 วินาที; Castle/Bobo และ Castle/Mew เก็บครบ 45/45 ก่อนหมดเวลา รวมกับผลเดิมครบ 9 คู่ รายงานสรุป `.logs/2026-10-17_browser-qa-handoff.md`
- [x] เล่น Grassland/Mew โหมดปกติจบจริง 40/40 เหรียญใน 97.27 วินาที พลาดหนึ่งครั้ง พร้อม replay/home ที่ 844×390; ไม่แก้สถานะเกมและไม่มี uncaught errors รายงาน `.logs/2026-10-16_normal-liveplay.md` (ยังไม่ครบทุกคู่ด่าน/ตัวละคร)
- [x] เล่น Forest/Mew โหมดปกติจบจริง 40/40 เหรียญใน 99.98 วินาที พลาดหนึ่งครั้ง พร้อม result/replay/home ที่ 844×390; ไม่มี uncaught errors และตรวจภาพ result หลัง transition แล้ว
- [x] เล่น Castle/Aclaire โหมดปกติจากต้นด่านจนปราบบอสและเก็บครบ 25/25 ใน 43.76 วินาที พลาดหนึ่งครั้ง พร้อม result/replay/home ที่ 844×390; ไม่ย้ายเข้าลานบอส ไม่เติมเหรียญ/HP และไม่มี uncaught errors (ยังเหลือคู่ตัวละครอื่น)
- [x] เล่นจับเวลาจริงครบ 120 วินาทีที่ 844×390: Grassland/Bobo, Forest/Mew, Castle/Aclaire พร้อม result/replay/pause/home; ไม่เขียนทับสถานะเกมและไม่มี uncaught errors แต่ยังไม่ถึงท้ายด่านหรือปราบบอส ดู `.logs/2026-10-15_liveplay.md`
- [x] ผลมินิเกมจริง: Memory ชนะ/replay ครบสามตัวละคร × ห้าขนาดจอ; RPS ชนะ 17 รอบ และ Coin Rain แพ้ตามกติกา/replay ที่ 844×390 ด้วย Aclaire (ไม่ใช่ทุกผลลัพธ์ของทุกตัวละคร)
- [x] แก้หัวข้อและปุ่มหน้า Memory result ถูกตัดในจอเตี้ย พร้อม assertion ขอบกรอบที่ล้มเหลวก่อนแก้และผ่านหลังแก้ครบ 15 กรณี
- [x] ตรวจ 360×640, 390×844, 640×360, 844×390, 1366×768: HUD, HP, controls ทั้งสองขนาด, pause และหมุนจอขณะกด; safe area จำลอง 360×640/640×360 และ fullscreen desktop ผ่าน
- [x] ตรวจหน้า result บนฐานล่าสุดครบห้าขนาดจอ × สามฉาก × normal/timed รวม 30 กรณี พร้อม replay/home; ใช้สถานะจบจำลองเพื่อทดสอบ UI ไม่ใช่การเล่นจบด่าน (Boss encounter จริงมีหลักฐานแยก)
- [x] ตรวจ asset/font/storage failure ทั้งสามฉาก, reload settings, reduced motion, สถิติเก่า และคู่มือครบห้าขนาดจอ; ไม่มี uncaught errors ใน flow ที่ตรวจ
- [ ] ทดสอบโทรศัพท์จริงอย่างน้อยหนึ่งเครื่องก่อนอ้างผลรองรับอุปกรณ์จริง; ขั้นตอนและช่องบันทึกผลอยู่ใน `.logs/2026-10-16_real-device-checklist.md` ยังไม่มีผลจากอุปกรณ์จริง

**Review focus:** background กลืนวัตถุ, frame anchor กระตุก, ปุ่มยิงชนปุ่มเดิน, เอฟเฟกต์ดาว/guard บังตัวละคร และการเปลี่ยน sprite ส่งผลต่อมินิเกม แต่ละกรณีต้องมีภาพและ flow ตรวจตาม V2–V4

**ลำดับส่งมอบ:** พินตรวจแผน/lineup → ฉาก → ตัวละคร → regression โดยเก็บ source เดิมใน Git และเปลี่ยนทีละชุดเพื่อย้อนกลับได้ ลงภาพตาม V1–V3 แล้วใน renderer เดิม; V4 ตรวจตามหลักฐานใน `.logs/2026-10-14_visual-art-direction.md` รายการที่ยังไม่ได้ยืนยันคง checkbox ว่าง ไม่ถือว่าผ่านทั้งหมด

**Goal:** ทำให้ Coin Quest มีภาพที่เป็นเอกลักษณ์ เข้าเกมได้ง่าย และควบคุมบนมือถือได้สะดวกทั้งแนวตั้งและแนวนอน

**Architecture:** ต่อยอด HTML/CSS/JavaScript และ Canvas 2D เดิม ใช้ DOM สำหรับเมนูและปุ่มสัมผัส ใช้ Canvas สำหรับสนาม ตัวละคร และ HUD เชื่อม layout ของทั้งสองส่วนผ่าน `layoutHud()` และ `resize()` เดิม

**Tech Stack:** HTML5, CSS, vanilla JavaScript, Canvas 2D, Web Audio, localStorage; คงการเปิด `index.html` และการเสิร์ฟแบบ static โดยไม่ต้อง build

**Design brief:** ข้อ 1–4 ในเอกสารนี้เป็นร่าง design brief; พินเลือกเป้าหมาย “ปรับภาพและประสบการณ์บนมือถือ” พินอนุมัติแผนและให้เริ่ม implementation แล้วในวันที่ 2026-10-13

**Execution:** หลังพินยืนยันขอบเขต ให้ใช้ `superpowers:executing-plans` ทำงานทีละ task ในแชตนี้ บันทึกผลจริงใน `.logs/` และทำเครื่องหมาย checkbox เมื่อมีหลักฐานตรวจผ่าน

## 1. สิ่งที่ตรวจพบจาก source

- มี Grassland และ Forest, ตัวละคร Bobo/Mew/Aclaire, โหมดปกติ/จับเวลา และมินิเกม RPS Battle
- `index.html` ใช้หน้า overlay สำหรับ title, character picker, pause, result และ minigames
- `css/style.css` รองรับ safe area, จอเตี้ย และ reduced motion อยู่แล้ว แต่ menu card มีรายละเอียดจำนวนมาก
- `js/input.js` รองรับหลาย pointer, ลากนิ้วระหว่างปุ่ม, pointer cancellation, keyboard และ gamepad อยู่แล้ว
- `js/hud.js` วาด HUD แบบ pixel art; `js/main.js:layoutHud()` ใช้ตำแหน่ง DOM มาจัดกรอบบน Canvas
- `js/main.js:resize()` จำกัด DPR สูงสุด 2 และมี handler สำหรับ resize/orientation/fullscreen
- ตัวละครเป็น sprite ที่สร้างด้วยโค้ดใน `js/sprites.js`; `CQ.debug` เปิดข้อมูลสำหรับตรวจสอบได้
- ข้อสังเกตข้างต้นมาจาก source ยังไม่ใช่ผล playtest และยังไม่ยืนยันว่ามี clipping หรือ input bug จริง

## 2. ทางเลือกและแนวทางที่เสนอ

| ทางเลือก | ขอบเขต | ข้อแลกเปลี่ยน |
|---|---|---|
| A — Responsive polish | จัดระยะ ตัวอักษร ปุ่ม และ safe area | กระทบโค้ดน้อย แต่ภาพรวมเปลี่ยนไม่มาก |
| **B — Visual refresh + mobile controls (เสนอ)** | งาน A พร้อมภาพด่าน หน้าแรกใหม่ และตัวเลือกขนาดปุ่ม | เห็นผลชัด ใช้ renderer และ gameplay เดิมเป็นฐาน |
| C — เปลี่ยน artwork ทั้งเกม | เปลี่ยน tiles, sprites, backgrounds และ effects ระหว่างเล่น | ต้องตรวจ animation/readability/performance เพิ่มมาก ควรแยกเป็นงานถัดไป |

ร่างนี้ใช้ทางเลือก B เป็นขอบเขตส่งมอบหนึ่งรอบ ไม่รวมภารกิจใหม่ ด่านใหม่ ระบบปลดล็อก multiplayer หรือ backend

## 3. ทิศทางภาพและหน้าจอ

### ภาพรวม

- ธีม **16-bit adventure**: สีฟ้า/เขียวจากฉาก สีทองของเหรียญ สีส้มของ Bobo และกรอบเข้ม อ่านข้อความบนพื้นครีมหรือพื้นเข้มทึบเพียงพอ
- ใช้ Kanit และ fallback ภาษาไทยเดิม ข้อความหลัก 16 CSS px ขึ้นไป; ข้อความรองอย่างน้อย 14 CSS px
- ใช้ภาพประกอบด่านในเมนู ส่วนตัวละครเลือกใช้ canvas preview เดิมเพื่อให้หน้าตาตรงกับตอนเล่น
- ตัวหนังสือ ปุ่ม และสถานะเลือกเป็น HTML/CSS; ภาพจาก imagegen ไม่มีข้อความที่ต้องอ่าน
- กำหนดสี ระยะ ขอบ และ focus ring เป็น CSS tokens และใช้ร่วมกันใน title, characters, pause และ result

### หน้าแรกและเลือกด่าน

- ภาพหลักแสดงบรรยากาศของด่านที่เลือก พร้อมชื่อเกมและข้อมูลด่านประจำวัน
- แสดงตัวละครที่เลือกและปุ่มเปลี่ยนตัวละครอย่างชัดเจน
- การ์ด Grassland/Forest มีภาพ ชื่อ และสถานะเลือกที่แยกได้ด้วยกรอบและเครื่องหมาย ไม่พึ่งสีอย่างเดียว
- ปุ่มโหมดปกติและจับเวลาแสดงเป้าหมายและสถิติเดิม วางก่อนรายละเอียดวิธีเล่น
- รวมคำแนะนำยาวไว้ในส่วน “วิธีเล่น” ที่เปิด/ปิดได้ และให้มินิเกมเป็นทางเลือกรอง
- จอสูงใช้ layout แนวตั้ง; จอแนวนอนเตี้ยใช้สองคอลัมน์และลดพื้นที่ภาพก่อนลดขนาดปุ่ม
- ใน viewport ขั้นต่ำ 360×640 และ 640×360 ต้องเห็นชื่อเกม ตัวละคร/ด่านที่เลือก และปุ่มเริ่มทั้งสองโหมดโดยไม่เลื่อน; รายละเอียดวิธีเล่นและมินิเกมเลื่อนได้ใน menu card

### เลือกตัวละคร, pause และ result

- Character picker แสดงชื่อ preview ความสามารถ และสถานะเลือก; จอแคบใช้การ์ดเรียงลง จอกว้างใช้สามคอลัมน์
- Pause แยก “เล่นต่อ” เป็นปุ่มหลัก ตามด้วยตั้งค่าปุ่มสัมผัส เสียง เพลง เต็มจอ เริ่มใหม่ และกลับหน้าแรก
- Result แสดงผลรอบล่าสุด สถิติ และปุ่มเล่นอีกครั้ง/กลับหน้าแรกด้วยลำดับเดียวกับของเดิม
- ปรับ shared styles อย่างระวังเพื่อให้ RPS Battle ยังอ่าน HP การ์ด action และผลแต่ละรอบได้

## 4. ประสบการณ์บนมือถือ

### Touch controls

- ปุ่มเดินซ้าย/ขวาอยู่ล่างซ้าย กระโดดอยู่ล่างขวา ขอบเขตรับสัมผัสตรงกับภาพปุ่ม
- ตั้งค่าขนาดได้สองแบบใน pause: `standard` = ปุ่มเดิน 64 px / กระโดด 76 px; `large` = 80 px / 92 px; ค่าเริ่มต้น `standard`
- เว้นจาก safe area อย่างน้อย 12 px และช่องว่างระหว่างปุ่มเดิน 8 px; ทุก interactive target ของเมนูและ HUD อย่างน้อย 44×44 CSS px
- ปุ่มมีสถานะกดที่มองเห็นได้ และยังรองรับเดินพร้อมกระโดด/ลากนิ้วซ้ายขวา
- บันทึกเฉพาะขนาดปุ่มใน key ใหม่ `coinquest.ui.v1`; ข้อมูลเสียหรือ storage ใช้ไม่ได้ให้กลับค่าเริ่มต้นและเล่นต่อได้
- เมื่อ pause, เปลี่ยนหน้า, หมุนจอ หรือแอปเสีย focus ต้องปล่อย input ค้างอย่างปลอดภัย ตรวจจากพฤติกรรมจริงก่อนแก้ handler

### HUD และ viewport

- บน touch device แสดงเหรียญ เวลา แถบพลัง และปุ่ม pause ระหว่างเล่น; รวมการตั้งค่าเสียง/เพลง/เต็มจอไว้ใน pause เพื่อลดความแน่น
- Desktop ยังคงเข้าถึงปุ่มเสียง/เพลง/เต็มจอบน HUD ได้ และสถานะต้องตรงกับปุ่มใน pause
- เชื่อมปุ่ม toggle ทั้งสองตำแหน่งกับค่า Audio เดียวกัน; ปุ่ม fullscreen ที่ไม่รองรับต้องซ่อนทั้งสองตำแหน่ง
- จัดกรอบ Canvas HUD จาก bounding box จริงหลัง layout เปลี่ยน; ทดสอบทั้งมี/ไม่มีไอเทม แถบ Mew และโล่ Aclaire
- ใช้พื้นที่ viewport ที่มองเห็นจริง รองรับ `100dvh` พร้อม fallback และ safe-area insets; ตรวจ `visualViewport` ก่อนเพิ่ม listener ที่จำเป็น
- แนวตั้งเล่นได้ มีคำแนะนำหมุนจอแบบไม่บังปุ่ม ไม่บังคับ fullscreen หรือ orientation lock
- เมนูเลื่อนภายในได้ แต่สนามและปุ่มควบคุมระหว่างเล่นต้องอยู่ใน viewport โดยไม่ต้องเลื่อน

## 5. Asset workflow และ skills ที่ระบุ

### imagegen

สร้างภาพใหม่สองภาพด้วย built-in imagegen หลังยืนยันแผน:

1. `assets/2026-10-13_grassland-menu.png` — ทุ่งหญ้าสดใส เนินฟ้า แพลตฟอร์มและเหรียญในบรรยากาศเกม 16-bit
2. `assets/2026-10-13_forest-menu.png` — ป่าเขียวหลายชั้น แสงลอดใบไม้ กิ่งไม้และทางผจญภัย โทนเดียวกับภาพแรก

ข้อกำหนด prompt: `stylized-concept`, ภาพแนวนอนสำหรับเมนู/การ์ดด่าน, ไม่มีข้อความ โลโก้ watermark หรือ UI ที่วาดติดภาพ, องค์ประกอบกลางภาพยังอ่านรู้เรื่องเมื่อใช้ `object-fit: cover`; ไม่เพิ่มตัวละครใหม่

- ตรวจภาพทั้งขนาดใหญ่และการ์ดบนจอแคบก่อนใช้
- คัดลอกไฟล์ final เข้า repo; บันทึก prompt, output path และวิธีสร้างใน `.logs/2026-10-13_imagegen.md`
- เป้าหมาย asset สำหรับเว็บรวมไม่เกิน 1 MB; เก็บต้นฉบับและทำไฟล์ web-optimized เพิ่มเมื่อจำเป็น โดยตรวจภาพหลัง optimize
- กำหนดขนาดพื้นที่ภาพล่วงหน้าเพื่อไม่ให้ปุ่มขยับระหว่างโหลด; หากรูปโหลดไม่ได้ยังต้องเห็นชื่อด่านและเริ่มเล่นได้

### playwright-interactive

- อ่าน skill แล้ว พบว่าระบุ persistent `js_repl`, Playwright และ browser runtime เป็น prerequisite
- ตอนร่างแผนมี Node REPL tool แต่ยังไม่ยืนยันว่าใช้แทน runtime ตาม skill ได้ และยังไม่ได้ตรวจ package/browser availability
- ก่อน QA ตรวจความพร้อมใน sandbox ที่ได้รับอนุญาต ไม่เปลี่ยน sandbox/config หรือถือว่าติดตั้ง skill แล้วเท่ากับใช้ได้ทันที
- หาก runtime นี้ใช้ไม่ได้ ให้รายงานข้อจำกัดและเสนอ browser automation ที่มีเป็นทางเลือกอย่างชัดเจน; ไม่รายงานว่าได้ใช้ Playwright Interactive ถ้าไม่ได้ใช้จริง
- ทำ QA inventory ก่อนทดสอบ ใช้ input จริงในการตรวจ flow แยก functional checks ออกจาก visual checks และเก็บ screenshot หลังสถานะที่ต้องการแสดงแล้ว

### openai-docs

อ่าน skill แล้ว งานนี้ใช้ภาพที่สร้างไว้ล่วงหน้า จึงไม่มี OpenAI API call ขณะเล่นและไม่ต้องเพิ่ม API key ในเกม หากต้องตอบประเด็นการใช้ OpenAI tools/API ระหว่าง implementation ให้ตรวจเอกสารทางการด้วย skill นี้และบันทึก citation เฉพาะประเด็นที่ใช้จริง

## 6. ลำดับ implementation

### Task 1 — Baseline และภาพสำหรับเมนู

**Files:** สร้าง `assets/2026-10-13_*-menu.*`, `.logs/2026-10-13_qa-inventory.md`, `.logs/2026-10-13_imagegen.md`

- [x] ตรวจ Git status และ runtime ที่ใช้ทดสอบ; เปิดเกมผ่าน local HTTP server
- [x] เก็บภาพก่อนแก้ของ title, character picker, gameplay, pause, result และ RPS ที่ desktop/portrait/landscape
- [x] ทำ QA inventory โดยผูกแต่ละ requirement กับ control, state, viewport และหลักฐาน
- [x] สร้างและตรวจสองภาพตามข้อ 5 พร้อมบันทึกขนาดไฟล์และ prompt

**ตรวจรับ:** มี baseline ที่บอกได้ว่าทดสอบจริงบนอะไร ภาพทั้งสองอ่านออกในขนาดการ์ด ไม่มีตัวอักษรผิดเพี้ยน และพร้อมอ้างอิงจาก repo

### Task 2 — หน้าแรกและการเลือกที่รองรับมือถือ

**Files:** แก้ `index.html`, `css/style.css`, `js/main.js` เฉพาะ title/character/stage/menu bindings

**Interfaces:** รักษา stage IDs `grassland`/`forest`, character IDs เดิม, `selectStage(id)`, `selectChar(id)`, `startGame(mode)` และ DOM IDs ที่ listener เดิมอ้างถึง

- [x] เพิ่ม tokens และโครง title ตามข้อ 3; โหลดภาพด่านผ่าน relative paths
- [x] ปรับ stage cards, character picker, วิธีเล่นแบบยุบได้ และการแสดงผลจอเตี้ย
- [x] ตรวจเลือกด่าน/ตัวละคร กลับหน้าแรก และเริ่มแต่ละโหมดด้วย mouse, keyboard และ touch
- [x] ตรวจ title ที่ 360×640 และ 640×360 ตามเกณฑ์ initial viewport รวมถึง image-load failure และ fallback font

**ตรวจรับ:** เริ่มเกมจากค่าเลือกที่เห็นจริงได้ ภาษาไทยไม่ถูกตัด ปุ่มหลักอยู่ใน initial viewport และ focus มองเห็น/กลับตำแหน่งสมเหตุสมผล

### Task 3 — ขนาดปุ่มสัมผัสและการตั้งค่า

**Files:** สร้าง `js/2026-10-13_ui-settings.js`, `tools/2026-10-13_check-ui-settings.js`; แก้ `index.html`, `css/style.css`, `js/main.js`; แก้ `js/input.js` เฉพาะ lifecycle ของ input ที่จำเป็น

**Interfaces:** `CQ.UISettings.normalize(raw) -> { touchSize: 'standard' | 'large' }`, `load(store) -> settings`, `save(store, settings) -> void`; `store` ใช้ interface `get(key)`/`set(key, value)` เดิม และทั้ง load/save ต้องไม่ throw เมื่อ storage ใช้ไม่ได้ โหลดไฟล์หลัง `audio.js` และก่อน `main.js`

- [x] เขียน unit checks ด้วย Node assert สำหรับค่าทั้งสองแบบ, ค่าไม่รู้จัก, JSON เสีย, get/set โยน exception และการไม่เขียนทับ key สถิติ
- [x] รันให้เห็นความล้มเหลวจาก module ที่ยังไม่มี แล้ว implement normalize/load/save
- [x] ผูก setting กับ CSS custom properties และ radio controls ใน pause พร้อม `aria` ที่ตรงสถานะ
- [x] ตรวจเดินพร้อมกระโดด ลากนิ้ว เปลี่ยนขนาด หมุนจอ กด pause และกลับจากเสีย focus; เพิ่ม regression test เฉพาะ input bug ที่พบ/แก้

**ตรวจรับ:** unit checks exit 0, ค่า setting อยู่หลัง reload, ปุ่มทั้งสองขนาดกดได้และไม่ทับกัน ไม่มี input ค้างใน flow ที่ทดสอบ; emulation ไม่ถือเป็นหลักฐานอุปกรณ์จริง

### Task 4 — HUD, pause และ result

**Files:** แก้ `index.html`, `css/style.css`, `js/main.js`, `js/hud.js`; แตะ `js/render.js` เฉพาะส่วนเชื่อม HUD หากจำเป็น

**Interfaces:** คง `CQ.HUD.pixelSize(...)` และ `renderer.layoutHud(...)`; ขยาย `refreshToggles()` ให้ sync ปุ่ม desktop/pause จาก Audio state เดียว

- [x] ย้ายการเข้าถึง setting บน touch ไป pause และจัด HUD ให้ใช้พื้นที่ที่เหลือจริง
- [x] ปรับ pause/result ให้เข้าชุด และคงเส้นทางเล่นต่อ/เริ่มใหม่/เล่นอีกครั้ง/กลับหน้าแรก
- [x] ตรวจ HUD สถานะหนาแน่นที่สุดที่เล่นได้จริง รวมเวลา แถบพลัง ไอเทม และข้อความ toast
- [x] ตรวจ layout หลังหมุนจอ เข้า/ออก fullscreen และเปลี่ยนขนาด viewport; ตรวจโหมด reduced motion และ focus

**ตรวจรับ:** เหรียญ เวลา พลัง และ pause อ่านได้ ไม่มีกรอบ Canvas ชนปุ่ม DOM; toggle ครบรอบเปิด→ปิด→เปิดให้สถานะตรงกันทั้งสองตำแหน่ง

### Task 5 — Regression, visual QA และเอกสาร

**Files:** แก้ `README.md`; เพิ่ม `.logs/2026-10-13_mobile-visual-qa.md` และ screenshot หลักฐานชื่อวันที่

- [x] ตรวจ JavaScript syntax ของไฟล์ที่แก้และไฟล์ใหม่ด้วย `node --check <file>`
- [x] รัน `node tools/2026-10-13_check-ui-settings.js` และ `node tools/check-rps.js` ต้อง exit 0
- [x] เล่น flow จากหน้าแรก→เลือก→เล่น→pause→เล่นต่อ→result→เล่นอีกครั้ง ด้วย normal input อย่างน้อยหนึ่งรอบ; debug state ใช้ตรวจ/เตรียมภาพได้ แต่ไม่นับแทน end-to-end playtest
- [x] ครอบคลุมทั้งสองด่าน ทั้งสองโหมด และความสามารถของทั้งสามตัวละคร รวมการเลือกค่าที่บันทึกไว้หลัง reload
- [x] ทดสอบ keyboard และ RPS smoke flow; ตรวจ touch หลายนิ้วด้วย runtime ที่รองรับ และแยกผล manual/device tests ชัดเจน
- [x] ทำ visual pass ตาม viewport matrix ด้านล่าง เก็บภาพ before/after และตรวจ bounding boxes ของส่วนสำคัญ
- [x] เล่นสำรวจเพิ่ม 60 วินาที ทดสอบหมุนจอระหว่างกดปุ่ม และตรวจ blur reset ด้วย unit test; การพักแอปบนอุปกรณ์จริงอยู่ในข้อจำกัดท้ายเอกสาร
- [x] อัปเดต README เรื่องภาพ asset และการตั้งค่ามือถือ พร้อม log ผลจริงและข้อจำกัดที่ยังตรวจไม่ได้

`node tools/check-level.js` รันเพิ่มเมื่อแตะ physics, level, spawning หรือ character stats เท่านั้น; งานภาพอย่างเดียวใช้ gameplay regression ตามข้างต้น

## 7. QA matrix และเกณฑ์จบงาน

| กลุ่ม | ขนาด CSS px | สิ่งที่ต้องตรวจ |
|---|---|---|
| มือถือเล็กแนวตั้ง | 360×640 | ปุ่มเริ่มในจอ ข้อความไทย เมนูเลื่อนภายใน HUD และปุ่มสัมผัส |
| มือถือแนวตั้ง | 390×844 | title/characters/pause/result, reload setting และ touch flow |
| มือถือเล็กแนวนอน | 640×360 | layout จอเตี้ย ปุ่มขนาด large, HUD หนาแน่น และ safe area จำลอง |
| มือถือแนวนอน | 844×390 | หมุนจอ ปุ่มหลายสัมผัส และพื้นที่เล่น |
| Desktop | 1366×768 | mouse/keyboard, focus, full HUD และ RPS |

- Functional QA และ visual QA ต้องผ่านแยกกัน ภาพ screenshot ที่เห็น clipping ถือว่าไม่ผ่านแม้ scroll metrics ปกติ
- ไม่มี horizontal overflow, ปุ่มสำคัญทับกัน, label ถูกตัด, asset ของ repo โหลดล้มเหลว หรือ uncaught error ใน flow ที่ทดสอบ
- รูปและ web fonts โหลดช้าหรือไม่ได้ต้องไม่ทำให้ปุ่มเริ่มใช้งานไม่ได้
- เก็บสถิติและตัวละคร/ด่านที่เลือกเดิมไว้ครบ; key `coinquest.ui.v1` แยกจากสถิติเก่า
- จำกัดภาพใหม่ไว้ในเมนู ไม่ decode ภาพใหม่ใน game loop; บันทึก frame timing ก่อน/หลังที่ runtime/viewport เดียวกันเพื่อดู regression โดยไม่อ้าง FPS ของมือถือจริงจาก emulation
- Browser emulation ใช้ตรวจ layout/input flow; Safari iOS, Android Chrome, browser chrome, notch และ gesture บนอุปกรณ์จริงให้ลงสถานะ “ยังไม่ได้ทดสอบ” หากไม่มีอุปกรณ์ให้ตรวจ
- งานรอบนี้เสร็จเมื่อ requirement ทั้งหมดมีผลตรวจผ่านหรือมีข้อจำกัดที่พินรับทราบ และมี `README.md`/`.logs/` ให้ตรวจย้อนหลัง

## 8. ขอบเขตไฟล์และสถานะปัจจุบัน

ใช้ `PLAN.md` ใน repo เป็นแผนหลักตามคำขอเดิม และเก็บ log/asset ใหม่ด้วยรูปแบบ `YYYY-MM-DD_topic`; source เดิมใช้ชื่อเดิมเพื่อรักษา references

ดำเนินการ Task 1–5 แล้ว ภาพสร้างด้วย built-in imagegen และใช้ WebP รวม 582,478 bytes; โค้ดเกมยังเป็น static HTML/CSS/JavaScript

ผลตรวจ: settings 4/4, keyboard/reset regression ผ่าน, RPS 7/7, browser interaction และ viewport bounds ผ่าน 5 ขนาดจอ, asset/font/storage fallback ผ่าน และเล่นโหมดจับเวลาโดยไม่แก้ state จนครบ 120 วินาที (17 เหรียญ, พลาด 3 ครั้ง)

ใช้ regular Playwright ผ่าน bundled Node + installed Chrome เป็น fallback เพราะ Node REPL ของ playwright-interactive โหลด package ไม่สำเร็จ ไม่ได้เปลี่ยน sandbox/config หรือติดตั้ง dependency ใหม่

รายงานหลัก: `.logs/2026-10-13_mobile-visual-qa.md`; log งาน: `.logs/2026-10-13_progress.md`; prompts: `.logs/2026-10-13_imagegen.md`

ข้อจำกัด: ยังไม่ได้ทดสอบบนมือถือ iOS/Android จริง, gamepad จริง หรือการพักแอปจริง; baseline result เป็นภาพจัด state เพื่อเปรียบเทียบ ส่วน final timed result มาจากการเล่นครบจริง Reviewer แยกติด usage limit จึงใช้ direct diff review แทน งานอยู่ใน working tree บน branch `codex/visual-mobile-refresh` ยังไม่มี commit/merge/push/publish

Preview: `http://127.0.0.1:8001` ขณะ local preview process ยังทำงาน เปิดใหม่ด้วย `node tools/2026-10-13_browser-qa.cjs preview` หรือเสิร์ฟ repo ด้วย static HTTP server ทั่วไป


### Performance follow-up — 2026-10-14

การวัดแบบ paced requestAnimationFrame บน Chrome/640×360 ผ่านทั้ง 3 ฉาก × 3 รอบ โดยแต่ละรอบไม่เกิน baseline +20% (Grassland p95 7.1–7.2 ms เทียบเดิม 7.1 ms) ไม่พบ regression ตามเกณฑ์นี้ จึงไม่แก้ renderer เพิ่ม ผลก่อนหน้าที่วน render รัวเป็น submission microbenchmark ไม่ใช่ frame cadence รายละเอียด `.logs/2026-10-14_performance-investigation.md` และข้อมูลครบ `.logs/2026-10-14_performance-results.json`

ยังไม่อ้างผลบนมือถือจริง; checklist ส่วนที่ยังไม่มีหลักฐานยังคงว่าง

### Boss และสถานะพิเศษ — 2026-10-14

- [x] ทดสอบ Boss encounter ครบ Bobo/Mew/Aclaire: ยิง โดนโจมตี HP หมด เกิดใหม่ ปราบบอส เก็บเหรียญ หน้า result และ replay (844×390)
- [x] ตรวจปีก กระโดดกลางอากาศ Mew ลอยตัว ดาวร่วมกับปีก ซ้าย/ขวา และ Aclaire guard ที่ 360×640 และ 844×390
- [x] แก้ปีกถูกตัวละครบังด้วยขนาด/ตำแหน่งวาด และตรวจภาพซ้ำทั้งสองแนวจอ; คง Bobo ไม่มีปากและ Aclaire ตาฟ้า

ผลและภาพอยู่ใน `.logs/2026-10-14_boss-special-qa.md` และ `.logs/2026-10-14_boss-special/` ใช้ fixture ย้ายตัวละครเข้าลานบอส/เก็บเหรียญก่อนลาน และจัดเวลาไอเทม จึงไม่ถือเป็นการเล่นทั้งด่านโดยไม่จัด state หรือทดสอบมือถือจริง รายการ V4 ที่กว้างกว่าขอบเขตนี้ยังคงว่าง
