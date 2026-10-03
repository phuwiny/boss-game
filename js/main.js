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
  const CHAR_KEY = 'coinquest.char';  // ตัวละครที่เลือกไว้
  const MODE_KEY = 'coinquest.mode';  // โหมดที่เล่นล่าสุด
  const POWERS = ['wing', 'mush', 'star'];
  const ITEM_INFO = {
    wing: { name: 'ปีก', toast: 'ได้ปีก! กระโดด 2 ชั้นได้ 10 วินาที', colors: ['#ffffff', '#bfe6ff', '#7fc4f5'] },
    mush: { name: 'เห็ด', toast: 'ได้เห็ด! วิ่งเร็วขึ้น 10 วินาที', colors: ['#ff5a7a', '#ffffff', '#ffc2cd'] },
    star: { name: 'ดาว', toast: 'ได้ดาว! อมตะ 10 วินาที ชนศัตรูได้เลย', colors: ['#ffd23f', '#fff3a0', '#ff9df5'] }
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
    titleDay: $('title-day'),
    titleCharPreview: $('title-char-preview'),
    titleCharName: $('title-char-name'),
    titleCharTag: $('title-char-tag'),
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
  let state = 'title'; // title | chars | playing | paused | cleared | won
  let pendingJump = false;
  let lastTime = performance.now();
  let acc = 0;
  let clock = 0;
  let winShownAt = 0;
  let spawnPool = null;
  let tempo = 1;
  let charId = CQ.getCharacter(CQ.store.get(CHAR_KEY)).id;
  let lastMode = CQ.store.get(MODE_KEY) === 'timed' ? 'timed' : 'normal';
  let charCards = [];
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

  function getPool() {
    if (!spawnPool) spawnPool = Spawn.buildPool(CQ.parseLevel(CQ.LEVEL_SECTIONS, { staticPlatforms: true }));
    return spawnPool;
  }

  // ── สร้างเกมใหม่ ──────────────────────────────────────────────
  function newGame(mode) {
    const timed = mode === 'timed';
    const ch = CQ.getCharacter(charId);
    const lv = CQ.parseLevel(CQ.LEVEL_SECTIONS);
    if (lv.errors.length) console.warn('Level errors:', lv.errors);
    const springs = [];
    for (let i = 0; i < lv.tiles.length; i++) {
      if (lv.tiles[i] === TILE.SPRING) springs.push({ tx: i % lv.w, ty: Math.floor(i / lv.w), hit: -10 });
    }
    const seedInfo = currentSeed();
    const rng = Spawn.makeRng(Spawn.modeSeed(seedInfo.seed, timed ? 'timed' : 'normal'));
    const picked = Spawn.pick(getPool(), lv.w, rng, { coins: timed ? Spawn.TIMED_COINS : Spawn.COINS });
    const center = function (o) { return { tx: o.tx, ty: o.ty, x: o.tx * T + T / 2, y: o.ty * T + T / 2 }; };
    const coins = lv.coins.map(center).concat(picked.coins.map(center));
    g = {
      lv: lv,
      mode: timed ? 'timed' : 'normal',
      char: ch,
      seedInfo: seedInfo,
      player: W.makePlayer(lv.start.tx, lv.start.ty, ch),
      coins: coins.map(function (c, i) { c.taken = false; c.phase = i * 0.83; return c; }),
      items: picked.items.map(function (it, i) { const o = center(it); o.type = it.type; o.taken = false; o.phase = i * 1.7; return o; }),
      enemies: lv.enemies.map(function (e) { return W.makeSlime(e.tx, e.ty); }),
      checkpoints: lv.checkpoints.map(function (c) { return { tx: c.tx, ty: c.ty, active: false, raise: 0 }; }),
      springs: springs,
      particles: [],
      respawn: { tx: lv.start.tx, ty: lv.start.ty },
      collected: 0,
      total: coins.length,
      goal: timed ? coins.length : Math.min(Spawn.GOAL, coins.length),
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
      showMinimap: false
    };
    renderer.setLevel(lv);
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
      W.stepSlime(e, lv, dt);
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
      if (!c.taken && W.overlap(p.x, p.y, p.w, p.h, c.x - R, c.y - R, R * 2, R * 2)) {
        collectCoin(c);
        if (state !== 'playing') return;
      }
    }

    const IR = P.COIN_R + 1;
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      if (!it.taken && W.overlap(p.x, p.y, p.w, p.h, it.x - IR, it.y - IR, IR * 2, IR * 2)) collectItem(it, p);
    }

    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (e.dead) continue;
      if (!W.overlap(p.x + 2, p.y + 3, p.w - 4, p.h - 3, e.x + 2, e.y + 4, e.w - 4, e.h - 4)) continue;
      if (p.pw.star > 0) knockOut(e, p);
      else if (p.vy > 0 && p.prevBottom <= e.y + e.h * 0.6) stomp(e, p, inp);
      else if (p.invuln <= 0) { kill(); return; }
    }

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
        for (let i = 0; i < 6; i++) {
          spawn({ kind: 'feather', x: p.x + p.w / 2 + (Math.random() - 0.5) * 20, y: p.y + p.h - 4, vx: (Math.random() - 0.5) * 70, vy: 20 + Math.random() * 40, g: 30, size: 5 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, color: '#ffffff', life: 0.7 + Math.random() * 0.3 });
        }
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
    p.pw[it.type] = P.POWER_TIME;
    if (it.type === 'wing') p.airJumps = 1;
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
    e.dead = true;
    e.deadT = 0;
    p.vy = inp.jump ? -P.JUMP_V * p.st.jump * 0.9 : -P.STOMP_V;
    p.jumping = !!inp.jump;
    p.onGround = false;
    p.ride = null;
    p.airJumps = p.pw.wing > 0 ? 1 : 0;
    g.shake = Math.max(g.shake, 3);
    Sound.sfx.stomp();
    burst(e.x + e.w / 2, e.y + e.h / 2, 8, ['#58d26d', '#a8f0b4'], 140, 'circle');
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
    Sound.sfx.die();
    burst(p.x + p.w / 2, p.y + p.h / 2, 10, ['#ff6a3d', '#ffd3ad', '#ffffff'], 160, 'circle');
  }

  function respawn() {
    const r = g.respawn;
    g.player = W.makePlayer(r.tx, r.ty, g.char);
    g.player.invuln = 1.5;
    g.deathAnim = null;
    pendingJump = false;
  }

  function clearGame() {
    state = 'cleared';
    g.clearT = 0;
    Sound.stopMusic();
    Sound.sfx.win();
    confetti(140);
    toast(g.mode === 'timed' ? 'เก็บครบทุกเหรียญแล้ว!' : 'เก็บครบ ' + g.goal + ' เหรียญแล้ว!');
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

  // ── บันทึกสถิติ (แยกตามโหมดและตัวละคร: ตลอดกาล + ของด่านวันนี้) ─────
  /** Bobo โหมดปกติใช้ key เดิม เพื่อเก็บสถิติที่ทำไว้ก่อนมีหลายตัวละคร */
  function recordKeys(mode, id) {
    if (mode === 'timed') return { all: 'coinquest.timed.best.v1.' + id, day: 'coinquest.timed.daily.v1.' + id };
    const sfx = id === 'bobo' ? '' : '.' + id;
    return { all: 'coinquest.best.v2' + sfx, day: 'coinquest.daily.v2' + sfx };
  }

  function readRecord(key, mode) {
    try {
      const v = JSON.parse(CQ.store.get(key));
      const field = mode === 'timed' ? 'coins' : 'time';
      return v && typeof v[field] === 'number' ? v : null;
    } catch (e) { return null; }
  }

  function loadRecords(mode, id, day) {
    const keys = recordKeys(mode, id);
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

  function bestLine(mode, id, info) {
    const rec = loadRecords(mode, id, info.day);
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
    [['normal', ui.bestNormal, ui.btnNormal], ['timed', ui.bestTimed, ui.btnTimed]].forEach(function (m) {
      const line = bestLine(m[0], charId, info);
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
        '<span class="char-best"></span>' +
        '</span>';
      btn.querySelector('.char-name').textContent = ch.name;
      btn.querySelector('.char-tag').textContent = ch.tagline;
      btn.querySelector('.char-desc').textContent = ch.desc;
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
      const n = loadRecords('normal', c.id, info.day).all;
      const t = loadRecords('timed', c.id, info.day).all;
      if (n) parts.push('ปกติ ' + fmtRecord('normal', n));
      if (t) parts.push('จับเวลา ' + fmtRecord('timed', t));
      c.best.textContent = parts.length ? 'ดีที่สุด: ' + parts.join(' · ') : 'ยังไม่มีสถิติ';
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

  // ── หน้าจอและสถานะ ─────────────────────────────────────────────
  function setScreen(el) {
    [ui.title, ui.chars, ui.pause, ui.win].forEach(function (s) { s.hidden = s !== el; });
    document.body.classList.toggle('overlay', !!el);
    const focusBtn = el && el.querySelector('.btn-primary');
    if (focusBtn) setTimeout(function () { try { focusBtn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  function currentScreen() {
    return [ui.title, ui.chars, ui.pause, ui.win].find(function (s) { return !s.hidden; }) || null;
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
      ui.winSub.textContent = g.char.name + (all ? ' · เหลือเวลา ' + fmtTime(result.left) : '') + ' · ' + deaths;
      ui.winLabel.textContent = 'เหรียญที่เก็บได้';
    } else {
      ui.winHeading.textContent = 'ภารกิจสำเร็จ!';
      ui.winSub.textContent = 'เก็บครบ ' + g.goal + ' เหรียญ · ' + g.char.name + ' · ' + deaths;
      ui.winLabel.textContent = 'เวลา';
    }
    ui.winTime.textContent = fmtRecord(mode, result);
    if (g.seedInfo.custom) {
      // ด่านพิเศษ (?seed=) ไม่บันทึกสถิติ
      ui.winBest.textContent = '-';
      ui.winBestAll.textContent = '-';
      ui.winNew.hidden = true;
    } else {
      const keys = recordKeys(mode, g.char.id);
      const rec = loadRecords(mode, g.char.id, g.seedInfo.day);
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

    if (state === 'chars') {
      const nav = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (nav !== 0 && nav !== navPrev) navChar(nav);
      navPrev = nav;
    }

    if (state === 'cleared') {
      g.clearT += dt;
      if (g.clearT > 1.9) showWin();
    }

    let wantTempo = 1;
    if (state === 'playing' && !g.deathAnim && g.player.pw.star > 0) wantTempo = 1.3;
    else if (state === 'playing' && g.limit && g.limit - g.time < 10) wantTempo = 1.15;
    if (wantTempo !== tempo) { tempo = wantTempo; Sound.setTempo(tempo); }

    updateEffects(dt);
    const face = g.deathAnim ? g.deathAnim.face : g.player.face;
    renderer.updateCamera(focusPoint(), face, dt, false);
    renderer.render(g, clock);
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

  function resize() {
    renderer.bottomCrop = document.body.classList.contains('touch') ? 0 : T * 1.5;
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(Math.max(1, r.width), Math.max(1, r.height), dpr);
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
      if (state !== 'title' && state !== 'chars' && state !== 'won') return;
      if (state === 'won' && clock - winShownAt < 0.8) return;
      const scr = currentScreen();
      if (!scr) return;
      const el = document.activeElement;
      const target = el && el.tagName === 'BUTTON' && !el.disabled && scr.contains(el) ? el : scr.querySelector('.btn-primary');
      if (target) target.click();
    });
    Input.on('pause', function () {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
      else if (state === 'chars') closeChars();
    });

    ui.descNormal.textContent = 'เก็บให้ครบ ' + Spawn.GOAL + ' จาก ' + Spawn.COINS + ' เหรียญ';
    ui.descTimed.textContent = 'เก็บให้มากที่สุดใน ' + Spawn.TIMED_TIME + ' วินาที';
    ui.btnTimed.title = 'มีเหรียญ ' + Spawn.TIMED_COINS + ' เหรียญในฉาก มากกว่าโหมดปกติ';
    buildCharCards();

    bindButton('btn-normal', function () { startGame('normal'); });
    bindButton('btn-timed', function () { startGame('timed'); });
    bindButton('btn-char', openChars);
    bindButton('btn-chars-ok', closeChars);
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

    document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(); });
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
    renderer: renderer
  };

  init();
})();
