/*
 * Coin Quest — มินิเกม "Coin Rain": กติกา การสุ่มของที่ตก และความยาก
 * ไม่ยุ่งกับ DOM จึงทดสอบใน Node ได้ (node tools/check-rain.js)
 *
 * พิกัดเป็นหน่วยของสนาม: สูง FIELD_H เสมอ กว้างตามสัดส่วนจอ (fieldWidth) จุด (0,0) คือมุมซ้ายบน
 * ตัวละครเดินบนพื้น (y = groundY) ของตกลงมาจากด้านบน รับเหรียญให้ได้มากที่สุด หลบหิน
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  const FIELD_H = 600;
  const MIN_W = 320;
  const MAX_W = 760;
  const GROUND = 56;          // ความหนาของพื้นด้านล่าง
  const PLAYER_W = 34;        // hitbox ของตัวละคร
  const PLAYER_H = 46;
  const RUN_SPEED = 470;      // ความเร็วเดินสูงสุด (หน่วย/วินาที)
  const RUN_ACCEL = 3200;     // ความเร่งตอนใช้ปุ่มซ้าย/ขวา
  const FOLLOW = 14;          // ลากนิ้ว: ยิ่งมากยิ่งตามนิ้วไว
  const INVINCIBLE = 1.2;     // โดนหินแล้วอมตะกี่วินาที
  const CATCH_PAD = 8;        // ของที่เก็บได้ รับง่ายกว่า hitbox เล็กน้อย
  const ROCK_PAD = -6;        // หิน ต้องโดนจริงถึงนับ (ใจดีกับผู้เล่น)
  const COMBO_STEP = 10;      // ทุก 10 คอมโบ ตัวคูณ +1
  const MAX_MULT = 5;
  const MAGNET_RANGE = 90;    // Mew: ดูดเหรียญในระยะนี้ (แนวนอน)
  const MAGNET_SPEED = 300;

  // ชนิดของที่ตก: r = รัศมี, pts = แต้มพื้นฐาน (คูณคอมโบ)
  const KINDS = {
    coin: { r: 13, pts: 1, good: true },
    gem: { r: 14, pts: 5, good: true },
    heart: { r: 13, pts: 3, good: true }, // พลังชีวิตเต็มแล้วได้แต้มแทน
    rock: { r: 17, pts: 0, good: false }
  };

  // ความสามารถของแต่ละตัวละครในมินิเกมนี้
  const PERKS = {
    bobo: { hp: 4, speed: 1, magnet: false, guard: 0, desc: 'หัวใจ 4 ดวง (ตัวอื่นมี 3)' },
    mew: { hp: 3, speed: 1, magnet: true, guard: 0, desc: 'ดูดเหรียญ/เพชรที่อยู่ใกล้ ๆ เข้าหาตัว' },
    aclaire: { hp: 3, speed: 1.25, magnet: false, guard: 1, desc: 'วิ่งเร็วขึ้น 25% และกันหินได้ 1 ครั้ง' }
  };

  function perksFor(charId) { return PERKS[charId] || PERKS.bobo; }

  /** ความกว้างสนามตามสัดส่วนจอ (กว้าง/สูง) */
  function fieldWidth(aspect) {
    const w = Math.round(FIELD_H * (aspect > 0 ? aspect : 1));
    return Math.max(MIN_W, Math.min(MAX_W, w));
  }

  /** ความยากตามเวลาที่เล่น (วินาที) */
  function difficulty(t, w) {
    const speed = Math.min(440, 150 + 4.5 * t);
    // สนามกว้างมีของตกถี่ขึ้น ความหนาแน่นต่อพื้นที่จึงใกล้เคียงกัน
    const widthMul = Math.max(0.55, Math.min(1.2, 420 / (w || 420)));
    const interval = Math.max(0.32, 0.85 - 0.008 * t) * widthMul;
    const rock = Math.min(0.42, 0.14 + 0.005 * t);
    return { speed: speed, interval: interval, rock: rock, gem: 0.05, heart: t > 15 ? 0.025 : 0 };
  }

  function multiplier(combo) {
    return Math.min(MAX_MULT, 1 + Math.floor(combo / COMBO_STEP));
  }

  function newGame(opts) {
    opts = opts || {};
    const w = opts.w || fieldWidth(1);
    const perks = perksFor(opts.charId);
    return {
      w: w,
      h: FIELD_H,
      groundY: FIELD_H - GROUND,
      rng: opts.rng || Math.random,
      perks: perks,
      t: 0,
      score: 0,
      hp: perks.hp,
      maxHp: perks.hp,
      combo: 0,
      maxCombo: 0,
      caught: 0,
      over: false,
      spawnT: 0.6,
      lastRockX: -999,
      player: { x: w / 2, w: PLAYER_W, h: PLAYER_H, vx: 0, face: 1, inv: 0, guard: perks.guard },
      objs: []
    };
  }

  function pickKind(s, d) {
    const r = s.rng();
    if (r < d.rock) return 'rock';
    if (r < d.rock + d.gem) return 'gem';
    if (r < d.rock + d.gem + d.heart && s.hp < s.maxHp) return 'heart';
    return 'coin';
  }

  function spawn(s, d) {
    const kind = pickKind(s, d);
    const r = KINDS[kind].r;
    let x = r + 6 + s.rng() * (s.w - 2 * (r + 6));
    // หินสองก้อนติดกันไม่ตกซ้อนตำแหน่งเดิม กันกำแพงหินที่หลบไม่ได้
    if (kind === 'rock' && Math.abs(x - s.lastRockX) < PLAYER_W * 1.5) {
      x = x < s.w / 2 ? Math.min(s.w - r - 6, x + PLAYER_W * 3) : Math.max(r + 6, x - PLAYER_W * 3);
    }
    if (kind === 'rock') s.lastRockX = x;
    s.objs.push({
      kind: kind,
      x: x,
      y: -r,
      vx: 0,
      vy: d.speed * (0.85 + s.rng() * 0.3) * (kind === 'rock' ? 1.08 : 1),
      r: r,
      rot: s.rng() * Math.PI * 2,
      vr: (s.rng() - 0.5) * (kind === 'rock' ? 5 : 2)
    });
  }

  /** วงกลม (ของที่ตก) ชนสี่เหลี่ยม (ตัวละคร) ที่ขยาย/หดขอบด้วย pad */
  function touches(s, o, pad) {
    const p = s.player;
    const left = p.x - p.w / 2 - pad, right = p.x + p.w / 2 + pad;
    const top = s.groundY - p.h - pad, bottom = s.groundY;
    const cx = Math.max(left, Math.min(right, o.x));
    const cy = Math.max(top, Math.min(bottom, o.y));
    const dx = o.x - cx, dy = o.y - cy;
    return dx * dx + dy * dy <= o.r * o.r;
  }

  /**
   * เดินหนึ่งจังหวะ
   * ctrl.move = -1 | 0 | 1 (ปุ่มซ้าย/ขวา) หรือ ctrl.target = ตำแหน่ง x ที่นิ้วชี้อยู่ (มีผลก่อน move)
   * คืนรายการเหตุการณ์ { type: coin|gem|heart|bonus|hit|guard|miss|smash|combo|over, x, y, pts }
   */
  function step(s, dt, ctrl) {
    const ev = [];
    if (s.over) return ev;
    ctrl = ctrl || {};
    s.t += dt;
    const p = s.player;
    const maxV = RUN_SPEED * s.perks.speed;

    // ── ตัวละคร ──
    if (ctrl.target != null) {
      p.vx = Math.max(-maxV, Math.min(maxV, (ctrl.target - p.x) * FOLLOW));
    } else {
      const want = (ctrl.move || 0) * maxV;
      const a = RUN_ACCEL * dt;
      p.vx = want > p.vx ? Math.min(want, p.vx + a) : Math.max(want, p.vx - a);
    }
    p.x += p.vx * dt;
    const half = p.w / 2;
    if (p.x < half) { p.x = half; p.vx = Math.max(0, p.vx); }
    if (p.x > s.w - half) { p.x = s.w - half; p.vx = Math.min(0, p.vx); }
    if (Math.abs(p.vx) > 30) p.face = p.vx > 0 ? 1 : -1;
    p.inv = Math.max(0, p.inv - dt);

    // ── สุ่มของตก ──
    const d = difficulty(s.t, s.w);
    s.spawnT -= dt;
    while (s.spawnT <= 0) {
      spawn(s, d);
      s.spawnT += d.interval * (0.75 + s.rng() * 0.5);
    }

    // ── ของที่ตก ──
    for (let i = s.objs.length - 1; i >= 0; i--) {
      const o = s.objs[i];
      const info = KINDS[o.kind];
      o.vy += 60 * dt;
      if (s.perks.magnet && info.good && o.y > s.groundY - 260 && Math.abs(o.x - p.x) < MAGNET_RANGE) {
        o.vx = Math.sign(p.x - o.x) * Math.min(MAGNET_SPEED, Math.abs(p.x - o.x) * 8);
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.rot += o.vr * dt;

      if (info.good && touches(s, o, CATCH_PAD)) {
        s.objs.splice(i, 1);
        collect(s, o, ev);
        continue;
      }
      if (!info.good && touches(s, o, ROCK_PAD)) {
        s.objs.splice(i, 1);
        hitRock(s, o, ev);
        if (s.over) return ev;
        continue;
      }
      if (o.y - o.r >= s.groundY - 2) {
        s.objs.splice(i, 1);
        if (o.kind === 'rock') {
          ev.push({ type: 'smash', x: o.x, y: s.groundY });
        } else if (o.kind !== 'heart') {
          // เหรียญ/เพชรตกพื้น = คอมโบขาด
          if (s.combo > 0) ev.push({ type: 'miss', x: o.x, y: s.groundY, combo: s.combo });
          s.combo = 0;
        }
      }
    }
    return ev;
  }

  function collect(s, o, ev) {
    const before = multiplier(s.combo);
    if (o.kind === 'heart' && s.hp < s.maxHp) {
      s.hp++;
      ev.push({ type: 'heart', x: o.x, y: o.y });
      return;
    }
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.caught++;
    const pts = KINDS[o.kind].pts * multiplier(s.combo);
    s.score += pts;
    ev.push({ type: o.kind === 'heart' ? 'bonus' : o.kind, x: o.x, y: o.y, pts: pts });
    const after = multiplier(s.combo);
    if (after > before) ev.push({ type: 'combo', x: o.x, y: o.y, mult: after });
  }

  function hitRock(s, o, ev) {
    const p = s.player;
    if (p.inv > 0) { ev.push({ type: 'smash', x: o.x, y: o.y }); return; }
    if (p.guard > 0) {
      p.guard--;
      p.inv = INVINCIBLE;
      ev.push({ type: 'guard', x: o.x, y: o.y });
      return;
    }
    s.hp--;
    s.combo = 0;
    p.inv = INVINCIBLE;
    ev.push({ type: 'hit', x: o.x, y: o.y });
    if (s.hp <= 0) {
      s.hp = 0;
      s.over = true;
      ev.push({ type: 'over', x: p.x, y: s.groundY });
    }
  }

  CQ.RainRules = {
    FIELD_H: FIELD_H,
    MIN_W: MIN_W,
    MAX_W: MAX_W,
    GROUND: GROUND,
    RUN_SPEED: RUN_SPEED,
    COMBO_STEP: COMBO_STEP,
    MAX_MULT: MAX_MULT,
    KINDS: KINDS,
    PERKS: PERKS,
    perksFor: perksFor,
    fieldWidth: fieldWidth,
    difficulty: difficulty,
    multiplier: multiplier,
    newGame: newGame,
    step: step
  };
})(typeof window !== 'undefined' ? window : globalThis);
