/*
 * Coin Quest — ตัวควบคุมเกมหลัก: สถานะเกม, game loop, HUD และหน้าจอต่าง ๆ
 */
(function () {
  'use strict';
  const CQ = window.CQ;
  const W = CQ.World;
  const P = CQ.PHYS;
  const T = P.T;
  const TILE = CQ.TILE;
  const Sound = CQ.Audio;
  const Input = CQ.Input;
  const Spawn = CQ.Spawn;
  const Boss = CQ.Boss;
  const CHAR_KEY = 'coinquest.char';  // ตัวละครที่เลือกไว้
  const MODE_KEY = 'coinquest.mode';  // โหมดที่เล่นล่าสุด
  const STAGE_KEY = 'coinquest.stage'; // สเตจที่เลือกไว้
  const POWERS = ['wing', 'mush', 'star'];
  const ITEM_INFO = {
    wing: { name: 'ปีก', toast: 'ได้ปีก! กระโดด 2 ชั้นได้ 10 วินาที', colors: ['#ffffff', '#bfe6ff', '#7fc4f5'] },
    mush: { name: 'เห็ด', toast: 'ได้เห็ด! วิ่งเร็วขึ้น 10 วินาที', colors: ['#ff5a7a', '#ffffff', '#ffc2cd'] },
    star: { name: 'ดาว', toast: 'ได้ดาว! อมตะ 10 วินาที ชนศัตรูได้เลย', colors: ['#ffd23f', '#fff3a0', '#ff9df5'] },
    heart: { name: 'หัวใจ', toast: 'ได้หัวใจ! พลังชีวิต +1', colors: ['#ff4d6a', '#ffffff', '#ffc2cd'] }
  };
  // สีอนุภาคของกระสุนแต่ละแบบ (ตอนชนกำแพง/ศัตรู)
  const SHOT_COLORS = {
    light: ['#ffffff', '#fff6b0', '#ffe066'],
    wind: ['#c9ffd4', '#7dff9a', '#2ecc71'],
    fire: ['#ffe08a', '#ff9b3a', '#ff5a1a'],
    boss: ['#fff0a0', '#ff9b3a', '#e8361e']
  };

  const $ = function (id) { return document.getElementById(id); };
  const canvas = $('game');
  const renderer = new CQ.Renderer(canvas);
  const ui = {
    hud: $('hud'),
    hudLeft: $('hud-left'),
    hudRight: $('hud-right'),
    toast: $('toast'),
    title: $('screen-title'),
    chars: $('screen-chars'),
    pause: $('screen-pause'),
    win: $('screen-win'),
    minigames: $('screen-minigames'),
    rps: $('screen-rps'),
    rain: $('screen-rain'),
    memory: $('screen-memory'),
    titleDay: $('title-day'),
    titleCharPreview: $('title-char-preview'),
    titleCharName: $('title-char-name'),
    titleCharTag: $('title-char-tag'),
    stagePick: $('stage-pick'),
    btnNormal: $('btn-normal'),
    btnTimed: $('btn-timed'),
    descNormal: $('desc-normal'),
    descTimed: $('desc-timed'),
    bestNormal: $('best-normal'),
    bestTimed: $('best-timed'),
    charGrid: $('char-grid'),
    winHeading: $('win-heading'),
    winSub: $('win-sub'),
    winLabel: $('win-label'),
    winTime: $('win-time'),
    winBestAll: $('win-best-all'),
    winBest: $('win-best'),
    winNew: $('win-new'),
    btnSound: $('btn-sound'),
    btnMusic: $('btn-music'),
    btnFullscreen: $('btn-fullscreen')
  };

  let g = null;
  let state = 'title'; // title | chars | minigames | rps | rain | memory | playing | paused | cleared | won
  let pendingJump = false;
  let lastTime = performance.now();
  let acc = 0;
  let clock = 0;
  let winShownAt = 0;
  const spawnPools = {};
  let tempo = 1;
  let charId = CQ.getCharacter(CQ.store.get(CHAR_KEY)).id;
  let stageId = CQ.getStage(CQ.store.get(STAGE_KEY)).id;
  let lastMode = CQ.store.get(MODE_KEY) === 'timed' ? 'timed' : 'normal';
  let charCards = [];
  let stageBtns = [];
  let navPrev = 0;
  const events = [];

  // ── seed ของด่าน: รายวัน หรือกำหนดเองด้วย ?seed=xxx ───────────────
  function currentSeed() {
    let custom = null;
    try { custom = new URLSearchParams(window.location.search).get('seed'); } catch (e) { /* ignore */ }
    if (custom) return { seed: 'custom:' + custom, custom: true, label: 'ด่านพิเศษ: ' + custom };
    const now = new Date();
    const day = Spawn.dailySeed(now);
    let label = day;
    try { label = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { /* ignore */ }
    return { seed: day, day: day, custom: false, label: 'ด่านประจำวันที่ ' + label };
  }

  /** จุดที่สุ่มวางของได้ แยกตามสเตจ (คำนวณครั้งเดียวต่อสเตจ) */
  function getPool(stage) {
    if (!spawnPools[stage.id]) spawnPools[stage.id] = Spawn.buildPool(CQ.parseLevel(stage.sections, { staticPlatforms: true }));
    return spawnPools[stage.id];
  }

  function stageLabel(stage) {
    return 'สเตจ ' + stage.no + ' ' + stage.name;
  }

  // ── สร้างเกมใหม่ ──────────────────────────────────────────────
  function newGame(mode) {
    const timed = mode === 'timed';
    const ch = CQ.getCharacter(charId);
    const stage = CQ.getStage(stageId);
    const lv = CQ.parseLevel(stage.sections);
    if (lv.errors.length) console.warn('Level errors:', lv.errors);
    const springs = [];
    for (let i = 0; i < lv.tiles.length; i++) {
      if (lv.tiles[i] === TILE.SPRING) springs.push({ tx: i % lv.w, ty: Math.floor(i / lv.w), hit: -10 });
    }
    const seedInfo = currentSeed();
    const rng = Spawn.makeRng(Spawn.modeSeed(seedInfo.seed, timed ? 'timed' : 'normal', stage.id));
    const picked = Spawn.pick(getPool(stage), lv.w, rng, { coins: Spawn.coinsFor(stage, timed ? 'timed' : 'normal'), items: Spawn.itemsFor(stage) });
    const center = function (o) { return { tx: o.tx, ty: o.ty, x: o.tx * T + T / 2, y: o.ty * T + T / 2 }; };
    const coins = lv.coins.map(center).concat(picked.coins.map(center));
    // Boss Stage: เหรียญจากบอส ซ่อนไว้จนกว่าจะชนะบอส (นับรวมในเป้าหมาย)
    if (lv.boss) {
      for (let i = 0; i < (stage.bossCoins || 0); i++) {
        const c = center(lv.boss);
        c.hidden = true;
        c.boss = true;
        coins.push(c);
      }
    }
    g = {
      lv: lv,
      mode: timed ? 'timed' : 'normal',
      stage: stage,
      char: ch,
      seedInfo: seedInfo,
      player: W.makePlayer(lv.start.tx, lv.start.ty, ch, stage.hp),
      coins: coins.map(function (c, i) { c.taken = false; c.phase = i * 0.83; return c; }),
      items: picked.items.map(function (it, i) { const o = center(it); o.type = it.type; o.taken = false; o.phase = i * 1.7; return o; }),
      enemies: lv.enemies.map(W.makeEnemy),
      checkpoints: lv.checkpoints.map(function (c) { return { tx: c.tx, ty: c.ty, active: false, raise: 0 }; }),
      springs: springs,
      particles: [],
      respawn: { tx: lv.start.tx, ty: lv.start.ty },
      collected: 0,
      total: coins.length,
      goal: coins.length, // ทุกโหมด: เก็บครบทุกเหรียญในฉาก = จบ
      limit: timed ? Spawn.TIMED_TIME : 0, // โหมดจับเวลา: เวลาที่มี (วินาที) / 0 = ไม่จำกัด
      time: 0,
      deaths: 0,
      lastTick: 0,
      warned: false,
      bumpT: null, // เวลาที่เก็บเหรียญล่าสุด (ให้ HUD เด้งตัวเลข)
      shake: 0,
      flash: 0,
      landSquash: 0,
      runPhase: 0,
      deathAnim: null,
      clearT: 0,
      showMinimap: false,
      // Boss Stage
      boss: lv.boss ? Boss.makeBoss(lv) : null,
      bossDefeated: false, // ชนะบอสแล้ว: บอสไม่กลับมาอีกจนจบด่าน แม้จะพลาด
      shots: [],           // กระสุนพลังของผู้เล่น
      fires: [],           // ลูกไฟของบอส
      rocks: [],           // หินที่กำลังหล่น
      spawners: lv.rocks.map(Boss.makeSpawner),
      shotCD: 0
    };
    document.body.classList.toggle('boss-stage', !!stage.boss);
    renderer.setLevel(lv, stage.theme);
    renderer.prepareHero(ch.id);
    renderer.look = 0;
    renderer.updateCamera(focusPoint(), 1, 0, true);
  }

  function focusPoint() {
    const d = g.deathAnim;
    if (d) return { x: d.x + d.w / 2, y: Math.min(d.startY, g.lv.h * T) };
    return { x: g.player.x + g.player.w / 2, y: g.player.y + g.player.h / 2 };
  }

  // ── อนุภาค (particles) ─────────────────────────────────────────
  function spawn(p) {
    if (g.particles.length > 400) g.particles.shift();
    p.t = 0;
    g.particles.push(p);
  }

  function dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      spawn({ kind: 'circle', x: x + (Math.random() - 0.5) * 16, y: y - 2, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 60, g: 140, size: 2.5 + Math.random() * 2.5, color: 'rgba(245,236,215,0.9)', life: 0.35 + Math.random() * 0.2 });
    }
  }

  function burst(x, y, n, colors, speed, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6);
      spawn({ kind: kind || 'star', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 220, size: 3 + Math.random() * 3, color: colors[i % colors.length], life: 0.5 + Math.random() * 0.4 });
    }
  }

  function confetti(n) {
    const colors = ['#ff6b6b', '#ffd23f', '#4fa9f2', '#2ecc71', '#b07cff', '#ff9f43'];
    for (let i = 0; i < n; i++) {
      spawn({ kind: 'rect', x: renderer.cam.x + Math.random() * renderer.viewW, y: renderer.cam.y - 20 - Math.random() * 120, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, g: 60, size: 6 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, color: colors[i % colors.length], life: 2.6 + Math.random() * 1.2 });
    }
  }

  // ── การจำลองโลกเกม 1 สเต็ป ─────────────────────────────────────
  function step(dt, inp) {
    const lv = g.lv;
    for (let i = 0; i < lv.platforms.length; i++) W.stepPlatform(lv.platforms[i], dt);
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      W.stepEnemy(e, lv, dt);
      if (e.dead && e.deadT > 0.7) g.enemies.splice(i, 1);
    }

    if (g.deathAnim) {
      const d = g.deathAnim;
      d.t += dt;
      d.vy += P.GRAVITY * 0.75 * dt;
      d.y += d.vy * dt;
      d.rot += dt * 7 * d.face;
      if (d.t > 1.05) respawn();
      return;
    }

    const p = g.player;
    events.length = 0;
    const jumpPressed = pendingJump;
    pendingJump = false;
    W.stepPlayer(p, { left: inp.left, right: inp.right, jump: inp.jump, jumpPressed: jumpPressed }, lv, dt, events);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.onGround && Math.abs(p.vx) > 25) g.runPhase += dt * Math.abs(p.vx) * 0.075;

    for (let i = 0; i < events.length; i++) handleEvent(events[i], p);
    if (p.dead) { kill(); return; }
    updatePowers(p, dt);

    const R = P.COIN_R;
    for (let i = 0; i < g.coins.length; i++) {
      const c = g.coins[i];
      if (c.pop && c.pop.t < 0.6) c.pop.t += dt;
      if (c.hidden || (c.pop && c.pop.t < 0.6)) continue;
      if (!c.taken && W.overlap(p.x, p.y, p.w, p.h, c.x - R, c.y - R, R * 2, R * 2)) {
        collectCoin(c);
        if (state !== 'playing') return;
      }
    }

    const IR = P.COIN_R + 1;
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      if (it.type === 'heart' && p.hp >= p.hpMax) continue; // พลังชีวิตเต็ม: เก็บหัวใจไว้ใช้ทีหลัง
      if (!it.taken && W.overlap(p.x, p.y, p.w, p.h, it.x - IR, it.y - IR, IR * 2, IR * 2)) collectItem(it, p);
    }

    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (e.dead) continue;
      const touching = W.overlap(p.x + 2, p.y + 3, p.w - 4, p.h - 3, e.x + 2, e.y + 4, e.w - 4, e.h - 4);
      if (e.kind === 'boar') {
        // หมูป่าที่ตื่นขณะทับตัวผู้เล่น ยังไม่ทำร้ายจนกว่าจะแยกกัน
        const stunned = e.stunT > 0;
        if (e.wasStunned && !stunned && touching) e.safe = true;
        e.wasStunned = stunned;
        if (e.safe && !touching) e.safe = false;
      }
      if (!touching) continue;
      const stomping = p.vy > 0 && p.prevBottom <= e.y + e.h * 0.6;
      if (e.kind === 'boar') {
        if (p.pw.star > 0) { if (!(e.stunT > 0)) stunBoar(e, p, true); continue; }
        if (stomping) { stomp(e, p, inp); continue; }
        if (e.stunT > 0 || e.safe) continue; // สลบอยู่: เดินทะลุได้
      } else {
        if (p.pw.star > 0) { knockOut(e, p); continue; }
        if (stomping) { stomp(e, p, inp); continue; }
      }
      if (p.invuln > 0) continue;
      if (hurtPlayer(p, e, 'enemy')) return;
    }

    if (g.stage.boss && stepBossStage(p, inp, dt)) return;

    for (let i = 0; i < g.checkpoints.length; i++) {
      const cp = g.checkpoints[i];
      if (!cp.active && W.overlap(p.x, p.y, p.w, p.h, cp.tx * T, (cp.ty - 1) * T, T, T * 2)) activateCheckpoint(cp);
    }
  }

  function handleEvent(ev, p) {
    switch (ev.type) {
      case 'jump':
        Sound.sfx.jump();
        dust(p.x + p.w / 2, p.y + p.h, 4);
        break;
      case 'land':
        if (ev.speed > 260) {
          g.landSquash = Math.min(0.22, ev.speed / 2600);
          dust(p.x + p.w / 2, p.y + p.h, ev.speed > 600 ? 8 : 4);
          if (ev.speed > 450) Sound.sfx.land();
        }
        break;
      case 'bonk':
        Sound.sfx.bonk();
        break;
      case 'airjump':
        Sound.sfx.airjump();
        if (ev.wing) {
          for (let i = 0; i < 6; i++) {
            spawn({ kind: 'feather', x: p.x + p.w / 2 + (Math.random() - 0.5) * 20, y: p.y + p.h - 4, vx: (Math.random() - 0.5) * 70, vy: 20 + Math.random() * 40, g: 30, size: 5 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, color: '#ffffff', life: 0.7 + Math.random() * 0.3 });
          }
        } else {
          // กระโดดชั้นที่ 2 ของตัวละคร (Mew): วงประกายใต้เท้า
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            spawn({ kind: 'star', x: p.x + p.w / 2, y: p.y + p.h, vx: Math.cos(a) * 90, vy: Math.sin(a) * 30 + 20, g: 0, size: 2.5 + Math.random() * 2, color: i % 2 ? '#ffffff' : g.char.color, life: 0.4 });
          }
        }
        break;
      case 'float':
        Sound.sfx.float();
        break;
      case 'guard':
        guarded(p);
        break;
      case 'hurt':
        hurtFx(p);
        break;
      case 'fell':
        hurtFx(p);
        toast('ตกเหว! พลังชีวิต -1');
        break;
      case 'spring': {
        Sound.sfx.spring();
        const s = g.springs.find(function (sp) { return sp.tx === ev.tx && sp.ty === ev.ty; });
        if (s) s.hit = clock;
        burst(ev.tx * T + 16, ev.ty * T + 18, 6, ['#ffffff', '#ffd23f'], 120, 'circle');
        break;
      }
    }
  }

  function collectCoin(c) {
    c.taken = true;
    g.collected++;
    Sound.sfx.coin();
    burst(c.x, c.y, 10, ['#ffd23f', '#fff3a0', '#ffffff'], 150, 'star');
    spawn({ kind: 'text', text: '+1', x: c.x, y: c.y - 14, vx: 0, vy: -50, g: 0, color: '#ffe066', life: 0.8 });
    g.bumpT = clock;
    const left = g.goal - g.collected;
    if (left === 0) clearGame();
    else if (g.mode === 'timed') {
      if (g.collected % 10 === 0) toast(g.collected + ' เหรียญแล้ว!');
    } else if (left === 1) toast('อีกเหรียญเดียวก็ครบแล้ว!');
    else if (left === Math.floor(g.goal / 2)) toast('ครึ่งทางแล้ว! เหลืออีก ' + left + ' เหรียญ');
  }

  // ── ไอเทม ────────────────────────────────────────────────────
  function collectItem(it, p) {
    const info = ITEM_INFO[it.type];
    it.taken = true;
    if (it.type === 'heart') {
      p.hp = Math.min(p.hpMax, p.hp + 1);
      Sound.sfx.heart();
      burst(it.x, it.y, 12, info.colors, 150, 'star');
      spawn({ kind: 'text', text: '+1', x: it.x, y: it.y - 16, vx: 0, vy: -45, g: 0, color: '#ff8fa0', life: 1 });
      toast(info.toast + ' (' + p.hp + '/' + p.hpMax + ')');
      return;
    }
    p.pw[it.type] = P.POWER_TIME;
    if (it.type === 'wing') p.airJumps = Math.min(p.airJumps + 1, p.airJumpsMax + 1); // ปีกเพิ่มกระโดดกลางอากาศ 1 ครั้ง
    Sound.sfx.powerup();
    burst(it.x, it.y, 14, info.colors, 170, 'star');
    spawn({ kind: 'text', text: info.name + '!', x: it.x, y: it.y - 16, vx: 0, vy: -45, g: 0, color: '#ffffff', life: 1 });
    toast(info.toast);
  }

  function updatePowers(p, dt) {
    for (let i = 0; i < POWERS.length; i++) {
      const k = POWERS[i];
      if (p.pw[k] <= 0) continue;
      p.pw[k] -= dt;
      if (p.pw[k] <= 0) {
        p.pw[k] = 0;
        Sound.sfx.powerdown();
      }
    }
    // เอฟเฟกต์ระหว่างมีพลัง
    if (p.pw.star > 0 && Math.random() < 0.3) {
      spawn({ kind: 'star', x: p.x + Math.random() * p.w, y: p.y + Math.random() * p.h, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, g: 0, size: 2.5 + Math.random() * 2.5, color: 'hsl(' + Math.floor(Math.random() * 360) + ',95%,70%)', life: 0.45 });
    }
    if (p.floating && Math.random() < 0.45) {
      spawn({ kind: 'star', x: p.x + 3 + Math.random() * (p.w - 6), y: p.y + p.h + 1, vx: (Math.random() - 0.5) * 20, vy: 25 + Math.random() * 25, g: 0, size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#ffffff' : '#bcd4ff', life: 0.45 });
    }
    if (p.pw.mush > 0 && p.onGround && Math.abs(p.vx) > P.RUN && Math.random() < 0.35) {
      spawn({ kind: 'circle', x: p.x + p.w / 2 - Math.sign(p.vx) * 10, y: p.y + p.h - 3, vx: -p.vx * 0.15, vy: -Math.random() * 30, g: 60, size: 2 + Math.random() * 2, color: 'rgba(255,200,210,0.9)', life: 0.3 });
    }
  }

  function knockOut(e, p) {
    e.dead = true;
    e.deadT = 0;
    e.knock = Math.sign(e.x + e.w / 2 - (p.x + p.w / 2)) || p.face;
    g.shake = Math.max(g.shake, 3);
    Sound.sfx.zap();
    burst(e.x + e.w / 2, e.y + e.h / 2, 10, ['#ffd23f', '#ffffff', '#ff9df5'], 160, 'star');
  }

  function stomp(e, p, inp) {
    p.vy = inp.jump ? -P.JUMP_V * p.st.jump * 0.9 : -P.STOMP_V;
    p.jumping = !!inp.jump;
    p.onGround = false;
    p.ride = null;
    W.refillAirJumps(p);
    g.shake = Math.max(g.shake, 3);
    if (e.kind === 'boar') { stunBoar(e, p, false); return; }
    e.dead = true;
    e.deadT = 0;
    Sound.sfx.stomp();
    burst(e.x + e.w / 2, e.y + e.h / 2, 8, ['#58d26d', '#a8f0b4'], 140, 'circle');
  }

  /** หมูป่าสลบ STUN_TIME วินาที (ไม่ตาย) knock = โดนดาวชน: กระเด็นเล็กน้อย */
  function stunBoar(e, p, knock) {
    e.stunT = P.STUN_TIME;
    e.safe = false;
    if (knock) {
      e.dir = Math.sign(e.x + e.w / 2 - (p.x + p.w / 2)) || p.face;
      e.vy = -260;
      e.onGround = false;
      g.shake = Math.max(g.shake, 3);
      Sound.sfx.zap();
    }
    Sound.sfx.stun();
    burst(e.x + e.w / 2, e.y + 4, 8, ['#ffd23f', '#ffffff', '#c98b55'], 130, 'star');
  }

  /**
   * ผู้เล่นโดนศัตรู/บอส/ลูกไฟ/หิน (from = สิ่งที่ชน ใช้หาทิศที่กระเด็น)
   * สเตจปกติพลาดทันที (ยกเว้นกันตายของ Aclaire) Boss Stage เสียพลังชีวิต 1 ขีด คืนค่า true ถ้าพลาด
   */
  function hurtPlayer(p, from, cause) {
    const evs = [];
    if (W.hurt(p, evs, cause)) { kill(); return true; }
    if (from) {
      const fx = from.w != null ? from.x + from.w / 2 : from.x;
      p.vx = (p.x + p.w / 2 < fx ? -1 : 1) * 230;
    }
    for (let i = 0; i < evs.length; i++) handleEvent(evs[i], p);
    return false;
  }

  /** Boss Stage: เสียพลังชีวิต 1 ขีด */
  function hurtFx(p) {
    g.shake = Math.max(g.shake, 5);
    g.flash = Math.max(g.flash, 0.6);
    Sound.sfx.hurt();
    burst(p.x + p.w / 2, p.y + p.h / 2, 10, ['#ff4d6a', '#ffc2cd', '#ffffff'], 150, 'star');
    spawn({ kind: 'text', text: '-1', x: p.x + p.w / 2, y: p.y - 6, vx: 0, vy: -50, g: 0, color: '#ff6a7a', life: 0.9 });
    if (p.hp === 1) toast('เหลือพลังชีวิต 1 ขีด! ระวังนะ');
  }

  /** Aclaire กันตายได้: กระเด็นออก (hurtPlayer ผลักตัวให้แล้ว) และอมตะชั่วคราว */
  function guarded(p) {
    g.shake = Math.max(g.shake, 5);
    g.flash = Math.max(g.flash, 0.5);
    Sound.sfx.guard();
    burst(p.x + p.w / 2, p.y + p.h / 2, 14, [g.char.color, '#ffffff', '#ffd3e6'], 170, 'star');
    toast(g.char.name + ' ทนไว้ได้! อมตะ ' + P.GUARD_TIME + ' วินาที');
  }

  function activateCheckpoint(cp) {
    cp.active = true;
    cp.raise = 0;
    g.respawn = { tx: cp.tx, ty: cp.ty };
    Sound.sfx.checkpoint();
    burst(cp.tx * T + 24, (cp.ty - 1) * T, 10, ['#2ecc71', '#ffffff', '#ffd23f'], 130, 'star');
    toast('บันทึกจุดเช็กพอยต์แล้ว');
  }

  function kill() {
    const p = g.player;
    g.deaths++;
    g.deathAnim = { x: p.x, y: p.y, startY: p.y, w: p.w, h: p.h, vx: 0, vy: -430, face: p.face, rot: 0, t: 0, onGround: false, ch: p.ch };
    g.shake = 7;
    g.flash = 1;
    g.shots.length = 0;
    g.fires.length = 0;
    g.rocks.length = 0;
    Sound.sfx.die();
    burst(p.x + p.w / 2, p.y + p.h / 2, 10, ['#ff6a3d', '#ffd3ad', '#ffffff'], 160, 'circle');
  }

  function respawn() {
    const r = g.respawn;
    g.player = W.makePlayer(r.tx, r.ty, g.char, g.stage.hp);
    g.player.invuln = 1.5;
    g.deathAnim = null;
    pendingJump = false;
    // Boss Stage: บอสที่ยังไม่แพ้กลับมาพลังเต็มที่เดิม (แพ้แล้วไม่กลับมาอีก)
    if (g.boss && !g.bossDefeated) g.boss = Boss.makeBoss(g.lv);
  }

  // ── Boss Stage: ยิงพลัง บอส ลูกไฟ หินหล่น ─────────────────────────
  /** คืนค่า true ถ้าผู้เล่นพลาด (หยุดสเต็ปนี้) */
  function stepBossStage(p, inp, dt) {
    const lv = g.lv;

    // ยิงพลัง: กดค้างได้ ยิงได้เมื่อกระสุนบนจอยังไม่ครบจำนวนของตัวละคร
    const w = g.char.shot;
    if (g.shotCD > 0) g.shotCD -= dt;
    if (w && inp.fire && g.shotCD <= 0 && g.shots.length < w.max) {
      g.shots.push(Boss.makeShot(p, w));
      g.shotCD = w.cooldown;
      Sound.sfx.shoot(w.kind);
    }
    for (let i = g.shots.length - 1; i >= 0; i--) {
      const s = g.shots[i];
      const res = Boss.stepShot(s, lv, dt) || shotHit(s, p);
      if (!res) continue;
      g.shots.splice(i, 1);
      if (res !== 'expire') burst(s.x, s.y, 6, SHOT_COLORS[s.kind], 110, 'circle');
    }

    // บอส
    const b = g.boss;
    if (b) {
      const evs = [];
      Boss.stepBoss(b, p, dt, g.fires, evs);
      for (let i = 0; i < evs.length; i++) bossEvent(evs[i], b);
      if (b.dead) bossDying(b, dt);
      else if (b.state !== 'sleep' && !(p.invuln > 0) && !(p.pw.star > 0)) {
        const box = Boss.bossTouchBox(b);
        if (W.overlap(p.x + 2, p.y + 3, p.w - 4, p.h - 3, box.x, box.y, box.w, box.h) && hurtPlayer(p, b, 'boss')) return true;
      }
    }

    // ลูกไฟของบอส
    for (let i = g.fires.length - 1; i >= 0; i--) {
      const f = g.fires[i];
      if (Boss.stepShot(f, lv, dt)) {
        g.fires.splice(i, 1);
        burst(f.x, f.y, 6, SHOT_COLORS.boss, 100, 'circle');
        continue;
      }
      if (!Boss.shotHits(f, { x: p.x + 3, y: p.y + 4, w: p.w - 6, h: p.h - 4 })) continue;
      if (p.invuln > 0) continue;
      g.fires.splice(i, 1);
      burst(f.x, f.y, 10, SHOT_COLORS.boss, 140, 'circle');
      if (p.pw.star > 0) continue;
      if (hurtPlayer(p, f, 'fire')) return true;
    }

    // หินหล่นจากเพดาน
    for (let i = 0; i < g.spawners.length; i++) {
      const sp = g.spawners[i];
      if (Boss.stepSpawner(sp, p, dt)) {
        g.rocks.push(Boss.makeRock(sp));
        Sound.sfx.rockCrack();
      } else if (sp.warn && Math.random() < dt * 14) {
        spawn({ kind: 'circle', x: sp.x + (Math.random() - 0.5) * 22, y: sp.y + 2, vx: 0, vy: 30 + Math.random() * 40, g: 300, size: 1.5 + Math.random() * 1.5, color: 'rgba(190,180,200,0.9)', life: 0.6 });
      }
    }
    for (let i = g.rocks.length - 1; i >= 0; i--) {
      const rk = g.rocks[i];
      const res = Boss.stepRock(rk, lv, dt);
      if (res) {
        g.rocks.splice(i, 1);
        if (res === 'break') breakRock(rk);
        continue;
      }
      if (p.invuln > 0 || !W.overlap(p.x + 2, p.y + 2, p.w - 4, p.h - 2, rk.x + 2, rk.y + 2, rk.w - 4, rk.h - 4)) continue;
      g.rocks.splice(i, 1);
      breakRock(rk);
      if (p.pw.star > 0) continue;
      if (hurtPlayer(p, rk, 'rock')) return true;
    }
    return false;
  }

  /** กระสุนผู้เล่นโดนบอส/ศัตรู/หิน คืน 'hit' ถ้าโดน */
  function shotHit(s, p) {
    const b = g.boss;
    if (b && !b.dead && Boss.shotHits(s, Boss.bossBox(b))) {
      const evs = [];
      Boss.hitBoss(b, s.dmg, evs);
      for (let i = 0; i < evs.length; i++) bossEvent(evs[i], b, s);
      return 'hit';
    }
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (e.dead || !Boss.shotHits(s, e)) continue;
      if (e.kind === 'boar') stunBoar(e, p, false); // หมูป่าไม่มีวันตาย: สลบแทน
      else knockOut(e, { x: s.x, w: 0, face: Math.sign(s.vx) });
      return 'hit';
    }
    for (let i = 0; i < g.rocks.length; i++) {
      const rk = g.rocks[i];
      if (!Boss.shotHits(s, rk)) continue;
      g.rocks.splice(i, 1);
      breakRock(rk);
      return 'hit';
    }
    return null;
  }

  function breakRock(rk) {
    Sound.sfx.rockBreak();
    g.shake = Math.max(g.shake, 2);
    burst(rk.x + rk.w / 2, rk.y + rk.h / 2, 9, ['#8a8199', '#b3aac2', '#5a5268'], 130, 'circle');
  }

  /** เหตุการณ์ของบอส (s = กระสุนที่ยิงโดน) */
  function bossEvent(ev, b, s) {
    switch (ev.type) {
      case 'wake':
        Sound.sfx.roar();
        g.shake = Math.max(g.shake, 8);
        toast('บอสเต่าปีศาจตื่นแล้ว! กดยิงพลังใส่มัน');
        break;
      case 'wind':
        Sound.sfx.bossWind();
        break;
      case 'fire':
        Sound.sfx.bossFire();
        break;
      case 'hit':
        Sound.sfx.bossHit();
        spawn({ kind: 'text', text: '-' + ev.dmg, x: s.x, y: s.y - 10, vx: (Math.random() - 0.5) * 30, vy: -60, g: 0, color: '#ffffff', life: 0.6 });
        if (b.hp <= b.hpMax / 2 && b.hp + ev.dmg > b.hpMax / 2) toast('บอสโกรธแล้ว! โจมตีเร็วขึ้น');
        break;
      case 'down':
        Sound.sfx.bossDown();
        g.shake = Math.max(g.shake, 10);
        g.bossDefeated = true;
        g.fires.length = 0;
        toast('ปราบบอสได้แล้ว!');
        break;
    }
  }

  /** บอสระเบิดทีละจุด แล้วเหรียญ 5 เหรียญกระเด็นออกมาให้เก็บ */
  function bossDying(b, dt) {
    if (b.deadT < 1.3 && Math.random() < dt * 16) {
      const x = b.x + Math.random() * b.w, y = b.y + Math.random() * b.h;
      burst(x, y, 8, ['#fff0a0', '#ff9b3a', '#e8361e', '#ffffff'], 160, 'circle');
      g.shake = Math.max(g.shake, 3);
    }
    if (b.dropped || b.deadT < 1.0) return;
    b.dropped = true;
    const list = g.coins.filter(function (c) { return c.boss; });
    const n = list.length;
    const ground = b.y + b.h;
    const cx = Math.max(b.minX + b.w / 2, Math.min(b.x + b.w / 2, g.lv.w * T - 30 - (n - 1) * 20));
    list.forEach(function (c, i) {
      const k = i - (n - 1) / 2;
      c.x = cx + k * 40;
      c.y = ground - 18 - (i % 2 ? 34 : 0);
      c.hidden = false;
      c.pop = { x0: b.x + b.w / 2, y0: b.y + b.h / 2, t: 0 };
    });
    burst(b.x + b.w / 2, b.y + b.h / 2, 24, ['#ffd23f', '#fff3a0', '#ffffff'], 220, 'star');
    Sound.sfx.powerup();
    toast('ได้เหรียญจากบอส ' + n + ' เหรียญ! เก็บให้ครบ');
  }

  function clearGame() {
    state = 'cleared';
    g.clearT = 0;
    Sound.stopMusic();
    Sound.sfx.win();
    confetti(140);
    toast('เก็บครบทุกเหรียญแล้ว!');
  }

  /** โหมดจับเวลา: หมดเวลา */
  function timeUp() {
    g.time = g.limit;
    state = 'cleared';
    g.clearT = 0;
    Sound.stopMusic();
    Sound.sfx.timeup();
    toast('หมดเวลา! เก็บได้ ' + g.collected + ' เหรียญ');
  }

  // ── บันทึกสถิติ (แยกตามสเตจ โหมด และตัวละคร: ตลอดกาล + ของด่านวันนี้) ─────
  /**
   * สเตจ 1 โหมดจับเวลาใช้ key เดิม สถิติที่ทำไว้จึงไม่หาย
   * สเตจอื่นใช้ coinquest.<สเตจ>.{best|daily}.<v>.<โหมด>.<ตัวละคร>
   * โหมดปกติขึ้นเวอร์ชัน key ใหม่ (สเตจ 1: v3, สเตจอื่น: v2) ตั้งแต่เปลี่ยนเป้าหมายจากเก็บ 20 เหรียญเป็นเก็บครบทั้งฉาก
   * เพราะเวลาแบบเดิมเทียบกันไม่ได้ (key เก่ายังอยู่ใน localStorage ไม่ได้ลบ)
   */
  function recordKeys(stage, mode, id) {
    if (stage !== 'grassland') {
      const k = 'coinquest.' + stage;
      const v = mode === 'timed' ? '.v1.' : '.v2.';
      return { all: k + '.best' + v + mode + '.' + id, day: k + '.daily' + v + mode + '.' + id };
    }
    if (mode === 'timed') return { all: 'coinquest.timed.best.v1.' + id, day: 'coinquest.timed.daily.v1.' + id };
    const sfx = id === 'bobo' ? '' : '.' + id;
    return { all: 'coinquest.best.v3' + sfx, day: 'coinquest.daily.v3' + sfx };
  }

  function readRecord(key, mode) {
    try {
      const v = JSON.parse(CQ.store.get(key));
      const field = mode === 'timed' ? 'coins' : 'time';
      return v && typeof v[field] === 'number' ? v : null;
    } catch (e) { return null; }
  }

  function loadRecords(stage, mode, id, day) {
    const keys = recordKeys(stage, mode, id);
    const daily = readRecord(keys.day, mode);
    return { all: readRecord(keys.all, mode), today: daily && daily.day === day ? daily : null };
  }

  /** ผล a ดีกว่าสถิติ b หรือไม่ (จับเวลา: เหรียญมากกว่า ถ้าเท่ากันดูเวลาที่เหลือ) */
  function isBetter(mode, a, b) {
    if (!b) return true;
    if (mode === 'timed') return a.coins > b.coins || (a.coins === b.coins && (a.left || 0) > (b.left || 0));
    return a.time < b.time;
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const d = Math.floor((t * 10) % 10);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + d;
  }

  function fmtRecord(mode, rec) {
    return mode === 'timed' ? rec.coins + ' เหรียญ' : fmtTime(rec.time);
  }

  function bestLine(stage, mode, id, info) {
    const rec = loadRecords(stage, mode, id, info.day);
    const parts = [];
    if (rec.today && !info.custom) parts.push('วันนี้ ' + fmtRecord(mode, rec.today));
    if (rec.all) parts.push('ดีที่สุด ' + fmtRecord(mode, rec.all));
    return parts.join(' · ');
  }

  function refreshTitle() {
    const info = currentSeed();
    const ch = CQ.getCharacter(charId);
    ui.titleDay.textContent = info.label;
    ui.titleCharName.textContent = ch.name;
    ui.titleCharTag.textContent = ch.tagline;
    const stage = CQ.getStage(stageId);
    const extra = stage.bossCoins || 0;
    const nNormal = Spawn.coinsFor(stage, 'normal') + extra;
    ui.descNormal.textContent = stage.boss ? 'ชนะบอสและเก็บครบ ' + nNormal + ' เหรียญ' : 'เก็บให้ครบทั้ง ' + nNormal + ' เหรียญในฉาก';
    ui.descTimed.textContent = 'เก็บให้มากที่สุดใน ' + Spawn.TIMED_TIME + ' วินาที';
    ui.btnTimed.title = 'มีเหรียญ ' + (Spawn.coinsFor(stage, 'timed') + extra) + ' เหรียญในฉาก มากกว่าโหมดปกติ';
    stageBtns.forEach(function (b) {
      const on = b.id === stageId;
      b.btn.classList.toggle('selected', on);
      b.btn.setAttribute('aria-checked', String(on));
    });
    [['normal', ui.bestNormal, ui.btnNormal], ['timed', ui.bestTimed, ui.btnTimed]].forEach(function (m) {
      const line = bestLine(stageId, m[0], charId, info);
      m[1].hidden = !line;
      m[1].textContent = line;
      m[2].classList.toggle('btn-primary', m[0] === lastMode);
    });
  }

  // ── หน้าเลือกตัวละคร ───────────────────────────────────────────
  function statRow(label, n) {
    let dots = '';
    for (let i = 0; i < 5; i++) dots += '<i' + (i < n ? ' class="on"' : '') + '></i>';
    return '<span class="stat"><span class="stat-label">' + label + '</span><span class="dots" role="img" aria-label="' + n + ' จาก 5">' + dots + '</span></span>';
  }

  function buildCharCards() {
    ui.charGrid.textContent = '';
    charCards = CQ.CHARACTERS.map(function (ch) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'char-card';
      btn.setAttribute('role', 'radio');
      btn.style.setProperty('--accent', ch.color);
      btn.innerHTML = '<canvas class="char-preview" aria-hidden="true"></canvas>' +
        '<span class="char-info">' +
        '<b class="char-name"></b><span class="char-tag"></span><span class="char-desc"></span>' +
        statRow('ความเร็ว', ch.bars.speed) + statRow('กระโดด', ch.bars.jump) +
        '<span class="char-skill"></span>' +
        '<span class="char-shot"></span>' +
        '<span class="char-best"></span>' +
        '</span>';
      btn.querySelector('.char-name').textContent = ch.name;
      btn.querySelector('.char-tag').textContent = ch.tagline;
      btn.querySelector('.char-desc').textContent = ch.desc;
      btn.querySelector('.char-skill').textContent = ch.skill;
      btn.querySelector('.char-shot').textContent = ch.shot ? ch.shot.desc : '';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        Sound.unlock();
        Sound.sfx.click();
        if (ch.id === charId) closeChars(); // กดตัวที่เลือกอยู่แล้วซ้ำ = ตกลง
        else selectChar(ch.id);
      });
      ui.charGrid.appendChild(btn);
      return { id: ch.id, btn: btn, canvas: btn.querySelector('canvas'), best: btn.querySelector('.char-best') };
    });
  }

  function refreshCharCards() {
    const info = currentSeed();
    charCards.forEach(function (c) {
      const on = c.id === charId;
      c.btn.classList.toggle('selected', on);
      c.btn.setAttribute('aria-checked', String(on));
      const parts = [];
      const n = loadRecords(stageId, 'normal', c.id, info.day).all;
      const t = loadRecords(stageId, 'timed', c.id, info.day).all;
      if (n) parts.push('ปกติ ' + fmtRecord('normal', n));
      if (t) parts.push('จับเวลา ' + fmtRecord('timed', t));
      c.best.textContent = 'สเตจ ' + CQ.getStage(stageId).no + ': ' + (parts.length ? 'ดีที่สุด ' + parts.join(' · ') : 'ยังไม่มีสถิติ');
    });
  }

  function selectChar(id) {
    if (state !== 'chars' || id === charId) return;
    charId = CQ.getCharacter(id).id;
    CQ.store.set(CHAR_KEY, charId);
    newGame(lastMode); // ให้ตัวละครในฉากหลังเปลี่ยนตามทันที
    refreshCharCards();
  }

  /** เลื่อนเลือกตัวละครด้วยลูกศรซ้าย/ขวา หรือจอยเกม */
  function navChar(dir) {
    const n = CQ.CHARACTERS.length;
    let i = 0;
    while (i < n && CQ.CHARACTERS[i].id !== charId) i++;
    const next = CQ.CHARACTERS[(i + dir + n) % n].id;
    const focusCard = document.activeElement && document.activeElement.classList.contains('char-card');
    Sound.sfx.click();
    selectChar(next);
    if (focusCard) {
      const c = charCards.find(function (cc) { return cc.id === next; });
      if (c) c.btn.focus({ preventScroll: true });
    }
  }

  // ── เลือกสเตจ (หน้าแรก) ───────────────────────────────────────
  function buildStageButtons() {
    ui.stagePick.textContent = '';
    stageBtns = CQ.STAGES.map(function (st) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stage-btn stage-' + st.theme;
      btn.setAttribute('role', 'radio');
      btn.innerHTML = '<span class="stage-text"><span class="stage-no"></span><span class="stage-name"></span></span>';
      btn.querySelector('.stage-no').textContent = 'สเตจ ' + st.no;
      btn.querySelector('.stage-name').textContent = st.name;
      btn.title = st.name + ' (' + st.th + ')';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        Sound.unlock();
        Sound.sfx.click();
        selectStage(st.id);
      });
      ui.stagePick.appendChild(btn);
      return { id: st.id, btn: btn };
    });
  }

  function selectStage(id) {
    if (state !== 'title') return;
    const st = CQ.getStage(id);
    if (st.id === stageId) return;
    stageId = st.id;
    CQ.store.set(STAGE_KEY, stageId);
    newGame(lastMode); // ให้ฉากหลังเปลี่ยนตามทันที
    refreshTitle();
  }

  /** ลูกศรซ้าย/ขวาตอน focus อยู่ที่ปุ่มสเตจ = เลื่อนสเตจ */
  function navStage(dir) {
    const el = document.activeElement;
    if (!el || !el.classList.contains('stage-btn')) return;
    const n = CQ.STAGES.length;
    let i = 0;
    while (i < n && CQ.STAGES[i].id !== stageId) i++;
    const next = CQ.STAGES[(i + dir + n) % n].id;
    Sound.sfx.click();
    selectStage(next);
    const b = stageBtns.find(function (sb) { return sb.id === next; });
    if (b) b.btn.focus({ preventScroll: true });
  }

  function openChars() {
    if (state !== 'title') return;
    state = 'chars';
    navPrev = 0;
    refreshCharCards();
    setScreen(ui.chars);
  }

  function closeChars() {
    if (state !== 'chars') return;
    state = 'title';
    refreshTitle();
    setScreen(ui.title);
  }

  // ── มินิเกม ──────────────────────────────────────────────────
  function openMinigames() {
    if (state !== 'title' && state !== 'rps' && state !== 'rain' && state !== 'memory') return;
    if (state === 'rps') CQ.RPS.stop();
    if (state === 'rain') CQ.Rain.stop();
    if (state === 'memory') CQ.Memory.stop();
    state = 'minigames';
    setScreen(ui.minigames);
  }

  function closeMinigames() {
    if (state !== 'minigames') return;
    state = 'title';
    refreshTitle();
    setScreen(ui.title);
  }

  function startRps() {
    if (state !== 'minigames') return;
    state = 'rps';
    setScreen(ui.rps);
    CQ.RPS.start(charId);
  }

  function startRain() {
    if (state !== 'minigames') return;
    state = 'rain';
    setScreen(ui.rain);
    CQ.Rain.start(charId);
  }

  function startMemory() {
    if (state !== 'minigames') return;
    state = 'memory';
    setScreen(ui.memory);
    CQ.Memory.start(charId);
  }

  // ── หน้าจอและสถานะ ─────────────────────────────────────────────
  function setScreen(el) {
    [ui.title, ui.chars, ui.minigames, ui.rps, ui.rain, ui.memory, ui.pause, ui.win].forEach(function (s) { s.hidden = s !== el; });
    document.body.classList.toggle('overlay', !!el);
    const focusBtn = el && visiblePrimary(el);
    if (focusBtn) setTimeout(function () { try { focusBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  function currentScreen() {
    return [ui.title, ui.chars, ui.minigames, ui.rps, ui.rain, ui.memory, ui.pause, ui.win].find(function (s) { return !s.hidden; }) || null;
  }

  /** ปุ่มหลักของหน้าที่มองเห็นอยู่ (ข้ามปุ่มในส่วนที่ซ่อน เช่นหน้าซ้อนของ Coin Rain) */
  function visiblePrimary(scr) {
    const list = scr.querySelectorAll('.btn-primary');
    for (let i = 0; i < list.length; i++) if (!list[i].closest('[hidden]')) return list[i];
    return null;
  }

  /** mode = 'normal' | 'timed' ไม่ระบุ = เล่นโหมดเดิมซ้ำ */
  function startGame(mode) {
    Sound.unlock();
    if (state === 'playing' || state === 'cleared') return;
    if (state === 'won' && clock - winShownAt < 0.8) return; // กันกดค้างจากในเกมแล้วข้ามหน้าสรุปผล
    mode = mode || (g && g.mode) || lastMode;
    lastMode = mode;
    CQ.store.set(MODE_KEY, mode);
    newGame(mode);
    state = 'playing';
    g.showMinimap = true;
    setScreen(null);
    toast(stageLabel(g.stage) + (g.mode === 'timed' ? ' · โหมดจับเวลา' : '') + (g.stage.boss ? ' · กด X หรือปุ่มยิง เพื่อยิงพลัง' : ''));
    ui.hud.hidden = false;
    document.body.classList.add('in-game');
    layoutHud();
    Input.reset();
    pendingJump = false;
    acc = 0;
    Sound.startMusic();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    setScreen(ui.pause);
    Sound.stopMusic();
  }

  function resumeGame() {
    if (state !== 'paused') return;
    Sound.unlock();
    state = 'playing';
    setScreen(null);
    Input.reset();
    pendingJump = false;
    lastTime = performance.now();
    Sound.startMusic();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function goTitle() {
    state = 'title';
    Sound.stopMusic();
    newGame(lastMode);
    ui.hud.hidden = true;
    document.body.classList.remove('in-game');
    refreshTitle();
    setScreen(ui.title);
  }

  function showWin() {
    state = 'won';
    winShownAt = clock;
    const mode = g.mode;
    const timed = mode === 'timed';
    const result = timed
      ? { coins: g.collected, left: Math.max(0, g.limit - g.time), deaths: g.deaths }
      : { time: g.time, deaths: g.deaths };
    const deaths = 'พลาด ' + g.deaths + ' ครั้ง';
    if (timed) {
      const all = g.collected >= g.total;
      ui.winHeading.textContent = all ? 'เก็บครบทุกเหรียญ!' : 'หมดเวลา!';
      ui.winSub.textContent = stageLabel(g.stage) + ' · ' + g.char.name + (all ? ' · เหลือเวลา ' + fmtTime(result.left) : '') + ' · ' + deaths;
      ui.winLabel.textContent = 'เหรียญที่เก็บได้';
    } else {
      ui.winHeading.textContent = 'ภารกิจสำเร็จ!';
      ui.winSub.textContent = stageLabel(g.stage) + (g.stage.boss ? ' · ปราบบอส' : '') + ' · เก็บครบทั้ง ' + g.goal + ' เหรียญ · ' + g.char.name + ' · ' + deaths;
      ui.winLabel.textContent = 'เวลา';
    }
    ui.winTime.textContent = fmtRecord(mode, result);
    if (g.seedInfo.custom) {
      // ด่านพิเศษ (?seed=) ไม่บันทึกสถิติ
      ui.winBest.textContent = '-';
      ui.winBestAll.textContent = '-';
      ui.winNew.hidden = true;
    } else {
      const keys = recordKeys(g.stage.id, mode, g.char.id);
      const rec = loadRecords(g.stage.id, mode, g.char.id, g.seedInfo.day);
      const newToday = isBetter(mode, result, rec.today);
      const newAll = isBetter(mode, result, rec.all);
      if (newToday) CQ.store.set(keys.day, JSON.stringify(Object.assign({ day: g.seedInfo.day }, result)));
      if (newAll) CQ.store.set(keys.all, JSON.stringify(Object.assign({ at: Date.now() }, result)));
      ui.winBest.textContent = fmtRecord(mode, newToday ? result : rec.today);
      ui.winBestAll.textContent = fmtRecord(mode, newAll ? result : rec.all);
      ui.winNew.hidden = !newToday;
      ui.winNew.textContent = newAll ? 'สถิติใหม่ตลอดกาล!' : 'สถิติใหม่ของวันนี้!';
    }
    setScreen(ui.win);
  }

  let toastTimer = null;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('show'); }, 1900);
  }

  /** โหมดจับเวลา: เตือนตอนเหลือ 10 วินาที และเสียงนับถอยหลัง 5 วินาทีสุดท้าย */
  function updateCountdown() {
    if (!g.limit || state !== 'playing') return;
    const left = g.limit - g.time;
    if (left <= 10 && !g.warned) {
      g.warned = true;
      toast('เหลือ 10 วินาที!');
    }
    const sec = Math.ceil(left);
    if (sec >= 1 && sec <= 5 && sec !== g.lastTick) {
      g.lastTick = sec;
      Sound.sfx.tick();
    }
  }

  function updateEffects(dt) {
    const parts = g.particles;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    g.shake = Math.max(0, g.shake - dt * 30);
    g.flash = Math.max(0, g.flash - dt * 2.5);
    g.landSquash = Math.max(0, g.landSquash - dt * 1.4);
    for (let i = 0; i < g.checkpoints.length; i++) {
      const cp = g.checkpoints[i];
      if (cp.active && cp.raise < 1) cp.raise = Math.min(1, cp.raise + dt * 2.5);
    }
  }

  function drawMenuPreviews() {
    if (state === 'chars') {
      for (let i = 0; i < charCards.length; i++) {
        const c = charCards[i];
        CQ.drawCharPreview(c.canvas, c.id, clock, c.id === charId);
      }
    } else if (state === 'title') {
      CQ.drawCharPreview(ui.titleCharPreview, charId, clock, false);
    } else if (state === 'rps') {
      CQ.drawCharPreview(CQ.RPS.avatar, charId, clock, false);
    }
  }

  // ── Game loop ────────────────────────────────────────────────
  function frame(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    clock += dt;

    const inp = Input.poll();
    if (state === 'playing') {
      if (inp.jumpPressed) pendingJump = true;
      acc += dt;
      let n = 0;
      while (acc >= P.DT && n < 12 && state === 'playing') {
        step(P.DT, inp);
        g.time += P.DT;
        acc -= P.DT;
        n++;
        if (g.limit && g.time >= g.limit && state === 'playing') timeUp();
      }
      if (n >= 12) acc = 0;
      updateCountdown();
    } else {
      acc = 0;
    }

    if (state === 'chars' || state === 'title') {
      const nav = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (nav !== 0 && nav !== navPrev) {
        if (state === 'chars') navChar(nav);
        else navStage(nav);
      }
      navPrev = nav;
    }

    if (state === 'rain') CQ.Rain.frame(dt, inp);
    else if (state === 'memory') CQ.Memory.frame(dt);

    if (state === 'cleared') {
      g.clearT += dt;
      if (g.clearT > 1.9) showWin();
    }

    let wantTempo = 1;
    if (state === 'playing' && !g.deathAnim && g.player.pw.star > 0) wantTempo = 1.3;
    else if (state === 'playing' && g.limit && g.limit - g.time < 10) wantTempo = 1.15;
    else if (state === 'playing' && g.boss && g.boss.state !== 'sleep' && !g.boss.dead) wantTempo = 1.12;
    if (wantTempo !== tempo) { tempo = wantTempo; Sound.setTempo(tempo); }

    updateEffects(dt);
    if (state !== 'rain') { // Coin Rain วาดบน canvas ของตัวเองเต็มจอ ไม่ต้องวาดฉากเกมหลักด้านหลัง
      const face = g.deathAnim ? g.deathAnim.face : g.player.face;
      renderer.updateCamera(focusPoint(), face, dt, false);
      renderer.render(g, clock);
    }
    drawMenuPreviews();
    requestAnimationFrame(frame);
  }

  // ── ขนาดจอ / HUD / มินิแมพ ─────────────────────────────────────
  function layoutHud() {
    if (!g || ui.hud.hidden) return;
    const vw = window.innerWidth;
    // ขนาดพิกเซลของ HUD ใช้ร่วมกับปุ่ม DOM ผ่านตัวแปร CSS --hud-px
    const P = CQ.HUD.pixelSize(vw, window.innerHeight, renderer.dpr);
    document.documentElement.style.setProperty('--hud-px', (P / renderer.dpr) + 'px');
    const A = ui.hudLeft.getBoundingClientRect();
    const B = ui.hudRight.getBoundingClientRect();
    renderer.layoutHud({ P: P, x: A.left, y: A.top, right: B.left, vw: vw, timed: !!g.limit });
  }

  /** ความสูงที่ปุ่มควบคุมบนมือถือกินจากขอบล่างของ canvas (CSS px) */
  function touchInset(r) {
    let top = r.bottom;
    document.querySelectorAll('#touch .pad').forEach(function (el) {
      const b = el.getBoundingClientRect();
      if (b.height > 0) top = Math.min(top, b.top);
    });
    return Math.max(0, r.bottom - top);
  }

  function resize() {
    const touch = document.body.classList.contains('touch');
    renderer.bottomCrop = touch ? 0 : T * 1.5;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(Math.max(1, r.width), Math.max(1, r.height), dpr, { touch: touch, bottomInset: touch ? touchInset(r) : 0 });
    if (g) {
      renderer.updateCamera(focusPoint(), g.player.face, 0, true);
      layoutHud();
    }
  }

  // ── ปุ่มและอีเวนต์ ─────────────────────────────────────────────
  function bindButton(id, fn) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      Sound.unlock();
      Sound.sfx.click();
      fn();
    });
  }

  function refreshToggles() {
    ui.btnSound.classList.toggle('off', !Sound.sfxOn);
    ui.btnSound.setAttribute('aria-pressed', String(Sound.sfxOn));
    ui.btnMusic.classList.toggle('off', !Sound.musicOn);
    ui.btnMusic.setAttribute('aria-pressed', String(Sound.musicOn));
  }

  const docEl = document.documentElement;
  const canFullscreen = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  function toggleFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
    const res = req.call(docEl, { navigationUI: 'hide' });
    const lock = function () {
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { /* ignore */ });
    };
    if (res && res.then) res.then(lock).catch(function () { /* ignore */ });
    else lock();
  }

  function init() {
    if (window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches)) {
      document.body.classList.add('touch');
    }
    Input.on('firsttouch', function () {
      document.body.classList.add('touch');
      resize();
    });
    Input.bindTouch($('touch'));
    // Space / Enter / ปุ่ม A ของจอย: กดปุ่มที่ focus อยู่ ถ้าไม่มีกดปุ่มหลักของหน้านั้น
    Input.on('confirm', function () {
      if (state !== 'title' && state !== 'chars' && state !== 'minigames' && state !== 'rps' && state !== 'rain' && state !== 'memory' && state !== 'won') return;
      if (state === 'won' && clock - winShownAt < 0.8) return;
      if (state === 'rain' && CQ.Rain.playing) return;
      const scr = currentScreen();
      if (!scr) return;
      const el = document.activeElement;
      const target = el && el.tagName === 'BUTTON' && !el.disabled && scr.contains(el) && !el.closest('[hidden]') ? el : visiblePrimary(scr);
      if (target) target.click();
    });
    Input.on('pause', function () {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
      else if (state === 'chars') closeChars();
      else if (state === 'minigames') closeMinigames();
      else if (state === 'rps') openMinigames();
      else if (state === 'rain' && !CQ.Rain.escape()) openMinigames();
      else if (state === 'memory' && !CQ.Memory.escape()) openMinigames();
    });

    buildCharCards();
    buildStageButtons();

    bindButton('btn-normal', function () { startGame('normal'); });
    bindButton('btn-timed', function () { startGame('timed'); });
    bindButton('btn-char', openChars);
    bindButton('btn-chars-ok', closeChars);
    bindButton('btn-minigames', openMinigames);
    bindButton('btn-mg-back', closeMinigames);
    bindButton('btn-mg-rps', startRps);
    bindButton('btn-rps-exit', openMinigames);
    CQ.RPS.init({ onExit: openMinigames });
    bindButton('btn-mg-rain', startRain);
    CQ.Rain.init({ onExit: openMinigames });
    bindButton('btn-mg-memory', startMemory);
    bindButton('btn-mem-exit', openMinigames);
    CQ.Memory.init({ onExit: openMinigames });
    bindButton('btn-again', function () { startGame(); });
    bindButton('btn-win-home', goTitle);
    bindButton('btn-resume', resumeGame);
    bindButton('btn-restart', function () { startGame(); });
    bindButton('btn-home', goTitle);
    bindButton('btn-pause', function () { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); });
    bindButton('btn-sound', function () { Sound.setSfx(!Sound.sfxOn); refreshToggles(); });
    bindButton('btn-music', function () { Sound.setMusic(!Sound.musicOn); refreshToggles(); });
    if (canFullscreen) bindButton('btn-fullscreen', toggleFullscreen);
    else ui.btnFullscreen.hidden = true;
    refreshToggles();

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) return;
      pauseGame();
      if (state === 'rain') CQ.Rain.pause();
    });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { e.preventDefault(); });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    document.addEventListener('fullscreenchange', function () { setTimeout(resize, 50); });

    newGame(lastMode);
    resize();
    refreshTitle();
    setScreen(ui.title);
    document.body.classList.add('ready');
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  // ใช้สำหรับทดสอบอัตโนมัติ/ดีบัก
  CQ.debug = {
    get game() { return g; },
    get state() { return state; },
    get charId() { return charId; },
    get stageId() { return stageId; },
    renderer: renderer
  };

  init();
})();
