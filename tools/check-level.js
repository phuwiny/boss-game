#!/usr/bin/env node
/*
 * ตรวจด่าน Coin Quest
 *   node tools/check-level.js
 *
 * 1) ตรวจรูปแบบข้อมูลด่าน (ความกว้างแถว, สัญลักษณ์, จำนวนเหรียญ = 20)
 * 2) จำลองการเล่นด้วยฟิสิกส์จริงของเกม (BFS จากจุดเริ่มต้น เดิน/กระโดดทุกรูปแบบ)
 *    เพื่อยืนยันว่าเหรียญทุกเหรียญเก็บได้จริง
 *    หมายเหตุ: รางแพลตฟอร์มเคลื่อนที่ถูกจำลองเป็นแผ่นไม้นิ่งตลอดแนวราง และไม่คิดศัตรู
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
['js/level.js', 'js/world.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const CQ = sandbox.CQ;
const W = CQ.World;
const P = CQ.PHYS;
const T = P.T;
const DT = P.DT;
const REQUIRED_COINS = 20;

let failed = false;
function fail(msg) { failed = true; console.log('  ✗ ' + msg); }

const lv = CQ.parseLevel(CQ.LEVEL_SECTIONS, { staticPlatforms: true });
console.log('ด่านขนาด ' + lv.w + ' x ' + lv.h + ' ช่อง (' + lv.w * T + ' px)');
lv.errors.forEach(fail);
if (lv.coins.length !== REQUIRED_COINS) fail('จำนวนเหรียญ ' + lv.coins.length + ' (ต้องเป็น ' + REQUIRED_COINS + ')');

const onFloor = function (e, what) {
  if (!W.isSolid(lv, e.tx, e.ty + 1) && !W.isOneWay(lv, e.tx, e.ty + 1)) fail(what + ' ที่ (' + e.tx + ', ' + e.ty + ') ไม่ได้อยู่บนพื้น');
};
lv.enemies.forEach(function (e) { onFloor(e, 'สไลม์'); });
lv.checkpoints.forEach(function (c) { onFloor(c, 'เช็กพอยต์'); });
onFloor(lv.start, 'จุดเริ่มต้น');

// ── BFS ──────────────────────────────────────────────────────────
const coinIndex = new Map();
lv.coins.forEach(function (c, i) { coinIndex.set(c.ty * lv.w + c.tx, i); });
const got = new Set();

function collect(p) {
  const tx0 = Math.floor((p.x - P.COIN_R) / T), tx1 = Math.floor((p.x + p.w + P.COIN_R) / T);
  const ty0 = Math.floor((p.y - P.COIN_R) / T), ty1 = Math.floor((p.y + p.h + P.COIN_R) / T);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const i = coinIndex.get(ty * lv.w + tx);
      if (i === undefined || got.has(i)) continue;
      const c = lv.coins[i];
      if (W.overlap(p.x, p.y, p.w, p.h, c.x - P.COIN_R, c.y - P.COIN_R, P.COIN_R * 2, P.COIN_R * 2)) got.add(i);
    }
  }
}

const clone = function (p) { return Object.assign({}, p); };
const key = function (p) {
  return Math.round(p.x / 8) + ',' + Math.round(p.y) + ',' + (Math.abs(p.vx) > 150 ? Math.sign(p.vx) : 0);
};
const input = function (dir, jump, pressed) {
  return { left: dir < 0, right: dir > 0, jump: jump, jumpPressed: pressed };
};

const seen = new Set();
const queue = [];
function enqueue(p) {
  const k = key(p);
  if (seen.has(k)) return;
  seen.add(k);
  queue.push(clone(p));
}

function simAir(p, dir1, switchAt, dir2, hold, pressFirst) {
  for (let i = 0; i < 900; i++) {
    const dir = i < switchAt ? dir1 : dir2;
    W.stepPlayer(p, input(dir, i < hold, pressFirst && i === 0), lv, DT, null);
    if (p.dead) return;
    collect(p);
    if (i > 1 && p.onGround) { enqueue(p); return; }
  }
}

function simWalk(s, dir) {
  const p = clone(s);
  for (let i = 0; i < 480; i++) {
    const beforeX = p.x;
    W.stepPlayer(p, input(dir, false, false), lv, DT, null);
    if (p.dead) return;
    collect(p);
    if (!p.onGround) {
      [dir, 0, -dir].forEach(function (d2) { simAir(clone(p), dir, 0, d2, 0, false); });
      return;
    }
    if (i % 4 === 3) enqueue(p);
    if (i > 20 && p.x === beforeX) { enqueue(p); return; } // ชนกำแพง
  }
  enqueue(p);
}

const start = W.makePlayer(lv.start.tx, lv.start.ty);
for (let i = 0; i < 120 && !start.onGround; i++) W.stepPlayer(start, input(0, false, false), lv, DT, null);
enqueue(start);

const HOLDS = [4, 14, 999];
const SWITCHES = [20, 45];
const t0 = Date.now();
while (queue.length) {
  const s = queue.shift();
  collect(s);
  simWalk(s, -1);
  simWalk(s, 1);
  for (const d1 of [-1, 0, 1]) {
    for (const hold of HOLDS) {
      simAir(clone(s), d1, 9999, d1, hold, true);
      for (const sw of SWITCHES) {
        for (const d2 of [-1, 0, 1]) {
          if (d2 !== d1) simAir(clone(s), d1, sw, d2, hold, true);
        }
      }
    }
  }
}

console.log('จำลองการเล่น: ' + seen.size + ' ตำแหน่งยืน, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' วินาที');
lv.coins.forEach(function (c, i) {
  const ok = got.has(i);
  if (!ok) fail('เหรียญที่ ' + (i + 1) + ' (ช่อง ' + c.tx + ', ' + c.ty + ') เก็บไม่ได้');
});
console.log('เก็บได้ ' + got.size + ' / ' + lv.coins.length + ' เหรียญ');

if (failed) {
  console.log('ผลตรวจ: ไม่ผ่าน');
  process.exit(1);
}
console.log('ผลตรวจ: ผ่าน ✓');
