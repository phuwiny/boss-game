# สเตจ 4 Haunted House — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มสเตจ 4 บ้านผีสิงที่มีบล็อกสวิตช์ม่วง/ส้ม แพลตฟอร์มแนวตั้ง ฟักทอง 2 ชนิด ความมืดสลัว และ motion ใหม่เฉพาะสเตจนี้ พร้อมงานภาพที่ Codex ทำตาม handoff

**Architecture:** ต่อยอด engine เดิม (Approach A): สัญลักษณ์/tile ใหม่ใน `js/level.js`, ความทึบของบล็อกสวิตช์อยู่ใน `World.isSolid` ผ่าน state บน `lv`, ฟักทองเป็นโมดูล logic ล้วน `js/pumpkin.js`, การวาดเฉพาะสเตจ 4 แยกไว้ใน `js/render-haunted.js` ที่เติม method ให้ `CQ.Renderer.prototype` โค้ด BFS ของตัวตรวจด่านย้ายไป `tools/lib/reach.js` เพื่อให้ทดสอบด้วยด่านจำลองได้

**Tech Stack:** HTML5 Canvas 2D, JavaScript ล้วน (ไม่มี build, ไม่มี dependency), Node.js `vm` + `assert` สำหรับ unit check, Playwright/Chromium สำหรับ browser QA

**Spec:** `docs/superpowers/specs/2026-10-22-stage4-haunted-house-design.md` · ภาพ: `docs/superpowers/specs/2026-10-22-stage4-codex-visual-handoff.md`

## Global Constraints

- ไม่มี build step, ไม่เพิ่ม dependency ในเกม; `index.html` ต้องเปิดผ่าน `file://` ได้
- ไฟล์ JS ใหม่ใช้รูปแบบเดิม: IIFE `(function (root) { 'use strict'; const CQ = root.CQ = root.CQ || {}; ... })(typeof window !== 'undefined' ? window : globalThis);` และ comment ภาษาไทยแบบไฟล์ข้างเคียง
- ไฟล์ข้อความเป็น UTF-8 **ไม่มี BOM** (ตาม repo เดิม)
- ด่านสูง `CQ.LEVEL_ROWS = 18` เท่าเดิม กล้องไม่เลื่อนแนวตั้งเพิ่ม
- สเตจ 1–3 และมินิเกม: พฤติกรรมและภาพตัวละครต้องเหมือนเดิมทุกพิกเซล
- ทุกภาพใหม่มี procedural fallback; โหลดไม่ได้ยังเล่นได้ครบ
- ค่าที่ spec กำหนด: HP 5, เหรียญตายตัว 40 ทั้งสองโหมด, โหมดจับเวลา 120 วินาที, ไอเทม หัวใจ 3 + เห็ด 1 (ไม่มีปีก/ดาว), แพลตฟอร์มแนวตั้ง speed 80 wait 0.5 กว้าง 96, สวิตช์ cooldown 0.3 วิ, ฟักทองยิงไฟ windup 0.6 วิ cooldown 2.5 วิ HP 3, อมตะหลังโดน 1.5 วิ (`P.HURT_INVULN`)
- Performance: RAF p95 สเตจ 4 ไม่เกิน +20% เทียบ Castle ในเครื่องเดียวกัน
- ข้อความในเกม/README/MANUAL เป็นภาษาไทย ไม่ใช้คำว่า "กรุณา" "โปรด"
- commit message ลงท้ายด้วย attribution lines ที่ session กำหนด; push ไป branch `claude/trusting-brahmagupta-ga1msg`

## Review Focus

1. **ผู้เล่นยืนบนบล็อกที่ถูกสลับเป็นโปร่งพอดี** — ต้องตกลงตามปกติ ไม่ค้างกลางอากาศ (Task 2 `settle` ไม่ทำให้บล็อกที่โปร่งกลับทึบ)
2. **กดสวิตช์ขณะตัวทับบล็อกสีที่กำลังจะทึบ** — บล็อกนั้นยังโปร่งจนออกพ้นตัว ไม่ดันตัวกระเด็น/ติดในกำแพง (Task 2 test `pending until clear`)
3. **แพลตฟอร์มแนวตั้งขาลงขณะผู้เล่นยืนนิ่ง/วิ่ง/กระโดดออก** — ไม่หลุดตก ไม่สั่น และกระโดดจากแพลตฟอร์มขาขึ้นได้ปกติ (Task 3 tests)
4. **พลาดหรือกด "กลับเช็กพอยต์" ก่อนแตะธงใดเลย** — กลับไปจุดเริ่ม สถานะสวิตช์เป็น `'purple'` (Task 7 browser check)
5. **ลูกไฟฟักทองค้างหลังผู้เล่นพลาด/กลับเช็กพอยต์ หรือฟักทองยิงขณะผู้เล่นอยู่หลังกำแพง** — ลูกไฟถูกล้าง; ลูกไฟชนกำแพงแล้วหาย (Task 4 test `fireball stops at wall`, Task 7 browser check)

---

### Task 0: เตรียม handoff ให้ Codex (ทำขนานกับ Task 1 ได้)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-22-stage4-codex-visual-handoff.md`

- [ ] **Step 1:** เปลี่ยนบรรทัดสถานะเป็น `> **สถานะ: พร้อมส่ง** — design อนุมัติ 2026-10-22` และแทน `YYYY-MM-DD_` ในชื่อไฟล์ด้วยข้อความ "วันที่ Codex สร้างไฟล์" (คงรูปแบบ)
- [ ] **Step 2:** Commit `docs: mark stage 4 Codex visual handoff ready`
- [ ] **Step 3:** แจ้งพินว่าส่งไฟล์ handoff ให้ Codex ได้ (Claude ส่งเองไม่ได้) และ Codex มีจุดหยุดรอพิน 3 จุด

---

### Task 1: Parser — สัญลักษณ์ใหม่, ไอเทมวางตายตัว, รางแนวตั้ง, ช่วงห้อง

**Files:**
- Modify: `js/level.js` (`CQ.TILE`, legend comment, `CQ.parseLevel`)
- Create: `tools/check-haunted.js`

**Interfaces:**
- Produces:
  - `CQ.TILE.PURPLE = 6`, `CQ.TILE.ORANGE = 7`, `CQ.TILE.SWITCH = 8`
  - สัญลักษณ์: `M` PURPLE, `O` ORANGE, `T` SWITCH, `|` รางแนวตั้ง, `k` ศัตรู `kind: 'phop'`, `j` ศัตรู `kind: 'pfire'`, `H` ไอเทม heart, `m` ไอเทม mush
  - field ใหม่ของ `lv`: `items: [{tx, ty, type}]`, `vtracks: [{tx, ty0, ty1}]`, `switches: [{tx, ty}]`, `rooms: [{tx0, tx1}]` (ช่วงคอลัมน์ของแต่ละ section), `sw: 'purple'`, `swPending: Set<number>` (index ของ tile)
  - platform ทุกอันมี `axis: 'x' | 'y'`, `dy`, `vy` (แนวนอน `dy = vy = 0`); แนวตั้ง: `{ axis: 'y', x: (tx - 1) * T, y: ty1 * T, w: 96, h: 14, minY: ty0 * T, maxY: ty1 * T, dir: -1, speed: 80, wait: 0.5, waitT: 0, dx: 0, vx: 0, dy: 0, vy: 0 }`
  - `opts.staticPlatforms`: รางแนวตั้งแปลงเป็น ONEWAY 3 ช่อง (`tx-1..tx+1`) ทุกแถว `ty0..ty1` (ไม่ทับ tile ที่ไม่ว่าง)

- [ ] **Step 1: เขียน test ที่ fail ใน `tools/check-haunted.js`** — โหลด `js/level.js` ใน vm sandbox แบบ `tools/check-level.js`, helper `t(name, fn)` แบบ `tools/check-memory.js`; ด่านจำลอง 1 section 18 แถว

```js
t('parse: บล็อกสวิตช์ ไอเทม ฟักทอง ราง และห้อง', function () {
  const lv = CQ.parseLevel([FIXTURE_A, FIXTURE_B]); // สอง section กว้าง 12 และ 10
  assert.deepStrictEqual(lv.errors, []);
  assert.strictEqual(lv.tiles[13 * lv.w + 4], CQ.TILE.PURPLE);
  assert.strictEqual(lv.tiles[13 * lv.w + 5], CQ.TILE.ORANGE);
  assert.strictEqual(lv.tiles[9 * lv.w + 6], CQ.TILE.SWITCH);
  assert.deepStrictEqual(lv.switches, [{ tx: 6, ty: 9 }]);
  assert.deepStrictEqual(lv.items.map(i => i.type).sort(), ['heart', 'mush']);
  assert.deepStrictEqual(lv.enemies.map(e => e.kind).sort(), ['pfire', 'phop']);
  assert.deepStrictEqual(lv.rooms, [{ tx0: 0, tx1: 11 }, { tx0: 12, tx1: 21 }]);
  assert.strictEqual(lv.sw, 'purple');
  assert.deepStrictEqual(lv.vtracks, [{ tx: 16, ty0: 6, ty1: 12 }]);
  const pl = lv.platforms.find(p => p.axis === 'y');
  assert.deepStrictEqual([pl.x, pl.y, pl.minY, pl.maxY, pl.w], [15 * 32, 12 * 32, 6 * 32, 12 * 32, 96]);
  assert.ok(lv.platforms.filter(p => p.axis === 'x').every(p => p.dy === 0));
});
t('parse staticPlatforms: รางแนวตั้งเป็นแผ่นไม้ 3 ช่องทุกแถว', function () {
  const lv = CQ.parseLevel([FIXTURE_A, FIXTURE_B], { staticPlatforms: true });
  for (let ty = 6; ty <= 12; ty++) for (let tx = 15; tx <= 17; tx++) assert.strictEqual(lv.tiles[ty * lv.w + tx], CQ.TILE.ONEWAY);
});
t('parse: สเตจเดิมไม่มี error และไม่มีไอเทมวางตายตัว', function () {
  CQ.STAGES.forEach(function (s) { const lv = CQ.parseLevel(s.sections); assert.deepStrictEqual(lv.errors, []); assert.strictEqual(lv.items.length, 0); });
});
```

- [ ] **Step 2:** `node tools/check-haunted.js` → FAIL (`lv.switches` undefined)
- [ ] **Step 3:** แก้ `CQ.parseLevel` ตาม Interfaces; รางแนวตั้ง = `|` ต่อกันในคอลัมน์เดียว (สแกนแนวตั้งหลังอ่านแถวครบ); อัปเดต legend comment ต้นไฟล์
- [ ] **Step 4:** `node tools/check-haunted.js` → PASS; `node tools/check-level.js` → `ผลตรวจ: ผ่าน ✓` (สเตจเดิมไม่เปลี่ยน)
- [ ] **Step 5:** Commit `feat(level): parse switch blocks, vertical tracks, fixed items and rooms`

---

### Task 2: บล็อกสวิตช์ — ความทึบ, สลับ, pending, โหม่ง

**Files:**
- Modify: `js/world.js` (`isSolid`, `moveY`, `stepPlayer` bonk event)
- Create: `js/switches.js`
- Modify: `index.html` (script `js/switches.js` หลัง `js/world.js`), `tools/check-level.js` (รายการไฟล์ที่โหลด)
- Test: `tools/check-haunted.js`

**Interfaces:**
- Consumes: `lv.sw`, `lv.swPending`, `lv.switches` (Task 1)
- Produces:
  - `World.isSolid(lv, tx, ty)`: SWITCH ทึบเสมอ; PURPLE ทึบเมื่อ `lv.sw === 'purple'` และ index ไม่อยู่ใน `lv.swPending`; ORANGE กลับกัน
  - `moveY` เมื่อหัวชน: ตั้ง `b.bonkTx`, `b.bonkTy` ก่อน return `'head'`; `stepPlayer` push `{ type: 'bonk', tx, ty }`
  - `CQ.Switches.toggle(lv, bodies) -> 'purple'|'orange'` สลับ `lv.sw`; tile สีใหม่ที่ทับ body ใด (`{x,y,w,h}`) ใส่ `lv.swPending`
  - `CQ.Switches.settle(lv, bodies) -> void` ลบ index ใน pending ที่ไม่ทับ body ใดแล้ว
  - `CQ.Switches.setState(lv, sw, bodies) -> void` ตั้งสถานะ ล้าง pending แล้วคำนวณ pending ใหม่จาก bodies
  - `CQ.Switches.isGhost(lv, tx, ty) -> boolean` สำหรับ renderer (บล็อกสีที่ไม่ทึบตอนนี้ รวม pending)

- [ ] **Step 1: เขียน test ที่ fail** (ด่านจำลอง: พื้นแถว 14, บล็อกม่วงแถว 11 คอลัมน์ 3–5, บล็อกส้มแถว 11 คอลัมน์ 7–9, สวิตช์ที่ (2, 9))

```js
t('switch: ม่วงทึบตอนเริ่ม ส้มโปร่ง สลับแล้วกลับกัน', function () {
  const lv = fixture();
  assert.ok(W.isSolid(lv, 4, 11)); assert.ok(!W.isSolid(lv, 8, 11)); assert.ok(W.isSolid(lv, 2, 9));
  assert.strictEqual(Switches.toggle(lv, []), 'orange');
  assert.ok(!W.isSolid(lv, 4, 11)); assert.ok(W.isSolid(lv, 8, 11));
});
t('switch: pending until clear — บล็อกที่ทับตัวยังโปร่งจนออกพ้น', function () {
  const lv = fixture(); const body = { x: 8 * 32 + 6, y: 11 * 32 - 4, w: 20, h: 28 };
  Switches.toggle(lv, [body]);
  assert.ok(!W.isSolid(lv, 8, 11)); assert.ok(W.isSolid(lv, 7, 11));
  body.x = 2 * 32; Switches.settle(lv, [body]);
  assert.ok(W.isSolid(lv, 8, 11));
});
t('switch: ยืนบนบล็อกม่วงแล้วสลับ = ตกลงมา', function () {
  const lv = fixture(); const p = W.makePlayer(4, 10, null, 5);
  for (let i = 0; i < 60; i++) W.stepPlayer(p, idle, lv, DT, []);
  assert.ok(p.onGround);
  Switches.toggle(lv, [p]);
  for (let i = 0; i < 60; i++) { W.stepPlayer(p, idle, lv, DT, []); Switches.settle(lv, [p]); }
  assert.ok(p.y + p.h > 13 * 32);
});
t('switch: โหม่งสวิตช์ได้ event bonk พร้อมพิกัด', function () {
  const lv = fixture(); const p = W.makePlayer(2, 13, null, 5); const ev = [];
  for (let i = 0; i < 60; i++) W.stepPlayer(p, { left: false, right: false, jump: true, jumpPressed: i === 2 }, lv, DT, ev);
  assert.ok(ev.some(e => e.type === 'bonk' && e.tx === 2 && e.ty === 9));
});
t('switch: setState ล้าง pending แล้วคำนวณใหม่', function () {
  const lv = fixture(); Switches.toggle(lv, [{ x: 8 * 32, y: 11 * 32, w: 20, h: 28 }]);
  Switches.setState(lv, 'purple', []); assert.strictEqual(lv.swPending.size, 0); assert.ok(W.isSolid(lv, 4, 11));
});
```

- [ ] **Step 2:** `node tools/check-haunted.js` → FAIL (`Switches` undefined)
- [ ] **Step 3:** แก้ `js/world.js` และสร้าง `js/switches.js` ตาม Interfaces (index = `ty * lv.w + tx`; สเตจที่ไม่มี `lv.sw` ไม่มี tile 6–7 จึงไม่กระทบ)
- [ ] **Step 4:** `node tools/check-haunted.js` → PASS; `node tools/check-level.js` → ผ่าน
- [ ] **Step 5:** Commit `feat(world): purple/orange switch blocks with safe toggling`

---

### Task 3: แพลตฟอร์มแนวตั้ง

**Files:**
- Modify: `js/world.js` (`stepPlatform`, `stepPlayer` ส่วน ride)
- Test: `tools/check-haunted.js`

**Interfaces:**
- Consumes: platform `axis: 'y'` (Task 1)
- Produces: `World.stepPlatform(pl, dt)` รองรับ `axis === 'y'` (เคลื่อนระหว่าง `minY`/`maxY`, ตั้ง `dy`/`vy`, หยุด `wait` ที่ปลาย); `stepPlayer` ตามแพลตฟอร์มด้วย `moveY(p, p.ride.dy, lv, null)` **หลัง** ride.dx และย้ายการคำนวณ `p.prevBottom` ไปไว้หลังการเลื่อนตาม ride

- [ ] **Step 1: เขียน test ที่ fail**

```js
t('vplatform: ยืนนิ่งติดไปด้วยครบรอบขึ้น-ลง', function () {
  const lv = vfixture(); const pl = lv.platforms[0]; const p = standOn(pl, lv);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 120 * 8; i++) {
    W.stepPlatform(pl, DT); W.stepPlayer(p, idle, lv, DT, []);
    assert.ok(Math.abs(p.y + p.h - pl.y) < 0.5, 'หลุดจากแพลตฟอร์มที่ step ' + i);
    minY = Math.min(minY, pl.y); maxY = Math.max(maxY, pl.y);
  }
  assert.strictEqual(minY, pl.minY); assert.strictEqual(maxY, pl.maxY);
});
t('vplatform: กระโดดจากแพลตฟอร์มขาขึ้นได้สูงกว่ายืนเฉย', function () {
  const lv = vfixture(); const pl = lv.platforms[0]; const p = standOn(pl, lv);
  for (let i = 0; i < 90; i++) { W.stepPlatform(pl, DT); W.stepPlayer(p, idle, lv, DT, []); }
  const y0 = p.y; let top = p.y;
  for (let i = 0; i < 80; i++) { W.stepPlatform(pl, DT); W.stepPlayer(p, { left: false, right: false, jump: true, jumpPressed: i === 0 }, lv, DT, []); top = Math.min(top, p.y); }
  assert.ok(y0 - top > 90);
});
t('vplatform: แพลตฟอร์มแนวนอนเดิมยังพาไปด้านข้าง', function () {
  const lv = CQ.parseLevel([HFIXTURE]); const pl = lv.platforms[0]; const p = standOn(pl, lv); const x0 = p.x;
  for (let i = 0; i < 120; i++) { W.stepPlatform(pl, DT); W.stepPlayer(p, idle, lv, DT, []); }
  assert.ok(p.x - x0 > 50);
});
```

- [ ] **Step 2:** `node tools/check-haunted.js` → FAIL ที่ test แรก
- [ ] **Step 3:** แก้ `stepPlatform` และ `stepPlayer` ตาม Interfaces
- [ ] **Step 4:** `node tools/check-haunted.js` → PASS; `node tools/check-level.js` → ผ่าน (สเตจเดิมไม่มีราง `|`)
- [ ] **Step 5:** Commit `feat(world): vertical moving platforms`

---

### Task 4: ฟักทอง (logic)

**Files:**
- Create: `js/pumpkin.js`
- Modify: `index.html` (script หลัง `js/boss.js`), `tools/check-level.js` (โหลดไฟล์ + `ENEMY_NAME` เพิ่ม `phop: 'ฟักทองกระโดด', pfire: 'ฟักทองยิงไฟ'`)
- Test: `tools/check-haunted.js`

**Interfaces:**
- Consumes: `World.moveY`, `World.isSolid`, `World.isOneWay`, `CQ.PHYS`
- Produces:
  - `CQ.Pumpkin.PUMPKIN = { HOP: { W: 26, H: 24, SPEED: 60, JUMP_V: 430, PAUSE: 0.8 }, FIRE: { W: 28, H: 26, RANGE: 9 * T, WINDUP: 0.6, COOLDOWN: 2.5, HP: 3, FIRE_SPEED: 200, FIRE_R: 8, FIRE_LIFE: 4 } }`
  - `CQ.Pumpkin.isPumpkin(kind) -> boolean` (`'phop' | 'pfire'`)
  - `CQ.Pumpkin.makePumpkin({ tx, ty, kind }) -> enemy` มี field เดียวกับศัตรูเดิม (`kind, x, y, w, h, vx, vy, dir, onGround, ride, dead, deadT, t`) + `hp` (phop 1, pfire 3), `pause`, `windT`, `cd`, `flash`, `face`
  - `CQ.Pumpkin.stepPumpkin(e, lv, p, dt, fires, ev) -> void` — phop: บนพื้นรอ `PAUSE` แล้วกระโดด `vx = dir * SPEED`, กลับทิศเมื่อช่องลงจอดข้างหน้า (2 ช่อง) ไม่มีพื้นหรือติดกำแพง/หนาม; pfire: อยู่กับที่ หันหาผู้เล่นเมื่อ `|dx| < RANGE` และ `|dy| < 4 * T`, เมื่อ `cd <= 0` เริ่ม `windT = WINDUP` + push `{ type: 'pwind' }`, ครบแล้ว push ลูกไฟ `{ x, y, vx, vy, r: FIRE_R, kind: 'ghost', t: 0, life: FIRE_LIFE }` เล็งผู้เล่น (vy จำกัด ±0.55 เท่าความเร็วแบบ `Boss.breathe`) + `{ type: 'pfire' }`, `cd = COOLDOWN`
  - ลูกไฟใช้ `Boss.stepShot` / `Boss.shotHits` เดิมได้ทันที (รูปร่างเดียวกัน)

- [ ] **Step 1: เขียน test ที่ fail**

```js
t('pumpkin: phop กระโดดเป็นจังหวะและไม่ตกขอบ', function () { /* วิ่ง 10 วิบนพื้นกว้าง 6 ช่องที่มีเหวสองข้าง: e.dead === false, มี onGround→air อย่างน้อย 3 ครั้ง */ });
t('pumpkin: pfire เตือนก่อนยิง 0.6 วิ แล้วยิง 1 ลูกต่อ cooldown', function () {
  const { lv, e, p } = fireFixture(); const fires = [], ev = [];
  let windAt = -1, fireAt = -1;
  for (let i = 0; i < 120 * 6; i++) { ev.length = 0; Pumpkin.stepPumpkin(e, lv, p, DT, fires, ev);
    if (ev.some(x => x.type === 'pwind') && windAt < 0) windAt = i;
    if (ev.some(x => x.type === 'pfire') && fireAt < 0) fireAt = i; }
  assert.ok(Math.abs((fireAt - windAt) * DT - 0.6) < 0.02);
  assert.ok(fires.length >= 2 && fires.length <= 3); assert.strictEqual(fires[0].kind, 'ghost');
  assert.ok(Math.sign(fires[0].vx) === Math.sign(p.x - e.x));
});
t('pumpkin: pfire ไม่ยิงเมื่อผู้เล่นอยู่นอกระยะ', function () { /* p ห่าง 12 ช่อง: 6 วิแล้ว fires.length === 0 */ });
t('pumpkin: fireball stops at wall', function () {
  const { lv, e, p } = fireFixture({ wallBetween: true }); const fires = [];
  for (let i = 0; i < 120 * 2; i++) Pumpkin.stepPumpkin(e, lv, p, DT, fires, []);
  const f = fires[0]; let res = null; for (let i = 0; i < 600 && !res; i++) res = Boss.stepShot(f, lv, DT);
  assert.strictEqual(res, 'wall');
});
```

- [ ] **Step 2:** `node tools/check-haunted.js` → FAIL
- [ ] **Step 3:** สร้าง `js/pumpkin.js` ตาม Interfaces (ค่าคงที่อยู่ต้นไฟล์แบบ `BOSS`/`ROCK`)
- [ ] **Step 4:** `node tools/check-haunted.js` → PASS
- [ ] **Step 5:** Commit `feat(pumpkin): hopping and fire-spitting pumpkin logic`

---

### Task 5: ตัวตรวจด่านรู้จักสวิตช์ — แยก BFS เป็น `tools/lib/reach.js`

**Files:**
- Create: `tools/lib/reach.js` (ย้าย `checkReach`, `key`, `simAir`, `simWalk`, `HOLDS`, `SWITCHES` จาก `tools/check-level.js`)
- Modify: `tools/check-level.js` (ใช้ `reach.js`; กติกาสเตจ `fixedCoins`)
- Test: `tools/check-haunted.js`

**Interfaces:**
- Consumes: `CQ.Switches` (Task 2), `lv.rooms`, `lv.items`, `lv.switches`, `lv.vtracks` (Task 1)
- Produces:
  - `reach(CQ, lv, ch, targets, opts) -> { got: Set<number>, standing: number }` ใน `tools/lib/reach.js` (`module.exports = { reach }`)
    - `opts.start: {tx, ty}` (ค่าเริ่ม `lv.start`), `opts.sw: 'purple'|'orange'` (ค่าเริ่ม `'purple'`), `opts.toggles: boolean` (ค่าเริ่ม `true`), `opts.airJumps: boolean` (ค่าเริ่ม `false`), `opts.bounds: { tx0, tx1 } | null`
    - node ใน BFS = ตำแหน่ง + `sw` + `pending` (array); key รวม `sw`; ก่อน sim จาก node เรียก `Switches.setState(lv, node.sw)` แล้วคืน pending ของ node
    - ระหว่าง sim: event bonk ที่ tile SWITCH → `Switches.toggle(lv, [p])` เมื่อ `toggles`; ทุก step เรียก `Switches.settle(lv, [p])`
    - ยิงสวิตช์: จากทุกตำแหน่งยืน ทั้งสองทิศ สแกนแถว `floor((p.y + 13) / T)` ไกลสุด `ch.shot.range` ถึง tile ทึบแรก ถ้าเป็น SWITCH → enqueue ตำแหน่งเดิมด้วย `sw` สลับ
    - `airJumps: true`: เพิ่มชุด sim ที่กดกระโดดซ้ำที่เฟรม 25 และ 45 ของการลอย (ใช้ตรวจทางลัด Mew เท่านั้น)
    - `bounds`: ไม่ enqueue ตำแหน่งที่ `tx` ของจุดกึ่งกลางตัวอยู่นอก `[tx0 - 1, tx1 + 1]`
  - ผลลัพธ์ของ `check-level.js` สำหรับสเตจเดิมต้องเหมือนเดิม (จำนวนตำแหน่งยืน/จุดที่เข้าถึง)

- [ ] **Step 1: เก็บ baseline** — `node tools/check-level.js > /tmp/claude-0/-home-user-boss-game/4cf1ef7a-381b-5b0c-a8c0-1d7176db432f/scratchpad/check-level-before.txt`
- [ ] **Step 2: เขียน test ที่ fail** (ด่านจำลอง: เหรียญ A อยู่บนชั้นที่ขึ้นได้เฉพาะเมื่อบล็อกส้มทึบ, สวิตช์โหม่งได้; ด่านจำลองที่ 2 สวิตช์อยู่สูงเกินโหม่งแต่ยิงถึง)

```js
t('reach: เหรียญหลังสวิตช์ เก็บได้เมื่อสลับได้ เก็บไม่ได้เมื่อห้ามสลับ', function () {
  const lv = CQ.parseLevel([GATE]); const tg = lv.coins.map(c => ({ tx: c.tx, ty: c.ty }));
  assert.strictEqual(reach(CQ, lv, bobo, tg, {}).got.size, tg.length);
  assert.strictEqual(reach(CQ, lv, bobo, tg, { toggles: false }).got.size, 0);
});
t('reach: เริ่มสถานะส้มก็ต้องสลับกลับได้', function () {
  const lv = CQ.parseLevel([GATE]); const tg = lv.coins.map(c => ({ tx: c.tx, ty: c.ty }));
  assert.strictEqual(reach(CQ, lv, bobo, tg, { sw: 'orange' }).got.size, tg.length);
});
t('reach: ยิงสวิตช์ที่โหม่งไม่ถึงนับเป็นการสลับ', function () {
  const lv = CQ.parseLevel([SHOOT_GATE]); const tg = lv.coins.map(c => ({ tx: c.tx, ty: c.ty }));
  assert.strictEqual(reach(CQ, lv, bobo, tg, {}).got.size, tg.length);
});
t('reach: airJumps ทำให้ Mew ข้ามช่องที่ Bobo ข้ามไม่ได้', function () {
  const lv = CQ.parseLevel([HIGH_LEDGE]); const tg = lv.coins.map(c => ({ tx: c.tx, ty: c.ty }));
  assert.strictEqual(reach(CQ, lv, bobo, tg, { toggles: false }).got.size, 0);
  assert.strictEqual(reach(CQ, lv, mew, tg, { toggles: false, airJumps: true }).got.size, tg.length);
});
```

- [ ] **Step 3:** `node tools/check-haunted.js` → FAIL (`tools/lib/reach.js` ไม่มี)
- [ ] **Step 4:** สร้าง `tools/lib/reach.js` ตาม Interfaces แล้วให้ `check-level.js` เรียกใช้
- [ ] **Step 5:** เพิ่มใน `check-level.js` สำหรับ `stage.fixedCoins`:
  - ข้าม `Spawn.buildPool`/`checkDaily`; fail ถ้า `lv.coins.length !== 40` หรือไอเทมไม่ใช่ heart×3 + mush×1
  - **กฎ 1:** ทุกเหรียญ/ไอเทมเข้าถึงได้จาก `lv.start` สถานะ `'purple'` ทุกตัวละคร
  - **กฎ 3:** ทุกห้อง `k ≥ 1` (ห้องที่มีเช็กพอยต์ `C`): เหรียญ/ไอเทมที่ `tx` อยู่ในห้องนั้น เข้าถึงได้จากเช็กพอยต์ของห้อง ทั้ง `sw: 'purple'` และ `'orange'`, `bounds` = ห้องนั้น, ทุกตัวละคร; ห้อง 0 ตรวจจาก `lv.start` สถานะ `'purple'` เท่านั้น
  - **กฎ 4:** ใต้ SWITCH ต้องเป็น EMPTY; ช่อง `(tx-1..tx+1, ty0-1)` ของรางแนวตั้งต้องไม่ทึบ ไม่เป็นหนาม ไม่เป็น PURPLE/ORANGE; เช็กพอยต์และจุดเริ่มต้องไม่ทับ PURPLE/ORANGE
  - **กฎ 5 (เตือนไม่ fail):** เหรียญที่ Mew (`toggles: false, airJumps: true`) เก็บได้แต่ Bobo (`toggles: false`) เก็บไม่ได้ พิมพ์ `⚠ ทางลัด Mew: เหรียญ (tx, ty)`
- [ ] **Step 6:** `node tools/check-haunted.js` → PASS; `node tools/check-level.js > .../check-level-after.txt` แล้ว `diff` กับ baseline → ต่างเฉพาะบรรทัดเวลา (วินาที)
- [ ] **Step 7:** Commit `test(level): switch-aware reachability checker`

---

### Task 6: ผังด่าน `js/stage-haunted.js`

**Files:**
- Create: `js/stage-haunted.js`
- Modify: `index.html` (script หลัง `js/stage-castle.js`), `tools/check-level.js` (โหลดไฟล์)

**Interfaces:**
- Consumes: สัญลักษณ์จาก Task 1, กฎตรวจจาก Task 5
- Produces: `CQ.STAGES[3]` =

```js
{ id: 'haunted', no: 4, name: 'Haunted House', th: 'บ้านผีสิง', theme: 'haunted', sections: SECTIONS,
  hp: 5, shoot: true, fixedCoins: true, checkpointReturn: true, motion: 'v2',
  dark: { alpha: 0.5, radius: 5.5 * 32 } }
```
(ไม่มี `music` และ `menuArt` จนกว่าจะมีไฟล์)

- [ ] **Step 1:** ออกแบบ 6 ห้อง (section) ความยาวรวม 220–260 ช่อง: ห้อง 1 สอนกลไก (สลับแล้วทางเปิดตรงหน้า), ห้อง 2 ฟักทองกระโดด, ห้อง 3 แพลตฟอร์มแนวตั้ง + เหรียญสูง, ห้อง 4 ฟักทองยิงไฟ + สวิตช์ที่ต้องยิง, ห้อง 5–6 สลับหลายครั้งร่วมแพลตฟอร์มแนวตั้ง; `C` ที่ต้นห้อง 2–6; เหรียญ `o` รวม 40; `H`×3, `m`×1; ห้อง puzzle มีเพดาน/ผนังบล็อกสวิตช์ปิดทางลัดด้านบน
- [ ] **Step 2:** `node tools/check-level.js haunted` → `ผลตรวจ: ผ่าน ✓` และ **ไม่มี** บรรทัด `⚠ ทางลัด Mew` (ถ้ามี แก้ผังจนหมด หรือบันทึกเหตุผลใน comment ของห้องนั้นว่าตั้งใจ)
- [ ] **Step 3:** `node tools/check-level.js` (ทุกสเตจ) → ผ่าน; `node tools/check-haunted.js` → PASS
- [ ] **Step 4:** Commit `feat(stage): Haunted House layout (6 rooms, 40 fixed coins)`

---

### Task 7: เชื่อมเข้าเกม — ยิง, เหรียญตายตัว, ฟักทอง, สวิตช์, เช็กพอยต์

**Files:**
- Modify: `js/main.js`, `index.html` (ปุ่มในเมนูหยุดเกม), `js/audio.js` (`sfx.switchFlip`, `sfx.pumpkinWind`, `sfx.pumpkinFire`)
- Create: `tools/2026-10-22_qa-haunted.cjs` (โมดูลรูปแบบเดียวกับ `tools/2026-10-16_qa-normal-liveplay.cjs`: `module.exports = async ({ page, width, height, results }) => {...}` ใช้ `CQ.debug`)

**Interfaces:**
- Consumes: ทุกอย่างจาก Task 1–6
- Produces (ใน `js/main.js`):
  - `newGame`: `stage.fixedCoins` → ไม่เรียก `Spawn.pick`; `coins = lv.coins`, `items = lv.items`; ศัตรู `Pumpkin.isPumpkin(e.kind) ? Pumpkin.makePumpkin(e) : W.makeEnemy(e)`; `g.respawn = { tx, ty, sw: 'purple' }`; `g.swCD = 0`; `Switches.setState(lv, 'purple', [])`
  - `step`: ฟักทองใช้ `Pumpkin.stepPumpkin(e, lv, g.player, dt, g.fires, pumpkinEvents)` แทน `W.stepEnemy`; `g.swCD -= dt`; หลัง `stepPlayer` เรียก `Switches.settle(lv, bodies)` (`bodies` = ผู้เล่น + ศัตรูที่ยังไม่ตาย)
  - `if ((g.stage.boss || g.stage.shoot) && stepBossStage(p, inp, dt)) return;` และ `body.boss-stage` ใช้เงื่อนไขเดียวกัน (ปุ่มยิงบนมือถือ)
  - `toggleSwitch(source)` — ไม่ทำถ้า `g.swCD > 0`; `Switches.toggle(lv, bodies)`; `g.swCD = 0.3`; `Sound.sfx.switchFlip()`; burst สีตามสถานะใหม่ เรียกจาก event `bonk` ที่ tile SWITCH และจากกระสุนที่ `Boss.stepShot` คืน `'wall'` บน tile SWITCH
  - `shotHit`: ศัตรูที่ `e.hp > 1` → `e.hp--`, `e.flash = 0.12`, คืน `'hit'` (ไม่ตาย)
  - `activateCheckpoint`: `g.respawn = { tx, ty, sw: g.lv.sw }`; `respawn()`: `Switches.setState(lv, g.respawn.sw, [g.player])`
  - `returnToCheckpoint()` — เรียกได้เมื่อ `state === 'paused'` และ `g.stage.checkpointReturn`; ย้ายผู้เล่นไป `W.makePlayer(r.tx, r.ty, ...)` ตำแหน่งเดียวกับ respawn แต่ **คง** `hp`, `guard`, `pw`; `vx = vy = 0`, `ride = null`, `invuln = P.HURT_INVULN`; `Switches.setState(lv, r.sw, [p])`; ล้าง `g.shots`, `g.fires`; ไม่เพิ่ม `g.deaths`; snap กล้อง; `resumeGame()`
  - `index.html`: `<button class="btn" id="btn-checkpoint" type="button" hidden>กลับเช็กพอยต์</button>` ระหว่าง `#btn-resume` กับ `#btn-restart`; `pauseGame()` ตั้ง `hidden = !g.stage.checkpointReturn`; `bindButton('btn-checkpoint', returnToCheckpoint)`
  - เมนู: จำนวนเหรียญของ `fixedCoins` นับจาก `CQ.parseLevel(stage.sections).coins.length`; tooltip โหมดจับเวลาของ `fixedCoins` = `'ใช้เหรียญชุดเดียวกับโหมดปกติ ' + n + ' เหรียญ'`; ภาพเมนูใช้ `stage.menuArt` ถ้ามี, ถ้าไม่มีและ theme ไม่ใช่ 3 ธีมเดิม → `landscape.hidden = true`
  - toast เริ่มเกมบอกปุ่มยิงเมื่อ `boss || shoot`

- [ ] **Step 1: เขียน browser check ที่ fail** ใน `tools/2026-10-22_qa-haunted.cjs` — เปิด `http://127.0.0.1:8001/?seed=qa-haunted`, เลือก `.stage-haunted`, `#btn-normal` แล้ว assert ผ่าน `page.evaluate` + input จริง:
  - `g.goal === 40`, `g.items.map(i=>i.type).sort()` = `['heart','heart','heart','mush']`, `g.player.hpMax === 5`
  - ยิง (`KeyX`) แล้ว `g.shots.length > 0`
  - วางผู้เล่นใต้สวิตช์แรกด้วย `CQ.debug.game.player.x/y` แล้วกดกระโดดจริง → `g.lv.sw === 'orange'`; กดซ้ำภายใน 0.3 วิไม่สลับกลับ
  - **Review Focus 4:** กด `P` → `#btn-checkpoint` แสดง → คลิก → ผู้เล่นอยู่ที่ `lv.start`, `g.lv.sw === 'purple'`, `g.deaths` เท่าเดิม, `hp` เท่าเดิม
  - แตะเช็กพอยต์ห้อง 2 ขณะ `sw === 'orange'` → สลับเป็น purple → กลับเช็กพอยต์ → `sw === 'orange'`
  - **Review Focus 5:** มีลูกไฟใน `g.fires` แล้วกลับเช็กพอยต์ → `g.fires.length === 0`
  - ตั้ง `hp = 1` แล้วชนฟักทอง → `deathAnim` → respawn: `hp === 5`, `sw` = ค่าที่เช็กพอยต์จำไว้
  - เปิดสเตจ 1–3: `#btn-checkpoint` ซ่อน, ไม่มี console error
- [ ] **Step 2:** รัน QA (`python3 -m http.server 8001` เบื้องหลัง + Playwright Chromium ที่ `/opt/pw-browsers`) → FAIL (`.stage-haunted` ยังไม่มีปุ่ม/พฤติกรรม)
- [ ] **Step 3:** แก้ `js/main.js`, `index.html`, `js/audio.js` ตาม Interfaces; ใส่ `<script src="js/pumpkin.js">`, `js/switches.js`, `js/stage-haunted.js` ถ้ายังไม่ได้ใส่
- [ ] **Step 4:** QA → PASS; `node tools/check-level.js`, `node tools/check-haunted.js`, `node tools/check-rps.js`, `node tools/check-rain.js`, `node tools/check-memory.js`, `node tools/check-balance.js`, `node tools/2026-10-13_check-input.js`, `node tools/2026-10-13_check-ui-settings.js` → ผ่านทั้งหมด
- [ ] **Step 5:** Commit `feat(game): wire Haunted House switches, pumpkins and checkpoint return`

---

### Task 8: ภาพ procedural ชั่วคราวของสเตจ 4

**Files:**
- Create: `js/render-haunted.js` (เติม method ให้ `CQ.Renderer.prototype`; โหลดหลัง `js/render.js`)
- Modify: `js/render.js` (THEMES `haunted`, dispatch ใน `tileSprite`, `drawSky`, `drawEnemy`, `drawShot`, `drawTracks`, decor ใน `setLevel`), `css/style.css` (`.stage-haunted` swatch, `.title-art[data-stage="haunted"]`), `index.html`
- Test: `tools/2026-10-22_qa-haunted.cjs` (เพิ่ม visual checks)

**Interfaces:**
- Consumes: `CQ.Switches.isGhost`, ฟิลด์ฟักทอง (`windT`, `flash`, `face`, `hp`), platform `axis`
- Produces (`js/render-haunted.js`):
  - `Renderer.prototype.hauntedTileSprite(lv, tx, ty, t) -> canvas` — PURPLE/ORANGE ทึบ: สีเต็ม + ลาย (ม่วง = พระจันทร์เสี้ยว/วงกลม, ส้ม = สี่เหลี่ยม/หน้าฟักทอง); โปร่ง: กรอบเส้นประ alpha ≤ 0.35 + ลายจาง; SWITCH: กล่องมีไฟสีตาม `lv.sw`; key แคชรวมสี+สถานะ
  - `drawHauntedSky(time)`, `drawPumpkin(e, time)` (ตาเรืองแสงและสั่นเมื่อ `windT > 0`, กะพริบเมื่อ `flash > 0`), `drawVTrack(pl)`
  - `drawShot` รองรับ `kind: 'ghost'` (เขียวผี `#7dffb0`/`#2ecc71`/`#c9ffe4`); `SHOT_COLORS.ghost` ใน `main.js`
  - ภาพเหล่านี้คือ fallback ถาวรเมื่อภาพ Codex โหลดไม่ได้

- [ ] **Step 1: เพิ่ม visual check ที่ fail** — screenshot ที่ 844×390 ตอนเริ่มสเตจ 4 และหลังสลับสวิตช์; assert ด้วย `page.evaluate` อ่านพิกเซลจาก canvas: ช่องบล็อกม่วงทึบมี alpha เฉลี่ยสูงกว่าช่องบล็อกส้มโปร่ง; หลังสลับกลับกัน; ภาพ grayscale ของบล็อกสองสีมีลายต่างกัน (ค่าความต่างของพิกเซลในช่อง > 0); ไม่มี console error
- [ ] **Step 2:** รัน QA → FAIL
- [ ] **Step 3:** สร้าง `js/render-haunted.js` และ hook ใน `js/render.js` ตาม Interfaces (สเตจเดิมไม่วิ่งเข้าโค้ดใหม่)
- [ ] **Step 4:** QA → PASS; screenshot สเตจ 1–3 ที่ 844×390 เทียบก่อนแก้ (`git stash` หรือ worktree ที่ `main`) ต่างกัน 0 พิกเซลในพื้นที่ฉาก
- [ ] **Step 5:** Commit `feat(render): procedural Haunted House tiles, pumpkins and ghost fire`

---

### Task 9: ความมืดสลัว

**Files:**
- Modify: `js/render-haunted.js` (`drawDarkness`), `js/render.js` (`render()` เรียกหลัง `drawParticles` ก่อน flash เมื่อ `g.stage.dark`)
- Test: `tools/2026-10-22_qa-haunted.cjs`, `tools/2026-10-16_qa-resolution-performance.cjs` (เพิ่มกรณี `['haunted','bobo',0]`)

**Interfaces:**
- Consumes: `g.stage.dark = { alpha, radius }`
- Produces: `Renderer.prototype.drawDarkness(g, time)` — offscreen canvas ขนาด view (สร้างใหม่เฉพาะตอน resize), เติม `rgba(20,8,36,alpha)`, เจาะแสงด้วย `destination-out` จาก gradient sprite ที่แคชตามรัศมี; แหล่งแสง: ผู้เล่น (`radius`), ฟักทองยิงไฟ (2.5 ช่อง, สว่างขึ้นตอน `windT`), ลูกไฟ (1.5 ช่อง), สวิตช์ (1.5 ช่อง), เหรียญที่ยังไม่เก็บ (0.8 ช่อง), decor เทียน/โคม (2 ช่อง)

- [ ] **Step 1: เพิ่ม check ที่ fail** — ที่ 844×390: ความสว่างเฉลี่ยรอบผู้เล่น (รัศมี 2 ช่อง) > ความสว่างเฉลี่ยมุมจอที่ไกลผู้เล่น อย่างน้อย 1.4 เท่า; ช่องหนามที่อยู่นอกวงแสงมีความสว่าง ≥ 35% ของตอนปิดความมืด (`g.stage.dark = null` ชั่วคราวผ่าน `CQ.debug`)
- [ ] **Step 2:** QA → FAIL
- [ ] **Step 3:** เขียน `drawDarkness` ตาม Interfaces
- [ ] **Step 4:** QA → PASS; performance: RAF p95 สเตจ 4 ≤ 1.2 × Castle ทั้ง 1366×768 และ 390×844
- [ ] **Step 5:** Commit `feat(render): dim haunted lighting with cached light sprites`

---

### Task 10: Motion v2 ฝั่ง code (เฉพาะ `stage.motion === 'v2'`)

**Files:**
- Modify: `js/render.js` (`drawHero` อ่าน `g.stage.motion`), `js/main.js` (event `land`/`jump`/เบรก, hit-stop ใน `kill()`, particle วิญญาณ), `js/render-haunted.js` (decor ไหว: ใยแมงมุม, เปลวเทียน, ฝุ่นลอย, ฟักทองหายใจ)
- Test: `tools/2026-10-22_qa-haunted.cjs`

**Interfaces:**
- Produces:
  - `g.motion = { stretch: 0, lean: 0 }` ตั้งใน `newGame`; อัปเดตใน `step` เฉพาะเมื่อ `g.stage.motion === 'v2'`: กระโดด → `stretch = 0.14` คืนเข้า 0 แบบ ease-out ใน 0.18 วิ; ลงพื้นใช้ `g.landSquash` ที่มีอยู่ (ค่าลบของ stretch); `lean` = `clamp(p.vx / (P.RUN * 1.5), -1, 1) * 0.08` rad แบบ smoothing
  - `drawHero`: เมื่อ v2 ใช้ `ctx.scale(1 - s * 0.5, 1 + s)` ยึดที่เท้า (anchor ล่าง) + `ctx.rotate(lean)`; ขนาดหลัง scale ปัดเป็นจำนวนเต็มพิกเซลจอ; hitbox (`p.w`, `p.h`) ไม่เปลี่ยน
  - ฝุ่นเพิ่มตอนกลับตัวขณะวิ่ง (`sign(vx) !== face` และ `|vx| > 120`) และตอนออกตัวจากหยุดนิ่ง
  - `kill()` เมื่อ v2: `g.hitStop = 0.12` (step ข้ามการจำลองระหว่าง hit-stop แต่ยังวาด) แล้ว deathAnim เดิม + particle วิญญาณ (`kind: 'circle'`, สีขาวอมเขียว, ลอยขึ้น 1 วิ)
  - ท่าใหม่จากภาพ Codex (Task 12) จะเลือกผ่าน `heroPose` เมื่อมี frame `run5`… ใน art data; ตอนนี้ใช้ 9 ท่าเดิม

- [ ] **Step 1: เพิ่ม check ที่ fail** — ในสเตจ 4: ระหว่างกระโดดขึ้น ความสูงของตัวละครบน canvas (bounding box พิกเซลที่ไม่ใช่ฉาก) มากกว่าตอนยืน ≥ 2 พิกเซลจอ; หลัง `kill()` 0.06 วิ `deathAnim.y` เท่ากับตอนเริ่ม (hit-stop); ในสเตจ 1 ค่าทั้งสองไม่เปลี่ยน (ภาพ hero ตรงกับ baseline ทุกพิกเซล)
- [ ] **Step 2:** QA → FAIL
- [ ] **Step 3:** แก้ตาม Interfaces
- [ ] **Step 4:** QA → PASS; `node tools/2026-10-14_check-sprites.js`, `node tools/2026-10-15_check-character-art.cjs` → ผ่าน
- [ ] **Step 5:** Commit `feat(motion): squash/stretch, lean, dust and hit-stop for stage 4`

---

### Task 11: จุดหยุด — พินลองเล่นผังด่าน (spec 6.9)

- [ ] **Step 1:** push branch; แจ้งพินพร้อมวิธีเปิด (`index.html` ในเครื่อง หรือ GitHub Pages ของ branch ถ้าเปิดใช้) และสิ่งที่ขอให้ดู: puzzle ง่าย/ยากเกิน, Mew ข้าม puzzle, ความมืดยุติธรรมไหม, motion ดูลื่นขึ้นไหม
- [ ] **Step 2:** **หยุดรอผล** — แก้ผัง/ค่าจูนตามที่พินสั่ง (กลับไป Task 6/9/10 ตามเรื่อง) ก่อนเริ่ม Task 12

---

### Task 12: นำภาพจาก Codex เข้าเกม (เริ่มเมื่อ Codex ส่งภาพที่พินอนุมัติแล้ว)

**Files:**
- Modify: `js/stage-haunted.js` (`menuArt`), `js/render-haunted.js` (โหลดภาพแบบ `Image` + ใช้ procedural เดิมเมื่อ `onerror`/ยังไม่โหลด เหมือน Grassland concept ใน `render.js`), `css/style.css` (`#screen-title .stage-haunted::before`)
- Create: `tools/2026-10-22_build-motion-v2-art.cjs` (ขยายจาก `tools/2026-10-15_build-character-art.cjs`: อ่าน source sheet 4×4 ลำดับ `run1–run8, jumpUp, jumpApex, jumpFall, land, dead1, dead2, dead3`, **ใช้สเกลเดียวกับชุด 9 ท่า** ที่คำนวณจาก source เดิม), `js/2026-10-22_character-art-v2.js` (ผลลัพธ์ `CQ.CharacterArtV2`)
- Modify: `js/sprites.js` / `js/render.js` — `heroFrame` เลือก frame v2 เมื่อ `g.stage.motion === 'v2'` และมีข้อมูล; ไม่มี → 9 ท่าเดิม
- Test: `tools/2026-10-15_check-character-art.cjs` (เพิ่มกรณี v2: ขนาด 54×48, density 2, `ax` 32, ความสูงตัวต่าง idle เดิม ≤ 1 px logical), `tools/2026-10-22_qa-haunted.cjs` (block ภาพด้วย `page.route` → เกมยังเล่นได้และใช้ procedural)

- [ ] **Step 1:** เพิ่ม check v2 ใน `tools/2026-10-15_check-character-art.cjs` และ check ภาพหายใน QA → FAIL
- [ ] **Step 2:** เขียน build script, รันสร้าง `js/2026-10-22_character-art-v2.js`, ต่อภาพฉาก/tile/ฟักทอง/ลูกไฟ/เมนู
- [ ] **Step 3:** checks → PASS; รอบ run 8 เฟรมใช้ `g.runPhase` แบ่ง 8 ช่วง; jump เลือก `jumpUp`/`jumpApex`/`jumpFall` ตาม `p.vy` (`< -150`, `|vy| ≤ 150`, `> 150`); `land` แสดง 0.08 วิหลัง event land; dead1→dead3 ตาม `deathAnim.t` (0–0.15, 0.15–0.6, > 0.6)
- [ ] **Step 4:** งบภาพเว็บสเตจ 4 ≤ 1 MB (`du -cb` ไฟล์ที่เกมโหลด)
- [ ] **Step 5:** Commit `feat(art): integrate Codex Haunted House art and stage-4 motion frames`

---

### Task 13: QA รวม, performance และเอกสาร

**Files:**
- Modify: `README.md` (ตารางสเตจ, ศัตรูฟักทอง, กลไกสวิตช์, ปุ่มกลับเช็กพอยต์, ประวัติเวอร์ชัน), `MANUAL.md` (หัวข้อสเตจ 4), `PLAN.md` (สรุปงานรอบนี้ + ลิงก์ spec/plan)
- Create: `.logs/2026-10-22_haunted-qa.md`

- [ ] **Step 1:** เล่นจบจริงด้วย input จริง: โหมดปกติ × 3 ตัวละคร (เก็บครบ 40), โหมดจับเวลา 1 รอบ (จบที่ 120 วิ) — ใช้ `tools/2026-10-16_qa-normal-liveplay.cjs` ที่ขยายให้รับ `haunted` (เพิ่มใน assert รายชื่อสเตจ + การสลับสวิตช์ในตัวหาเส้นทาง) หรือเล่นด้วย Playwright ตามเส้นทางที่บันทึกไว้
- [ ] **Step 2:** 5 ขนาดจอ (360×640, 390×844, 640×360, 844×390, 1366×768): screenshot สเตจ 4 ตอนเริ่ม, หลังสลับ, ในความมืดใกล้ฟักทองยิงไฟ, เมนูหยุดเกม
- [ ] **Step 3:** Regression: smoke สเตจ 1–3 × 3 ตัวละคร, ภาพ hero สเตจ 1–3 ตรง baseline; check ใน `tools/check-*.js` และ `tools/2026-10-1*_check-*` ผ่านทั้งหมด
- [ ] **Step 4:** Performance ตาม Task 9 Step 4 อีกรอบหลังใส่ภาพจริง
- [ ] **Step 5:** เขียน `.logs/2026-10-22_haunted-qa.md` (สิ่งที่ตรวจ, ผล, สิ่งที่ยังไม่ได้ตรวจ เช่น อุปกรณ์จริง/จอยเกมจริง) และอัปเดต README/MANUAL/PLAN เป็นภาษาไทย; แก้บรรทัดสถานะ v1.1.1 ใน README ที่ยังบอกว่า PR #25 รอ merge
- [ ] **Step 6:** Commit `docs: Haunted House stage docs and QA log` แล้ว push
