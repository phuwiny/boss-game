#!/usr/bin/env node
/*
 * ตรวจด่าน Coin Quest (ทุกสเตจ)
 *   node tools/check-level.js
 *
 * 1) ตรวจรูปแบบข้อมูลด่าน (ความกว้างแถว, สัญลักษณ์, ตำแหน่งศัตรู/เช็กพอยต์/บอส/หินหล่น, สเตจที่ห้ามมีเหว)
 * 2) จำลองการเล่นด้วยฟิสิกส์จริงของเกม (BFS จากจุดเริ่มต้น เดิน/กระโดดทุกรูปแบบ ไม่ใช้ไอเทม) ทีละตัวละคร
 *    เพื่อยืนยันว่า "ทุกจุด" ที่ระบบสุ่มอาจวางเหรียญ/ไอเทม (spawn pool) เก็บได้จริงด้วยทุกตัวละคร
 *    - ไม่กดกระโดดกลางอากาศ (ไม่ใช้กระโดด 2 ชั้น) และปิดการกันตาย จึงเป็นการตรวจแบบระมัดระวัง
 *    - กดกระโดดค้างได้ ตัวละครที่ลอยตัวได้จึงใช้การลอยในบางเส้นทาง
 * 3) ลองสุ่มวางแบบรายวันล่วงหน้า 1 ปี ทั้งโหมดปกติและโหมดจับเวลา เพื่อยืนยันว่าทุกวันได้เหรียญและไอเทมครบ ไม่ซ้อนกัน
 *    หมายเหตุ: รางแพลตฟอร์มเคลื่อนที่ถูกจำลองเป็นแผ่นไม้นิ่งตลอดแนวราง และไม่คิดศัตรู บอส และหินหล่น
 *    Boss Stage ตรวจเพิ่มว่าจุดที่เหรียญจากบอสอาจตกลงมา (เขตที่บอสเดิน) เก็บได้ทุกจุด
 *    BFS อยู่ใน tools/lib/reach.js (รู้จักบล็อกสวิตช์ม่วง/ส้ม: โหม่ง/ยิงสวิตช์ได้)
 * 4) สเตจ fixedCoins (วางเหรียญ/ไอเทมตายตัว ไม่สุ่ม): ตรวจจำนวน, การเข้าถึงจากจุดเริ่มและจากเช็กพอยต์ของแต่ละห้อง
 *    ทั้งสองสถานะสวิตช์, ตำแหน่งสวิตช์/รางแนวตั้ง/เช็กพอยต์ และเตือนเหรียญที่เป็นทางลัดของ Mew
 *
 * ตรวจเฉพาะบางสเตจ/ตัวละครได้ เช่น  node tools/check-level.js forest mew aclaire
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reach } = require('./lib/reach.js');

const ROOT = path.resolve(__dirname, '..');
const sandbox = { console: console };
sandbox.window = sandbox;
vm.createContext(sandbox);
['js/level.js', 'js/stage-forest.js', 'js/stage-castle.js', 'js/world.js', 'js/switches.js', 'js/pumpkin.js', 'js/characters.js', 'js/spawn.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

const CQ = sandbox.CQ;
const W = CQ.World;
const P = CQ.PHYS;
const Spawn = CQ.Spawn;
const T = P.T;
const ENEMY_NAME = { slime: 'สไลม์', boar: 'หมูป่า', phop: 'ฟักทองกระโดด', pfire: 'ฟักทองยิงไฟ' };

let failed = false;
function fail(msg) { failed = true; console.log('  ✗ ' + msg); }
const OUT = { fail: fail, warn: function (msg) { console.log(msg); }, log: function (msg) { console.log(msg); } };

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
  if (stage.boss && !lv.boss) fail(label + ' เป็น Boss Stage แต่ไม่มีบอส X');
  if (lv.boss) {
    onFloor(lv.boss, 'บอส');
    for (let tx = lv.boss.tx - 8; tx <= lv.boss.tx + 2; tx++) {
      for (let ty = lv.boss.ty - 2; ty <= lv.boss.ty; ty++) {
        if (W.tileAt(lv, tx, ty) !== CQ.TILE.EMPTY) fail('เขตบอสต้องโล่ง แต่มีของที่ (' + tx + ', ' + ty + ')');
      }
      if (!W.isSolid(lv, tx, lv.boss.ty + 1)) fail('เขตบอสต้องเป็นพื้นเรียบ แต่คอลัมน์ ' + tx + ' ไม่มีพื้น');
    }
  }
  lv.rocks.forEach(function (r) {
    if (!W.isSolid(lv, r.tx, r.ty - 1)) fail('จุดหินหล่นที่ (' + r.tx + ', ' + r.ty + ') ต้องอยู่ใต้เพดาน');
  });

  if (stage.noPits) {
    const pits = [];
    for (let tx = 0; tx < lv.w; tx++) if (!W.isSolid(lv, tx, lv.h - 1)) pits.push(tx);
    if (pits.length) fail(label + ' ต้องไม่มีเหว แต่แถวล่างสุดว่างที่คอลัมน์ ' + pits.slice(0, 10).join(', ') + (pits.length > 10 ? ' ...' : ''));
  }

  if (stage.fixedCoins) {
    // วางเหรียญ/ไอเทมตายตัวทั้งหมด ไม่มีการสุ่มรายวัน
    console.log('เหรียญตายตัว ' + lv.coins.length + ' | ไอเทม ' + lv.items.map(function (it) { return it.type; }).join(', ') +
      ' | สวิตช์ ' + lv.switches.length + ' | ห้อง ' + lv.rooms.length + ' | เป้าหมาย: เก็บครบทุกเหรียญ');
    checkFixed(lv, label, chars, OUT);
    return;
  }

  const pool = Spawn.buildPool(lv);
  const items = Spawn.itemsFor(stage);
  const nNormal = Spawn.coinsFor(stage, 'normal'), nTimed = Spawn.coinsFor(stage, 'timed');
  const bossCoins = stage.bossCoins || 0;
  const totalCoins = lv.coins.length + nNormal + bossCoins;
  console.log('จุดที่สุ่มวางได้: ' + pool.length + ' จุด | เหรียญในฉาก ' + totalCoins + ' (ตายตัว ' + lv.coins.length +
    (bossCoins ? ', จากบอส ' + bossCoins : '') + ') | ไอเทม ' + items.join(', ') + (stage.hp ? ' | พลังชีวิต ' + stage.hp : '') + ' | เป้าหมาย: เก็บครบทุกเหรียญ');
  if (pool.length < (nNormal + items.length) * 2) fail('จุดที่สุ่มวางได้น้อยเกินไป');
  if (pool.length < (nTimed + items.length) * 2) fail('จุดที่สุ่มวางได้น้อยเกินไปสำหรับโหมดจับเวลา');

  // เป้าหมายที่ต้องเข้าถึงได้: เหรียญตายตัว + ทุกจุดใน spawn pool (+ จุดที่เหรียญจากบอสอาจตก)
  const targets = lv.coins.map(function (c) { return { tx: c.tx, ty: c.ty, what: 'เหรียญตายตัว' }; })
    .concat(pool.map(function (s) { return { tx: s.tx, ty: s.ty, what: 'จุดสุ่ม' }; }));
  if (lv.boss) {
    for (let tx = lv.boss.tx - 8; tx <= lv.boss.tx + 2; tx++) {
      for (let ty = lv.boss.ty - 1; ty <= lv.boss.ty; ty++) targets.push({ tx: tx, ty: ty, what: 'จุดเหรียญจากบอส' });
    }
  }
  chars.forEach(function (ch) { checkReach(lv, ch, targets, label); });
  checkDaily(lv, pool, stage);
}

// ── BFS (tools/lib/reach.js) ─────────────────────────────────────
/**
 * BFS ด้วยฟิสิกส์ของตัวละคร ch คืนรายการเป้าหมายที่เก็บไม่ได้
 * out = { fail, log } (ค่าเริ่ม: ตัวพิมพ์ของสคริปต์นี้), opts ส่งต่อให้ reach()
 */
function checkReach(lv, ch, targets, label, opts, out) {
  out = out || OUT;
  const t0 = Date.now();
  const r = reach(CQ, lv, ch, targets, opts || {});
  const tag = '[' + label + ' / ' + ch.name + '] ';
  out.log(tag + 'จำลองการเล่น: ' + r.standing + ' ตำแหน่งยืน, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' วินาที');
  const missed = [];
  targets.forEach(function (t, i) {
    if (r.got.has(i)) return;
    missed.push(t);
    if (missed.length <= 30) out.fail(tag + t.what + ' ช่อง (' + t.tx + ', ' + t.ty + ') เก็บไม่ได้');
  });
  if (missed.length > 30) out.fail(tag + '...และอีก ' + (missed.length - 30) + ' จุด');
  out.log(tag + 'เข้าถึงได้ ' + (targets.length - missed.length) + ' / ' + targets.length + ' จุด');
  return missed;
}

// ── สเตจที่วางเหรียญ/ไอเทมตายตัว (stage.fixedCoins) ─────────────────
const FIXED_COINS = 40;
const FIXED_ITEMS = { heart: 3, mush: 1 };
const SW_NAME = { purple: 'ม่วง', orange: 'ส้ม' };

/**
 * กติกาสเตจ fixedCoins (ใช้ทั้งตอนตรวจสเตจจริงและในเทสต์ tools/check-haunted.js)
 *   จำนวนเหรียญ/ไอเทม, กฎ 1 (เข้าถึงจากจุดเริ่ม), กฎ 3 (แต่ละห้องเข้าถึงจากเช็กพอยต์ทั้งสองสถานะ),
 *   กฎ 4 (ตำแหน่งสวิตช์/ราง/เช็กพอยต์), กฎ 5 (เตือนทางลัดของ Mew)
 * out = { fail, warn, log }
 */
function checkFixed(lv, label, chars, out) {
  out = out || OUT;
  fixedCounts(lv, label, out);
  fixedLayout(lv, label, out);
  fixedReach(lv, label, chars, out);
  mewShortcuts(lv, out);
}

const inRoom = function (room) { return function (t) { return t.tx >= room.tx0 && t.tx <= room.tx1; }; };

/** จำนวนเหรียญ (40) และไอเทม (heart×3 + mush×1) */
function fixedCounts(lv, label, out) {
  if (lv.coins.length !== FIXED_COINS) out.fail(label + ': มีเหรียญ ' + lv.coins.length + ' เหรียญ (ต้องมี ' + FIXED_COINS + ')');
  const count = {};
  lv.items.forEach(function (it) { count[it.type] = (count[it.type] || 0) + 1; });
  const okItems = Object.keys(count).concat(Object.keys(FIXED_ITEMS)).every(function (k) { return (count[k] || 0) === (FIXED_ITEMS[k] || 0); });
  if (!okItems) {
    out.fail(label + ': ไอเทมต้องเป็น heart×3 + mush×1 แต่มี ' +
      Object.keys(count).map(function (k) { return k + '×' + count[k]; }).join(' + '));
  }
}

/** กฎ 4: ใต้สวิตช์ต้องว่าง, เหนือหัวรางแนวตั้งต้องว่าง, เช็กพอยต์/จุดเริ่มไม่ทับ/ไม่ยืนบนบล็อกสี */
function fixedLayout(lv, label, out) {
  const TILE = CQ.TILE;
  const isColor = function (t) { return t === TILE.PURPLE || t === TILE.ORANGE; };
  lv.switches.forEach(function (s) {
    if (W.tileAt(lv, s.tx, s.ty + 1) !== TILE.EMPTY) out.fail(label + ': ใต้สวิตช์ที่ (' + s.tx + ', ' + s.ty + ') ต้องเป็นช่องว่าง');
  });
  lv.vtracks.forEach(function (vt) {
    for (let tx = vt.tx - 1; tx <= vt.tx + 1; tx++) {
      const ty = vt.ty0 - 1, t = W.tileAt(lv, tx, ty);
      if (W.isSolid(lv, tx, ty) || t === TILE.SPIKE || isColor(t)) {
        out.fail(label + ': เหนือหัวรางแนวตั้ง ช่อง (' + tx + ', ' + ty + ') ต้องว่าง (แพลตฟอร์มขึ้นไปถึง)');
      }
    }
  });
  const notOnColor = function (c, what) {
    if (isColor(W.tileAt(lv, c.tx, c.ty)) || isColor(W.tileAt(lv, c.tx, c.ty + 1))) {
      out.fail(label + ': ' + what + 'ที่ (' + c.tx + ', ' + c.ty + ') ทับ/ยืนบนบล็อกม่วง/ส้ม');
    }
  };
  lv.checkpoints.forEach(function (c) { notOnColor(c, 'เช็กพอยต์'); });
  notOnColor(lv.start, 'จุดเริ่มต้น');
}

const fixedTargets = function (lv) {
  return lv.coins.map(function (c) { return { tx: c.tx, ty: c.ty, what: 'เหรียญ' }; })
    .concat(lv.items.map(function (it) { return { tx: it.tx, ty: it.ty, what: 'ไอเทม ' + it.type }; }));
};

/** กฎ 1 และกฎ 3 */
function fixedReach(lv, label, chars, out) {
  const targets = fixedTargets(lv);

  // กฎ 1: ทุกเหรียญ/ไอเทมเข้าถึงได้จากจุดเริ่ม สถานะม่วง
  chars.forEach(function (ch) {
    checkReach(lv, ch, targets, label + ' จากจุดเริ่ม (' + SW_NAME.purple + ')', { sw: 'purple' }, out);
  });

  // กฎ 3: แต่ละห้องเข้าถึงได้จากเช็กพอยต์ของห้อง (ห้อง 0 = จุดเริ่ม สถานะม่วงเท่านั้น)
  lv.rooms.forEach(function (room, k) {
    const tg = targets.filter(inRoom(room));
    if (k === 0) {
      chars.forEach(function (ch) {
        checkReach(lv, ch, tg, label + ' ห้อง 0 จากจุดเริ่ม (' + SW_NAME.purple + ')', { sw: 'purple', bounds: room }, out);
      });
      return;
    }
    const cp = lv.checkpoints.filter(inRoom(room))[0];
    if (!cp) { out.fail(label + ': ห้อง ' + k + ' (คอลัมน์ ' + room.tx0 + '-' + room.tx1 + ') ไม่มีเช็กพอยต์ C'); return; }
    ['purple', 'orange'].forEach(function (sw) {
      chars.forEach(function (ch) {
        checkReach(lv, ch, tg, label + ' ห้อง ' + k + ' จากเช็กพอยต์ (' + SW_NAME[sw] + ')', { start: cp, sw: sw, bounds: room }, out);
      });
    });
  });
}

/** กฎ 5 (เตือน): เหรียญที่ Mew ใช้กระโดดกลางอากาศเก็บได้ แต่ Bobo เก็บไม่ได้ (ไม่สลับสวิตช์ทั้งคู่) */
function mewShortcuts(lv, out) {
  const bobo = CQ.CHARACTERS.find(function (c) { return c.id === 'bobo'; });
  const mew = CQ.CHARACTERS.find(function (c) { return c.id === 'mew'; });
  const coins = lv.coins.map(function (c) { return { tx: c.tx, ty: c.ty }; });
  const gotMew = reach(CQ, lv, mew, coins, { toggles: false, airJumps: true }).got;
  const gotBobo = reach(CQ, lv, bobo, coins, { toggles: false }).got;
  coins.forEach(function (c, i) {
    if (gotMew.has(i) && !gotBobo.has(i)) out.warn('  ⚠ ทางลัด Mew: เหรียญ (' + c.tx + ', ' + c.ty + ')');
  });
}

// ── ทดลองสุ่มแบบรายวัน 1 ปี ───────────────────────────────────────
function checkDaily(lv, pool, stage) {
  const day0 = new Date(2026, 0, 1);
  const ITEMS = Spawn.itemsFor(stage);
  const MODES = [
    { id: 'normal', name: 'โหมดปกติ', coins: Spawn.coinsFor(stage, 'normal') },
    { id: 'timed', name: 'โหมดจับเวลา', coins: Spawn.coinsFor(stage, 'timed') }
  ];
  MODES.forEach(function (m) {
    let badDays = 0;
    for (let d = 0; d < 366; d++) {
      const date = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + d);
      const seed = Spawn.modeSeed(Spawn.dailySeed(date), m.id, stage.id);
      const r = Spawn.pick(pool, lv.w, Spawn.makeRng(seed), { coins: m.coins, items: ITEMS });
      const cells = new Set();
      r.coins.concat(r.items).forEach(function (s) { cells.add(s.tx + ',' + s.ty); });
      const types = {};
      r.items.forEach(function (it) { types[it.type] = (types[it.type] || 0) + 1; });
      const okItems = ITEMS.every(function (t) {
        return types[t] === ITEMS.filter(function (x) { return x === t; }).length;
      });
      if (r.coins.length !== m.coins || r.items.length !== ITEMS.length || cells.size !== r.coins.length + r.items.length || !okItems) {
        badDays++;
        if (badDays <= 5) fail(m.name + ' วันที่ ' + seed + ': ได้เหรียญ ' + r.coins.length + ', ไอเทม ' + r.items.length + ', ตำแหน่งไม่ซ้ำ ' + cells.size);
      }
    }
    const today = Spawn.pick(pool, lv.w, Spawn.makeRng(Spawn.modeSeed(Spawn.dailySeed(), m.id, stage.id)), { coins: m.coins, items: ITEMS });
    console.log(m.name + ' ทดลองสุ่มรายวัน 366 วัน: ' + (366 - badDays) + ' วันผ่าน | วันนี้ (' + Spawn.dailySeed() + '): เหรียญ ' + today.coins.length + ', ไอเทม ' +
      today.items.map(function (i) { return i.type + '@' + i.tx; }).join(' '));
  });
}

function main() {
  stages.forEach(checkStage);

  if (failed) {
    console.log('ผลตรวจ: ไม่ผ่าน');
    process.exit(1);
  }
  console.log('ผลตรวจ: ผ่าน ✓');
}

if (require.main === module) main();
module.exports = { CQ: CQ, checkReach: checkReach, checkFixed: checkFixed, fixedCounts: fixedCounts, fixedLayout: fixedLayout, fixedReach: fixedReach, mewShortcuts: mewShortcuts };
