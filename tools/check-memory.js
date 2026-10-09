#!/usr/bin/env node
/*
 * ตรวจกติกามินิเกม "Memory Match" (js/memory-rules.js)
 *   node tools/check-memory.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'memory-rules.js'), 'utf8'), sandbox);
const R = sandbox.CQ.MemoryRules;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
function makeRng(seed) {
  return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
const DT = 1 / 60;
function run(s, sec) { for (let i = 0; i < Math.round(sec / DT); i++) R.step(s, DT); }
/** เริ่มเกมแล้วข้าม preview */
function ready(opts) { const s = R.newGame(opts); run(s, s.previewT + 0.05); return s; }
function pairOf(s, i) { return s.cards.findIndex(function (c, j) { return j !== i && c.face === s.cards[i].face; }); }
function wrongOf(s, i) { return s.cards.findIndex(function (c, j) { return j !== i && !c.matched && c.face !== s.cards[i].face; }); }

t('แจกการ์ดครบคู่ทุกระดับ ไม่มีหน้าซ้ำเกิน 2 ใบ', function () {
  assert(R.FACES.length >= 10);
  R.LEVEL_IDS.forEach(function (id) {
    for (let seed = 1; seed < 200; seed++) {
      const s = R.newGame({ level: id, rng: makeRng(seed) });
      const lv = R.LEVELS[id];
      assert.strictEqual(s.cards.length, lv.cols * lv.rows);
      const count = {};
      s.cards.forEach(function (c) { count[c.face] = (count[c.face] || 0) + 1; });
      Object.keys(count).forEach(function (f) { assert.strictEqual(count[f], 2, id + ' ' + f); });
      assert.strictEqual(Object.keys(count).length, s.pairs);
    }
  });
});

t('preview: เปิดให้ดูทั้งกระดาน แตะไม่ได้ และยังไม่จับเวลา', function () {
  const s = R.newGame({ level: 'easy', charId: 'mew', rng: makeRng(1) });
  assert(R.faceUp(s, 0));
  assert.strictEqual(R.flip(s, 0).length, 0);
  run(s, 1);
  assert.strictEqual(s.t, 0);
  let started = false;
  for (let i = 0; i < 60 && !started; i++) started = R.step(s, DT) === 'start';
  assert(started);
  assert(!R.faceUp(s, 0));
});

t('เปิดถูกคู่ = จับคู่ได้ / เปิดผิดคู่ = คว่ำกลับหลังครู่หนึ่ง', function () {
  const s = ready({ level: 'normal', charId: 'bobo', rng: makeRng(2) });
  const j = pairOf(s, 0);
  R.flip(s, 0);
  const ev = R.flip(s, j);
  assert(ev.some(function (e) { return e.type === 'match'; }));
  assert(s.cards[0].matched && s.cards[j].matched);
  assert.strictEqual(s.moves, 1);
  assert.strictEqual(R.flip(s, 0).length, 0, 'แตะใบที่จับคู่แล้วไม่ได้');

  const a = s.cards.findIndex(function (c) { return !c.matched; });
  const b = wrongOf(s, a);
  R.flip(s, a);
  assert(R.flip(s, b).some(function (e) { return e.type === 'miss'; }));
  assert(R.faceUp(s, a) && R.faceUp(s, b));
  run(s, 0.9);
  assert(!R.faceUp(s, a) && !R.faceUp(s, b));
  assert.strictEqual(s.moves, 2);
});

t('แตะใบใหม่ระหว่างโชว์คู่ที่ผิด: คู่เดิมคว่ำทันที แล้วเปิดใบใหม่', function () {
  const s = ready({ level: 'normal', rng: makeRng(3) });
  const a = 0, b = wrongOf(s, 0);
  R.flip(s, a); R.flip(s, b);
  const c = s.cards.findIndex(function (x, i) { return i !== a && i !== b; });
  const ev = R.flip(s, c);
  assert.strictEqual(ev[0].type, 'flip');
  assert(!s.cards[a].up && !s.cards[b].up && s.cards[c].up);
  assert.strictEqual(s.open.length, 1);

  // แตะใบเดิมในคู่ที่ผิดซ้ำทันที: ต้องเปิดใบนั้นใหม่ ไม่ถูกเมิน
  const s2 = ready({ level: 'normal', rng: makeRng(3) });
  const w = wrongOf(s2, 0);
  R.flip(s2, 0); R.flip(s2, w);
  assert.strictEqual(R.flip(s2, 0)[0].type, 'flip');
  assert(s2.cards[0].up && !s2.cards[w].up);
  assert(R.flip(s2, pairOf(s2, 0)).some(function (e) { return e.type === 'match'; }));
});

t('ความสามารถ: Bobo preview 3 วิ, Aclaire คว่ำเร็ว, Mew ส่องดูได้ 1 ครั้ง', function () {
  assert.strictEqual(R.newGame({ charId: 'bobo' }).previewT, 3);
  assert.strictEqual(R.newGame({ charId: 'aclaire' }).previewT, 1.5);

  const a = ready({ level: 'easy', charId: 'aclaire', rng: makeRng(4) });
  R.flip(a, 0); R.flip(a, wrongOf(a, 0));
  run(a, 0.5);
  assert(!a.cards[0].up, 'Aclaire คว่ำกลับภายใน 0.5 วิ');

  const b = ready({ level: 'easy', charId: 'bobo', rng: makeRng(4) });
  R.flip(b, 0); R.flip(b, wrongOf(b, 0));
  run(b, 0.5);
  assert(b.cards[0].up, 'ตัวอื่นยังโชว์ค้างที่ 0.5 วิ');

  const m = ready({ level: 'easy', charId: 'mew', rng: makeRng(5) });
  assert(R.peek(m));
  assert(R.faceUp(m, 3) && R.flip(m, 3).length === 0, 'ระหว่างส่องดูแตะไม่ได้');
  run(m, R.PEEK_TIME + 0.05);
  assert(!R.faceUp(m, 3));
  assert(!R.peek(m), 'ส่องได้ครั้งเดียว');
  assert(!R.peek(b), 'Bobo ส่องไม่ได้');
});

t('จับครบทุกคู่ = ชนะ (เล่นแบบจำได้หมด ทุกระดับ ทุกตัวละคร)', function () {
  R.LEVEL_IDS.forEach(function (id) {
    ['bobo', 'mew', 'aclaire'].forEach(function (ch) {
      const s = ready({ level: id, charId: ch, rng: makeRng(9) });
      let win = false;
      for (let i = 0; i < s.cards.length; i++) {
        if (s.cards[i].matched) continue;
        R.flip(s, i);
        win = R.flip(s, pairOf(s, i)).some(function (e) { return e.type === 'win'; }) || win;
        run(s, 0.1);
      }
      assert(win && s.done && s.matched === s.pairs && s.moves === s.pairs);
      assert.strictEqual(R.stars(s.moves, s.pairs), 3);
      const t0 = s.t; run(s, 1);
      assert.strictEqual(s.t, t0, 'ชนะแล้วหยุดจับเวลา');
    });
  });
});

t('ดาวตามจำนวนครั้งที่เปิด และการเทียบสถิติ', function () {
  assert.strictEqual(R.stars(9, 6), 3);
  assert.strictEqual(R.stars(10, 6), 2);
  assert.strictEqual(R.stars(15, 6), 2);
  assert.strictEqual(R.stars(16, 6), 1);
  assert(R.isBetter({ time: 20, moves: 30 }, { time: 25, moves: 10 }));
  assert(R.isBetter({ time: 20, moves: 9 }, { time: 20, moves: 10 }));
  assert(!R.isBetter({ time: 21, moves: 6 }, { time: 20, moves: 10 }));
  assert(R.isBetter({ time: 99, moves: 99 }, null));
});

t('ผู้เล่นสุ่มเปิดมั่ว ๆ ก็จบเกมได้เสมอ (ไม่ค้าง)', function () {
  const rng = makeRng(77);
  let moves = 0;
  for (let g = 0; g < 300; g++) {
    const s = ready({ level: R.LEVEL_IDS[g % 3], charId: ['bobo', 'mew', 'aclaire'][g % 3], rng: makeRng(g + 1) });
    let guard = 0;
    while (!s.done) {
      assert(++guard < 100000, 'เกมไม่จบ');
      R.flip(s, Math.floor(rng() * s.cards.length));
      if (rng() < 0.3) run(s, 0.2);
    }
    moves += s.moves;
  }
  console.log('    สุ่มเปิด 300 เกม: เฉลี่ย ' + (moves / 300).toFixed(1) + ' ครั้ง/เกม');
});

console.log('\nผ่านทั้งหมด ' + n + ' ข้อ');
