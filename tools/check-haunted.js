#!/usr/bin/env node
/*
 * ตรวจระบบของสเตจ 4 Haunted House (ตัวแปลงด่าน บล็อกสวิตช์ รางแนวตั้ง ฟักทอง ฯลฯ)
 *   node tools/check-haunted.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
// เพิ่มไฟล์ที่ต้องใช้ในรายการนี้ (งานถัดไปจะต่อท้าย)
['js/level.js', 'js/stage-forest.js', 'js/stage-castle.js', 'js/world.js', 'js/switches.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});
const CQ = sandbox.CQ;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
// ข้อมูลจาก vm sandbox มี prototype ของอีก realm จึงแปลงเป็น JSON ธรรมดาก่อนเทียบแบบ deep
function same(actual, expected, msg) { assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg); }

// ── ด่านจำลอง 2 section (สูง 18 แถว) ─────────────────────────────
// A กว้าง 12: P เริ่ม, M(ม่วง) ที่ (4,13), O(ส้ม) ที่ (5,13), T สวิตช์ที่ (6,9), k ยืนบนพื้น, H ไอเทมหัวใจ, ~ ราง
const FIXTURE_A = [
  '............', //  0
  '............', //  1
  '............', //  2
  '............', //  3
  '............', //  4
  '............', //  5
  '............', //  6
  '............', //  7
  '............', //  8
  '......T.....', //  9
  '............', // 10
  '.......~~~..', // 11
  '............', // 12
  '..P.MO.k...H', // 13
  '############', // 14
  '############', // 15
  '############', // 16
  '############'  // 17
];
// B กว้าง 10 (เริ่มที่คอลัมน์ 12): รางแนวตั้ง | ที่ tx 16 แถว 6-12 (3 คอลัมน์ 15-17 ว่าง), m ไอเทมเห็ด, j ยืนบนพื้น
const FIXTURE_B = [
  '..........', //  0
  '..........', //  1
  '..........', //  2
  '..........', //  3
  '..........', //  4
  '..........', //  5
  '....|.....', //  6
  '....|.....', //  7
  '....|.....', //  8
  '....|.....', //  9
  '....|.....', // 10
  '....|.....', // 11
  '....|.....', // 12
  '.m..j.....', // 13
  '##########', // 14
  '##########', // 15
  '##########', // 16
  '##########'  // 17
];
// หมายเหตุ: ที่ (11,13) ใน A คือ H และ (13,13) ใน B คือ m

t('parse: บล็อกสวิตช์ ไอเทม ฟักทอง ราง และห้อง', function () {
  const lv = CQ.parseLevel([FIXTURE_A, FIXTURE_B]); // สอง section กว้าง 12 และ 10
  same(lv.errors, []);
  assert.strictEqual(lv.tiles[13 * lv.w + 4], CQ.TILE.PURPLE);
  assert.strictEqual(lv.tiles[13 * lv.w + 5], CQ.TILE.ORANGE);
  assert.strictEqual(lv.tiles[9 * lv.w + 6], CQ.TILE.SWITCH);
  same(lv.switches, [{ tx: 6, ty: 9 }]);
  same(lv.items.map(i => i.type).sort(), ['heart', 'mush']);
  same(lv.enemies.map(e => e.kind).sort(), ['pfire', 'phop']);
  same(lv.rooms, [{ tx0: 0, tx1: 11 }, { tx0: 12, tx1: 21 }]);
  assert.strictEqual(lv.sw, 'purple');
  assert.ok(typeof lv.swPending.add === 'function' && typeof lv.swPending.has === 'function');
  assert.strictEqual(lv.swPending.size, 0);
  same(lv.vtracks, [{ tx: 16, ty0: 6, ty1: 12 }]);
  const pl = lv.platforms.find(p => p.axis === 'y');
  same([pl.x, pl.y, pl.minY, pl.maxY, pl.w], [15 * 32, 12 * 32, 6 * 32, 12 * 32, 96]);
  same([pl.h, pl.dir, pl.speed, pl.wait, pl.waitT, pl.dx, pl.vx, pl.dy, pl.vy], [14, -1, 80, 0.5, 0, 0, 0, 0, 0]);
  assert.ok(lv.platforms.filter(p => p.axis === 'x').length >= 1);
  assert.ok(lv.platforms.filter(p => p.axis === 'x').every(p => p.dy === 0 && p.vy === 0));
});
t('parse: ตำแหน่งไอเทมและศัตรู', function () {
  const lv = CQ.parseLevel([FIXTURE_A, FIXTURE_B]);
  same(lv.items, [{ tx: 11, ty: 13, type: 'heart' }, { tx: 13, ty: 13, type: 'mush' }]);
  const k = lv.enemies.find(e => e.kind === 'phop'), j = lv.enemies.find(e => e.kind === 'pfire');
  same([k.tx, k.ty, j.tx, j.ty], [7, 13, 16, 13]);
});
t('parse staticPlatforms: รางแนวตั้งเป็นแผ่นไม้ 3 ช่องทุกแถว', function () {
  const lv = CQ.parseLevel([FIXTURE_A, FIXTURE_B], { staticPlatforms: true });
  for (let ty = 6; ty <= 12; ty++) for (let tx = 15; tx <= 17; tx++) assert.strictEqual(lv.tiles[ty * lv.w + tx], CQ.TILE.ONEWAY);
  assert.strictEqual(lv.platforms.length, 0);
});
t('parse: สเตจเดิมไม่มี error และไม่มีไอเทมวางตายตัว', function () {
  CQ.STAGES.forEach(function (s) { const lv = CQ.parseLevel(s.sections); same(lv.errors, []); assert.strictEqual(lv.items.length, 0); });
});

// ── บล็อกสวิตช์ ───────────────────────────────────────────────────
// ด่านจำลอง: พื้นแถว 14, บล็อกม่วงแถว 11 คอลัมน์ 3-5, บล็อกส้มแถว 11 คอลัมน์ 7-9, สวิตช์ที่ (2, 9)
function fixture() {
  const rows = [];
  for (let y = 0; y < 18; y++) {
    let r = '............';
    if (y === 9) r = '..T.........';
    else if (y === 11) r = '...MMM.OOO..';
    else if (y === 13) r = 'P...........';
    else if (y >= 14) r = '############';
    rows.push(r);
  }
  return CQ.parseLevel([rows]);
}
const W = CQ.World, Switches = CQ.Switches, DT = CQ.PHYS.DT;
const idle = { left: false, right: false, jump: false, jumpPressed: false };

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

// ── แพลตฟอร์มแนวตั้ง ──────────────────────────────────────────────
// ด่านจำลอง: รางแนวตั้ง | ที่ tx 4 แถว 4-12 (แพลตฟอร์มกว้าง 3 ช่อง คอลัมน์ 3-5) พื้นแถว 14
function vfixture() {
  const rows = [];
  for (let y = 0; y < 18; y++) {
    let r = '..........';
    if (y >= 4 && y <= 12) r = '....|.....';
    else if (y >= 14) r = '##########';
    rows.push(r);
  }
  return CQ.parseLevel([rows]);
}
// ราง ~ แนวนอนแถว 11 คอลัมน์ 2-8 พื้นแถว 14
const HFIXTURE = (function () {
  const rows = [];
  for (let y = 0; y < 18; y++) {
    let r = '..........';
    if (y === 11) r = '..~~~~~~~.';
    else if (y >= 14) r = '##########';
    rows.push(r);
  }
  return rows;
})();
// วางผู้เล่นเหนือแพลตฟอร์มแล้วให้ตกลงมายืนบนนั้น (ไม่ขยับแพลตฟอร์ม)
function standOn(pl, lv) {
  const p = W.makePlayer(0, 0, null, 5);
  p.x = pl.x + (pl.w - p.w) / 2; p.y = pl.y - p.h - 2; p.vy = 0;
  for (let i = 0; i < 20 && p.ride !== pl; i++) W.stepPlayer(p, idle, lv, DT, []);
  assert.strictEqual(p.ride, pl, 'ผู้เล่นต้องลงมายืนบนแพลตฟอร์ม');
  return p;
}

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
t('vplatform: ตกลงมาจากความสูงน้อยๆ ลงบนแพลตฟอร์มขาขึ้นต้องไม่ทะลุ', function () {
  for (let h = 0; h <= 120; h += 2.5) {
    const lv = vfixture(); const pl = lv.platforms[0];
    while (pl.y > 300) W.stepPlatform(pl, DT); // เลื่อนมากลางราง ขาขึ้น
    assert.strictEqual(pl.dir, -1);
    const p = W.makePlayer(0, 0, null, 5);
    p.x = pl.x + (pl.w - p.w) / 2; p.y = pl.y - p.h - h; p.vy = 0;
    for (let i = 0; i < 120; i++) { W.stepPlatform(pl, DT); W.stepPlayer(p, idle, lv, DT, []); } // แพลตฟอร์มก่อนผู้เล่น เหมือน main.js
    assert.strictEqual(p.ride, pl, 'ทะลุแพลตฟอร์มเมื่อตกจากสูง ' + h + ' px');
  }
});

console.log('\nผ่านทั้งหมด ' + n + ' ข้อ');
