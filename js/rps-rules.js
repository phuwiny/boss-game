/*
 * Coin Quest — มินิเกม "เป่า-ยิ้ง-ฉุบ Battle": กติกาและ AI ของ COM
 * ไม่ยุ่งกับ DOM จึงทดสอบใน Node ได้ (node tools/check-rps.js)
 *
 * ลำดับในหนึ่งรอบ: เป่ายิ้งฉุบ (เสมอ = เป่าใหม่) → ต่อสู้ (ผู้ชนะเลือก action ก่อน) → สรุปผล
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  const MAX_HP = 3;
  const MAX_CHARGE = 3;     // ชาร์จสะสมได้ไม่เกิน 3 ครั้ง
  const CHARGE_BONUS = 0.5; // ต่อ 1 การชาร์จ
  const ATTACK_DMG = 1;
  const DEFEND_BLOCK = 0.5; // โจมตีโดนป้องกัน: ดาเมจลดลง 0.5 (โจมตีปกติจึงเหลือ -0.5)
  const HEAL_HP = 1;

  const HANDS = ['scissors', 'paper', 'rock'];
  const BEATS = { scissors: 'paper', paper: 'rock', rock: 'scissors' };
  const ACTIONS = ['attack', 'defend', 'charge', 'heal'];

  /** 1 = a ชนะ, -1 = b ชนะ, 0 = เสมอ */
  function judge(a, b) {
    if (a === b) return 0;
    return BEATS[a] === b ? 1 : -1;
  }

  function newFighter() {
    return { hp: MAX_HP, charge: 0, losses: 0, healedLastTurn: false };
  }

  /**
   * action ที่เลือกได้ในเฟสต่อสู้ คืน { attack: { ok, reason }, ... }
   * role = 'winner' | 'loser' (ผลเป่ายิ้งฉุบรอบนี้; ต้องนับ losses ของรอบนี้แล้ว)
   */
  function allowedActions(f, role) {
    const out = {};
    const firstLoss = role === 'loser' && f.losses === 1;
    out.attack = firstLoss ? { ok: false, reason: 'แพ้ครั้งแรก ห้ามโจมตี' } : { ok: true };
    out.defend = { ok: true };
    out.charge = f.charge >= MAX_CHARGE ? { ok: false, reason: 'ชาร์จเต็มแล้ว' } : { ok: true };
    out.heal = f.healedLastTurn ? { ok: false, reason: 'ต้องพัก 1 เทิร์น' } : { ok: true };
    return out;
  }

  function power(f, base) {
    return base + f.charge * CHARGE_BONUS;
  }

  /**
   * คิดผลเฟสต่อสู้ (ทั้งสองฝ่ายเกิดพร้อมกัน) แล้วแก้ค่าใน a, b
   * คืน { a: report, b: report } โดย report = { action, power, dmg, heal, blocked, clash, hpBefore, hp }
   */
  function resolve(a, b, actA, actB) {
    const ra = { action: actA, power: 0, dmg: 0, heal: 0, blocked: false, clash: false, hpBefore: a.hp };
    const rb = { action: actB, power: 0, dmg: 0, heal: 0, blocked: false, clash: false, hpBefore: b.hp };

    // ใช้ผลการชาร์จทันทีเมื่อโจมตีหรือฟื้นพลัง
    if (actA === 'attack') ra.power = power(a, ATTACK_DMG);
    if (actA === 'heal') ra.power = power(a, HEAL_HP);
    if (actB === 'attack') rb.power = power(b, ATTACK_DMG);
    if (actB === 'heal') rb.power = power(b, HEAL_HP);

    if (actA === 'attack' && actB === 'attack') {
      ra.clash = rb.clash = true; // โจมตีชนกัน -0 ทั้งคู่
    } else {
      if (actA === 'attack') {
        rb.blocked = actB === 'defend';
        rb.dmg = rb.blocked ? Math.max(0, ra.power - DEFEND_BLOCK) : ra.power;
      }
      if (actB === 'attack') {
        ra.blocked = actA === 'defend';
        ra.dmg = ra.blocked ? Math.max(0, rb.power - DEFEND_BLOCK) : rb.power;
      }
    }
    if (actA === 'heal') ra.heal = ra.power;
    if (actB === 'heal') rb.heal = rb.power;

    [[a, ra], [b, rb]].forEach(function (p) {
      const f = p[0], r = p[1];
      if (r.action === 'attack' || r.action === 'heal') f.charge = 0;
      if (r.action === 'charge') f.charge = Math.min(MAX_CHARGE, f.charge + 1);
      f.healedLastTurn = r.action === 'heal';
      // ฟื้นพลังและดาเมจเกิดพร้อมกัน HP ไม่เกินค่าสูงสุดและไม่ต่ำกว่า 0
      f.hp = Math.max(0, Math.min(MAX_HP, f.hp + r.heal - r.dmg));
      r.hp = f.hp;
    });
    return { a: ra, b: rb };
  }

  function randomHand(rand) {
    rand = rand || Math.random;
    return HANDS[Math.floor(rand() * HANDS.length)];
  }

  /**
   * AI ของ COM เลือก action แบบสุ่มถ่วงน้ำหนัก ไม่เห็นการ์ดของผู้เล่น
   * ใช้เฉพาะข้อมูลที่เปิดเผย: HP, ชาร์จ, และ action ที่อีกฝ่ายเลือกได้ในเทิร์นนี้
   */
  function comAction(me, foe, myAllowed, foeAllowed, rand) {
    rand = rand || Math.random;
    const atk = power(me, ATTACK_DMG);
    const foeAtk = foeAllowed.attack.ok ? power(foe, ATTACK_DMG) : 0;
    const w = {
      attack: 3 + me.charge * 1.5 + (foe.hp <= atk ? 6 : 0) + (foe.hp <= atk - DEFEND_BLOCK ? 3 : 0),
      defend: foeAtk ? 1.5 + foe.charge * 1.5 + (me.hp <= foeAtk ? 3 : 0) : 0,
      charge: 2.5 - me.charge * 0.6 + (foeAtk ? 0 : 1),
      heal: me.hp >= MAX_HP ? 0.1 : (MAX_HP - me.hp) * 2.2 + me.charge * 0.5
    };
    let total = 0;
    ACTIONS.forEach(function (k) {
      if (!myAllowed[k].ok || w[k] < 0) w[k] = 0;
      total += w[k];
    });
    if (total <= 0) return 'defend';
    let r = rand() * total;
    for (let i = 0; i < ACTIONS.length; i++) {
      r -= w[ACTIONS[i]];
      if (r < 0) return ACTIONS[i];
    }
    return 'defend';
  }

  CQ.RPSRules = {
    MAX_HP: MAX_HP,
    MAX_CHARGE: MAX_CHARGE,
    CHARGE_BONUS: CHARGE_BONUS,
    HANDS: HANDS,
    ACTIONS: ACTIONS,
    judge: judge,
    newFighter: newFighter,
    allowedActions: allowedActions,
    power: power,
    resolve: resolve,
    randomHand: randomHand,
    comAction: comAction
  };
})(typeof window !== 'undefined' ? window : globalThis);
