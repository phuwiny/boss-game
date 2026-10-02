/*
 * Coin Quest — ฟิสิกส์และการชน (ไม่ยุ่งกับ DOM จึงใช้ร่วมกับตัวตรวจด่านใน Node ได้)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const TILE = CQ.TILE;
  const T = 32;
  const EPS = 1e-4;

  const P = CQ.PHYS = {
    T: T,
    DT: 1 / 120,           // fixed timestep
    GRAVITY: 1900,
    MAX_FALL: 900,
    RUN: 210,
    ACC_GROUND: 2200,
    DEC_GROUND: 2600,
    ACC_AIR: 1500,
    DEC_AIR: 300,
    JUMP_V: 640,
    JUMP_CUT: 0.5,         // ปล่อยปุ่มกระโดดระหว่างลอยขึ้น = กระโดดเตี้ยลง
    COYOTE: 0.09,          // ยังกระโดดได้แม้เพิ่งเดินพ้นขอบ
    BUFFER: 0.12,          // กดกระโดดก่อนถึงพื้นเล็กน้อยก็ยังนับ
    SPRING_V: 980,
    STOMP_V: 430,
    PW: 20,
    PH: 28,
    SLIME_W: 26,
    SLIME_H: 18,
    SLIME_SPEED: 42,
    COIN_R: 10
  };

  function tileAt(lv, tx, ty) {
    if (tx < 0 || tx >= lv.w) return TILE.GROUND; // ขอบซ้าย/ขวาของด่านเป็นกำแพง
    if (ty < 0 || ty >= lv.h) return TILE.EMPTY;
    return lv.tiles[ty * lv.w + tx];
  }

  function isSolid(lv, tx, ty) {
    const t = tileAt(lv, tx, ty);
    return t === TILE.GROUND || t === TILE.BRICK;
  }

  function isOneWay(lv, tx, ty) {
    return tileAt(lv, tx, ty) === TILE.ONEWAY;
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function approach(v, target, delta) {
    return v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
  }

  /** เลื่อนแนวนอน คืนค่า true ถ้าชนกำแพง */
  function moveX(b, dx, lv) {
    if (dx === 0) return false;
    b.x += dx;
    const ty0 = Math.floor(b.y / T);
    const ty1 = Math.floor((b.y + b.h - EPS) / T);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - EPS) / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (isSolid(lv, tx, ty)) { b.x = tx * T - b.w; return true; }
      }
    } else {
      const tx = Math.floor(b.x / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (isSolid(lv, tx, ty)) { b.x = (tx + 1) * T; return true; }
      }
    }
    return false;
  }

  /** เลื่อนแนวตั้ง จัดการพื้นทึบ แผ่นไม้ทางเดียว และแพลตฟอร์มเคลื่อนที่ คืนค่า 'head' ถ้าหัวชนเพดาน */
  function moveY(b, dy, lv, platforms) {
    const prevBottom = b.y + b.h;
    b.y += dy;
    b.onGround = false;
    b.ride = null;
    if (dy > 0) {
      const bottom = b.y + b.h;
      const ty = Math.floor((bottom - EPS) / T);
      const top = ty * T;
      const tx0 = Math.floor(b.x / T);
      const tx1 = Math.floor((b.x + b.w - EPS) / T);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolid(lv, tx, ty) || (isOneWay(lv, tx, ty) && prevBottom <= top + 0.01)) {
          b.y = top - b.h;
          b.vy = 0;
          b.onGround = true;
          return 'ground';
        }
      }
      if (platforms) {
        for (let i = 0; i < platforms.length; i++) {
          const pl = platforms[i];
          if (b.x + b.w > pl.x && b.x < pl.x + pl.w && prevBottom <= pl.y + 0.01 && bottom >= pl.y) {
            b.y = pl.y - b.h;
            b.vy = 0;
            b.onGround = true;
            b.ride = pl;
            return 'platform';
          }
        }
      }
    } else if (dy < 0) {
      const ty = Math.floor(b.y / T);
      const tx0 = Math.floor(b.x / T);
      const tx1 = Math.floor((b.x + b.w - EPS) / T);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolid(lv, tx, ty)) {
          b.y = (ty + 1) * T;
          b.vy = 0;
          return 'head';
        }
      }
    }
    return null;
  }

  function makePlayer(tx, ty) {
    return {
      x: tx * T + (T - P.PW) / 2,
      y: (ty + 1) * T - P.PH,
      w: P.PW, h: P.PH,
      vx: 0, vy: 0,
      face: 1,
      onGround: false, ride: null,
      coyote: 0, buffer: 0, jumping: false,
      prevBottom: 0,
      dead: false, invuln: 0
    };
  }

  /**
   * เดินหน้าฟิสิกส์ผู้เล่น 1 สเต็ป
   * inp = { left, right, jump, jumpPressed }  ev = array สำหรับเก็บเหตุการณ์ (jump/land/spring/die/bonk)
   */
  function stepPlayer(p, inp, lv, dt, ev) {
    p.prevBottom = p.y + p.h;

    // ยืนบนแพลตฟอร์มเคลื่อนที่ → เคลื่อนตาม
    if (p.ride && p.ride.dx) moveX(p, p.ride.dx, lv);

    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) p.face = dir;
    let accel;
    if (p.onGround) accel = (dir === 0 || p.vx * dir < 0) ? P.DEC_GROUND : P.ACC_GROUND;
    else accel = dir === 0 ? P.DEC_AIR : P.ACC_AIR;
    p.vx = approach(p.vx, dir * P.RUN, accel * dt);

    p.coyote = p.onGround ? P.COYOTE : Math.max(0, p.coyote - dt);
    p.buffer = inp.jumpPressed ? P.BUFFER : Math.max(0, p.buffer - dt);

    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -P.JUMP_V;
      if (p.ride) p.vx += p.ride.vx;
      p.buffer = 0;
      p.coyote = 0;
      p.onGround = false;
      p.ride = null;
      p.jumping = true;
      if (ev) ev.push({ type: 'jump' });
    }
    if (p.jumping && !inp.jump && p.vy < 0) {
      p.vy *= P.JUMP_CUT;
      p.jumping = false;
    }

    p.vy = Math.min(p.vy + P.GRAVITY * dt, P.MAX_FALL);
    if (p.vy >= 0) p.jumping = false;

    if (moveX(p, p.vx * dt, lv)) p.vx = 0;

    const wasGround = p.onGround;
    const fallSpeed = p.vy;
    const hit = moveY(p, p.vy * dt, lv, lv.platforms);
    if (hit === 'head') {
      p.jumping = false;
      if (ev) ev.push({ type: 'bonk' });
    }
    if (p.onGround && !wasGround && ev) ev.push({ type: 'land', speed: fallSpeed });

    // หนามและสปริง
    const tx0 = Math.floor(p.x / T), tx1 = Math.floor((p.x + p.w - EPS) / T);
    const ty0 = Math.floor(p.y / T), ty1 = Math.floor((p.y + p.h - EPS) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = tileAt(lv, tx, ty);
        if (t === TILE.SPIKE) {
          if (overlap(p.x + 3, p.y + 4, p.w - 6, p.h - 4, tx * T + 4, ty * T + 16, 24, 16)) {
            p.dead = true;
            if (ev) ev.push({ type: 'die', cause: 'spike' });
            return;
          }
        } else if (t === TILE.SPRING && p.vy >= 0) {
          const top = ty * T + 18;
          if (overlap(p.x, p.y, p.w, p.h, tx * T + 3, top, 26, 14)) {
            p.y = top - p.h;
            p.vy = -P.SPRING_V;
            p.jumping = false;
            p.onGround = false;
            p.ride = null;
            p.coyote = 0;
            if (ev) ev.push({ type: 'spring', tx: tx, ty: ty });
          }
        }
      }
    }

    if (p.y > lv.h * T + 40) {
      p.dead = true;
      if (ev) ev.push({ type: 'die', cause: 'fall' });
    }
  }

  function makeSlime(tx, ty) {
    return {
      x: tx * T + (T - P.SLIME_W) / 2,
      y: (ty + 1) * T - P.SLIME_H,
      w: P.SLIME_W, h: P.SLIME_H,
      vx: 0, vy: 0, dir: -1,
      onGround: false, ride: null,
      dead: false, deadT: 0, t: (tx * 0.37) % 1
    };
  }

  function stepSlime(e, lv, dt) {
    e.t += dt;
    if (e.dead) { e.deadT += dt; return; }
    e.vy = Math.min(e.vy + P.GRAVITY * dt, P.MAX_FALL);
    if (e.onGround) {
      const nx = e.x + e.dir * P.SLIME_SPEED * dt;
      const front = e.dir > 0 ? nx + e.w - EPS : nx;
      const ftx = Math.floor(front / T);
      const feet = Math.floor((e.y + e.h - EPS) / T);
      const ft = tileAt(lv, ftx, feet);
      const blocked = isSolid(lv, ftx, feet) || ft === TILE.SPIKE || ft === TILE.SPRING;
      const noFloor = !isSolid(lv, ftx, feet + 1) && !isOneWay(lv, ftx, feet + 1);
      if (blocked || noFloor) e.dir = -e.dir;
      else e.x = nx;
    }
    moveY(e, e.vy * dt, lv, null);
    if (e.y > lv.h * T + 40) e.dead = true;
  }

  function stepPlatform(pl, dt) {
    if (pl.waitT > 0) {
      pl.waitT -= dt;
      pl.dx = 0;
      pl.vx = 0;
      return;
    }
    let nx = pl.x + pl.dir * pl.speed * dt;
    if (nx >= pl.maxX) { nx = pl.maxX; pl.dir = -1; pl.waitT = pl.wait; }
    else if (nx <= pl.minX) { nx = pl.minX; pl.dir = 1; pl.waitT = pl.wait; }
    pl.dx = nx - pl.x;
    pl.vx = pl.dx / dt;
    pl.x = nx;
  }

  CQ.World = {
    tileAt: tileAt,
    isSolid: isSolid,
    isOneWay: isOneWay,
    overlap: overlap,
    moveX: moveX,
    moveY: moveY,
    makePlayer: makePlayer,
    stepPlayer: stepPlayer,
    makeSlime: makeSlime,
    stepSlime: stepSlime,
    stepPlatform: stepPlatform
  };
})(typeof window !== 'undefined' ? window : globalThis);
