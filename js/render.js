/*
 * Coin Quest — การวาดภาพ (Canvas 2D, วาดด้วยโค้ดทั้งหมด ไม่ใช้ไฟล์ภาพ)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ;
  const T = CQ.PHYS.T;
  const TILE = CQ.TILE;

  // พื้นที่โลกเกม (หน่วย logical px) ที่ต้องเห็นอย่างน้อยไม่ว่าจอขนาดใด
  const MIN_VIEW_W = 420;
  const MIN_VIEW_H = 380;
  const GROUND_ROW = 14;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function hash(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.S = 1;
    this.scale = 1;
    this.dpr = 1;
    this.viewW = MIN_VIEW_W;
    this.viewH = MIN_VIEW_H;
    this.cam = { x: 0, y: 0 };
    this.look = 0;
    this.sprites = {};
    this.level = null;
    this.decor = [];
    this.pits = [];
    this.minimap = null;
    this.minimapRect = null;
    this.bottomCrop = 0; // ซ่อนดินด้านล่างบางส่วน (ใช้บนจอที่ไม่มีปุ่มสัมผัส)
    const r = rng(42);
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      this.clouds.push({ x: r() * 2400, y: 30 + r() * 140, s: 0.6 + r() * 0.8, v: 4 + r() * 8 });
    }
  }

  Renderer.prototype.resize = function (cssW, cssH, dpr) {
    this.dpr = dpr;
    this.scale = Math.min(cssW / MIN_VIEW_W, cssH / MIN_VIEW_H);
    this.S = this.scale * dpr;
    this.viewW = cssW / this.scale;
    this.viewH = cssH / this.scale;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.sprites = {};
    this.layers = null;
  };

  // ── สไปรต์ (แคชไว้ตามความละเอียดจอ) ───────────────────────────
  Renderer.prototype.sprite = function (key, w, h, draw) {
    let s = this.sprites[key];
    if (!s) {
      s = makeCanvas(w * this.S, h * this.S);
      const c = s.getContext('2d');
      c.scale(s.width / w, s.height / h);
      draw(c);
      this.sprites[key] = s;
    }
    return s;
  };

  function drawGround(c, mask, variant) {
    const top = mask & 1, left = mask & 2, right = mask & 4;
    c.fillStyle = '#8d5b34';
    c.fillRect(0, 0, 32, 32);
    const r = rng(variant * 977 + 13);
    c.fillStyle = '#7a4c2a';
    for (let i = 0; i < 4; i++) {
      rr(c, r() * 26, 8 + r() * 20, 4 + r() * 4, 3 + r() * 2, 2);
      c.fill();
    }
    c.fillStyle = '#a5703f';
    for (let i = 0; i < 3; i++) c.fillRect(r() * 29, 10 + r() * 20, 2, 2);
    c.fillStyle = 'rgba(0,0,0,0.14)';
    if (left) c.fillRect(0, 0, 3, 32);
    if (right) c.fillRect(29, 0, 3, 32);
    if (top) {
      c.fillStyle = '#3f9a40';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(32, 0);
      c.lineTo(32, 10);
      for (let x = 32; x > 0; x -= 8) c.quadraticCurveTo(x - 4, 16, x - 8, 10);
      c.closePath();
      c.fill();
      c.fillStyle = '#5cc451';
      c.fillRect(0, 0, 32, 9);
      c.fillStyle = '#82e070';
      c.fillRect(0, 0, 32, 3);
      if (left) { c.fillStyle = '#3f9a40'; c.fillRect(0, 0, 2, 11); }
      if (right) { c.fillStyle = '#3f9a40'; c.fillRect(30, 0, 2, 11); }
    }
  }

  function drawBrick(c) {
    c.fillStyle = '#8f4426';
    c.fillRect(0, 0, 32, 32);
    const bricks = [[1, 1, 14, 14], [17, 1, 14, 14], [1, 17, 6, 14], [9, 17, 14, 14], [25, 17, 6, 14]];
    bricks.forEach(function (b) {
      c.fillStyle = '#c96a3b';
      c.fillRect(b[0], b[1], b[2], b[3]);
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.fillRect(b[0], b[1], b[2], 2);
      c.fillStyle = 'rgba(0,0,0,0.16)';
      c.fillRect(b[0], b[1] + b[3] - 2, b[2], 2);
    });
  }

  function drawPlank(c, mask) {
    const l = (mask & 1) ? 3 : 0, r = (mask & 2) ? 3 : 0;
    c.fillStyle = '#8e5a2c';
    rr(c, l, 0, 32 - l - r, 13, (l || r) ? 4 : 0);
    c.fill();
    c.fillStyle = '#c88a4e';
    c.fillRect(l, 1, 32 - l - r, 9);
    c.fillStyle = '#e4ad70';
    c.fillRect(l, 1, 32 - l - r, 2);
    c.fillStyle = 'rgba(90,50,20,0.35)';
    c.fillRect(l + 4, 6, 10, 1);
    c.fillRect(l + 16, 4, 8, 1);
    c.fillStyle = '#6b4220';
    c.fillRect(15, 3, 2, 2);
    if (l) { c.fillStyle = '#7a4c25'; c.fillRect(6, 13, 4, 6); }
    if (r) { c.fillStyle = '#7a4c25'; c.fillRect(22, 13, 4, 6); }
  }

  function drawSpikes(c) {
    c.fillStyle = '#5b6370';
    c.fillRect(1, 29, 30, 3);
    for (let i = 0; i < 3; i++) {
      const x0 = 1 + i * 10;
      c.fillStyle = '#e9eef4';
      c.beginPath();
      c.moveTo(x0, 30);
      c.lineTo(x0 + 5, 13);
      c.lineTo(x0 + 5, 30);
      c.closePath();
      c.fill();
      c.fillStyle = '#a7b1bf';
      c.beginPath();
      c.moveTo(x0 + 5, 13);
      c.lineTo(x0 + 10, 30);
      c.lineTo(x0 + 5, 30);
      c.closePath();
      c.fill();
    }
  }

  Renderer.prototype.tileSprite = function (lv, tx, ty, t) {
    const W = CQ.World;
    if (t === TILE.GROUND) {
      const solid = function (x, y) { return W.isSolid(lv, x, y); };
      let mask = 0;
      if (ty > 0 && !solid(tx, ty - 1)) mask |= 1;
      if (!solid(tx - 1, ty)) mask |= 2;
      if (!solid(tx + 1, ty)) mask |= 4;
      const v = hash(tx, ty) % 3;
      return this.sprite('g' + mask + '_' + v, 32, 32, function (c) { drawGround(c, mask, v); });
    }
    if (t === TILE.BRICK) return this.sprite('brick', 32, 32, drawBrick);
    if (t === TILE.ONEWAY) {
      let mask = 0;
      if (W.tileAt(lv, tx - 1, ty) !== TILE.ONEWAY) mask |= 1;
      if (W.tileAt(lv, tx + 1, ty) !== TILE.ONEWAY) mask |= 2;
      return this.sprite('plank' + mask, 32, 32, function (c) { drawPlank(c, mask); });
    }
    if (t === TILE.SPIKE) return this.sprite('spike', 32, 32, drawSpikes);
    return null;
  };

  // ── ฉากหลังแบบ parallax ─────────────────────────────────────────
  Renderer.prototype.buildLayers = function () {
    const S = this.S;
    const mk = function (w, h, draw) {
      const cv = makeCanvas(w * S, h * S);
      const c = cv.getContext('2d');
      c.scale(cv.width / w, cv.height / h);
      draw(c, w, h);
      return { cv: cv, w: w, h: h };
    };
    const ridge = function (c, w, h, base, amps, color) {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        let y = base;
        amps.forEach(function (a) { y -= a[0] * Math.sin((x / w) * Math.PI * 2 * a[1] + a[2]); });
        c.lineTo(x, y);
      }
      c.lineTo(w, h);
      c.closePath();
      c.fill();
    };
    this.layers = {
      mountains: mk(1024, 240, function (c, w, h) {
        ridge(c, w, h, 120, [[46, 3, 0.4], [22, 7, 1.3], [10, 13, 2]], '#b9def3');
        ridge(c, w, h, 160, [[38, 4, 2.1], [16, 9, 0.2], [7, 17, 1]], '#9fcfea');
      }),
      hills: mk(768, 170, function (c, w, h) {
        ridge(c, w, h, 80, [[22, 3, 1.1], [10, 7, 0.3]], '#97d68d');
        const r = rng(7);
        c.fillStyle = '#74bf6d';
        for (let i = 0; i < 14; i++) {
          const x = r() * w, y = 70 + r() * 30, s = 0.7 + r() * 0.6;
          ellipse(c, x, y, 9 * s, 13 * s);
          c.fill();
          c.fillRect(x - 1.5, y + 10 * s, 3, 8);
        }
        ridge(c, w, h, 118, [[16, 2, 2.4], [8, 6, 0.9]], '#7cc775');
      })
    };
    this.cloudSprite = mk(120, 50, function (c) {
      c.fillStyle = 'rgba(255,255,255,0.95)';
      [[30, 32, 22, 15], [55, 24, 26, 20], [82, 31, 22, 15], [56, 36, 40, 12]].forEach(function (e) {
        ellipse(c, e[0], e[1], e[2], e[3]);
        c.fill();
      });
      c.fillStyle = 'rgba(200,225,245,0.6)';
      ellipse(c, 58, 42, 38, 6);
      c.fill();
    });
  };

  Renderer.prototype.drawSky = function (g, time) {
    const ctx = this.ctx, vw = this.viewW, vh = this.viewH;
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, '#4fa9f2');
    grad.addColorStop(0.6, '#a5dbff');
    grad.addColorStop(1, '#dff4ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);

    const sx = vw * 0.8 - this.cx * 0.01, sy = 64 - (this.cy - this.camMaxY()) * 0.05;
    ctx.fillStyle = 'rgba(255,245,190,0.35)';
    ellipse(ctx, sx, sy, 46, 46);
    ctx.fill();
    ctx.fillStyle = '#fff6c4';
    ellipse(ctx, sx, sy, 28, 28);
    ctx.fill();

    const cs = this.cloudSprite;
    const period = 2400;
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i];
      let x = (cl.x - this.cx * 0.08 + time * cl.v) % period;
      if (x < 0) x += period;
      x -= 200;
      if (x > vw + 50) continue;
      const y = cl.y - (this.cy - this.camMaxY()) * 0.1;
      ctx.drawImage(cs.cv, x, y, cs.w * cl.s, cs.h * cl.s);
    }
  };

  Renderer.prototype.drawLayer = function (layer, fx, fy, groundOffset) {
    const ctx = this.ctx;
    const base = GROUND_ROW * T + groundOffset - this.camMaxY() - (this.cy - this.camMaxY()) * fy;
    const y = base - layer.h;
    let x = -((this.cx * fx) % layer.w);
    if (x > 0) x -= layer.w;
    for (; x < this.viewW; x += layer.w) ctx.drawImage(layer.cv, x, y, layer.w + 0.5, layer.h);
    if (base < this.viewH) {
      ctx.fillStyle = layer === this.layers.hills ? '#7cc775' : '#9fcfea';
      ctx.fillRect(0, base - 0.5, this.viewW, this.viewH - base + 1);
    }
  };

  // ── ด่าน: ของตกแต่ง, มินิแมพ ──────────────────────────────────
  Renderer.prototype.setLevel = function (lv) {
    this.level = lv;
    const W = CQ.World;
    const empty = function (x, y) { return W.tileAt(lv, x, y) === TILE.EMPTY; };
    const ground = function (x, y) { return W.tileAt(lv, x, y) === TILE.GROUND; };
    const decor = [];
    const busy = new Set();
    lv.coins.concat(lv.checkpoints, lv.enemies).forEach(function (o) { busy.add(o.tx); });
    for (let tx = 0; tx < lv.w; tx++) {
      for (let ty = 1; ty < lv.h; ty++) {
        if (!ground(tx, ty) || !empty(tx, ty - 1)) continue;
        const r = hash(tx, ty) % 100;
        const x = tx * T + 16, y = ty * T;
        const flat = ground(tx - 1, ty) && ground(tx + 1, ty) && empty(tx - 1, ty - 1) && empty(tx + 1, ty - 1);
        let room = 0;
        while (room < 4 && empty(tx, ty - 1 - room)) room++;
        if (r < 8 && flat && room >= 4 && !busy.has(tx)) decor.push({ k: 'tree', x: x, y: y, s: 0.85 + (r % 4) * 0.08, back: true });
        else if (r < 18 && flat) decor.push({ k: 'bush', x: x, y: y, s: 0.8 + (r % 3) * 0.15, back: true });
        else if (r < 38) decor.push({ k: 'flower', x: x - 8 + (r % 16), y: y, c: ['#ff6b8b', '#ffd23f', '#ffffff', '#b07cff'][r % 4] });
        else if (r < 62) decor.push({ k: 'tuft', x: x - 6 + (r % 12), y: y });
        else if (r < 66) decor.push({ k: 'rock', x: x, y: y, back: true });
      }
    }
    if (lv.start) decor.push({ k: 'sign', x: (lv.start.tx + 3) * T + 16, y: (lv.start.ty + 1) * T, back: true });
    this.decor = decor;

    this.pits = [];
    for (let tx = 0; tx < lv.w; tx++) {
      if (!empty(tx, lv.h - 1)) continue;
      const last = this.pits[this.pits.length - 1];
      if (last && last.tx1 === tx - 1) last.tx1 = tx;
      else this.pits.push({ tx0: tx, tx1: tx });
    }

    const mm = makeCanvas(lv.w, lv.h);
    const c = mm.getContext('2d');
    for (let ty = 0; ty < lv.h; ty++) {
      for (let tx = 0; tx < lv.w; tx++) {
        const t = lv.tiles[ty * lv.w + tx];
        if (t === TILE.GROUND || t === TILE.BRICK) c.fillStyle = 'rgba(255,255,255,0.62)';
        else if (t === TILE.ONEWAY) c.fillStyle = 'rgba(255,255,255,0.4)';
        else if (t === TILE.SPIKE) c.fillStyle = '#ff7070';
        else if (t === TILE.SPRING) c.fillStyle = '#ffb347';
        else continue;
        c.fillRect(tx, ty, 1, 1);
      }
    }
    c.fillStyle = 'rgba(255,255,255,0.3)';
    lv.tracks.forEach(function (tr) { c.fillRect(tr.tx0, tr.ty, tr.tx1 - tr.tx0 + 1, 1); });
    this.minimap = mm;
  };

  Renderer.prototype.drawDecor = function (back, time) {
    const ctx = this.ctx;
    const x0 = this.cx - 80, x1 = this.cx + this.viewW + 80;
    for (let i = 0; i < this.decor.length; i++) {
      const d = this.decor[i];
      if (!!d.back !== back || d.x < x0 || d.x > x1) continue;
      switch (d.k) {
        case 'tree': {
          const s = d.s;
          ctx.fillStyle = '#7a4f2c';
          ctx.fillRect(d.x - 4 * s, d.y - 40 * s, 8 * s, 40 * s);
          ctx.fillStyle = '#3f9a49';
          ellipse(ctx, d.x, d.y - 58 * s, 26 * s, 24 * s); ctx.fill();
          ctx.fillStyle = '#4fb257';
          ellipse(ctx, d.x - 8 * s, d.y - 64 * s, 16 * s, 15 * s); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ellipse(ctx, d.x - 12 * s, d.y - 70 * s, 7 * s, 5 * s); ctx.fill();
          break;
        }
        case 'bush':
          ctx.fillStyle = '#3e9b46';
          ellipse(ctx, d.x - 9 * d.s, d.y - 7 * d.s, 11 * d.s, 9 * d.s); ctx.fill();
          ellipse(ctx, d.x + 9 * d.s, d.y - 7 * d.s, 11 * d.s, 9 * d.s); ctx.fill();
          ctx.fillStyle = '#52b55a';
          ellipse(ctx, d.x, d.y - 12 * d.s, 13 * d.s, 11 * d.s); ctx.fill();
          break;
        case 'rock':
          ctx.fillStyle = '#9aa3ad';
          ellipse(ctx, d.x, d.y - 3, 9, 6); ctx.fill();
          ctx.fillStyle = '#c3cad2';
          ellipse(ctx, d.x - 2, d.y - 5, 4, 2.5); ctx.fill();
          break;
        case 'sign':
          ctx.fillStyle = '#7a4f2c';
          ctx.fillRect(d.x - 2, d.y - 30, 4, 30);
          ctx.fillStyle = '#c88a4e';
          rr(ctx, d.x - 18, d.y - 40, 36, 20, 4); ctx.fill();
          ctx.strokeStyle = '#8e5a2c'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#5a3417';
          ctx.beginPath();
          ctx.moveTo(d.x - 10, d.y - 33); ctx.lineTo(d.x + 2, d.y - 33); ctx.lineTo(d.x + 2, d.y - 37);
          ctx.lineTo(d.x + 11, d.y - 30); ctx.lineTo(d.x + 2, d.y - 23); ctx.lineTo(d.x + 2, d.y - 27);
          ctx.lineTo(d.x - 10, d.y - 27); ctx.closePath(); ctx.fill();
          break;
        case 'flower': {
          const sway = Math.sin(time * 2 + d.x * 0.05) * 1.2;
          ctx.strokeStyle = '#3f9a40'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + sway, d.y - 9); ctx.stroke();
          ctx.fillStyle = d.c;
          for (let k = 0; k < 5; k++) {
            const a = k / 5 * Math.PI * 2;
            ellipse(ctx, d.x + sway + Math.cos(a) * 2.6, d.y - 10 + Math.sin(a) * 2.6, 2, 2); ctx.fill();
          }
          ctx.fillStyle = '#ffcf33';
          ellipse(ctx, d.x + sway, d.y - 10, 1.6, 1.6); ctx.fill();
          break;
        }
        case 'tuft':
          ctx.strokeStyle = '#3f9a40'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(d.x - 3, d.y); ctx.lineTo(d.x - 5, d.y - 6);
          ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y - 8);
          ctx.moveTo(d.x + 3, d.y); ctx.lineTo(d.x + 5, d.y - 6);
          ctx.stroke();
          break;
      }
    }
  };

  // ── กล้อง ────────────────────────────────────────────────────
  Renderer.prototype.camMaxY = function () {
    return this.level ? this.level.h * T - this.viewH - this.bottomCrop : 0;
  };

  Renderer.prototype.clampCam = function (x, y) {
    const lv = this.level;
    const maxX = lv.w * T - this.viewW;
    x = maxX <= 0 ? maxX / 2 : clamp(x, 0, maxX);
    const maxY = this.camMaxY();
    const minY = -3 * T;
    y = maxY <= minY ? maxY : clamp(y, minY, maxY);
    return { x: x, y: y };
  };

  Renderer.prototype.updateCamera = function (focus, face, dt, snap) {
    const tgtLook = face * 46;
    this.look += clamp(tgtLook - this.look, -dt * 110, dt * 110);
    const want = this.clampCam(focus.x + this.look - this.viewW / 2, focus.y - this.viewH * 0.56);
    if (snap) {
      this.cam.x = want.x;
      this.cam.y = want.y;
      return;
    }
    const kx = 1 - Math.exp(-dt * 7);
    const ky = 1 - Math.exp(-dt * 5);
    this.cam.x += (want.x - this.cam.x) * kx;
    this.cam.y += (want.y - this.cam.y) * ky;
  };

  // ── วาดทั้งเฟรม ────────────────────────────────────────────────
  Renderer.prototype.render = function (g, time) {
    const ctx = this.ctx, S = this.S;
    if (!this.layers) this.buildLayers();
    let cx = this.cam.x, cy = this.cam.y;
    if (g.shake > 0) {
      cx += (Math.random() * 2 - 1) * g.shake;
      cy += (Math.random() * 2 - 1) * g.shake;
    }
    this.cx = cx = Math.round(cx * S) / S;
    this.cy = cy = Math.round(cy * S) / S;

    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = true;
    this.drawSky(g, time);
    this.drawLayer(this.layers.mountains, 0.12, 0.25, 30);
    this.drawLayer(this.layers.hills, 0.3, 0.45, 40);

    ctx.setTransform(S, 0, 0, S, -cx * S, -cy * S);
    this.drawPits();
    this.drawTracks(g);
    this.drawDecor(true, time);
    this.drawTiles(g.lv);
    ctx.setTransform(S, 0, 0, S, -cx * S, -cy * S);
    this.drawDecor(false, time);
    this.drawSprings(g, time);
    for (let i = 0; i < g.checkpoints.length; i++) this.drawCheckpoint(g.checkpoints[i], time);
    for (let i = 0; i < g.coins.length; i++) if (!g.coins[i].taken) this.drawCoin(g.coins[i], time);
    for (let i = 0; i < g.lv.platforms.length; i++) this.drawPlatform(g.lv.platforms[i]);
    for (let i = 0; i < g.enemies.length; i++) this.drawSlime(g.enemies[i]);
    if (g.deathAnim) this.drawHero(g.deathAnim, g, time, true);
    else if (!(g.player.invuln > 0 && Math.floor(time * 18) % 2 === 0)) this.drawHero(g.player, g, time, false);
    this.drawParticles(g.particles);

    ctx.setTransform(S, 0, 0, S, 0, 0);
    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (g.flash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (g.showMinimap) this.drawMinimap(g, time);
  };

  Renderer.prototype.drawPits = function () {
    const ctx = this.ctx, lv = this.level;
    const y0 = (GROUND_ROW - 0.5) * T, y1 = lv.h * T + this.viewH;
    const grad = ctx.createLinearGradient(0, y0, 0, lv.h * T - this.bottomCrop);
    grad.addColorStop(0, 'rgba(30,40,70,0)');
    grad.addColorStop(0.45, 'rgba(26,32,58,0.6)');
    grad.addColorStop(1, 'rgba(18,22,42,0.95)');
    ctx.fillStyle = grad;
    for (let i = 0; i < this.pits.length; i++) {
      const p = this.pits[i];
      const x0 = p.tx0 * T, x1 = (p.tx1 + 1) * T;
      if (x1 < this.cx || x0 > this.cx + this.viewW) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  };

  Renderer.prototype.drawTiles = function (lv) {
    const ctx = this.ctx, S = this.S, cx = this.cx, cy = this.cy;
    const tx0 = Math.max(0, Math.floor(cx / T)), tx1 = Math.min(lv.w - 1, Math.floor((cx + this.viewW) / T));
    const ty0 = Math.max(0, Math.floor(cy / T)), ty1 = Math.min(lv.h - 1, Math.floor((cy + this.viewH) / T));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let ty = ty0; ty <= ty1; ty++) {
      const y0 = Math.round((ty * T - cy) * S), y1 = Math.round(((ty + 1) * T - cy) * S);
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = lv.tiles[ty * lv.w + tx];
        if (t === TILE.EMPTY || t === TILE.SPRING) continue;
        const spr = this.tileSprite(lv, tx, ty, t);
        if (!spr) continue;
        const x0 = Math.round((tx * T - cx) * S), x1 = Math.round(((tx + 1) * T - cx) * S);
        ctx.drawImage(spr, x0, y0, x1 - x0, y1 - y0);
      }
    }
  };

  Renderer.prototype.drawTracks = function (g) {
    const ctx = this.ctx;
    for (let i = 0; i < g.lv.platforms.length; i++) {
      const pl = g.lv.platforms[i];
      const y = pl.y + 7;
      const xa = pl.minX + 10, xb = pl.maxX + pl.w - 10;
      ctx.strokeStyle = 'rgba(70,50,30,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(70,50,30,0.5)';
      ellipse(ctx, xa, y, 4, 4); ctx.fill();
      ellipse(ctx, xb, y, 4, 4); ctx.fill();
    }
  };

  Renderer.prototype.drawPlatform = function (pl) {
    const ctx = this.ctx;
    if (pl.x + pl.w < this.cx || pl.x > this.cx + this.viewW) return;
    ctx.fillStyle = '#7a4c25';
    rr(ctx, pl.x, pl.y, pl.w, pl.h, 5); ctx.fill();
    ctx.fillStyle = '#c88a4e';
    rr(ctx, pl.x + 2, pl.y + 1, pl.w - 4, pl.h - 4, 4); ctx.fill();
    ctx.fillStyle = '#e4ad70';
    ctx.fillRect(pl.x + 5, pl.y + 2, pl.w - 10, 2);
    ctx.fillStyle = '#7d8794';
    rr(ctx, pl.x, pl.y, 10, pl.h, 4); ctx.fill();
    rr(ctx, pl.x + pl.w - 10, pl.y, 10, pl.h, 4); ctx.fill();
    ctx.fillStyle = '#c9d0d9';
    ellipse(ctx, pl.x + 5, pl.y + 7, 1.6, 1.6); ctx.fill();
    ellipse(ctx, pl.x + pl.w - 5, pl.y + 7, 1.6, 1.6); ctx.fill();
  };

  Renderer.prototype.drawSprings = function (g, time) {
    const ctx = this.ctx;
    for (let i = 0; i < g.springs.length; i++) {
      const s = g.springs[i];
      const x = s.tx * T, base = (s.ty + 1) * T;
      if (x + T < this.cx || x > this.cx + this.viewW) continue;
      const t = time - s.hit;
      const ext = t < 0.45 ? Math.cos(t * 28) * 8 * (1 - t / 0.45) : 0;
      const top = base - 14 - ext;
      ctx.fillStyle = '#4b5260';
      rr(ctx, x + 4, base - 4, 24, 4, 1.5); ctx.fill();
      ctx.strokeStyle = '#9aa3ad';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const n = 4, h = (base - 4) - (top + 5);
      ctx.moveTo(x + 9, base - 4);
      for (let k = 1; k <= n; k++) ctx.lineTo(k % 2 ? x + 23 : x + 9, base - 4 - (h * k) / n);
      ctx.stroke();
      ctx.fillStyle = '#e8443a';
      rr(ctx, x + 3, top, 26, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x + 6, top + 1, 20, 1.5);
    }
  };

  Renderer.prototype.drawCheckpoint = function (cp, time) {
    const ctx = this.ctx;
    const x = cp.tx * T + 12, base = (cp.ty + 1) * T;
    if (x + 40 < this.cx || x - 20 > this.cx + this.viewW) return;
    ctx.fillStyle = '#8d96a5';
    rr(ctx, x - 7, base - 5, 14, 5, 2); ctx.fill();
    ctx.fillStyle = '#6f7887';
    ctx.fillRect(x - 1.5, base - 62, 3, 58);
    ctx.fillStyle = cp.active ? '#ffd23f' : '#b9c0cb';
    ellipse(ctx, x, base - 63, 3.2, 3.2); ctx.fill();
    const raise = cp.active ? Math.min(1, cp.raise) : 0;
    const fy = base - 58 + (1 - raise) * 34;
    const w1 = Math.sin(time * 6 + cp.tx) * 2.5, w2 = Math.sin(time * 6 + cp.tx + 1.4) * 2.5;
    ctx.fillStyle = cp.active ? '#2ecc71' : '#c3c9d3';
    ctx.beginPath();
    ctx.moveTo(x + 1.5, fy);
    ctx.quadraticCurveTo(x + 12, fy - 2 + w1, x + 24, fy + 6 + w2);
    ctx.quadraticCurveTo(x + 12, fy + 12 + w1, x + 1.5, fy + 15);
    ctx.closePath();
    ctx.fill();
    if (cp.active) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(x + 8, fy + 7.5);
      ctx.lineTo(x + 11, fy + 10);
      ctx.lineTo(x + 16, fy + 5);
      ctx.lineTo(x + 15, fy + 4);
      ctx.lineTo(x + 11, fy + 8);
      ctx.lineTo(x + 9, fy + 6.5);
      ctx.closePath();
      ctx.fill();
    }
  };

  Renderer.prototype.drawCoin = function (c, time) {
    const ctx = this.ctx;
    if (c.x + 20 < this.cx || c.x - 20 > this.cx + this.viewW) return;
    const bob = Math.sin(time * 3 + c.phase) * 2.2;
    const spin = Math.cos(time * 3.4 + c.phase);
    const sx = Math.max(0.14, Math.abs(spin));
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.fillStyle = 'rgba(255,214,70,0.22)';
    ellipse(ctx, 0, 0, 15, 15); ctx.fill();
    ctx.scale(sx, 1);
    ctx.fillStyle = spin > 0 ? '#ffd23f' : '#f2b51c';
    ellipse(ctx, 0, 0, 9.5, 9.5); ctx.fill();
    ctx.strokeStyle = '#d48a00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,170,0.95)';
    ctx.lineWidth = 1.6;
    ellipse(ctx, 0, 0, 5.6, 5.6); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ellipse(ctx, -3.2, -3.6, 1.8, 2.6); ctx.fill();
    ctx.restore();
  };

  Renderer.prototype.drawSlime = function (e) {
    const ctx = this.ctx;
    if (e.x + 40 < this.cx || e.x - 40 > this.cx + this.viewW) return;
    if (e.dead && e.deadT > 0.6) return;
    const cx = e.x + e.w / 2, by = e.y + e.h;
    let sx = 1 - Math.sin(e.t * 9) * 0.06, sy = 1 + Math.sin(e.t * 9) * 0.08;
    ctx.save();
    if (e.dead) {
      sx = 1.35; sy = 0.35;
      ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.6);
    }
    ctx.translate(cx, by);
    ctx.scale(sx, sy);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ellipse(ctx, 0, 0, 13, 2.5); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.bezierCurveTo(-15, -14, -7, -20, 0, -20);
    ctx.bezierCurveTo(7, -20, 15, -14, 14, 0);
    ctx.closePath();
    ctx.fillStyle = '#58d26d';
    ctx.fill();
    ctx.strokeStyle = '#2e9b49';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ellipse(ctx, -5.5, -13, 3.6, 2.2); ctx.fill();
    const d = e.dir;
    if (e.dead) {
      ctx.strokeStyle = '#1b3a24'; ctx.lineWidth = 1.6;
      [-4, 4].forEach(function (ox) {
        ctx.beginPath();
        ctx.moveTo(ox - 2, -11); ctx.lineTo(ox + 2, -7);
        ctx.moveTo(ox + 2, -11); ctx.lineTo(ox - 2, -7);
        ctx.stroke();
      });
    } else {
      [-4, 4].forEach(function (ox) {
        ctx.fillStyle = '#fff';
        ellipse(ctx, d * 3 + ox, -9, 2.7, 3.1); ctx.fill();
        ctx.fillStyle = '#1b3a24';
        ellipse(ctx, d * 3 + ox + d * 0.9, -8.6, 1.4, 1.7); ctx.fill();
      });
    }
    ctx.restore();
  };

  Renderer.prototype.drawHero = function (p, g, time, dead) {
    const ctx = this.ctx;
    const f = p.face || 1;
    const cx = p.x + p.w / 2, by = p.y + p.h;
    let sx = 1, sy = 1;
    if (!dead) {
      if (!p.onGround) {
        const s = Math.min(0.14, Math.abs(p.vy) / 3000);
        sy += s; sx -= s * 0.7;
      }
      const sq = g.landSquash || 0;
      sy -= sq; sx += sq * 0.8;
    }
    ctx.save();
    ctx.translate(cx, by);
    if (dead) {
      ctx.translate(0, -14);
      ctx.rotate(p.rot);
      ctx.translate(0, 14);
    }
    ctx.scale(sx, sy);

    const speed = Math.min(1, Math.abs(p.vx || 0) / 210);
    const sway = Math.sin(time * 13) * (1 + speed * 1.5);
    ctx.strokeStyle = '#2f6fde';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8 * f, -20);
    ctx.quadraticCurveTo(-15 * f, -21 + sway * 0.5, -(20 + speed * 5) * f, -15 + sway + (1 - speed) * 5);
    ctx.moveTo(-8 * f, -19);
    ctx.quadraticCurveTo(-14 * f, -17 + sway * 0.4, -(17 + speed * 4) * f, -10 + sway * 0.8 + (1 - speed) * 4);
    ctx.stroke();

    const run = !dead && p.onGround && Math.abs(p.vx) > 25;
    const ph = g.runPhase || 0;
    ctx.fillStyle = '#5a2a1a';
    if (run) {
      ellipse(ctx, -4 + Math.sin(ph) * 4.5, -3 - Math.max(0, Math.cos(ph)) * 3, 4.6, 3); ctx.fill();
      ellipse(ctx, 4 + Math.sin(ph + Math.PI) * 4.5, -3 - Math.max(0, Math.cos(ph + Math.PI)) * 3, 4.6, 3); ctx.fill();
    } else if (!dead && !p.onGround) {
      ellipse(ctx, -5 + f, -4, 4.4, 3); ctx.fill();
      ellipse(ctx, 5 + f * 2, -2.5, 4.4, 3); ctx.fill();
    } else {
      ellipse(ctx, -5, -3, 4.6, 3); ctx.fill();
      ellipse(ctx, 5, -3, 4.6, 3); ctx.fill();
    }

    rr(ctx, -11, -27, 22, 23, 10);
    ctx.fillStyle = '#ff6a3d';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffd3ad';
    ellipse(ctx, f * 2.5, -9, 7.5, 6); ctx.fill();
    ctx.fillStyle = '#2f6fde';
    ctx.fillRect(-12, -23, 24, 4.2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-12, -23, 24, 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ellipse(ctx, -5 * f, -25, 5, 2.2); ctx.fill();
    ctx.restore();
    rr(ctx, -11, -27, 22, 23, 10);
    ctx.strokeStyle = '#c8461f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const ex = f * 3.2;
    if (dead) {
      ctx.strokeStyle = '#1d1d2b'; ctx.lineWidth = 1.6;
      [-3.8, 3.8].forEach(function (o) {
        ctx.beginPath();
        ctx.moveTo(ex + o - 2, -17); ctx.lineTo(ex + o + 2, -13);
        ctx.moveTo(ex + o + 2, -17); ctx.lineTo(ex + o - 2, -13);
        ctx.stroke();
      });
    } else {
      const blink = (time % 3.3) < 0.12;
      [-3.8, 3.8].forEach(function (o) {
        ctx.fillStyle = '#fff';
        ellipse(ctx, ex + o, -15, 2.8, blink ? 0.6 : 3.5); ctx.fill();
        if (!blink) {
          ctx.fillStyle = '#1d1d2b';
          ellipse(ctx, ex + o + f * 1.1, -14.6, 1.5, 1.9); ctx.fill();
        }
      });
      ctx.fillStyle = 'rgba(255,120,140,0.55)';
      ellipse(ctx, f * 9, -9.5, 2.2, 1.5); ctx.fill();
    }
    ctx.restore();
  };

  Renderer.prototype.drawParticles = function (list) {
    const ctx = this.ctx;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const a = Math.max(0, 1 - p.t / p.life);
      ctx.globalAlpha = a;
      if (p.kind === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = '800 15px Kanit, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(80,50,0,0.6)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.kind === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else if (p.kind === 'star') {
        const s = p.size * (0.5 + a * 0.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
        ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ellipse(ctx, p.x, p.y, p.size * (0.4 + a * 0.6), p.size * (0.4 + a * 0.6));
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  Renderer.prototype.drawMinimap = function (g, time) {
    const r = this.minimapRect;
    if (!r || !this.minimap) return;
    const ctx = this.ctx, lv = g.lv;
    const k = 1 / this.scale;
    const x = r.x * k, y = r.y * k, w = r.w * k, h = r.h * k;
    const pad = 4 * k;
    ctx.fillStyle = 'rgba(16,28,52,0.55)';
    rr(ctx, x - pad, y - pad, w + pad * 2, h + pad * 2, 6 * k);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.minimap, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
    const sx = w / (lv.w * T), sy = h / (lv.h * T);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1 * k;
    const vy0 = Math.max(0, this.cy), vy1 = Math.min(lv.h * T, this.cy + this.viewH);
    ctx.strokeRect(x + this.cx * sx, y + vy0 * sy, this.viewW * sx, (vy1 - vy0) * sy);
    for (let i = 0; i < g.checkpoints.length; i++) {
      const cp = g.checkpoints[i];
      ctx.fillStyle = cp.active ? '#2ecc71' : 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + (cp.tx * T + 12) * sx - 0.75 * k, y + (cp.ty - 1) * T * sy, 1.5 * k, 2 * T * sy);
    }
    const pulse = 1 + Math.sin(time * 6) * 0.25;
    for (let i = 0; i < g.coins.length; i++) {
      const c = g.coins[i];
      if (c.taken) continue;
      ctx.fillStyle = '#ffd23f';
      ellipse(ctx, x + c.x * sx, y + c.y * sy, 2.2 * k * pulse, 2.2 * k * pulse);
      ctx.fill();
    }
    const p = g.deathAnim || g.player;
    ctx.fillStyle = '#ff5a3d';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2 * k;
    ellipse(ctx, x + (p.x + p.w / 2) * sx, y + clamp(p.y + p.h / 2, 0, lv.h * T) * sy, 3 * k, 3 * k);
    ctx.fill();
    ctx.stroke();
  };

  CQ.Renderer = Renderer;
})(window);
