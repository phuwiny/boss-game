#!/usr/bin/env node
/*
 * ตรวจด่าน Coin Quest (ทุกสเตจ)
 *   node tools/check-level.js
 *
 * 1) ตรวจรูปแบบข้อมูลด่าน (ความกว้างแถว, สัญลักษณ์, ตำแหน่งศัตรู/เช็กพอยต์, สเตจที่ห้ามมีเหว)
 * 2) จำลองการเล่นด้วยฟิสิกส์จริงของเกม (BFS จากจุดเริ่มต้น เดิน/กระโดดทุกรูปแบบ ไม่ใช้ไอเทม) ทีละตัวละคร
 *    เพื่อยืนยันว่า "ทุกจุด" ที่ระบบสุ่มอาจวางเหรียญ/ไอเทม (spawn pool) เก็บได้จริงด้วยทุกตัวละคร
 *    - ไม่กดกระโดดกลางอากาศ (ไม่ใช้กระโดด 2 ชั้น) และปิดการกันตาย จึงเป็นการตรวจแบบระมัดระวัง
 *    - กดกระโดดค้างได้ ตัวละครที่ลอยตัวได้จึงใช้การลอยในบางเส้นทาง
 * 3) ลองสุ่มวางแบบรายวันล่วงหน้า 1 ปี ทั้งโหมดปกติและโหมดจับเวลา เพื่อยืนยันว่าทุกวันได้เหรียญและไอเทมครบ ไม่ซ้อนกัน
 *    หมายเหตุ: รางแพลตฟอร์มเคลื่อนที่ถูกจำลองเป็นแผ่นไม้นิ่งตลอดแนวราง และไม่คิดศัตรู
 *
 * ตรวจเฉพาะบางสเตจ/ตัวละครได้ เช่น  node tools/check-level.js forest mew aclaire
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
['js/level.js', 'js/stage-forest.js', 'js/world.js', 'js/characters.js', 'js/spawn.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const CQ = sandbox.CQ;
const W = CQ.World;
const P = CQ.PHYS;
const Spawn = CQ.Spawn;
const T = P.T;
const DT = P.DT;
const ENEMY_NAME = { slime: 'สไลม์', boar: 'หมูป่า' };

let failed = false;
function fail(msg) { failed = true; console.log('  ✗ ' + msg); }

const args = process.argv.slice(2);
const isStage = function (a) { return CQ.STAGES.some(function (s) { return s.id === a; }); };
const isChar = function (a) { return CQ.CHARACTERS.some(function (c) { return c.id === a; }); };
args.forEach(function (a) {
  if (!isStage(a) && !isChar(a)) {
    fail('ไม่รู้จัก "' + a + '" (สเตจ: ' + CQ.STAGES.map(function (s) { return s.id; }).join(', ') +
      ' | ตัวละคร: ' + CQ.CHARACTERS.map(function (c) { return c.id; }).join(', ') + ')');
  }
});
const wantStages = args.filter(isStage);
const wantChars = args.filter(isChar);
const stages = CQ.STAGES.filter(function (s) { return !wantStages.length || wantStages.indexOf(s.id) >= 0; });
const chars = CQ.CHARACTERS.filter(function (c) { return !wantChars.length || wantChars.indexOf(c.id) >= 0; });


function checkStage(stage) {
  const label = 'สเตจ ' + stage.no + ' ' + stage.name;
  console.log('── ' + label + ' ──');
  const lv = CQ.parseLevel(stage.sections, { staticPlatforms: true });
  const spikes = lv.tiles.filter(function (t) { return t === CQ.TILE.SPIKE; }).length;
  console.log('ด่านขนาด ' + lv.w + ' x ' + lv.h + ' ช่อง (' + lv.w * T + ' px) | หนาม ' + spikes + ' ช่อง | ศัตรู ' +
    Object.keys(ENEMY_NAME).map(function (k) {
      return ENEMY_NAME[k] + ' ' + lv.enemies.filter(function (e) { return e.kind === k; }).length;
    }).join(', ') + ' | เช็กพอยต์ ' + lv.checkpoints.length);
  lv.errors.forEach(function (e) { fail(label + ': ' + e); });

  const onFloor = function (e, what) {
    if (!W.isSolid(lv, e.tx, e.ty + 1) && !W.isOneWay(lv, e.tx, e.ty + 1)) fail(what + ' ที่ (' + e.tx + ', ' + e.ty + ') ไม่ได้อยู่บนพื้น');
  };
  lv.enemies.forEach(function (e) { onFloor(e, ENEMY_NAME[e.kind]); });
  lv.checkpoints.forEach(function (c) { onFloor(c, 'เช็กพอยต์'); });
  onFloor(lv.start, 'จุดเริ่มต้น');

  if (stage.noPits) {
    const pits = [];
    for (let tx = 0; tx < lv.w; tx++) if (!W.isSolid(lv, tx, lv.h - 1)) pits.push(tx);
    if (pits.length) fail(label + ' ต้องไม่มีเหว แต่แถวล่างสุดว่างที่คอลัมน์ ' + pits.slice(0, 10).join(', ') + (pits.length > 10 ? ' ...' : ''));
  }

  const pool = Spawn.buildPool(lv);
  const totalCoins = lv.coins.length + Spawn.COINS;
  console.log('จุดที่สุ่มวางได้: ' + pool.length + ' จุด | เหรียญในฉาก ' + totalCoins + ' (ตายตัว ' + lv.coins.length + ') | เป้าหมาย: เก็บครบทุกเหรียญ');
  if (pool.length < (Spawn.COINS + Spawn.ITEMS.length) * 2) fail('จุดที่สุ่มวางได้น้อยเกินไป');
  if (pool.length < (Spawn.TIMED_COINS + Spawn.ITEMS.length) * 2) fail('จุดที่สุ่มวางได้น้อยเกินไปสำหรับโหมดจับเวลา');

  // เป้าหมายที่ต้องเข้าถึงได้: เหรียญตายตัว + ทุกจุดใน spawn pool
  const targets = lv.coins.map(function (c) { return { tx: c.tx, ty: c.ty, what: 'เหรียญตายตัว' }; })
    .concat(pool.map(function (s) { return { tx: s.tx, ty: s.ty, what: 'จุดสุ่ม' }; }));
  chars.forEach(function (ch) { checkReach(lv, ch, targets, label); });
  checkDaily(lv, pool, stage);
}

// ── BFS ──────────────────────────────────────────────────────────
const R = P.COIN_R;
const clone = function (p) { return Object.assign({}, p); };
const key = function (p) {
  return Math.round(p.x / 8) + ',' + Math.round(p.y) + ',' + (Math.abs(p.vx) > 150 ? Math.sign(p.vx) : 0);
};
const input = function (dir, jump, pressed) {
  return { left: dir < 0, right: dir > 0, jump: jump, jumpPressed: pressed };
};
const HOLDS = [4, 14, 999];
const SWITCHES = [20, 45];

/** BFS ด้วยฟิสิกส์ของตัวละคร ch คืนจำนวนเป้าหมายที่เก็บไม่ได้ */
function checkReach(lv, ch, targets, label) {
  const targetIndex = new Map();
  targets.forEach(function (t, i) {
    const k = t.ty * lv.w + t.tx;
    if (!targetIndex.has(k)) targetIndex.set(k, []);
    targetIndex.get(k).push(i);
  });
  const got = new Set();
  const seen = new Set();
  const queue = [];

  function collect(p) {
    const tx0 = Math.floor((p.x - R) / T), tx1 = Math.floor((p.x + p.w + R) / T);
    const ty0 = Math.floor((p.y - R) / T), ty1 = Math.floor((p.y + p.h + R) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const list = targetIndex.get(ty * lv.w + tx);
        if (!list || got.has(list[0])) continue;
        const cx = tx * T + T / 2, cy = ty * T + T / 2;
        if (W.overlap(p.x, p.y, p.w, p.h, cx - R, cy - R, R * 2, R * 2)) list.forEach(function (i) { got.add(i); });
      }
    }
  }

  function enqueue(p) {
    const k = key(p);
    if (seen.has(k)) return;
    seen.add(k);
    queue.push(clone(p));
  }

  function simAir(p, dir1, switchAt, dir2, hold, pressFirst) {
    for (let i = 0; i < 1200; i++) {
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

  const start = W.makePlayer(lv.start.tx, lv.start.ty, ch);
  start.guard = 0; // ไม่นับการเดินผ่านหนามด้วยการกันตาย
  for (let i = 0; i < 120 && !start.onGround; i++) W.stepPlayer(start, input(0, false, false), lv, DT, null);
  enqueue(start);

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

  const tag = '[' + label + ' / ' + ch.name + '] ';
  console.log(tag + 'จำลองการเล่น: ' + seen.size + ' ตำแหน่งยืน, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' วินาที');
  let missing = 0;
  targets.forEach(function (t, i) {
    if (got.has(i)) return;
    missing++;
    if (missing <= 30) fail(tag + t.what + ' ช่อง (' + t.tx + ', ' + t.ty + ') เก็บไม่ได้');
  });
  if (missing > 30) fail(tag + '...และอีก ' + (missing - 30) + ' จุด');
  console.log(tag + 'เข้าถึงได้ ' + (targets.length - missing) + ' / ' + targets.length + ' จุด');
  return missing;
}

// ── ทดลองสุ่มแบบรายวัน 1 ปี ───────────────────────────────────────
function checkDaily(lv, pool, stage) {
  const day0 = new Date(2026, 0, 1);
  const MODES = [
    { id: 'normal', name: 'โหมดปกติ', coins: Spawn.COINS },
    { id: 'timed', name: 'โหมดจับเวลา', coins: Spawn.TIMED_COINS }
  ];
  MODES.forEach(function (m) {
    let badDays = 0;
    for (let d = 0; d < 366; d++) {
      const date = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + d);
      const seed = Spawn.modeSeed(Spawn.dailySeed(date), m.id, stage.id);
      const r = Spawn.pick(pool, lv.w, Spawn.makeRng(seed), { coins: m.coins });
      const cells = new Set();
      r.coins.concat(r.items).forEach(function (s) { cells.add(s.tx + ',' + s.ty); });
      const types = {};
      r.items.forEach(function (it) { types[it.type] = (types[it.type] || 0) + 1; });
      const okItems = Spawn.ITEMS.every(function (t) {
        return types[t] === Spawn.ITEMS.filter(function (x) { return x === t; }).length;
      });
      if (r.coins.length !== m.coins || r.items.length !== Spawn.ITEMS.length || cells.size !== r.coins.length + r.items.length || !okItems) {
        badDays++;
        if (badDays <= 5) fail(m.name + ' วันที่ ' + seed + ': ได้เหรียญ ' + r.coins.length + ', ไอเทม ' + r.items.length + ', ตำแหน่งไม่ซ้ำ ' + cells.size);
      }
    }
    const today = Spawn.pick(pool, lv.w, Spawn.makeRng(Spawn.modeSeed(Spawn.dailySeed(), m.id, stage.id)), { coins: m.coins });
    console.log(m.name + ' ทดลองสุ่มรายวัน 366 วัน: ' + (366 - badDays) + ' วันผ่าน | วันนี้ (' + Spawn.dailySeed() + '): เหรียญ ' + today.coins.length + ', ไอเทม ' +
      today.items.map(function (i) { return i.type + '@' + i.tx; }).join(' '));
  });
}

stages.forEach(checkStage);

if (failed) {
  console.log('ผลตรวจ: ไม่ผ่าน');
  process.exit(1);
}
console.log('ผลตรวจ: ผ่าน ✓');
