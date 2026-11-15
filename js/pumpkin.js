/*
 * Coin Quest — Stage 4: ฟักทองผี (ตรรกะล้วน ไม่ยุ่งกับ DOM ส่วนการวาดอยู่ใน js/render.js)
 *   phop  = ฟักทองกระโดด: หยุดรอแล้วกระโดดไปข้างหน้าเป็นจังหวะ ไม่กระโดดตกขอบ
 *   pfire = ฟักทองยิงไฟ: อยู่กับที่ หันหาผู้เล่น เตือนก่อนยิงลูกไฟผี (ใช้ Boss.stepShot / Boss.shotHits ได้เลย)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const W = CQ.World;
  const P = CQ.PHYS;
  const T = P.T;
  const TILE = CQ.TILE;
  const EPS = 1e-4;

  const PUMPKIN = {
    HOP: {
      W: 26, H: 24,          // ขนาดตัว (px)
      SPEED: 60,             // ความเร็วแนวนอนตอนอยู่กลางอากาศ
      JUMP_V: 430,           // ความเร็วกระโดด (px/วินาที)
      PAUSE: 0.8             // หยุดพักบนพื้นก่อนกระโดดครั้งต่อไป (วินาที)
    },
    FIRE: {
      W: 28, H: 26,          // ขนาดตัว (px)
      RANGE: 9 * T,          // ผู้เล่นอยู่ในระยะนี้ (แนวนอน) จึงเริ่มยิง
      WINDUP: 0.6,           // อ้าปากเตือนก่อนยิง (วินาที) ผู้เล่นมีเวลาหลบ
      COOLDOWN: 2.5,         // เว้นระหว่างนัด
      HP: 3,                 // ยิงโดน 3 ครั้งจึงแตก (เหยียบหัวแตกทันที)
      FIRE_SPEED: 200,       // ความเร็วลูกไฟ
      FIRE_R: 8,
      FIRE_LIFE: 4
    }
  };
  const VY_CLAMP = 0.55;     // ลูกไฟเล็งขึ้น-ลงได้ไม่เกินสัดส่วนนี้ของความเร็ว (เหมือน Boss.breathe)
  const SEE_DY = 4 * T;      // ผู้เล่นต้องอยู่ในความสูงนี้ถึงจะเห็น

  function isPumpkin(kind) { return kind === 'phop' || kind === 'pfire'; }

  function makePumpkin(d) {
    const hop = d.kind === 'phop';
    const C = hop ? PUMPKIN.HOP : PUMPKIN.FIRE;
    return {
      kind: d.kind,
      x: d.tx * T + (T - C.W) / 2,
      y: (d.ty + 1) * T - C.H,
      w: C.W, h: C.H,
      vx: 0, vy: 0, dir: -1,
      onGround: false, ride: null,
      dead: false, deadT: 0, t: (d.tx * 0.37) % 1,
      hp: hop ? 1 : PUMPKIN.FIRE.HP,
      pause: hop ? PUMPKIN.HOP.PAUSE : 0, // phop: เวลาพักที่เหลือ
      windT: 0,                           // pfire: เวลาเตือนที่เหลือ (> 0 = กำลังอ้าปาก)
      cd: 0,                              // pfire: เวลาเว้นก่อนยิงนัดต่อไป
      flash: 0,                           // เวลากะพริบตอนโดนตี
      face: -1
    };
  }

  function floorAt(lv, tx, ty) { return W.isSolid(lv, tx, ty) || W.isOneWay(lv, tx, ty); }

  /** กระโดดไปทาง dir แล้วจะลงจอดบนพื้นได้ไหม (ไม่ติดกำแพง/หนาม และใต้เท้าหน้า-กลางตัวมีพื้น) */
  function landingOk(e, lv, dir) {
    const reach = 2 * PUMPKIN.HOP.JUMP_V / P.GRAVITY * PUMPKIN.HOP.SPEED; // ระยะที่ไปได้ต่อหนึ่งกระโดด
    const front = dir > 0 ? e.x + e.w + reach - EPS : e.x - reach;
    const mid = e.x + e.w / 2 + dir * reach;
    const feet = Math.floor((e.y + e.h - EPS) / T);
    const top = Math.floor(e.y / T);
    const ftx = Math.floor(front / T), mtx = Math.floor(mid / T);
    for (let ty = top; ty <= feet; ty++) {
      if (W.isSolid(lv, ftx, ty)) return false;
      if (ty === feet && TILE.SPIKE !== undefined && W.tileAt(lv, ftx, ty) === TILE.SPIKE) return false;
    }
    return floorAt(lv, ftx, feet + 1) && floorAt(lv, mtx, feet + 1);
  }

  function stepHop(e, lv, dt) {
    const H = PUMPKIN.HOP;
    e.vy = Math.min(e.vy + P.GRAVITY * dt, P.MAX_FALL);
    if (e.onGround) {
      e.vx = 0;
      e.pause -= dt;
      if (e.pause <= 0) {
        if (!landingOk(e, lv, e.dir)) e.dir = -e.dir;
        if (landingOk(e, lv, e.dir)) { e.vy = -H.JUMP_V; e.vx = e.dir * H.SPEED; e.onGround = false; }
        else e.pause = H.PAUSE * 0.5; // ไม่มีที่ให้ลง: รออีกนิด
      }
    } else if (e.vx !== 0 && W.moveX(e, e.vx * dt, lv)) {
      e.dir = -e.dir; e.vx = 0; // ชนกำแพงกลางอากาศ: หันกลับแล้วตกลงตรงๆ
    }
    const was = e.onGround;
    W.moveY(e, e.vy * dt, lv, null);
    if (e.onGround && !was) { e.pause = H.PAUSE; e.vx = 0; } // เพิ่งลงพื้น: เริ่มนับพักใหม่
    e.face = e.dir;
  }

  /** ลูกไฟผีเล็งไปที่ผู้เล่น (สูตรเดียวกับ Boss.breathe) */
  function spit(e, p) {
    const F = PUMPKIN.FIRE;
    const mx = e.x + e.w / 2 + e.face * (e.w / 2), my = e.y + e.h * 0.4;
    let dx = p.x + p.w / 2 - mx, dy = p.y + p.h / 2 - my;
    if (dx * e.face < 24) dx = e.face * 24;
    const len = Math.hypot(dx, dy) || 1;
    let vy = (dy / len) * F.FIRE_SPEED;
    vy = Math.max(-VY_CLAMP * F.FIRE_SPEED, Math.min(VY_CLAMP * F.FIRE_SPEED, vy));
    const vx = e.face * Math.sqrt(F.FIRE_SPEED * F.FIRE_SPEED - vy * vy);
    return { x: mx, y: my, vx: vx, vy: vy, r: F.FIRE_R, kind: 'ghost', t: 0, life: F.FIRE_LIFE };
  }

  function stepFire(e, lv, p, dt, fires, ev) {
    const F = PUMPKIN.FIRE;
    e.vy = Math.min(e.vy + P.GRAVITY * dt, P.MAX_FALL);
    W.moveY(e, e.vy * dt, lv, null);
    if (e.cd > 0) e.cd = Math.max(0, e.cd - dt);
    const dx = p.x + p.w / 2 - (e.x + e.w / 2), dy = p.y + p.h / 2 - (e.y + e.h / 2);
    const seen = Math.abs(dx) < F.RANGE && Math.abs(dy) < SEE_DY;
    if (seen && e.windT <= 0) { e.face = dx >= 0 ? 1 : -1; e.dir = e.face; }
    if (e.windT > 0) {
      e.windT -= dt;
      if (e.windT <= 0) {
        e.windT = 0;
        fires.push(spit(e, p));
        ev.push({ type: 'pfire' });
        e.cd = F.COOLDOWN;
      }
    } else if (seen && e.cd <= 0) {
      e.windT = F.WINDUP;
      ev.push({ type: 'pwind' });
    }
  }

  /**
   * เดินฟักทอง 1 สเต็ป
   * fires = รายการลูกไฟ (เพิ่มลูกใหม่เข้าไป)  ev = เหตุการณ์ (pwind / pfire)
   */
  function stepPumpkin(e, lv, p, dt, fires, ev) {
    e.t += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
    if (e.dead) { e.deadT += dt; return; }
    if (e.kind === 'phop') stepHop(e, lv, dt);
    else stepFire(e, lv, p, dt, fires, ev);
    if (e.y > lv.h * T + 40) e.dead = true;
  }

  CQ.Pumpkin = {
    PUMPKIN: PUMPKIN,
    isPumpkin: isPumpkin,
    makePumpkin: makePumpkin,
    stepPumpkin: stepPumpkin
  };
})(typeof window !== 'undefined' ? window : globalThis);
