#!/usr/bin/env node
/*
 * ตรวจกติกามินิเกม "Coin Rain" (js/rain-rules.js)
 *   node tools/check-rain.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'rain-rules.js'), 'utf8'), sandbox);
const R = sandbox.CQ.RainRules;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
function makeRng(seed) {
  return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
const DT = 1 / 120;

/** วางของ 1 ชิ้นเหนือหัวตัวละครพอดี แล้วเดินจนของหายไป */
function dropOn(s, kind) {
  s.objs.length = 0;
  s.spawnT = 999;
  const o = { kind: kind, x: s.player.x, y: s.groundY - 120, vx: 0, vy: 200, r: R.KINDS[kind].r, rot: 0, vr: 0 };
  s.objs.push(o);
  const ev = [];
  for (let i = 0; i < 240 && s.objs.length; i++) ev.push.apply(ev, R.step(s, DT, {}));
  s.spawnT = 999;
  return ev;
}

t('ความกว้างสนามอยู่ในช่วง MIN_W..MAX_W', function () {
  assert.strictEqual(R.fieldWidth(0.46), R.MIN_W);
  assert.strictEqual(R.fieldWidth(3), R.MAX_W);
  assert.strictEqual(R.fieldWidth(1), 600);
});

t('ความยากเพิ่มตามเวลาและมีเพดาน', function () {
  const a = R.difficulty(0, 420), b = R.difficulty(60, 420), c = R.difficulty(9999, 420);
  assert(b.speed > a.speed && b.interval < a.interval && b.rock > a.rock);
  assert.strictEqual(c.speed, 440);
  assert(c.interval >= 0.32 * 0.55 - 1e-9);
  assert(c.rock <= 0.42);
  assert.strictEqual(a.heart, 0, 'ช่วงแรกยังไม่มีหัวใจ');
});

t('ตัวคูณคอมโบ: ทุก 10 คอมโบ +1 สูงสุด 5', function () {
  assert.strictEqual(R.multiplier(0), 1);
  assert.strictEqual(R.multiplier(9), 1);
  assert.strictEqual(R.multiplier(10), 2);
  assert.strictEqual(R.multiplier(39), 4);
  assert.strictEqual(R.multiplier(500), R.MAX_MULT);
});

t('เก็บเหรียญ +1 / เพชร +5 / คอมโบเพิ่ม', function () {
  const s = R.newGame({ w: 400, charId: 'bobo', rng: makeRng(1) });
  let ev = dropOn(s, 'coin');
  assert.strictEqual(s.score, 1); assert.strictEqual(s.combo, 1);
  assert(ev.some(function (e) { return e.type === 'coin'; }));
  dropOn(s, 'gem');
  assert.strictEqual(s.score, 6); assert.strictEqual(s.combo, 2);
});

t('คอมโบ 10 ขึ้นไปคูณแต้ม และเหรียญตกพื้นตัดคอมโบ', function () {
  const s = R.newGame({ w: 400, charId: 'bobo', rng: makeRng(2) });
  for (let i = 0; i < 10; i++) dropOn(s, 'coin');
  assert.strictEqual(s.score, 9 + 2); // เหรียญที่ 10 ได้ x2
  // เหรียญตกไกลตัว
  s.objs.push({ kind: 'coin', x: s.player.x < 200 ? 380 : 20, y: s.groundY - 40, vx: 0, vy: 300, r: 13, rot: 0, vr: 0 });
  let ev = [];
  for (let i = 0; i < 60; i++) ev = ev.concat(R.step(s, DT, {}));
  assert.strictEqual(s.combo, 0);
  assert(ev.some(function (e) { return e.type === 'miss'; }));
});

t('โดนหิน -1 หัวใจ อมตะชั่วครู่ และหมดหัวใจ = จบเกม', function () {
  const s = R.newGame({ w: 400, charId: 'mew', rng: makeRng(3) });
  assert.strictEqual(s.hp, 3);
  dropOn(s, 'rock');
  assert.strictEqual(s.hp, 2);
  dropOn(s, 'rock'); // ยังอมตะอยู่ ไม่เสียเพิ่ม
  assert.strictEqual(s.hp, 2);
  s.player.inv = 0; dropOn(s, 'rock');
  s.player.inv = 0; const ev = dropOn(s, 'rock');
  assert.strictEqual(s.hp, 0);
  assert(s.over && ev.some(function (e) { return e.type === 'over'; }));
  assert.strictEqual(R.step(s, DT, {}).length, 0, 'จบเกมแล้วไม่เดินต่อ');
});

t('หัวใจ +1 ไม่เกินสูงสุด (เต็มแล้วได้แต้มแทน)', function () {
  const s = R.newGame({ w: 400, charId: 'mew', rng: makeRng(4) });
  dropOn(s, 'rock'); s.player.inv = 0;
  dropOn(s, 'heart');
  assert.strictEqual(s.hp, 3);
  const ev = dropOn(s, 'heart');
  assert.strictEqual(s.hp, 3);
  assert(ev.some(function (e) { return e.type === 'bonus' && e.pts === 3; }));
});

t('ความสามารถตัวละคร: Bobo 4 หัวใจ, Aclaire กันหิน 1 ครั้ง, Mew ดูดเหรียญ', function () {
  assert.strictEqual(R.newGame({ charId: 'bobo' }).hp, 4);
  const a = R.newGame({ w: 400, charId: 'aclaire', rng: makeRng(5) });
  const ev = dropOn(a, 'rock');
  assert.strictEqual(a.hp, 3);
  assert(ev.some(function (e) { return e.type === 'guard'; }));
  a.player.inv = 0; dropOn(a, 'rock');
  assert.strictEqual(a.hp, 2);

  // เหรียญตกห่างตัว 60 หน่วย: Mew ดูดเข้ามาเก็บได้ Bobo เก็บไม่ได้
  ['mew', 'bobo'].forEach(function (id) {
    const s = R.newGame({ w: 400, charId: id, rng: makeRng(6) });
    s.spawnT = 999;
    s.objs.push({ kind: 'coin', x: s.player.x + 60, y: s.groundY - 250, vx: 0, vy: 200, r: 13, rot: 0, vr: 0 });
    for (let i = 0; i < 240 && s.objs.length; i++) R.step(s, DT, {});
    assert.strictEqual(s.score, id === 'mew' ? 1 : 0, id);
  });
});

t('ลากนิ้ว: ตัวละครเดินตามนิ้วและไม่ออกนอกสนาม', function () {
  const s = R.newGame({ w: 400, charId: 'bobo', rng: makeRng(7) });
  for (let i = 0; i < 120; i++) R.step(s, DT, { target: 100 });
  assert(Math.abs(s.player.x - 100) < 1);
  for (let i = 0; i < 240; i++) R.step(s, DT, { target: -500 });
  assert(s.player.x >= s.player.w / 2);
  for (let i = 0; i < 240; i++) R.step(s, DT, { move: 1 });
  assert(s.player.x <= s.w - s.player.w / 2);
});

/** บอทง่าย ๆ: หลบหินที่ใกล้ตัว แล้วเดินไปหาเหรียญที่ต่ำที่สุด */
function bot(s) {
  const p = s.player;
  let danger = null, goal = null;
  for (let i = 0; i < s.objs.length; i++) {
    const o = s.objs[i];
    if (o.kind === 'rock') {
      const eta = (s.groundY - p.h - o.y) / o.vy;
      if (eta < 0.55 && Math.abs(o.x - p.x) < p.w / 2 + o.r + 22 && (!danger || o.y > danger.y)) danger = o;
    } else if (!goal || o.y > goal.y) goal = o;
  }
  if (danger) {
    const left = danger.x - p.w - danger.r - 30, right = danger.x + p.w + danger.r + 30;
    const canL = left > p.w / 2, canR = right < s.w - p.w / 2;
    return { target: canL && (!canR || Math.abs(left - p.x) < Math.abs(right - p.x)) ? left : right };
  }
  return goal ? { target: goal.x } : {};
}

t('เล่นได้จริง: บอทหลบหินอยู่รอดนาน ส่วนการยืนนิ่งแพ้เร็ว (ทุกตัวละคร ทุกขนาดสนาม)', function () {
  ['bobo', 'mew', 'aclaire'].forEach(function (id) {
    [R.MIN_W, 600, R.MAX_W].forEach(function (w) {
      let botT = 0, idleT = 0, score = 0;
      const games = 10;
      for (let g = 0; g < games; g++) {
        const a = R.newGame({ w: w, charId: id, rng: makeRng(100 + g) });
        while (!a.over && a.t < 240) R.step(a, DT, bot(a));
        botT += a.t; score += a.score;
        const b = R.newGame({ w: w, charId: id, rng: makeRng(100 + g) });
        while (!b.over && b.t < 240) R.step(b, DT, {});
        assert(b.over, 'ยืนนิ่งแล้วเกมต้องจบ');
        idleT += b.t;
        assert(a.objs.length < 80, 'ของบนจอไม่ควรสะสมมากเกินไป');
      }
      botT /= games; idleT /= games;
      console.log('    ' + id + ' w=' + w + ': บอทอยู่ได้เฉลี่ย ' + botT.toFixed(0) + ' วิ (' + (score / games).toFixed(0) + ' แต้ม), ยืนนิ่ง ' + idleT.toFixed(0) + ' วิ');
      assert(botT > 60, 'บอทควรอยู่รอดเกิน 60 วินาที');
      assert(idleT < botT, 'ยืนนิ่งต้องแพ้เร็วกว่า');
    });
  });
});

console.log('\nผ่านทั้งหมด ' + n + ' ข้อ');
