#!/usr/bin/env node
/*
 * ตรวจกติกามินิเกม "เป่า-ยิ้ง-ฉุบ Battle" (js/rps-rules.js)
 *   node tools/check-rps.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'rps-rules.js'), 'utf8'), sandbox);
const R = sandbox.CQ.RPSRules;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok  ' + name); }
function pair(a, b) { return [Object.assign(R.newFighter(), a), Object.assign(R.newFighter(), b)]; }

t('เป่ายิ้งฉุบ: กรรไกร>กระดาษ>ค้อน>กรรไกร', function () {
  assert.strictEqual(R.judge('scissors', 'paper'), 1);
  assert.strictEqual(R.judge('paper', 'rock'), 1);
  assert.strictEqual(R.judge('rock', 'scissors'), 1);
  assert.strictEqual(R.judge('paper', 'scissors'), -1);
  assert.strictEqual(R.judge('rock', 'rock'), 0);
});

// resolve(a, b, actA, actB, winner): winner = ผู้ชนะเป่า ('a' | 'b')
t('โจมตี -1 / โดนป้องกัน -0.5 / โจมตีชนกันไม่มีชาร์จ -0', function () {
  let [a, b] = pair();
  R.resolve(a, b, 'attack', 'charge', 'a');
  assert.strictEqual(b.hp, 2);
  [a, b] = pair();
  R.resolve(a, b, 'attack', 'defend', 'a');
  assert.strictEqual(b.hp, 2.5);
  [a, b] = pair();
  R.resolve(a, b, 'attack', 'attack', 'a');
  assert.strictEqual(a.hp, 3); assert.strictEqual(b.hp, 3);
});

t('โจมตีชนกัน: พลังชาร์จหักลบกัน ผู้เริ่มก่อนที่โดนลดดาเมจ 0.5 (ตัวอย่างจากโจทย์)', function () {
  // ผู้เล่นชาร์จ 2 (=1) COM ชาร์จ 1 (=0.5) ผู้เล่นเริ่มก่อน → COM -0.5
  let [a, b] = pair({ charge: 2 }, { charge: 1 });
  let r = R.resolve(a, b, 'attack', 'attack', 'a');
  assert.strictEqual(b.hp, 2.5); assert.strictEqual(a.hp, 3);
  assert.strictEqual(r.b.clashGuard, false);
  assert.strictEqual(a.charge, 0); assert.strictEqual(b.charge, 0);
  // COM เริ่มก่อน → ลดดาเมจ 0.5 ไม่เสีย HP
  [a, b] = pair({ charge: 2 }, { charge: 1 });
  r = R.resolve(a, b, 'attack', 'attack', 'b');
  assert.strictEqual(b.hp, 3); assert.strictEqual(a.hp, 3);
  assert.strictEqual(r.b.clashGuard, true);
  // ชาร์จ 3 vs 0 ผู้โดนเริ่มก่อน → 1.5 - 0.5 = 1
  [a, b] = pair({ charge: 3 }, { charge: 0 });
  R.resolve(a, b, 'attack', 'attack', 'b');
  assert.strictEqual(b.hp, 2);
  // ชาร์จเท่ากัน → -0 ทั้งคู่
  [a, b] = pair({ charge: 2 }, { charge: 2 });
  R.resolve(a, b, 'attack', 'attack', 'a');
  assert.strictEqual(a.hp, 3); assert.strictEqual(b.hp, 3);
});

t('ชาร์จ +0.5 ต่อครั้ง สูงสุด 3 ใช้หมดเมื่อโจมตี', function () {
  const [a, b] = pair();
  R.resolve(a, b, 'charge', 'defend', 'a');
  R.resolve(a, b, 'charge', 'defend', 'a');
  assert.strictEqual(a.charge, 2);
  R.resolve(a, b, 'attack', 'charge', 'a');
  assert.strictEqual(b.hp, 1); // 1 + 0.5*2
  assert.strictEqual(a.charge, 0);
  const [c] = pair({ charge: 3 });
  assert.strictEqual(R.allowedActions(c, 'winner').charge.ok, false);
});

t('ชาร์จแล้วโจมตีโดนป้องกัน ลดลง 0.5', function () {
  const [a, b] = pair({ charge: 3 });
  R.resolve(a, b, 'attack', 'defend', 'a');
  assert.strictEqual(b.hp, 1); // 2.5 - 0.5
});

t('ฟื้นพลัง +1 (+ชาร์จ) ไม่เกิน 3 และใช้ติดกันไม่ได้', function () {
  const [a, b] = pair({ hp: 1, charge: 1 });
  R.resolve(a, b, 'heal', 'defend', 'a');
  assert.strictEqual(a.hp, 2.5);
  assert.strictEqual(a.charge, 0);
  assert.strictEqual(R.allowedActions(a, 'winner').heal.ok, false);
  R.resolve(a, b, 'defend', 'defend', 'a');
  assert.strictEqual(R.allowedActions(a, 'winner').heal.ok, true);
  R.resolve(a, b, 'heal', 'defend', 'a');
  assert.strictEqual(a.hp, 3);
});

t('แพ้เป่าครั้งแรกห้ามโจมตี นับใหม่ทุกครั้งที่ชนะเป่า', function () {
  const me = R.newFighter(), foe = R.newFighter();
  R.recordRps(foe, me); // แพ้ครั้งแรก
  assert.strictEqual(R.allowedActions(me, 'loser').attack.ok, false);
  assert.strictEqual(R.allowedActions(foe, 'winner').attack.ok, true);
  R.recordRps(foe, me); // แพ้ติดกันครั้งที่ 2
  assert.strictEqual(R.allowedActions(me, 'loser').attack.ok, true);
  R.recordRps(me, foe); // ชนะ → รีเซ็ต
  assert.strictEqual(me.lossStreak, 0);
  R.recordRps(foe, me); // แพ้ครั้งแรกอีกรอบ
  assert.strictEqual(R.allowedActions(me, 'loser').attack.ok, false);
});

t('แพ้เป่าครั้งแรกแล้วป้องกัน ลดดาเมจได้ 1 (0.5 + buff 0.5)', function () {
  let [a, b] = pair();
  R.recordRps(a, b);
  assert.strictEqual(R.allowedActions(b, 'loser').defend.block, 1);
  let r = R.resolve(a, b, 'attack', 'defend', 'a');
  assert.strictEqual(b.hp, 3); assert.strictEqual(r.b.block, 1);
  [a, b] = pair({ charge: 2 });
  R.recordRps(a, b);
  R.resolve(a, b, 'attack', 'defend', 'a');
  assert.strictEqual(b.hp, 2); // 2 - 1
  // แพ้ติดกันครั้งที่ 2 ไม่มี buff
  [a, b] = pair();
  R.recordRps(a, b); R.recordRps(a, b);
  R.resolve(a, b, 'attack', 'defend', 'a');
  assert.strictEqual(b.hp, 2.5);
});

t('AI ของ COM เลือกเฉพาะ action ที่อนุญาต และเกมจบได้เสมอ', function () {
  let seed = 7;
  const rand = function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let comWins = 0, rounds = 0;
  for (let g = 0; g < 2000; g++) {
    const p = R.newFighter(), c = R.newFighter();
    let round = 0;
    while (p.hp > 0 && c.hp > 0) {
      assert(++round < 500, 'เกมไม่จบ');
      let res = 0;
      while (!res) res = R.judge(R.randomHand(rand), R.randomHand(rand));
      if (res > 0) R.recordRps(p, c); else R.recordRps(c, p);
      const ap = R.allowedActions(p, res > 0 ? 'winner' : 'loser');
      const ac = R.allowedActions(c, res > 0 ? 'loser' : 'winner');
      const xp = R.comAction(p, c, ap, ac, rand);
      const xc = R.comAction(c, p, ac, ap, rand);
      assert(ap[xp].ok && ac[xc].ok, 'เลือก action ต้องห้าม');
      R.resolve(p, c, xp, xc, res > 0 ? 'a' : 'b');
      assert(p.hp >= 0 && p.hp <= R.MAX_HP && c.hp >= 0 && c.hp <= R.MAX_HP);
    }
    assert(!(p.hp <= 0 && c.hp <= 0), 'แพ้พร้อมกัน');
    if (p.hp <= 0) comWins++;
    rounds += round;
  }
  console.log('    AI vs AI 2000 เกม: เฉลี่ย ' + (rounds / 2000).toFixed(1) + ' รอบ/เกม, ฝั่ง B ชนะ ' + (comWins / 20).toFixed(1) + '%');
});

console.log('\nผ่านทั้งหมด ' + n + ' ข้อ');
