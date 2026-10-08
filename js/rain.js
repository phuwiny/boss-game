/*
 * Coin Quest — มินิเกม "Coin Rain" หน้าจอ การวาด และการควบคุม
 * กติกาอยู่ใน js/rain-rules.js ส่วนการสลับหน้าจออยู่ใน js/main.js (เรียก CQ.Rain.frame ทุกเฟรม)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ;
  const R = CQ.RainRules;
  const Sound = CQ.Audio;
  const BEST_KEY = 'coinquest.rain.best.'; // + id ตัวละคร
  const DT = 1 / 120;
  const TAU = Math.PI * 2;
  const HEART_SVG = '<svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">' +
    '<rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="2" height="1"/>' +
    '<rect x="0" y="1" width="7" height="2"/><rect x="1" y="3" width="5" height="1"/>' +
    '<rect x="2" y="4" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/></svg>';

  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    screen: $('screen-rain'),
    canvas: $('rain-canvas'),
    hud: $('rain-hud'),
    pauseBtn: $('btn-rain-pause'),
    score: $('rain-score'),
    mult: $('rain-mult'),
    hearts: $('rain-hearts'),
    ready: $('rain-ready'),
    pause: $('rain-pause'),
    over: $('rain-over'),
    perk: $('rain-perk'),
    readyBest: $('rain-ready-best'),
    overScore: $('rain-over-score'),
    overStats: $('rain-over-stats'),
    overBest: $('rain-over-best'),
    overNew: $('rain-over-new')
  };
  const ctx = ui.canvas.getContext('2d');

  let opts = {};
  let charId = 'bobo';
  let s = null;          // สถานะจาก RainRules
  let mode = null;       // ready | play | pause | over
  let acc = 0;
  let clock = 0;
  let runDist = 0;       // ระยะที่เดิน ใช้เลือกท่าวิ่ง
  let shake = 0;
  let pointer = null;    // { id, x } ตำแหน่งนิ้ว/เมาส์ (หน่วยสนาม)
  let hudKey = '';
  let parts = [];        // อนุภาค
  let pops = [];         // ตัวเลขลอย
  const view = { W: 1, H: 1, dpr: 1, scale: 1, ox: 0, oy: 0 };
  const clouds = [0, 1, 2, 3, 4].map(function (i) { return { x: i * 0.23 + 0.05, y: 0.08 + (i % 3) * 0.09, s: 0.7 + (i % 2) * 0.5, v: 0.006 + i * 0.002 }; });

  function loadBest(id) {
    try { return JSON.parse(CQ.store.get(BEST_KEY + id)) || null; } catch (e) { return null; }
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60), sec = Math.floor(t % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // ── ขนาดจอ ────────────────────────────────────────────────────────
  function layout() {
    const cw = ui.canvas.clientWidth, ch = ui.canvas.clientHeight;
    if (!cw || !ch) return false;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
    if (ui.canvas.width !== W || ui.canvas.height !== H) { ui.canvas.width = W; ui.canvas.height = H; }
    view.W = W; view.H = H; view.dpr = dpr;
    const fw = s ? s.w : R.fieldWidth(cw / ch);
    view.scale = Math.min(W / fw, H / R.FIELD_H);
    view.ox = Math.round((W - fw * view.scale) / 2);
    view.oy = Math.round(H - R.FIELD_H * view.scale); // ชิดล่าง ฟ้าส่วนเกินอยู่ด้านบน
    return true;
  }

  function newField() {
    const cw = ui.canvas.clientWidth || 1, ch = ui.canvas.clientHeight || 1;
    s = R.newGame({ w: R.fieldWidth(cw / ch), charId: charId });
    acc = 0;
    parts = [];
    pops = [];
    shake = 0;
    hudKey = '';
    layout();
  }

  // ── หน้าจอซ้อน ───────────────────────────────────────────────────
  function showOverlay(el) {
    [ui.ready, ui.pause, ui.over].forEach(function (o) { o.hidden = o !== el; });
    ui.hud.hidden = mode === 'ready';
    ui.pauseBtn.classList.toggle('off', mode !== 'play'); // ซ่อนแบบคงที่ว่าง คะแนนจึงไม่ขยับ
    const btn = el && el.querySelector('.btn-primary');
    if (btn) setTimeout(function () { try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  function showReady() {
    mode = 'ready';
    newField();
    const ch = CQ.getCharacter(charId);
    ui.perk.textContent = ch.name + ': ' + s.perks.desc;
    const best = loadBest(charId);
    ui.readyBest.hidden = !best;
    if (best) ui.readyBest.textContent = 'สถิติของ ' + ch.name + ': ' + best.score + ' แต้ม';
    showOverlay(ui.ready);
  }

  function begin() {
    Sound.unlock();
    newField();
    mode = 'play';
    pointer = null;
    showOverlay(null);
    Sound.startMusic();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'pause';
    pointer = null;
    Sound.stopMusic();
    showOverlay(ui.pause);
  }

  function resume() {
    if (mode !== 'pause') return;
    Sound.unlock();
    mode = 'play';
    acc = 0;
    showOverlay(null);
    Sound.startMusic();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function gameOver() {
    mode = 'over';
    pointer = null;
    Sound.stopMusic();
    const ch = CQ.getCharacter(charId);
    const prev = loadBest(charId);
    const isNew = s.score > 0 && (!prev || s.score > prev.score);
    if (isNew) CQ.store.set(BEST_KEY + charId, JSON.stringify({ score: s.score, combo: s.maxCombo, time: Math.round(s.t), at: Date.now() }));
    const best = isNew ? { score: s.score } : prev;
    ui.overScore.textContent = s.score;
    ui.overStats.textContent = ch.name + ' · เก็บได้ ' + s.caught + ' ชิ้น · คอมโบสูงสุด ' + s.maxCombo + ' · เวลา ' + fmtTime(s.t);
    ui.overBest.textContent = best ? best.score + ' แต้ม' : '-';
    ui.overNew.hidden = !isNew;
    setTimeout(function () {
      if (mode !== 'over') return;
      if (isNew) Sound.sfx.win();
      showOverlay(ui.over);
    }, 900);
  }

  // ── เหตุการณ์จากกติกา → เสียง/อนุภาค ───────────────────────────
  function burst(x, y, n, colors, speed, life, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.6);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g: grav, t: 0, life: life * (0.6 + Math.random() * 0.4), c: colors[i % colors.length], sz: 3 + Math.random() * 3 });
    }
  }

  function pop(x, y, text, color) {
    pops.push({ x: x, y: y, text: text, color: color, t: 0 });
  }

  function handle(ev) {
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      switch (e.type) {
        case 'coin':
          Sound.sfx.coin();
          burst(e.x, e.y, 6, ['#fff3a0', '#ffd23f', '#ffffff'], 150, 0.45, 300);
          pop(e.x, e.y - 18, '+' + e.pts, '#ffd23f');
          break;
        case 'gem':
          Sound.sfx.powerup();
          burst(e.x, e.y, 12, ['#b9f3ff', '#5fd4ff', '#d6a8ff', '#ffffff'], 220, 0.6, 300);
          pop(e.x, e.y - 18, '+' + e.pts, '#7fe6ff');
          break;
        case 'bonus':
          Sound.sfx.coin();
          pop(e.x, e.y - 18, '+' + e.pts, '#ff9db0');
          break;
        case 'heart':
          Sound.sfx.heart();
          burst(e.x, e.y, 10, ['#ff4d6a', '#ffc2cd', '#ffffff'], 160, 0.6, 200);
          pop(e.x, e.y - 18, '+1 ♥', '#ff6b85');
          break;
        case 'combo':
          Sound.sfx.checkpoint();
          pop(s.player.x, s.groundY - 90, 'x' + e.mult + '!', '#ff8a3d');
          break;
        case 'miss':
          if (e.combo >= 5) pop(e.x, e.y - 20, 'คอมโบขาด', '#ffffff');
          break;
        case 'smash':
          Sound.sfx.rockCrack();
          burst(e.x, e.y - 6, 7, ['#8d8496', '#5f566b', '#b9b1c4'], 160, 0.5, 700);
          break;
        case 'guard':
          Sound.sfx.guard();
          burst(e.x, e.y, 10, ['#ffffff', '#bfe6ff', '#ff8fc0'], 220, 0.5, 400);
          pop(s.player.x, s.groundY - 80, 'กันได้!', '#bfe6ff');
          break;
        case 'hit':
          Sound.sfx.hurt();
          burst(e.x, e.y, 10, ['#8d8496', '#5f566b', '#b9b1c4'], 220, 0.6, 700);
          shake = 1;
          break;
        case 'over':
          Sound.sfx.die();
          shake = 1.4;
          gameOver();
          break;
      }
    }
  }

  // ── อัปเดตทุกเฟรม (เรียกจาก main.js) ─────────────────────────────
  function frame(dt, inp) {
    if (!mode) return;
    clock += dt;
    if (!layout()) return;
    if (mode === 'play') {
      const move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      const ctrl = pointer ? { target: pointer.x } : { move: move };
      acc += dt;
      let n = 0;
      while (acc >= DT && n < 24 && mode === 'play') {
        const x0 = s.player.x;
        handle(R.step(s, DT, ctrl));
        runDist += Math.abs(s.player.x - x0);
        acc -= DT;
        n++;
      }
      if (n >= 24) acc = 0;
    } else if (mode === 'over') {
      // ของที่ยังตกอยู่ค่อย ๆ จางหาย
      for (let i = 0; i < s.objs.length; i++) s.objs[i].y += s.objs[i].vy * dt * 0.25;
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (mode !== 'pause') p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      if (mode === 'pause') continue;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      if (mode !== 'pause') pops[i].t += dt;
      if (pops[i].t > 0.9) pops.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 3);
    updateHud();
    draw();
  }

  function updateHud() {
    const mult = R.multiplier(s.combo);
    const key = s.score + '|' + mult + '|' + s.combo + '|' + s.hp + '|' + s.player.guard;
    if (key === hudKey) return;
    hudKey = key;
    ui.score.textContent = s.score;
    ui.mult.textContent = mult > 1 ? 'x' + mult : (s.combo > 0 ? 'คอมโบ ' + s.combo : '');
    ui.mult.classList.toggle('hot', mult > 1);
    let h = '';
    for (let i = 0; i < s.maxHp; i++) h += '<span class="rain-heart' + (i < s.hp ? '' : ' empty') + '">' + HEART_SVG + '</span>';
    if (s.perks.guard) h += '<span class="rain-guard' + (s.player.guard > 0 ? '' : ' used') + '" title="โล่">🛡️</span>';
    ui.hearts.innerHTML = h;
    ui.hearts.setAttribute('aria-label', 'หัวใจ ' + s.hp + ' จาก ' + s.maxHp);
  }

  // ── การวาด ───────────────────────────────────────────────────────
  function ellipse(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  }

  function drawBackground() {
    const W = view.W, H = view.H, k = view.scale;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#3d6fd1');
    sky.addColorStop(0.55, '#7fb6f0');
    sky.addColorStop(1, '#ffd9a0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // เมฆ
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const x = (((c.x + clock * c.v) % 1.3) - 0.15) * W, y = c.y * H, r = 22 * c.s * k;
      ellipse(x, y, r * 1.6, r * 0.7); ctx.fill();
      ellipse(x - r * 0.8, y + r * 0.15, r, r * 0.55); ctx.fill();
      ellipse(x + r * 0.9, y + r * 0.1, r * 1.1, r * 0.6); ctx.fill();
    }
    // พื้น: หญ้าและดิน เต็มความกว้างจอ
    const gy = view.oy + s.groundY * k;
    ctx.fillStyle = '#8d5b34';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = '#5cc451';
    ctx.fillRect(0, gy, W, Math.max(2, 12 * k));
    ctx.fillStyle = '#3f9a3a';
    ctx.fillRect(0, gy + 12 * k, W, Math.max(1, 3 * k));
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    const step = 26 * k;
    for (let x = (view.ox % step) - step; x < W; x += step) ctx.fillRect(x, gy + 24 * k, 10 * k, 5 * k);
    // ขอบสนาม (เมื่อจอกว้างกว่าสนาม)
    if (view.ox > 2) {
      ctx.fillStyle = 'rgba(16,28,52,0.28)';
      ctx.fillRect(0, 0, view.ox, gy);
      ctx.fillRect(view.ox + s.w * k, 0, W - view.ox - s.w * k, gy);
    }
  }

  function drawCoin(o) {
    const spin = Math.cos(clock * 6 + o.rot);
    ctx.fillStyle = 'rgba(255,214,70,0.25)';
    ellipse(0, 0, o.r * 1.4, o.r * 1.4); ctx.fill();
    ctx.save();
    ctx.scale(Math.max(0.15, Math.abs(spin)), 1);
    ctx.fillStyle = spin > 0 ? '#ffd23f' : '#f2b51c';
    ellipse(0, 0, o.r, o.r); ctx.fill();
    ctx.strokeStyle = '#d48a00'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,170,0.95)'; ctx.lineWidth = 1.8;
    ellipse(0, 0, o.r * 0.58, o.r * 0.58); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ellipse(-o.r * 0.34, -o.r * 0.38, o.r * 0.18, o.r * 0.27); ctx.fill();
    ctx.restore();
  }

  function drawGem(o) {
    const r = o.r;
    ctx.fillStyle = 'rgba(150,230,255,' + (0.25 + 0.15 * Math.sin(clock * 8)) + ')';
    ellipse(0, 0, r * 1.6, r * 1.6); ctx.fill();
    ctx.rotate(Math.sin(o.rot) * 0.25);
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.35); ctx.lineTo(-r * 0.5, -r); ctx.lineTo(r * 0.5, -r); ctx.lineTo(r, -r * 0.35); ctx.lineTo(0, r * 1.1);
    ctx.closePath();
    ctx.fillStyle = '#5fd4ff'; ctx.fill();
    ctx.strokeStyle = '#1f6fb8'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.35); ctx.lineTo(r, -r * 0.35);
    ctx.moveTo(-r * 0.5, -r); ctx.lineTo(-r * 0.25, -r * 0.35); ctx.lineTo(0, r * 1.1);
    ctx.moveTo(r * 0.5, -r); ctx.lineTo(r * 0.25, -r * 0.35); ctx.lineTo(0, r * 1.1);
    ctx.strokeStyle = 'rgba(31,111,184,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#e6fbff';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r); ctx.lineTo(-r * 0.25, -r * 0.35); ctx.lineTo(-r, -r * 0.35); ctx.closePath(); ctx.fill();
  }

  function drawHeart(o) {
    const u = o.r / 3.6, b = 1 + 0.08 * Math.sin(clock * 9);
    ctx.scale(b, b);
    ctx.fillStyle = 'rgba(255,90,120,0.25)';
    ellipse(0, 0, o.r * 1.5, o.r * 1.5); ctx.fill();
    // หัวใจแบบพิกเซล 7x6
    const rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 7; c++) {
        if (rows[r][c] !== '#') continue;
        ctx.fillStyle = (r === 1 && c === 1) || (r === 0 && c === 1) ? '#ffc2cd' : (r >= 3 ? '#d42a4a' : '#ff4d6a');
        ctx.fillRect((c - 3.5) * u, (r - 3) * u, u + 0.4, u + 0.4);
      }
    }
  }

  function drawRock(o) {
    const r = o.r;
    ctx.rotate(o.rot);
    ctx.beginPath();
    const pts = [1, 0.82, 0.95, 0.78, 1, 0.86, 0.92, 0.8];
    for (let i = 0; i < pts.length; i++) {
      const a = (i / pts.length) * TAU;
      ctx.lineTo(Math.cos(a) * r * pts[i], Math.sin(a) * r * pts[i]);
    }
    ctx.closePath();
    ctx.fillStyle = '#7d738d'; ctx.fill();
    ctx.strokeStyle = '#2a2233'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.fillStyle = '#a79fb5';
    ellipse(-r * 0.3, -r * 0.3, r * 0.35, r * 0.22); ctx.fill();
    ctx.strokeStyle = 'rgba(42,34,51,0.6)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.1); ctx.lineTo(r * 0.45, r * 0.3); ctx.lineTo(r * 0.3, r * 0.6); ctx.stroke();
  }

  function drawObjects() {
    const k = view.scale;
    // เงาเตือนบนพื้นตรงที่หินจะตก
    for (let i = 0; i < s.objs.length; i++) {
      const o = s.objs[i];
      if (o.kind !== 'rock' || o.y < 0) continue;
      const near = Math.min(1, o.y / s.groundY);
      ctx.fillStyle = 'rgba(40,20,30,' + (0.12 + near * 0.3) + ')';
      ellipse(view.ox + o.x * k, view.oy + (s.groundY + 2) * k, o.r * (0.5 + near * 0.6) * k, 4 * k); ctx.fill();
    }
    for (let i = 0; i < s.objs.length; i++) {
      const o = s.objs[i];
      ctx.save();
      ctx.translate(view.ox + o.x * k, view.oy + o.y * k);
      ctx.scale(k, k);
      if (o.kind === 'coin') drawCoin(o);
      else if (o.kind === 'gem') drawGem(o);
      else if (o.kind === 'heart') drawHeart(o);
      else drawRock(o);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = s.player, k = view.scale;
    if (p.inv > 0 && mode === 'play' && Math.floor(clock * 14) % 2 === 0) return;
    let pose;
    if (s.over) pose = 'dead';
    else if (Math.abs(p.vx) > 40) pose = 'run' + (1 + Math.floor(runDist / 14) % 4);
    else pose = (clock % 3.3) < 0.12 ? 'blink' : 'idle';
    const fr = CQ.heroFrame(charId, pose);
    const px = Math.max(1, Math.round(k * 1.15)); // 1 art px = จำนวนเต็มพิกเซลจอ ภาพจึงคม
    const sx = Math.round(view.ox + p.x * k), base = Math.round(view.oy + s.groundY * k);
    ctx.fillStyle = 'rgba(16,28,52,0.22)';
    ellipse(sx, base, 15 * px, 3 * px); ctx.fill();
    if (p.guard > 0) {
      ctx.strokeStyle = 'rgba(191,230,255,' + (0.55 + 0.25 * Math.sin(clock * 6)) + ')';
      ctx.lineWidth = 2 * px;
      ellipse(sx, base - 21 * px, 22 * px, 26 * px); ctx.stroke();
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(sx, 0);
    ctx.scale(p.face || 1, 1);
    ctx.drawImage(fr.c, -fr.ax * px, base - (fr.h - 1) * px, fr.w * px, fr.h * px);
    ctx.restore();
  }

  function drawEffects() {
    const k = view.scale;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.c;
      const z = p.sz * k;
      ctx.fillRect(view.ox + p.x * k - z / 2, view.oy + p.y * k - z / 2, z, z);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let i = 0; i < pops.length; i++) {
      const p = pops[i];
      const a = Math.min(1, (0.9 - p.t) / 0.3);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '800 ' + Math.round(20 * k) + 'px Kanit, sans-serif';
      const x = view.ox + p.x * k, y = view.oy + (p.y - p.t * 50) * k;
      ctx.lineWidth = 4 * k;
      ctx.strokeStyle = 'rgba(29,36,51,0.85)';
      ctx.strokeText(p.text, x, y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake * view.dpr, (Math.random() - 0.5) * 8 * shake * view.dpr);
    drawBackground();
    drawObjects();
    drawPlayer();
    drawEffects();
    if (mode === 'pause' || mode === 'over') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(16,28,52,0.35)';
      ctx.fillRect(0, 0, view.W, view.H);
    }
  }

  // ── การควบคุมด้วยนิ้ว/เมาส์: ตัวละครเดินตามตำแหน่งนิ้วในแนวนอน ──
  function fieldX(e) {
    const r = ui.canvas.getBoundingClientRect();
    return ((e.clientX - r.left) * view.dpr - view.ox) / view.scale;
  }

  ui.canvas.addEventListener('pointerdown', function (e) {
    if (mode !== 'play') return;
    e.preventDefault();
    try { ui.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    pointer = { id: e.pointerId, x: fieldX(e) };
  });
  ui.canvas.addEventListener('pointermove', function (e) {
    if (mode !== 'play') return;
    if (pointer && pointer.id === e.pointerId) pointer.x = fieldX(e);
  });
  const release = function (e) { if (pointer && pointer.id === e.pointerId) pointer = null; };
  ui.canvas.addEventListener('pointerup', release);
  ui.canvas.addEventListener('pointercancel', release);
  ui.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function bind(id, fn) {
    $(id).addEventListener('click', function (e) {
      e.preventDefault();
      Sound.unlock();
      Sound.sfx.click();
      fn();
    });
  }
  bind('btn-rain-start', begin);
  bind('btn-rain-pause', pause);
  bind('btn-rain-resume', resume);
  bind('btn-rain-restart', begin);
  bind('btn-rain-again', begin);
  ['btn-rain-back', 'btn-rain-quit', 'btn-rain-home'].forEach(function (id) {
    bind(id, function () { if (opts.onExit) opts.onExit(); });
  });

  // ── API ──────────────────────────────────────────────────────────
  CQ.Rain = {
    init: function (o) { opts.onExit = o.onExit; },
    /** เปิดหน้ามินิเกม (หน้าเริ่ม) ด้วยตัวละครที่เลือกไว้ */
    start: function (id) {
      charId = CQ.getCharacter(id).id;
      showReady();
    },
    stop: function () {
      if (mode === 'play') Sound.stopMusic();
      mode = null;
      s = null;
      pointer = null;
    },
    pause: pause,
    /** Esc: กำลังเล่น = หยุดชั่วคราว, หยุดอยู่ = เล่นต่อ คืน false เมื่อให้ main.js ออกจากมินิเกม */
    escape: function () {
      if (mode === 'play') { pause(); return true; }
      if (mode === 'pause') { resume(); return true; }
      return false;
    },
    frame: frame,
    get playing() { return mode === 'play'; },
    get game() { return s; } // ใช้สำหรับทดสอบอัตโนมัติ/ดีบัก
  };
})(window);
