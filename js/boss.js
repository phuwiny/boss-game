/*
 * Coin Quest — Boss Stage: บอสเต่าปีศาจ, กระสุนพลังของผู้เล่น, ลูกไฟของบอส และหินหล่นจากเพดาน
 * (ตรรกะล้วน ไม่ยุ่งกับ DOM ส่วนการวาดอยู่ใน js/render.js และเอฟเฟกต์/เสียงอยู่ใน js/main.js)
 *
 * กระสุนของผู้เล่นตั้งค่าที่ `shot` ของแต่ละตัวละครใน js/characters.js
 *   speed = ความเร็ว (px/วินาที), max = มีบนจอพร้อมกันได้กี่ลูก (ยิงต่อเนื่องได้กี่ลูก),
 *   damage = ดาเมจต่อลูก, cooldown = เว้นระยะระหว่างนัด (วินาที), r = รัศมี, range = ระยะยิง (px)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const W = CQ.World;
  const T = CQ.PHYS.T;

  const BOSS = {
    W: 92, H: 72,          // ขนาดตัวบอส (px)
    HP: 50,                // พลังชีวิตบอส
    SPEED: 36,             // ความเร็วเดิน (ตอนโกรธเร็วขึ้น 1.4 เท่า)
    RANGE: 6,              // เดินไป-กลับได้ไกลจากจุดเริ่มกี่ช่อง (ไปทางซ้าย)
    WAKE: 12 * T,          // ผู้เล่นเข้าใกล้ในระยะนี้ บอสจะตื่น
    WINDUP: 0.6,           // อ้าปากเตรียมพ่นไฟ (วินาที) ผู้เล่นมีเวลาหลบ
    REST: 1.8,             // พักระหว่างการโจมตี
    REST_ANGRY: 1.15,      // พักระหว่างการโจมตีเมื่อพลังชีวิตเหลือไม่ถึงครึ่ง
    FIRE_SPEED: 240,       // ไฟธรรมดา: ลูกเดียว พุ่งเข้าหาผู้เล่น
    SPREAD_SPEED: 205,     // ไฟกระจาย: 3 ลูกในความสูงต่างกัน
    SPREAD: [-0.42, -0.16, 0.1],
    FIRE_R: 9,
    FIRE_LIFE: 4.5
  };

  const ROCK = {
    SIZE: 22,
    PERIOD: 2.8,           // หินหล่นทุก ๆ กี่วินาที (นับเฉพาะตอนผู้เล่นอยู่ใกล้)
    WARN: 0.8,             // สั่นเตือนก่อนหล่น
    NEAR: 9 * T,           // ผู้เล่นอยู่ใกล้ในระยะนี้ หินจึงเริ่มหล่น
    GRAVITY: 1500,
    MAX_FALL: 720
  };

  // ── บอส ──────────────────────────────────────────────────────
  /** สร้างบอสจากตำแหน่ง X ในด่าน (ช่องที่วาง X = มุมซ้ายล่างของตัวบอส) */
  function makeBoss(lv) {
    const b = lv.boss;
    const x = b.tx * T;
    const maxX = Math.min(x, lv.w * T - BOSS.W - 4);
    return {
      x: maxX, y: (b.ty + 1) * T - BOSS.H, w: BOSS.W, h: BOSS.H,
      minX: maxX - BOSS.RANGE * T, maxX: maxX,
      hp: BOSS.HP, hpMax: BOSS.HP,
      state: 'sleep',          // sleep → fight
      face: -1,
      t: 0,
      rest: 1.4,               // เวลาถึงการโจมตีครั้งถัดไป
      windT: 0,                // > 0 = กำลังอ้าปากเตรียมพ่นไฟ
      next: 'fire',            // ท่าที่จะใช้: fire | spread
      count: 0,
      walkTo: maxX,
      walk: 0,
      flash: 0,
      dead: false, deadT: 0, dropped: false
    };
  }

  function wake(b, ev) {
    if (b.state !== 'sleep') return;
    b.state = 'fight';
    b.rest = 1.4;
    ev.push({ type: 'wake' });
  }

  function angry(b) { return b.hp <= b.hpMax / 2; }

  /** ท่าโจมตีถัดไป: ปกติ ไฟธรรมดา 2 ครั้งแล้วไฟกระจาย / โกรธ สลับกัน */
  function pattern(b) {
    const seq = angry(b) ? ['fire', 'spread'] : ['fire', 'fire', 'spread'];
    return seq[b.count % seq.length];
  }

  /** ตำแหน่งปากบอส */
  function mouth(b) {
    return { x: b.x + b.w / 2 + b.face * (b.w / 2 + 6), y: b.y + b.h - 30 };
  }

  function fireball(x, y, vx, vy) {
    return { x: x, y: y, vx: vx, vy: vy, r: BOSS.FIRE_R, kind: 'boss', t: 0, life: BOSS.FIRE_LIFE };
  }

  /** พ่นไฟ: fire = ลูกเดียวเล็งไปที่ผู้เล่น, spread = 3 ลูกแผ่ออกในความสูงต่างกัน */
  function breathe(b, p, fires) {
    const m = mouth(b);
    if (b.next === 'spread') {
      BOSS.SPREAD.forEach(function (k) {
        fires.push(fireball(m.x, m.y, b.face * BOSS.SPREAD_SPEED, k * BOSS.SPREAD_SPEED));
      });
      return;
    }
    const S = BOSS.FIRE_SPEED;
    let dx = p.x + p.w / 2 - m.x, dy = p.y + p.h / 2 - m.y;
    if (dx * b.face < 24) dx = b.face * 24; // ผู้เล่นอยู่ชิดปาก/ด้านหลัง: พ่นไปข้างหน้า
    const len = Math.hypot(dx, dy) || 1;
    let vy = (dy / len) * S;
    vy = Math.max(-0.55 * S, Math.min(0.55 * S, vy));
    const vx = b.face * Math.sqrt(S * S - vy * vy);
    fires.push(fireball(m.x, m.y, vx, vy));
  }

  /**
   * เดินหน้าบอส 1 สเต็ป
   * fires = รายการลูกไฟ (เพิ่มลูกใหม่เข้าไป)  ev = เหตุการณ์ (wake / wind / fire)
   */
  function stepBoss(b, p, dt, fires, ev) {
    b.t += dt;
    if (b.flash > 0) b.flash = Math.max(0, b.flash - dt);
    if (b.dead) { b.deadT += dt; return; }
    const cx = b.x + b.w / 2, pcx = p.x + p.w / 2;
    if (b.state === 'sleep') {
      if (!p.dead && Math.abs(pcx - cx) < BOSS.WAKE) wake(b, ev);
      return;
    }
    if (Math.abs(pcx - cx) > 12) b.face = pcx < cx ? -1 : 1;
    if (b.windT > 0) {
      b.windT -= dt;
      if (b.windT <= 0) {
        b.windT = 0;
        breathe(b, p, fires);
        ev.push({ type: 'fire', spread: b.next === 'spread' });
        b.count++;
        b.rest = angry(b) ? BOSS.REST_ANGRY : BOSS.REST;
      }
      return;
    }
    // เดินไป-กลับในเขตของตัวเอง
    const spd = BOSS.SPEED * (angry(b) ? 1.4 : 1);
    if (Math.abs(b.walkTo - b.x) < 2) b.walkTo = b.minX + Math.random() * (b.maxX - b.minX);
    const d = b.walkTo - b.x;
    const mv = Math.sign(d) * Math.min(Math.abs(d), spd * dt);
    b.x += mv;
    b.walk += Math.abs(mv);
    b.rest -= dt;
    if (b.rest <= 0) {
      b.windT = BOSS.WINDUP;
      b.next = pattern(b);
      ev.push({ type: 'wind' });
    }
  }

  /** บอสโดนกระสุน ev: hit / down (ตาย) ยิงตอนหลับ = ปลุก */
  function hitBoss(b, dmg, ev) {
    if (b.dead) return;
    wake(b, ev);
    b.hp = Math.max(0, b.hp - dmg);
    b.flash = 0.12;
    if (b.hp <= 0) {
      b.dead = true;
      b.deadT = 0;
      ev.push({ type: 'down' });
    } else {
      ev.push({ type: 'hit', dmg: dmg });
    }
  }

  /** กรอบที่กระสุนยิงโดน / กรอบที่ชนผู้เล่นแล้วเสียพลังชีวิต */
  function bossBox(b) { return { x: b.x + 6, y: b.y + 8, w: b.w - 12, h: b.h - 8 }; }
  function bossTouchBox(b) { return { x: b.x + 10, y: b.y + 16, w: b.w - 20, h: b.h - 16 }; }

  // ── กระสุน (ทั้งของผู้เล่นและลูกไฟบอส) ─────────────────────────
  /** กระสุนของผู้เล่น ยิงออกจากหน้าตัวตามทิศที่หัน w = ch.shot */
  function makeShot(p, w) {
    const f = p.face || 1;
    return {
      x: p.x + p.w / 2 + f * 10, y: p.y + 13,
      vx: f * w.speed, vy: 0, r: w.r, kind: w.kind, dmg: w.damage,
      t: 0, life: w.range / w.speed
    };
  }

  /** เลื่อนกระสุน คืน 'expire' (หมดระยะ/ออกนอกด่าน) | 'wall' (ชนกำแพง) | null */
  function stepShot(s, lv, dt) {
    s.t += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.t >= s.life || s.x < -40 || s.x > lv.w * T + 40 || s.y > lv.h * T + 40 || s.y < -80) return 'expire';
    if (W.isSolid(lv, Math.floor(s.x / T), Math.floor(s.y / T))) return 'wall';
    return null;
  }

  /** กระสุน (วงกลม) ทับกรอบ box หรือไม่ */
  function shotHits(s, box) {
    return W.overlap(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2, box.x, box.y, box.w, box.h);
  }

  // ── หินหล่นจากเพดาน ────────────────────────────────────────────
  function makeSpawner(r) {
    return { tx: r.tx, ty: r.ty, x: r.tx * T + T / 2, y: r.ty * T, t: ((r.tx * 0.618) % 1) * ROCK.PERIOD, warn: false, since: 9 };
  }

  /** นับเวลาเมื่อผู้เล่นอยู่ใกล้ คืน true เมื่อถึงเวลาหินหล่น */
  function stepSpawner(sp, p, dt) {
    sp.since += dt;
    sp.warn = false;
    if (Math.abs(p.x + p.w / 2 - sp.x) > ROCK.NEAR) return false;
    sp.t += dt;
    if (sp.t >= ROCK.PERIOD) {
      sp.t = 0;
      sp.since = 0;
      return true;
    }
    sp.warn = sp.t > ROCK.PERIOD - ROCK.WARN;
    return false;
  }

  function makeRock(sp) {
    const s = ROCK.SIZE;
    return { x: sp.x - s / 2, y: sp.y, w: s, h: s, vy: 60, rot: 0, spin: (sp.tx % 2 ? 1 : -1) * 3 };
  }

  /** หินตก คืน 'break' (ตกถึงพื้น) | 'gone' (ตกลงเหว) | null */
  function stepRock(rk, lv, dt) {
    rk.vy = Math.min(rk.vy + ROCK.GRAVITY * dt, ROCK.MAX_FALL);
    rk.y += rk.vy * dt;
    rk.rot += rk.spin * dt;
    if (rk.y > lv.h * T + 40) return 'gone';
    const ty = Math.floor((rk.y + rk.h) / T);
    const tx0 = Math.floor((rk.x + 2) / T), tx1 = Math.floor((rk.x + rk.w - 2) / T);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (W.isSolid(lv, tx, ty) || W.isOneWay(lv, tx, ty)) {
        if (rk.y + rk.h - rk.vy * dt <= ty * T + 2) return 'break';
      }
    }
    return null;
  }

  CQ.Boss = {
    BOSS: BOSS,
    ROCK: ROCK,
    makeBoss: makeBoss,
    stepBoss: stepBoss,
    hitBoss: hitBoss,
    bossBox: bossBox,
    bossTouchBox: bossTouchBox,
    mouth: mouth,
    makeShot: makeShot,
    stepShot: stepShot,
    shotHits: shotHits,
    makeSpawner: makeSpawner,
    stepSpawner: stepSpawner,
    makeRock: makeRock,
    stepRock: stepRock
  };
})(typeof window !== 'undefined' ? window : globalThis);
