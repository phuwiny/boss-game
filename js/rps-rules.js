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
  const GUARD_BONUS = 0.5;  // แพ้เป่าครั้งแรกแล้วป้องกัน: ลดดาเมจเพิ่มอีก 0.5
  const CLASH_BONUS = 0.5;  // โจมตีชนกัน: ฝ่ายที่เริ่มก่อน (ชนะเป่า) ลดดาเมจที่ได้รับ 0.5
  const HEAL_HP = 1;
  // เพดาน HP ที่ฟื้นพลังได้: เริ่มที่ 3 แล้วลด 0.5 ทุก 3 รอบ ต่ำสุด 1 (กันเกมยืดเยื้อ)
  const HEAL_CAP_EVERY = 3;
  const HEAL_CAP_STEP = 0.5;
  const HEAL_CAP_MIN = 1;

  const HANDS = ['scissors', 'paper', 'rock'];
  const BEATS = { scissors: 'paper', paper: 'rock', rock: 'scissors' };
  const ACTIONS = ['attack', 'defend', 'charge', 'heal'];

  /** 1 = a ชนะ, -1 = b ชนะ, 0 = เสมอ */
  function judge(a, b) {
    if (a === b) return 0;
    return BEATS[a] === b ? 1 : -1;
  }

  function newFighter() {
    // lossStreak = จำนวนครั้งที่แพ้เป่าติดกัน (ชนะเป่าเมื่อไรรีเซ็ตเป็น 0)
    return { hp: MAX_HP, charge: 0, lossStreak: 0, healedLastTurn: false };
  }

  /** บันทึกผลเป่ายิ้งฉุบที่ไม่เสมอ */
  function recordRps(winner, loser) {
    winner.lossStreak = 0;
    loser.lossStreak++;
  }

  /** แพ้เป่าครั้งแรก (นับใหม่ทุกครั้งที่ชนะเป่า): ห้ามโจมตี แต่ป้องกันได้มากขึ้น */
  function isFirstLoss(f, role) {
    return role === 'loser' && f.lossStreak === 1;
  }

  function defendBlock(f, role) {
    return DEFEND_BLOCK + (isFirstLoss(f, role) ? GUARD_BONUS : 0);
  }

  /** เพดาน HP ที่ฟื้นพลังได้ในรอบที่ round (เริ่มที่ 1) */
  function healCap(round) {
    const steps = Math.floor(Math.max(0, (round || 1) - 1) / HEAL_CAP_EVERY);
    return Math.max(HEAL_CAP_MIN, MAX_HP - steps * HEAL_CAP_STEP);
  }

  /**
   * action ที่เลือกได้ในเฟสต่อสู้ คืน { attack: { ok, reason }, ... }
   * role = 'winner' | 'loser' (ผลเป่ายิ้งฉุบรอบนี้; ต้องเรียก recordRps ก่อน)
   * defend.block = ดาเมจที่ป้องกันได้
   */
  function allowedActions(f, role, round) {
    const out = {};
    const firstLoss = isFirstLoss(f, role);
    out.attack = firstLoss ? { ok: false, reason: 'แพ้ครั้งแรก ห้ามโจมตี' } : { ok: true };
    out.defend = { ok: true, block: defendBlock(f, role), buffed: firstLoss };
    out.charge = f.charge >= MAX_CHARGE ? { ok: false, reason: 'ชาร์จเต็มแล้ว' } : { ok: true };
    const cap = healCap(round);
    if (f.healedLastTurn) out.heal = { ok: false, reason: 'ต้องพัก 1 เทิร์น', cap: cap };
    else if (f.hp >= cap) out.heal = { ok: false, reason: 'HP ถึงเพดาน ' + cap, cap: cap };
    else out.heal = { ok: true, cap: cap };
    return out;
  }

  function power(f, base) {
    return base + f.charge * CHARGE_BONUS;
  }

  /**
   * คิดผลเฟสต่อสู้ (ทั้งสองฝ่ายเกิดพร้อมกัน) แล้วแก้ค่าใน a, b
   * winner = 'a' | 'b' ฝ่ายที่ชนะเป่ายิ้งฉุบรอบนี้ (เริ่มก่อน), round = รอบปัจจุบัน (ใช้คิดเพดานฟื้นพลัง)
   * คืน { a: report, b: report } โดย report = { action, power, dmg, heal, blocked, block, clash, clashPower, clashGuard, hpBefore, hp }
   */
  function resolve(a, b, actA, actB, winner, round) {
    const cap = healCap(round);
    const roleA = winner === 'a' ? 'winner' : 'loser';
    const roleB = winner === 'b' ? 'winner' : 'loser';
    const ra = { action: actA, power: 0, dmg: 0, heal: 0, blocked: false, block: 0, clash: false, clashPower: 0, clashGuard: false, hpBefore: a.hp };
    const rb = { action: actB, power: 0, dmg: 0, heal: 0, blocked: false, block: 0, clash: false, clashPower: 0, clashGuard: false, hpBefore: b.hp };

    // ใช้ผลการชาร์จทันทีเมื่อโจมตีหรือฟื้นพลัง
    if (actA === 'attack') ra.power = power(a, ATTACK_DMG);
    if (actA === 'heal') ra.power = power(a, HEAL_HP);
    if (actB === 'attack') rb.power = power(b, ATTACK_DMG);
    if (actB === 'heal') rb.power = power(b, HEAL_HP);

    if (actA === 'attack' && actB === 'attack') {
      // โจมตีชนกัน: ดาเมจปกติหักล้างกันหมด เหลือแต่พลังชาร์จที่หักลบกัน
      // ฝ่ายที่ชาร์จมากกว่าทำดาเมจเท่าส่วนต่าง ถ้าฝ่ายที่โดนเป็นผู้เริ่มก่อน ลดดาเมจลงอีก 0.5
      ra.clash = rb.clash = true;
      ra.clashPower = a.charge * CHARGE_BONUS;
      rb.clashPower = b.charge * CHARGE_BONUS;
      const diff = ra.clashPower - rb.clashPower;
      if (diff !== 0) {
        const hit = diff > 0 ? rb : ra;
        const hitRole = diff > 0 ? roleB : roleA;
        hit.clashGuard = hitRole === 'winner';
        hit.dmg = Math.max(0, Math.abs(diff) - (hit.clashGuard ? CLASH_BONUS : 0));
      }
    } else {
      if (actA === 'attack') {
        rb.blocked = actB === 'defend';
        rb.block = rb.blocked ? defendBlock(b, roleB) : 0;
        rb.dmg = Math.max(0, ra.power - rb.block);
      }
      if (actB === 'attack') {
        ra.blocked = actA === 'defend';
        ra.block = ra.blocked ? defendBlock(a, roleA) : 0;
        ra.dmg = Math.max(0, rb.power - ra.block);
      }
    }
    // ฟื้นพลังได้ไม่เกินเพดานของรอบนี้
    if (actA === 'heal') ra.heal = Math.max(0, Math.min(ra.power, cap - a.hp));
    if (actB === 'heal') rb.heal = Math.max(0, Math.min(rb.power, cap - b.hp));

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
    const block = myAllowed.defend.block;
    const w = {
      attack: 3 + me.charge * 1.5 + (foe.hp <= atk ? 6 : 0) + (foe.hp <= atk - foeAllowed.defend.block ? 3 : 0) +
        (foeAtk ? (me.charge - foe.charge) * 0.8 : 0), // ถ้าอีกฝ่ายโจมตีด้วย ชาร์จมากกว่าได้เปรียบตอนชนกัน
      defend: foeAtk ? 1.5 + foe.charge * 1.5 + (me.hp <= foeAtk ? 3 : 0) + (block > DEFEND_BLOCK ? 1.5 : 0) : 0,
      charge: 2.5 - me.charge * 0.6 + (foeAtk ? 0 : 1),
      heal: Math.max(0, (myAllowed.heal.cap || MAX_HP) - me.hp) * 2.2 + me.charge * 0.5
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
    DEFEND_BLOCK: DEFEND_BLOCK,
    GUARD_BONUS: GUARD_BONUS,
    CLASH_BONUS: CLASH_BONUS,
    healCap: healCap,
    HANDS: HANDS,
    ACTIONS: ACTIONS,
    judge: judge,
    newFighter: newFighter,
    recordRps: recordRps,
    allowedActions: allowedActions,
    power: power,
    resolve: resolve,
    randomHand: randomHand,
    comAction: comAction
  };
})(typeof window !== 'undefined' ? window : globalThis);
