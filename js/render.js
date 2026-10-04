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

  // ── ธีมของแต่ละสเตจ: สีพื้น แผ่นไม้ ท้องฟ้า (ฉากหลังและของตกแต่งแยกตาม id ใน buildLayers/setLevel) ──
  const THEMES = {
    grassland: {
      id: 'grassland',
      sky: ['#4fa9f2', '#a5dbff', '#dff4ff'],
      ground: { dirt: '#8d5b34', dark: '#7a4c2a', light: '#a5703f', grassDark: '#3f9a40', grass: '#5cc451', grassLight: '#82e070' },
      plank: { edge: '#8e5a2c', mid: '#c88a4e', light: '#e4ad70', grain: 'rgba(90,50,20,0.35)', knot: '#6b4220', leg: '#7a4c25' },
      tuft: '#3f9a40'
    },
    forest: {
      id: 'forest',
      sky: ['#245c4c', '#6ea77a', '#d8ebb0'],
      ground: { dirt: '#5e3d26', dark: '#4c3020', light: '#7a5235', grassDark: '#2b6a33', grass: '#3d8a3a', grassLight: '#69ad4c' },
      plank: { edge: '#4f3019', mid: '#7e5230', light: '#9c6c40', grain: 'rgba(40,22,10,0.4)', knot: '#3d2412', leg: '#4f3019', leaves: true },
      tuft: '#2f7a35'
    },
    castle: {
      id: 'castle',
      sky: ['#120e1a', '#1f1829', '#2e2338'],
      plank: { edge: '#3b2616', mid: '#6a4529', light: '#86603c', grain: 'rgba(30,16,6,0.45)', knot: '#2e1c0e', leg: '#55565e' },
      tuft: '#5a5268'
    }
  };

  const POWER_COLOR = { wing: '#7fc4f5', mush: '#ff5a7a', star: '#ffd23f', heart: '#ff4d6a' };
  const ITEM_GLOW = { wing: '191,230,255', mush: '255,120,150', star: '255,214,70', heart: '255,90,120' };

  /** ปีก 1 ข้าง: โคนปีกที่ (0,0) ยื่นไปทาง -x */
  function wingPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-6, -10, -16, -14, -20, -8);
    ctx.bezierCurveTo(-16, -6, -17, -3, -18, 0);
    ctx.bezierCurveTo(-13, -1, -13, 2, -14, 5);
    ctx.bezierCurveTo(-8, 3, -4, 4, 0, 0);
    ctx.closePath();
  }

  function fillWing(ctx) {
    wingPath(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#7fb8e6';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(127,184,230,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -1); ctx.lineTo(-14, -6);
    ctx.moveTo(-3, 1); ctx.lineTo(-12, 1);
    ctx.stroke();
  }

  function starPath(ctx, r1, r2) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? r2 : r1;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  }

  /** ไอคอนไอเทม วาดกึ่งกลางที่ (0,0) ขนาดราว 24 หน่วย */
  function drawItemIcon(ctx, type, time) {
    if (type === 'wing') {
      const flap = Math.sin(time * 6) * 0.25;
      [1, -1].forEach(function (side) {
        ctx.save();
        ctx.scale(side, 1);
        ctx.translate(-1.5, 3);
        ctx.rotate(flap);
        ctx.scale(0.62, 0.62);
        fillWing(ctx);
        ctx.restore();
      });
      ctx.fillStyle = '#ffd23f';
      ellipse(ctx, 0, 3, 2.6, 2.6); ctx.fill();
    } else if (type === 'mush') {
      rr(ctx, -5.5, -1, 11, 10, 3);
      ctx.fillStyle = '#f7e7c6';
      ctx.fill();
      ctx.strokeStyle = '#c9a97a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#3a2a1a';
      ellipse(ctx, -2, 3.6, 1, 1.6); ctx.fill();
      ellipse(ctx, 2, 3.6, 1, 1.6); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12.5, 1.5);
      ctx.bezierCurveTo(-12.5, -12.5, 12.5, -12.5, 12.5, 1.5);
      ctx.closePath();
      ctx.fillStyle = '#ff4d6a';
      ctx.fill();
      ctx.strokeStyle = '#c42a48';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      [[-5.5, -4, 2.7, 2.3], [4, -6.2, 3, 2.5], [8.6, -1, 1.8, 1.6], [-9.6, -0.6, 1.5, 1.4]].forEach(function (d) {
        ellipse(ctx, d[0], d[1], d[2], d[3]); ctx.fill();
      });
    } else if (type === 'heart') {
      const beat = 1 + Math.max(0, Math.sin(time * 7)) * 0.08;
      ctx.save();
      ctx.scale(beat, beat);
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-4, 6, -12, 1, -12, -4.5);
      ctx.bezierCurveTo(-12, -10, -5, -12, 0, -6);
      ctx.bezierCurveTo(5, -12, 12, -10, 12, -4.5);
      ctx.bezierCurveTo(12, 1, 4, 6, 0, 10);
      ctx.closePath();
      ctx.fillStyle = '#ff4d6a';
      ctx.fill();
      ctx.strokeStyle = '#b8243f';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ellipse(ctx, -6, -5, 2.6, 1.8); ctx.fill();
      ctx.restore();
    } else if (type === 'star') {
      ctx.save();
      ctx.rotate(Math.sin(time * 3) * 0.15);
      starPath(ctx, 12.5, 5.6);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.strokeStyle = '#e09b00';
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = '#3a2a00';
      ellipse(ctx, -2.6, -0.5, 1.1, 2); ctx.fill();
      ellipse(ctx, 2.6, -0.5, 1.1, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ellipse(ctx, -4, -5, 1.6, 1.1); ctx.fill();
      ctx.restore();
    }
  }

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
    this.theme = THEMES.grassland;
    const r = rng(42);
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      this.clouds.push({ x: r() * 2400, y: 30 + r() * 140, s: 0.6 + r() * 0.8, v: 4 + r() * 8 });
    }
  }

  Renderer.prototype.resize = function (cssW, cssH, dpr) {
    this.dpr = dpr;
    // ปรับสเกลให้ 1 พิกเซลของตัวละคร = จำนวนเต็มของพิกเซลจอ (ภาพคม)
    // โดยยังเห็นด่านอย่างน้อยราว 80% ของพื้นที่ขั้นต่ำ (MIN_VIEW_W x MIN_VIEW_H)
    const U = CQ.Sprites.UNIT;
    let k = Math.max(1, Math.round(Math.min(cssW / MIN_VIEW_W, cssH / MIN_VIEW_H) * dpr * U));
    while (k > 1 && (cssH * U * dpr / k < MIN_VIEW_H * 0.8 || cssW * U * dpr / k < MIN_VIEW_W * 0.78)) k--;
    this.pixel = k;
    this.scale = k / (U * dpr);
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

  function drawGround(c, mask, variant, pal) {
    const top = mask & 1, left = mask & 2, right = mask & 4;
    c.fillStyle = pal.dirt;
    c.fillRect(0, 0, 32, 32);
    const r = rng(variant * 977 + 13);
    c.fillStyle = pal.dark;
    for (let i = 0; i < 4; i++) {
      rr(c, r() * 26, 8 + r() * 20, 4 + r() * 4, 3 + r() * 2, 2);
      c.fill();
    }
    c.fillStyle = pal.light;
    for (let i = 0; i < 3; i++) c.fillRect(r() * 29, 10 + r() * 20, 2, 2);
    c.fillStyle = 'rgba(0,0,0,0.14)';
    if (left) c.fillRect(0, 0, 3, 32);
    if (right) c.fillRect(29, 0, 3, 32);
    if (top) {
      c.fillStyle = pal.grassDark;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(32, 0);
      c.lineTo(32, 10);
      for (let x = 32; x > 0; x -= 8) c.quadraticCurveTo(x - 4, 16, x - 8, 10);
      c.closePath();
      c.fill();
      c.fillStyle = pal.grass;
      c.fillRect(0, 0, 32, 9);
      c.fillStyle = pal.grassLight;
      c.fillRect(0, 0, 32, 3);
      if (left) { c.fillStyle = pal.grassDark; c.fillRect(0, 0, 2, 11); }
      if (right) { c.fillStyle = pal.grassDark; c.fillRect(30, 0, 2, 11); }
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

  function drawPlank(c, mask, pal) {
    const l = (mask & 1) ? 3 : 0, r = (mask & 2) ? 3 : 0;
    c.fillStyle = pal.edge;
    rr(c, l, 0, 32 - l - r, 13, (l || r) ? 4 : 0);
    c.fill();
    c.fillStyle = pal.mid;
    c.fillRect(l, 1, 32 - l - r, 9);
    c.fillStyle = pal.light;
    c.fillRect(l, 1, 32 - l - r, 2);
    c.fillStyle = pal.grain;
    c.fillRect(l + 4, 6, 10, 1);
    c.fillRect(l + 16, 4, 8, 1);
    c.fillStyle = pal.knot;
    c.fillRect(15, 3, 2, 2);
    if (pal.leaves) {
      // กิ่งไม้ในป่า: มีใบไม้ติดที่ปลายกิ่ง
      const leaf = function (x, y, a) {
        c.save(); c.translate(x, y); c.rotate(a);
        c.fillStyle = '#3d8a3a'; ellipse(c, 0, 0, 5, 2.6); c.fill();
        c.fillStyle = '#69ad4c'; ellipse(c, -1, -0.8, 2.6, 1.2); c.fill();
        c.restore();
      };
      if (l) { leaf(4, 12, 0.9); leaf(9, 13, -0.4); }
      if (r) { leaf(28, 12, -0.9); leaf(23, 13, 0.4); }
      return;
    }
    if (l) { c.fillStyle = pal.leg; c.fillRect(6, 13, 4, 6); }
    if (r) { c.fillStyle = pal.leg; c.fillRect(22, 13, 4, 6); }
  }

  /** บล็อกหินมีมอส (บล็อก B ของสเตจป่า) top = ด้านบนโล่ง มีมอสคลุม */
  function drawStone(c, top) {
    c.fillStyle = '#4b5057';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#767e88';
    rr(c, 1, 1, 30, 30, 4); c.fill();
    c.fillStyle = '#929aa4';
    c.fillRect(3, 3, 26, 3);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(3, 26, 26, 3);
    c.fillStyle = '#4b5057';
    c.fillRect(9, 12, 9, 2); c.fillRect(16, 12, 2, 7); c.fillRect(5, 21, 7, 2); c.fillRect(21, 19, 6, 2);
    if (top) {
      c.fillStyle = '#3d8a3a';
      c.fillRect(0, 0, 32, 6);
      c.fillRect(3, 6, 5, 3); c.fillRect(15, 6, 7, 2); c.fillRect(25, 6, 3, 4);
      c.fillStyle = '#69ad4c';
      c.fillRect(0, 0, 32, 2);
    }
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

  /** พื้นหินในปราสาท (# ของ Boss Stage) ก้อนหินเรียงสลับ ด้านบนเป็นขอบหินขัด */
  function drawCastleFloor(c, mask, variant) {
    const top = mask & 1, left = mask & 2, right = mask & 4;
    c.fillStyle = '#2a2433';
    c.fillRect(0, 0, 32, 32);
    const off = variant * 6;
    const blocks = [[1 - off, 1, 20, 14], [23 - off, 1, 20, 14], [-9 + off, 17, 20, 14], [13 + off, 17, 20, 14], [35 + off, 17, 20, 14]];
    blocks.forEach(function (b) {
      c.fillStyle = '#463e52';
      c.fillRect(b[0], b[1], b[2], b[3]);
      c.fillStyle = '#554c62';
      c.fillRect(b[0], b[1], b[2], 2);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(b[0], b[1] + b[3] - 2, b[2], 2);
    });
    const r = rng(variant * 313 + 5);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 2; i++) c.fillRect(4 + r() * 22, 6 + r() * 20, 3 + r() * 4, 1);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    if (left) c.fillRect(0, 0, 3, 32);
    if (right) c.fillRect(29, 0, 3, 32);
    if (top) {
      c.fillStyle = '#7d738d';
      c.fillRect(0, 0, 32, 6);
      c.fillStyle = '#a69cb6';
      c.fillRect(0, 0, 32, 2);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0, 6, 32, 2);
      c.fillStyle = '#5f566e';
      c.fillRect(variant * 9 + 3, 2, 1, 4);
    }
  }

  /** อิฐปราสาท (B ของ Boss Stage: เพดานและบล็อก) top = ด้านบนโล่ง */
  function drawCastleBrick(c, top) {
    c.fillStyle = '#1e1826';
    c.fillRect(0, 0, 32, 32);
    const bricks = [[1, 1, 14, 9], [17, 1, 14, 9], [1, 12, 6, 9], [9, 12, 14, 9], [25, 12, 6, 9], [1, 23, 14, 8], [17, 23, 14, 8]];
    bricks.forEach(function (b, i) {
      c.fillStyle = i % 3 === 1 ? '#4a3a52' : '#55445e';
      c.fillRect(b[0], b[1], b[2], b[3]);
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.fillRect(b[0], b[1], b[2], 1);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(b[0], b[1] + b[3] - 1, b[2], 1);
    });
    if (top) {
      c.fillStyle = '#7d738d';
      c.fillRect(0, 0, 32, 4);
      c.fillStyle = '#a69cb6';
      c.fillRect(0, 0, 32, 1);
    }
  }

  Renderer.prototype.tileSprite = function (lv, tx, ty, t) {
    const W = CQ.World;
    const th = this.theme;
    if (th.id === 'castle' && (t === TILE.GROUND || t === TILE.BRICK)) {
      if (t === TILE.BRICK) {
        const top = !W.isSolid(lv, tx, ty - 1) && ty > 0;
        return this.sprite('cbrick' + (top ? 1 : 0), 32, 32, function (c) { drawCastleBrick(c, top); });
      }
      const solid = function (x, y) { return W.isSolid(lv, x, y); };
      let mask = 0;
      if (ty > 0 && !solid(tx, ty - 1)) mask |= 1;
      if (!solid(tx - 1, ty)) mask |= 2;
      if (!solid(tx + 1, ty)) mask |= 4;
      const v = (tx + ty) % 2;
      return this.sprite('cfloor' + mask + '_' + v, 32, 32, function (c) { drawCastleFloor(c, mask, v); });
    }
    if (t === TILE.GROUND) {
      const solid = function (x, y) { return W.isSolid(lv, x, y); };
      let mask = 0;
      if (ty > 0 && !solid(tx, ty - 1)) mask |= 1;
      if (!solid(tx - 1, ty)) mask |= 2;
      if (!solid(tx + 1, ty)) mask |= 4;
      const v = hash(tx, ty) % 3;
      return this.sprite(th.id + 'g' + mask + '_' + v, 32, 32, function (c) { drawGround(c, mask, v, th.ground); });
    }
    if (t === TILE.BRICK) {
      if (th.id === 'forest') {
        const top = !W.isSolid(lv, tx, ty - 1);
        return this.sprite('stone' + (top ? 1 : 0), 32, 32, function (c) { drawStone(c, top); });
      }
      return this.sprite('brick', 32, 32, drawBrick);
    }
    if (t === TILE.ONEWAY) {
      let mask = 0;
      if (W.tileAt(lv, tx - 1, ty) !== TILE.ONEWAY) mask |= 1;
      if (W.tileAt(lv, tx + 1, ty) !== TILE.ONEWAY) mask |= 2;
      return this.sprite(th.id + 'plank' + mask, 32, 32, function (c) { drawPlank(c, mask, th.plank); });
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
    if (this.theme.id === 'castle') {
      // ปราสาท: ผนังไกลมีหน้าต่างโค้งรับแสงจันทร์ + แนวเสาหินและธงใกล้ ๆ
      this.layers = {
        far: mk(1024, 320, function (c, w, h) {
          c.fillStyle = '#231c2e';
          c.fillRect(0, 0, w, h);
          c.fillStyle = 'rgba(255,255,255,0.03)';
          for (let y = 8; y < h; y += 22) c.fillRect(0, y, w, 1);
          for (let i = 0; i < 4; i++) {
            const x = i * 256 + 128;
            // หน้าต่างโค้ง
            c.fillStyle = '#141a33';
            c.beginPath();
            c.moveTo(x - 30, 210); c.lineTo(x - 30, 120); c.arc(x, 120, 30, Math.PI, 0); c.lineTo(x + 30, 210);
            c.closePath(); c.fill();
            const gl = c.createLinearGradient(x, 90, x, 210);
            gl.addColorStop(0, 'rgba(140,170,255,0.45)');
            gl.addColorStop(1, 'rgba(90,110,200,0.12)');
            c.fillStyle = gl;
            c.fill();
            c.fillStyle = 'rgba(235,240,255,0.85)';
            ellipse(c, x + 10, 118, 9, 9); c.fill();
            c.fillStyle = '#231c2e';
            c.fillRect(x - 1.5, 90, 3, 120);
            c.fillRect(x - 30, 160, 60, 3);
            // เสาระหว่างหน้าต่าง
            const px = i * 256;
            c.fillStyle = '#1b1524';
            c.fillRect(px - 20, 0, 40, h);
            c.fillStyle = '#2b2338';
            c.fillRect(px - 26, 40, 52, 10);
            c.fillRect(px - 26, h - 30, 52, 30);
          }
          // โค้งเพดานระหว่างเสา
          c.fillStyle = '#1b1524';
          c.beginPath();
          c.moveTo(0, 0);
          for (let i = 0; i < 4; i++) {
            c.lineTo(i * 256, 70);
            c.quadraticCurveTo(i * 256 + 128, 6, i * 256 + 256, 70);
          }
          c.lineTo(w, 0);
          c.closePath();
          c.fill();
        }),
        near: mk(900, 260, function (c, w, h) {
          const r = rng(77);
          for (let i = 0; i < 3; i++) {
            const x = (i + 0.5) * (w / 3);
            c.fillStyle = '#16111e';
            c.fillRect(x - 26, 0, 52, h);
            c.fillStyle = '#211a2b';
            c.fillRect(x - 26, 0, 6, h);
            c.fillStyle = '#0f0b15';
            c.fillRect(x + 20, 0, 6, h);
            // ธงสีแดงห้อยข้างเสา
            const bx = x + 40 + r() * 30;
            c.fillStyle = '#6e1c2c';
            c.beginPath();
            c.moveTo(bx, 20); c.lineTo(bx + 34, 20); c.lineTo(bx + 34, 130); c.lineTo(bx + 17, 116); c.lineTo(bx, 130);
            c.closePath(); c.fill();
            c.fillStyle = '#c9a23a';
            c.fillRect(bx, 20, 34, 4);
            c.fillStyle = 'rgba(201,162,58,0.8)';
            ellipse(c, bx + 17, 64, 7, 9); c.fill();
            c.fillStyle = '#6e1c2c';
            ellipse(c, bx + 17, 64, 3.5, 5); c.fill();
          }
          c.fillStyle = '#16111e';
          c.fillRect(0, h - 26, w, 26);
        })
      };
      this.layers.far.fill = '#1b1524';
      this.layers.near.fill = '#16111e';
    } else if (this.theme.id === 'forest') {
      // ป่า: แนวยอดไม้ไกล ๆ + ลำต้นไม้ใหญ่ใกล้ ๆ
      this.layers = {
        far: mk(1024, 260, function (c, w, h) {
          const r = rng(31);
          const crowns = function (base, n, rmin, rmax, color) {
            c.fillStyle = color;
            for (let i = 0; i < n; i++) {
              const x = (i + r() * 0.6) * (w / n), rad = rmin + r() * (rmax - rmin);
              ellipse(c, x, base - r() * 26, rad, rad * 1.1); c.fill();
              ellipse(c, x + w, base - 10, rad, rad); c.fill(); // ต่อขอบให้วนซ้ำได้
              ellipse(c, x - w, base - 10, rad, rad); c.fill();
            }
            c.fillRect(0, base, w, h - base);
          };
          crowns(120, 26, 26, 40, '#5f9c78');
          crowns(170, 30, 22, 34, '#4b8a67');
        }),
        near: mk(900, 440, function (c, w, h) {
          const r = rng(57);
          // ลำต้นไม้
          for (let i = 0; i < 6; i++) {
            const x = (i + 0.2 + r() * 0.5) * (w / 6), tw = 18 + r() * 14;
            c.fillStyle = '#3d2c22';
            c.fillRect(x - tw / 2, 40, tw, h - 40);
            c.fillStyle = '#4e3a2c';
            c.fillRect(x - tw / 2 + 3, 40, 4, h - 40);
            c.fillStyle = 'rgba(0,0,0,0.18)';
            c.fillRect(x + tw / 2 - 5, 40, 5, h - 40);
          }
          // เรือนยอดด้านบน
          c.fillStyle = '#2c5e3e';
          for (let x = -20; x < w + 40; x += 34 + r() * 20) {
            ellipse(c, x, 18 + r() * 30, 40 + r() * 20, 30 + r() * 14); c.fill();
          }
          // พุ่มไม้ด้านล่าง
          ridge(c, w, h, 380, [[14, 5, 0.7], [7, 13, 1.9]], '#2f6e40');
          c.fillStyle = '#3b8048';
          for (let i = 0; i < 18; i++) {
            ellipse(c, r() * w, 388 + r() * 20, 16 + r() * 12, 10 + r() * 6); c.fill();
          }
          c.fillRect(0, 404, w, h - 404);
        })
      };
      this.layers.far.fill = '#4b8a67';
      this.layers.near.fill = '#3b8048';
    } else {
      this.layers = {
        far: mk(1024, 240, function (c, w, h) {
          ridge(c, w, h, 120, [[46, 3, 0.4], [22, 7, 1.3], [10, 13, 2]], '#b9def3');
          ridge(c, w, h, 160, [[38, 4, 2.1], [16, 9, 0.2], [7, 17, 1]], '#9fcfea');
        }),
        near: mk(768, 170, function (c, w, h) {
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
      this.layers.far.fill = '#9fcfea';
      this.layers.near.fill = '#7cc775';
    }
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
    const sky = this.theme.sky;
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(0.6, sky[1]);
    grad.addColorStop(1, sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);
    if (this.theme.id === 'forest') { this.drawForestSky(time); return; }
    if (this.theme.id === 'castle') { this.drawCastleSky(time); return; }

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

  /** ท้องฟ้าในป่า: ลำแสงส่องลงมา + ใบไม้ปลิวช้า ๆ */
  Renderer.prototype.drawForestSky = function (time) {
    const ctx = this.ctx, vw = this.viewW, vh = this.viewH;
    const period = 1400;
    for (let i = 0; i < 5; i++) {
      let x = (i * 300 + 120 - this.cx * 0.05) % period;
      if (x < 0) x += period;
      x -= 200;
      const a = 0.07 + 0.03 * Math.sin(time * 0.6 + i * 1.7);
      ctx.fillStyle = 'rgba(255,248,200,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x + 46, -10);
      ctx.lineTo(x + 170, vh);
      ctx.lineTo(x + 60, vh);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i];
      let x = (cl.x - this.cx * 0.1 + time * cl.v * 2) % 2400;
      if (x < 0) x += 2400;
      x -= 200;
      if (x > vw + 50) continue;
      const y = ((cl.y * 2 + time * (12 + cl.v)) % (vh + 40)) - 20;
      ctx.save();
      ctx.translate(x + Math.sin(time * 1.3 + i) * 12, y);
      ctx.rotate(Math.sin(time * 2 + i) * 0.8);
      ctx.fillStyle = i % 3 ? 'rgba(160,210,110,0.85)' : 'rgba(230,190,90,0.85)';
      ellipse(ctx, 0, 0, 4.5 * cl.s, 2.2 * cl.s); ctx.fill();
      ctx.restore();
    }
  };

  /** ในปราสาท: ฝุ่นลอยช้า ๆ ในแสงจันทร์ */
  Renderer.prototype.drawCastleSky = function (time) {
    const ctx = this.ctx, vw = this.viewW, vh = this.viewH;
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i];
      let x = (cl.x - this.cx * 0.15 + time * cl.v) % 2400;
      if (x < 0) x += 2400;
      x -= 200;
      if (x > vw + 20) continue;
      const y = (cl.y * 2 + Math.sin(time * 0.5 + i) * 20) % vh;
      ctx.fillStyle = 'rgba(200,190,230,' + (0.12 + 0.08 * Math.sin(time + i)).toFixed(3) + ')';
      ellipse(ctx, x, y, 1.6 * cl.s, 1.6 * cl.s); ctx.fill();
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
      ctx.fillStyle = layer.fill;
      ctx.fillRect(0, base - 0.5, this.viewW, this.viewH - base + 1);
    }
  };

  // ── ด่าน: ของตกแต่ง, มินิแมพ ──────────────────────────────────
  /** theme = id ใน THEMES (ไม่ใส่ = grassland) เปลี่ยนธีมแล้วสร้างภาพพื้นและฉากหลังใหม่ */
  Renderer.prototype.setLevel = function (lv, theme) {
    this.level = lv;
    const th = THEMES[theme] || THEMES.grassland;
    if (th !== this.theme) {
      this.theme = th;
      this.layers = null;
    }
    const forest = th.id === 'forest';
    const castle = th.id === 'castle';
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
        if (castle) {
          // ปราสาท: คบเพลิงบนผนัง ธง กระดูก เศษหิน
          if (r < 10 && flat && room >= 4 && !busy.has(tx)) decor.push({ k: 'torch', x: x, y: y, back: true });
          else if (r < 15 && flat && room >= 4) decor.push({ k: 'chain', x: x, y: y, back: true });
          else if (r < 22) decor.push({ k: 'bones', x: x - 6 + (r % 12), y: y });
          else if (r < 36) decor.push({ k: 'rubble', x: x - 8 + (r % 16), y: y });
          continue;
        }
        if (forest) {
          // ป่า: ต้นไม้ใหญ่ เฟิร์น เห็ด ตอไม้ หินมอส
          if (r < 11 && flat && room >= 4 && !busy.has(tx)) decor.push({ k: 'oak', x: x, y: y, s: 0.9 + (r % 4) * 0.08, back: true });
          else if (r < 24 && flat) decor.push({ k: 'fern', x: x, y: y, s: 0.8 + (r % 3) * 0.15, back: true });
          else if (r < 33) decor.push({ k: 'shroom', x: x - 8 + (r % 16), y: y, c: r % 2 ? '#e8503a' : '#c98b55' });
          else if (r < 52) decor.push({ k: 'tuft', x: x - 6 + (r % 12), y: y });
          else if (r < 56 && flat) decor.push({ k: 'stump', x: x, y: y, back: true });
          else if (r < 60) decor.push({ k: 'rock', x: x, y: y, back: true, moss: true });
          continue;
        }
        if (r < 8 && flat && room >= 4 && !busy.has(tx)) decor.push({ k: 'tree', x: x, y: y, s: 0.85 + (r % 4) * 0.08, back: true });
        else if (r < 18 && flat) decor.push({ k: 'bush', x: x, y: y, s: 0.8 + (r % 3) * 0.15, back: true });
        else if (r < 38) decor.push({ k: 'flower', x: x - 8 + (r % 16), y: y, c: ['#ff6b8b', '#ffd23f', '#ffffff', '#b07cff'][r % 4] });
        else if (r < 62) decor.push({ k: 'tuft', x: x - 6 + (r % 12), y: y });
        else if (r < 66) decor.push({ k: 'rock', x: x, y: y, back: true });
      }
    }
    if (lv.start) decor.push({ k: 'sign', x: (lv.start.tx + 3) * T + 16, y: (lv.start.ty + 1) * T, back: true });
    if (lv.boss) {
      // บัลลังก์ด้านหลังบอส
      decor.push({ k: 'throne', x: (lv.boss.tx + 1.5) * T, y: (lv.boss.ty + 1) * T, back: true });
    }
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
          if (d.moss) { ctx.fillStyle = '#4f9a45'; ellipse(ctx, d.x + 1, d.y - 8, 6, 2.4); ctx.fill(); }
          break;
        case 'oak': {
          // ต้นไม้ใหญ่ในป่า: ลำต้นหนา รากแผ่ เรือนยอดเข้มหลายชั้น
          const s = d.s;
          ctx.fillStyle = '#4a3324';
          ctx.beginPath();
          ctx.moveTo(d.x - 14 * s, d.y); ctx.quadraticCurveTo(d.x - 6 * s, d.y - 6 * s, d.x - 6 * s, d.y - 70 * s);
          ctx.lineTo(d.x + 6 * s, d.y - 70 * s); ctx.quadraticCurveTo(d.x + 6 * s, d.y - 6 * s, d.x + 14 * s, d.y);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#5e4330';
          ctx.fillRect(d.x - 3 * s, d.y - 66 * s, 3 * s, 58 * s);
          ctx.fillStyle = '#245a34';
          ellipse(ctx, d.x, d.y - 86 * s, 34 * s, 26 * s); ctx.fill();
          ctx.fillStyle = '#2f7040';
          ellipse(ctx, d.x - 14 * s, d.y - 92 * s, 20 * s, 17 * s); ctx.fill();
          ellipse(ctx, d.x + 14 * s, d.y - 80 * s, 20 * s, 15 * s); ctx.fill();
          ctx.fillStyle = 'rgba(200,240,150,0.18)';
          ellipse(ctx, d.x - 16 * s, d.y - 99 * s, 9 * s, 6 * s); ctx.fill();
          break;
        }
        case 'fern': {
          const s = d.s;
          ctx.strokeStyle = '#2f7a35'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.quadraticCurveTo(d.x + k * 5 * s, d.y - 14 * s, d.x + k * 9 * s, d.y - (12 - Math.abs(k) * 3) * s);
            ctx.stroke();
          }
          ctx.strokeStyle = '#4f9a45'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.quadraticCurveTo(d.x + 2 * s, d.y - 12 * s, d.x + 4 * s, d.y - 15 * s); ctx.stroke();
          break;
        }
        case 'shroom':
          ctx.fillStyle = '#f2e6cf';
          ctx.fillRect(d.x - 1.5, d.y - 6, 3, 6);
          ctx.fillStyle = d.c;
          ctx.beginPath(); ctx.moveTo(d.x - 6, d.y - 5); ctx.quadraticCurveTo(d.x, d.y - 14, d.x + 6, d.y - 5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ellipse(ctx, d.x - 2, d.y - 8, 1.3, 1.1); ctx.fill();
          ellipse(ctx, d.x + 2.5, d.y - 7, 1, 0.9); ctx.fill();
          break;
        case 'stump':
          ctx.fillStyle = '#5a3d28';
          rr(ctx, d.x - 10, d.y - 12, 20, 12, 3); ctx.fill();
          ctx.fillStyle = '#c9a171';
          ellipse(ctx, d.x, d.y - 12, 10, 3.2); ctx.fill();
          ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 1;
          ellipse(ctx, d.x, d.y - 12, 5, 1.6); ctx.stroke();
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
        case 'torch': {
          // คบเพลิงติดผนัง เปลวไฟสั่นไหว + แสงเรือง
          const ty = d.y - 70, fl = Math.sin(time * 13 + d.x) * 1.2 + Math.sin(time * 7.3 + d.x * 0.3);
          const glow = ctx.createRadialGradient(d.x, ty - 8, 2, d.x, ty - 8, 50);
          glow.addColorStop(0, 'rgba(255,170,80,' + (0.3 + 0.06 * Math.sin(time * 9 + d.x)).toFixed(3) + ')');
          glow.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = glow;
          ellipse(ctx, d.x, ty - 8, 50, 50); ctx.fill();
          ctx.fillStyle = '#4a4552';
          ctx.fillRect(d.x - 6, ty + 10, 12, 4);
          ctx.fillRect(d.x - 2, ty + 4, 4, 14);
          ctx.fillStyle = '#6b4a2c';
          ctx.beginPath(); ctx.moveTo(d.x - 5, ty - 2); ctx.lineTo(d.x + 5, ty - 2); ctx.lineTo(d.x + 2, ty + 8); ctx.lineTo(d.x - 2, ty + 8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ff7a1a';
          ctx.beginPath(); ctx.moveTo(d.x - 6, ty - 2); ctx.quadraticCurveTo(d.x - 5 + fl, ty - 14, d.x + fl * 0.6, ty - 20 - fl); ctx.quadraticCurveTo(d.x + 6 + fl, ty - 10, d.x + 6, ty - 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffd36a';
          ctx.beginPath(); ctx.moveTo(d.x - 3, ty - 2); ctx.quadraticCurveTo(d.x - 2 + fl * 0.5, ty - 9, d.x + fl * 0.4, ty - 13 - fl * 0.5); ctx.quadraticCurveTo(d.x + 3 + fl * 0.5, ty - 7, d.x + 3, ty - 2); ctx.closePath(); ctx.fill();
          break;
        }
        case 'chain': {
          // โซ่ห้อยจากที่สูง
          ctx.strokeStyle = '#5c5868'; ctx.lineWidth = 2;
          const top = d.y - 150, sw = Math.sin(time * 1.2 + d.x) * 1.5;
          for (let yy = top; yy < d.y - 60; yy += 7) {
            ellipse(ctx, d.x + sw * (yy - top) / 90, yy, 2.4, 4); ctx.stroke();
          }
          ctx.fillStyle = '#5c5868';
          ctx.fillRect(d.x + sw - 5, d.y - 60, 10, 3);
          break;
        }
        case 'bones':
          ctx.fillStyle = '#e8e0cf';
          ellipse(ctx, d.x, d.y - 4, 4.5, 4); ctx.fill();
          ctx.fillRect(d.x - 3, d.y - 2, 6, 2);
          ctx.fillStyle = '#2a2433';
          ellipse(ctx, d.x - 1.6, d.y - 4.5, 1, 1.2); ctx.fill();
          ellipse(ctx, d.x + 1.6, d.y - 4.5, 1, 1.2); ctx.fill();
          ctx.strokeStyle = '#d6cdb9'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(d.x + 6, d.y - 1); ctx.lineTo(d.x + 13, d.y - 3); ctx.stroke();
          break;
        case 'rubble':
          ctx.fillStyle = '#5f566e';
          ellipse(ctx, d.x, d.y - 2, 5, 3); ctx.fill();
          ellipse(ctx, d.x + 6, d.y - 1.5, 3, 2); ctx.fill();
          ctx.fillStyle = '#7d738d';
          ellipse(ctx, d.x - 1, d.y - 3, 2.4, 1.3); ctx.fill();
          break;
        case 'throne': {
          // บัลลังก์หินขนาดใหญ่ของบอส
          ctx.fillStyle = '#2b2236';
          ctx.fillRect(d.x - 40, d.y - 150, 80, 150);
          ctx.fillStyle = '#3a2f48';
          ctx.fillRect(d.x - 34, d.y - 144, 68, 100);
          ctx.fillStyle = '#6e1c2c';
          ctx.fillRect(d.x - 26, d.y - 136, 52, 92);
          ctx.fillStyle = '#c9a23a';
          ctx.beginPath(); ctx.moveTo(d.x - 44, d.y - 150); ctx.lineTo(d.x - 32, d.y - 172); ctx.lineTo(d.x - 20, d.y - 150);
          ctx.moveTo(d.x - 12, d.y - 150); ctx.lineTo(d.x, d.y - 180); ctx.lineTo(d.x + 12, d.y - 150);
          ctx.moveTo(d.x + 20, d.y - 150); ctx.lineTo(d.x + 32, d.y - 172); ctx.lineTo(d.x + 44, d.y - 150); ctx.fill();
          ctx.fillRect(d.x - 44, d.y - 152, 88, 5);
          break;
        }
        case 'tuft':
          ctx.strokeStyle = this.theme.tuft; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
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
    this.drawLayer(this.layers.far, 0.12, 0.25, 30);
    this.drawLayer(this.layers.near, 0.3, 0.45, 40);

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
    for (let i = 0; i < g.items.length; i++) if (!g.items[i].taken) this.drawItem(g.items[i], time);
    for (let i = 0; i < g.lv.platforms.length; i++) this.drawPlatform(g.lv.platforms[i]);
    for (let i = 0; i < g.enemies.length; i++) this.drawEnemy(g.enemies[i], time);
    if (g.spawners) {
      for (let i = 0; i < g.spawners.length; i++) this.drawSpawner(g.spawners[i], time);
      for (let i = 0; i < g.rocks.length; i++) this.drawRock(g.rocks[i]);
    }
    if (g.boss) this.drawBoss(g.boss, time);
    if (g.deathAnim) this.drawHero(g.deathAnim, g, time, true);
    else if (!(g.player.invuln > 0 && Math.floor(time * 18) % 2 === 0)) this.drawHero(g.player, g, time, false);
    if (g.shots) {
      for (let i = 0; i < g.shots.length; i++) this.drawShot(g.shots[i], time);
      for (let i = 0; i < g.fires.length; i++) this.drawShot(g.fires[i], time);
    }
    this.drawParticles(g.particles);

    ctx.setTransform(S, 0, 0, S, 0, 0);
    if (g.flash > 0) {
      ctx.fillStyle = 'rgba(255,80,80,' + (g.flash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (g.showMinimap) {
      this.drawMinimap(g, time);
      this.drawHud(g, time);
    }
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
    if (c.hidden) return;
    let x = c.x, y = c.y;
    if (c.pop && c.pop.t < 0.6) {
      // เหรียญจากบอส: กระเด็นเป็นวงโค้งจากตัวบอสไปยังที่วาง
      const k = c.pop.t / 0.6;
      x = c.pop.x0 + (c.x - c.pop.x0) * k;
      y = c.pop.y0 + (c.y - c.pop.y0) * k - Math.sin(k * Math.PI) * 70;
    }
    if (x + 20 < this.cx || x - 20 > this.cx + this.viewW) return;
    const bob = Math.sin(time * 3 + c.phase) * 2.2;
    const spin = Math.cos(time * 3.4 + c.phase);
    const sx = Math.max(0.14, Math.abs(spin));
    ctx.save();
    ctx.translate(x, y + bob);
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

  // ── Boss Stage ──────────────────────────────────────────────
  /** หินที่ติดอยู่บนเพดาน: สั่นและมีฝุ่นร่วงก่อนหล่น หายไปครู่หนึ่งหลังหล่น */
  Renderer.prototype.drawSpawner = function (sp, time) {
    const ctx = this.ctx;
    if (sp.x + 30 < this.cx || sp.x - 30 > this.cx + this.viewW) return;
    // รอยร้าวบนเพดาน
    ctx.strokeStyle = 'rgba(10,6,16,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sp.x - 16, sp.y - 1); ctx.lineTo(sp.x - 8, sp.y - 7); ctx.lineTo(sp.x - 2, sp.y - 3); ctx.lineTo(sp.x + 6, sp.y - 9); ctx.lineTo(sp.x + 15, sp.y - 2);
    ctx.stroke();
    if (sp.since < 0.5) return; // เพิ่งหล่นไป
    const jx = sp.warn ? Math.sin(time * 60) * 1.6 : 0;
    const grow = Math.min(1, (sp.since - 0.5) / 0.4);
    ctx.save();
    ctx.translate(sp.x + jx, sp.y);
    ctx.scale(grow, grow);
    this.rockShape(11, sp.warn);
    ctx.restore();
  };

  Renderer.prototype.rockShape = function (r, hot) {
    const ctx = this.ctx;
    ctx.fillStyle = hot ? '#8f7f8f' : '#6f667e';
    ctx.strokeStyle = '#2a2433'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r, -2); ctx.lineTo(-r * 0.6, -r); ctx.lineTo(r * 0.5, -r * 0.9); ctx.lineTo(r, -1); ctx.lineTo(r * 0.7, r * 0.8); ctx.lineTo(-r * 0.5, r);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.6); ctx.lineTo(r * 0.3, -r * 0.65); ctx.lineTo(-r * 0.1, -r * 0.2); ctx.closePath(); ctx.fill();
  };

  Renderer.prototype.drawRock = function (rk) {
    const ctx = this.ctx;
    if (rk.x + 30 < this.cx || rk.x - 30 > this.cx + this.viewW) return;
    ctx.save();
    ctx.translate(rk.x + rk.w / 2, rk.y + rk.h / 2);
    ctx.rotate(rk.rot);
    this.rockShape(rk.w / 2, false);
    ctx.restore();
  };

  /** กระสุน: light (Bobo), wind (Mew), fire (Aclaire), boss (ลูกไฟของบอส) */
  Renderer.prototype.drawShot = function (s, time) {
    const ctx = this.ctx;
    if (s.x + 30 < this.cx || s.x - 30 > this.cx + this.viewW) return;
    const r = s.r, dir = s.vx < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.kind === 'light') {
      ctx.fillStyle = 'rgba(255,250,190,0.35)';
      ellipse(ctx, 0, 0, r * 2.2, r * 2.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,150,0.5)';
      ellipse(ctx, -dir * r * 1.4, 0, r * 1.3, r * 0.8); ctx.fill();
      ctx.fillStyle = '#fff6b0';
      ellipse(ctx, 0, 0, r, r); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ellipse(ctx, 0, 0, r * 0.55, r * 0.55); ctx.fill();
    } else if (s.kind === 'wind') {
      ctx.scale(dir, 1);
      ctx.rotate(Math.sin(time * 30 + s.x * 0.05) * 0.08);
      ctx.fillStyle = 'rgba(125,255,154,0.25)';
      ellipse(ctx, -r, 0, r * 2.6, r * 1.3); ctx.fill();
      ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-r * 0.6, 0, r * 1.2, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#d6ffe0'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-r * 1.6, 0, r * 0.9, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(125,255,154,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-r * 4, -r * 0.5); ctx.lineTo(-r * 1.5, -r * 0.5); ctx.moveTo(-r * 4.5, r * 0.5); ctx.lineTo(-r * 2, r * 0.5); ctx.stroke();
    } else {
      // ลูกไฟ (Aclaire สีส้มทอง / บอสสีแดงเข้ม ใหญ่กว่า)
      const boss = s.kind === 'boss';
      const fl = 1 + Math.sin(time * 40 + s.y) * 0.1;
      const ang = Math.atan2(s.vy, s.vx);
      ctx.rotate(ang);
      ctx.fillStyle = boss ? 'rgba(255,60,30,0.3)' : 'rgba(255,140,40,0.3)';
      ellipse(ctx, -r * 0.6, 0, r * 2.2 * fl, r * 1.7 * fl); ctx.fill();
      ctx.fillStyle = boss ? '#c8261a' : '#ff6a1a';
      ctx.beginPath();
      ctx.moveTo(-r * 2.6 * fl, 0); ctx.quadraticCurveTo(-r, -r * 1.1, 0, -r); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(-r, r * 1.1, -r * 2.6 * fl, 0);
      ctx.fill();
      ctx.fillStyle = boss ? '#ff8a2a' : '#ffb03a';
      ellipse(ctx, 0, 0, r * 0.7, r * 0.7); ctx.fill();
      ctx.fillStyle = boss ? '#ffe680' : '#fff2b0';
      ellipse(ctx, r * 0.15, 0, r * 0.35, r * 0.35); ctx.fill();
    }
    ctx.restore();
  };

  /**
   * บอสเต่าปีศาจ: กระดองหนามสีม่วง หัวมีเขา ตาเรืองแสง
   * sleep = หลับ (มี Z ลอย), windT > 0 = อ้าปากมีไฟเรือง, โกรธ (พลังเหลือไม่ถึงครึ่ง) = ตัวแดงขึ้น, flash = โดนยิง
   */
  Renderer.prototype.drawBoss = function (b, time) {
    const ctx = this.ctx;
    if (b.x + b.w + 60 < this.cx || b.x - 60 > this.cx + this.viewW) return;
    if (b.dead && b.deadT > 1.6) return;
    const angry = b.hp <= b.hpMax / 2;
    const white = b.flash > 0 || (b.dead && Math.floor(b.deadT * 14) % 2 === 0);
    const C = white ? {
      skin: '#ffffff', skinD: '#f0e8f4', shell: '#ffffff', shellD: '#f2ecf6', rim: '#ffffff', spike: '#ffffff', horn: '#ffffff', line: '#d8cce0'
    } : {
      skin: angry ? '#7d6a3a' : '#6b7d3f', skinD: angry ? '#5a4a26' : '#4c5a2b',
      shell: angry ? '#6a2a44' : '#4a2f5c', shellD: angry ? '#4a1a2e' : '#331f42',
      rim: '#8a5a30', spike: '#ece2cc', horn: '#b8302a', line: '#1c1210'
    };
    let cx = b.x + b.w / 2;
    const by = b.y + b.h;
    if (b.dead) cx += Math.sin(time * 70) * 2;
    ctx.save();
    if (b.dead && b.deadT > 1.0) ctx.globalAlpha = Math.max(0, 1 - (b.deadT - 1.0) / 0.6);
    ctx.translate(cx, by + (b.dead ? Math.max(0, b.deadT - 0.8) * 20 : 0));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(ctx, 0, 0, 50, 6); ctx.fill();
    ctx.scale(b.face < 0 ? -1 : 1, 1);
    const sleep = b.state === 'sleep';
    const ph = b.walk * 0.09;
    const breath = sleep ? Math.sin(time * 2) * 1.5 : Math.sin(time * 4) * 0.8;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = C.line;
    ctx.lineJoin = 'round';
    // หาง
    ctx.fillStyle = C.skinD;
    ctx.beginPath(); ctx.moveTo(-36, -18); ctx.lineTo(-54, -10); ctx.lineTo(-36, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // ขา 4 ข้าง
    [-28, -12, 12, 28].forEach(function (lx, i) {
      const lift = sleep ? 0 : Math.max(0, Math.sin(ph + (i % 2) * Math.PI)) * 4;
      ctx.fillStyle = i % 2 ? C.skin : C.skinD;
      rr(ctx, lx - 7, -20 - lift, 14, 20, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.spike;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(lx + k * 4 - 2, -lift); ctx.lineTo(lx + k * 4, 3 - lift); ctx.lineTo(lx + k * 4 + 2, -lift); ctx.closePath(); ctx.fill();
      }
    });
    ctx.translate(0, breath);
    // กระดอง
    ctx.fillStyle = C.rim;
    ellipse(ctx, -4, -22, 44, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.shell;
    ctx.beginPath();
    ctx.moveTo(-46, -22);
    ctx.bezierCurveTo(-46, -78, 38, -78, 38, -22);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ลายกระดองหกเหลี่ยม
    ctx.strokeStyle = C.shellD; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -24); ctx.lineTo(-20, -44); ctx.lineTo(-4, -52); ctx.lineTo(12, -44); ctx.lineTo(18, -24);
    ctx.moveTo(-20, -44); ctx.lineTo(-36, -40);
    ctx.moveTo(-4, -52); ctx.lineTo(-4, -64);
    ctx.moveTo(12, -44); ctx.lineTo(28, -40);
    ctx.moveTo(-26, -24); ctx.lineTo(-4, -32); ctx.lineTo(18, -24);
    ctx.stroke();
    // หนามบนกระดอง
    ctx.fillStyle = C.spike; ctx.strokeStyle = C.line; ctx.lineWidth = 1.6;
    [[-34, -46, -0.6], [-18, -60, -0.25], [-2, -66, 0], [14, -60, 0.25], [28, -48, 0.6]].forEach(function (sp) {
      ctx.save(); ctx.translate(sp[0], sp[1]); ctx.rotate(sp[2]);
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(0, -12); ctx.lineTo(5, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    // คอและหัว
    const open = b.windT > 0 ? Math.min(1, (0.6 - b.windT) / 0.25) : 0;
    const hy = sleep ? -24 : -38;
    ctx.lineWidth = 2.2;
    ctx.fillStyle = C.skinD;
    rr(ctx, 26, hy - 2, 18, 22, 6); ctx.fill(); ctx.stroke();
    // เขา
    ctx.fillStyle = C.horn;
    ctx.beginPath(); ctx.moveTo(38, hy - 10); ctx.quadraticCurveTo(30, hy - 30, 18, hy - 32); ctx.quadraticCurveTo(28, hy - 22, 32, hy - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(48, hy - 12); ctx.quadraticCurveTo(46, hy - 30, 38, hy - 36); ctx.quadraticCurveTo(42, hy - 24, 42, hy - 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // กรามล่าง (อ้าตอนพ่นไฟ)
    ctx.save();
    ctx.translate(40, hy + 6);
    ctx.rotate(open * 0.5);
    ctx.fillStyle = C.skinD;
    rr(ctx, -4, -2, 22, 9, 4); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (open > 0 && !white) {
      ctx.fillStyle = 'rgba(255,140,40,' + (0.5 + 0.3 * Math.sin(time * 40)).toFixed(3) + ')';
      ellipse(ctx, 52, hy + 8, 6 + open * 6, 4 + open * 5); ctx.fill();
    }
    // หัว
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.moveTo(30, hy + 6);
    ctx.bezierCurveTo(28, hy - 14, 56, hy - 16, 60, hy + 2);
    ctx.lineTo(56, hy + 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ฟัน
    ctx.fillStyle = C.spike;
    ctx.beginPath(); ctx.moveTo(48, hy + 6); ctx.lineTo(50, hy + 11); ctx.lineTo(52, hy + 6); ctx.moveTo(54, hy + 6); ctx.lineTo(55.5, hy + 10); ctx.lineTo(57, hy + 6); ctx.fill();
    // ตา
    if (sleep) {
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(40, hy - 4); ctx.quadraticCurveTo(44, hy - 1, 48, hy - 4); ctx.stroke();
    } else {
      ctx.fillStyle = white ? '#ffffff' : '#ffe14d';
      ellipse(ctx, 45, hy - 4, 5, 4); ctx.fill();
      ctx.fillStyle = white ? '#ffffff' : angry ? '#ff1a1a' : '#d81b1b';
      ellipse(ctx, 46.5, hy - 3.5, 2, 2.6); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(38, hy - 11); ctx.lineTo(51, hy - 6); ctx.stroke();
    }
    ctx.restore();
    if (sleep) {
      // Z ลอยขึ้น
      ctx.fillStyle = 'rgba(230,220,255,0.85)';
      ctx.font = '800 14px Kanit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let k = 0; k < 3; k++) {
        const t = (time * 0.6 + k / 3) % 1;
        ctx.globalAlpha = Math.sin(t * Math.PI);
        ctx.fillText('Z', cx + b.face * 40 + t * 18 * b.face, by - 72 - t * 34);
      }
      ctx.globalAlpha = 1;
    }
  };

  Renderer.prototype.drawEnemy = function (e, time) {
    if (e.kind === 'boar') this.drawBoar(e, time);
    else this.drawSlime(e);
  };

  /** หมูป่า (หันไปทาง e.dir) ตอนสลบ: ตาเป็นก้นหอย มีดาวหมุนรอบหัว และสั่นในวินาทีสุดท้ายก่อนตื่น */
  Renderer.prototype.drawBoar = function (e, time) {
    const ctx = this.ctx;
    if (e.x + 50 < this.cx || e.x - 50 > this.cx + this.viewW) return;
    const stunned = e.stunT > 0;
    let cx = e.x + e.w / 2;
    const by = e.y + e.h;
    if (stunned && e.stunT < 1) cx += Math.sin(time * 70) * 1.2;
    ctx.save();
    ctx.translate(cx, by);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ellipse(ctx, 0, 0, 15, 2.6); ctx.fill();
    ctx.scale(e.dir < 0 ? -1 : 1, 1);
    const ph = (e.walk || 0) * 0.22;
    const bob = stunned ? 0 : Math.abs(Math.sin(ph)) * -1.2;
    // ขา
    ctx.fillStyle = '#4a2c1a';
    [-9, -4, 4, 9].forEach(function (lx, i) {
      const lift = stunned ? 0 : Math.max(0, Math.sin(ph + (i % 2) * Math.PI)) * 2.2;
      ctx.fillRect(lx - 1.6, -6 - lift, 3.2, 6);
    });
    ctx.translate(0, bob);
    // หาง
    ctx.strokeStyle = '#5a3622'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-14, -12); ctx.quadraticCurveTo(-19, -14, -17, -17); ctx.stroke();
    // ลำตัว
    ctx.fillStyle = '#8a5a3c';
    ctx.strokeStyle = '#4a2c1a'; ctx.lineWidth = 1.6;
    ellipse(ctx, -1, -11, 15, 9.5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b07a52';
    ellipse(ctx, 0, -6.5, 10, 3.6); ctx.fill();
    // ขนแผงหลัง
    ctx.fillStyle = '#4a2c1a';
    ctx.beginPath();
    ctx.moveTo(-11, -17);
    for (let k = 0; k < 6; k++) { ctx.lineTo(-9 + k * 3.4, -23 + (k % 2) * 2); ctx.lineTo(-7.5 + k * 3.4, -19); }
    ctx.lineTo(9, -18); ctx.closePath(); ctx.fill();
    // หัว
    ctx.fillStyle = '#8a5a3c';
    ellipse(ctx, 11, -12, 8, 7.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6e442b';
    ctx.beginPath(); ctx.moveTo(6, -17); ctx.lineTo(8, -23); ctx.lineTo(11.5, -17.5); ctx.closePath(); ctx.fill();
    // จมูก + เขี้ยว
    ctx.fillStyle = '#e7a58a';
    rr(ctx, 15, -13, 6.5, 7, 2.5); ctx.fill();
    ctx.strokeStyle = '#4a2c1a'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#4a2c1a';
    ellipse(ctx, 19.2, -10.2, 0.9, 1.2); ctx.fill();
    ellipse(ctx, 17, -10.2, 0.9, 1.2); ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath(); ctx.moveTo(14.2, -6); ctx.quadraticCurveTo(16.4, -5, 17.2, -9.6); ctx.lineTo(16, -9.4); ctx.quadraticCurveTo(15.4, -7, 14, -7.4); ctx.closePath(); ctx.fill();
    // ตา
    if (stunned) {
      ctx.strokeStyle = '#2a170c'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const a = k * 0.75 + time * 8, rad = 0.4 + k * 0.17;
        const px = 11.5 + Math.cos(a) * rad, py = -14 + Math.sin(a) * rad;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ellipse(ctx, 12, -14, 2, 2); ctx.fill();
      ctx.fillStyle = '#2a170c';
      ellipse(ctx, 12.7, -13.8, 1.1, 1.2); ctx.fill();
      ctx.strokeStyle = '#2a170c'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(9.5, -17.5); ctx.lineTo(14, -16); ctx.stroke(); // คิ้วขมวด
    }
    ctx.restore();
    if (stunned) {
      // ดาวหมุนรอบหัว
      const hx = cx + (e.dir < 0 ? -9 : 9);
      for (let k = 0; k < 3; k++) {
        const a = time * 5 + k * (Math.PI * 2 / 3);
        const sx = hx + Math.cos(a) * 10, sy = by - 27 + Math.sin(a) * 3;
        ctx.fillStyle = Math.sin(a) > 0 ? '#ffe066' : '#fff6c4';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 3.2);
        ctx.quadraticCurveTo(sx, sy, sx + 3.2, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy + 3.2);
        ctx.quadraticCurveTo(sx, sy, sx - 3.2, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy - 3.2);
        ctx.fill();
      }
    }
  };

  Renderer.prototype.drawSlime = function (e) {
    const ctx = this.ctx;
    if (e.x + 40 < this.cx || e.x - 40 > this.cx + this.viewW) return;
    if (e.dead && e.deadT > 0.6) return;
    const cx = e.x + e.w / 2, by = e.y + e.h;
    let sx = 1 - Math.sin(e.t * 9) * 0.06, sy = 1 + Math.sin(e.t * 9) * 0.08;
    ctx.save();
    if (e.dead && e.knock) {
      // โดนดาวชน: กระเด็นหมุนตกจอ
      const t = e.deadT;
      ctx.globalAlpha = Math.max(0, 1 - t / 0.6);
      ctx.translate(cx + e.knock * 150 * t, by - 10 - 240 * t + 800 * t * t);
      ctx.rotate(e.knock * t * 10);
      ctx.translate(0, 10);
      sx = 1; sy = 1;
    } else {
      if (e.dead) {
        sx = 1.35; sy = 0.35;
        ctx.globalAlpha = Math.max(0, 1 - e.deadT / 0.6);
      }
      ctx.translate(cx, by);
    }
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

  // ── ตัวละคร (pixel art จาก js/sprites.js) ───────────────────────
  // เก็บ frame เป็น canvas 1 พิกเซลต่อ 1 art px แล้วขยายตอนวาดด้วยจำนวนเต็ม (this.pixel) ภาพจึงคมทุกจอ
  const heroCache = {};
  function heroFrame(id, pose, hue) {
    const key = id + '|' + pose + '|' + (hue == null ? '' : hue);
    let fr = heroCache[key];
    if (!fr) {
      const f = CQ.Sprites.build(id, pose, hue);
      const c = makeCanvas(f.w, f.h);
      CQ.Sprites.paint(c.getContext('2d'), f, 0, 0, 1);
      fr = heroCache[key] = { c: c, w: f.w, h: f.h, ax: f.ax };
    }
    return fr;
  }

  const wingCache = [];
  function wingFrame(i) {
    if (!wingCache[i]) {
      const f = CQ.Sprites.wing(i);
      const c = makeCanvas(f.w, f.h);
      CQ.Sprites.paint(c.getContext('2d'), f, 0, 0, 1);
      wingCache[i] = { c: c, w: f.w, h: f.h };
    }
    return wingCache[i];
  }

  /** เลือกท่าจากสถานะผู้เล่น */
  function heroPose(p, g, time, dead) {
    if (dead) return 'dead';
    if (p.floating) return 'jump'; // ลอยตัว (Mew): แขนชูขึ้น
    if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall';
    if (Math.abs(p.vx) > 25) {
      const TAU = Math.PI * 2;
      const a = (((g.runPhase || 0) % TAU) + TAU) % TAU;
      return 'run' + (1 + Math.floor(a / (Math.PI / 2)) % 4);
    }
    return (time % 3.3) < 0.12 ? 'blink' : 'idle';
  }

  /** สร้าง frame ของตัวละครไว้ล่วงหน้า กันภาพกระตุกตอนเปลี่ยนท่าครั้งแรก */
  Renderer.prototype.prepareHero = function (id) {
    Object.keys(CQ.Sprites.POSES).forEach(function (pose) { heroFrame(id, pose, null); });
  };

  Renderer.prototype.drawHero = function (p, g, time, dead) {
    const ctx = this.ctx, S = this.S, k = this.pixel;
    const pw = !dead && p.pw ? p.pw : null;
    const shown = function (t) { return t > 0 && (t > 2 || Math.floor(time * 8) % 2 === 0); }; // กะพริบช่วง 2 วินาทีสุดท้าย
    const f = p.face || 1;
    const sx = Math.round((p.x + p.w / 2 - this.cx) * S);
    let sy = Math.round((p.y + p.h - this.cy) * S);
    if (p.floating) sy -= (Math.floor(time * 6) % 2) * k; // ลอยตัว: ขยับขึ้นลง 1 พิกเซล
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    let hue = null;
    if (pw && shown(pw.star)) {
      hue = Math.floor(((time * 540) % 360) / 30) * 30; // ดาว: เสื้อเปลี่ยนสีรุ้ง
      ctx.fillStyle = 'hsla(' + ((hue + 60) % 360) + ',100%,70%,0.35)';
      ellipse(ctx, sx, sy - 17 * S, 19 * S, 21 * S); ctx.fill();
    }
    // ต่อจากนี้วาดในพิกัดที่หันขวาเสมอ แล้วกลับภาพตามทิศที่หัน
    ctx.translate(sx, 0);
    ctx.scale(f, 1);
    if (pw && shown(pw.mush) && Math.abs(p.vx) > 230) {
      // เห็ด: เส้นความเร็วแบบพิกเซลด้านหลังตัว
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 3; i++) {
        const off = Math.floor((time * 60 + i * 9) % 10), len = 6 + i * 2;
        ctx.fillRect((-13 - off - len) * k, sy - (28 - i * 8) * k, len * k, k);
      }
    }
    if (pw && shown(pw.wing)) {
      // ปีก: ต่อที่ไหล่ด้านหลัง กระพือเร็วตอนลอยกลางอากาศ
      const wf = wingFrame(p.onGround ? Math.floor(time * 2.5) % 2 : Math.floor(time * 14) % 2);
      ctx.drawImage(wf.c, (-3 - wf.w) * k, sy - 25 * k, wf.w * k, wf.h * k);
    }
    const fr = heroFrame(p.ch || 'bobo', heroPose(p, g, time, dead), hue);
    ctx.drawImage(fr.c, -fr.ax * k, sy - (fr.h - 1) * k, fr.w * k, fr.h * k);
    ctx.restore();
  };

  /** วาดตัวละครลง canvas ของหน้าเมนู (ขยายเป็นจำนวนเต็มเท่า ภาพคม) */
  CQ.drawCharPreview = function (canvas, id, time, running) {
    const cw = canvas.clientWidth, chh = canvas.clientHeight;
    if (!cw || !chh) return;
    const dpr = Math.min(root.devicePixelRatio || 1, 2);
    const W = Math.round(cw * dpr), H = Math.round(chh * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pose = running ? 'run' + (1 + Math.floor(time * 10) % 4) : ((time % 3.3) < 0.12 ? 'blink' : 'idle');
    const fr = heroFrame(id, pose, null);
    const k = Math.max(1, Math.floor(H * 0.8 / 40)); // ตัวละครสูงราว 40 พิกเซล
    const base = Math.round(H * 0.9);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(16,28,52,0.16)';
    ctx.fillRect(Math.round(W / 2 - 7 * k), base - k, 14 * k, 2 * k);
    ctx.drawImage(fr.c, Math.round(W / 2) - fr.ax * k, base - (fr.h - 1) * k, fr.w * k, fr.h * k);
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
      } else if (p.kind === 'feather') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ellipse(ctx, 0, 0, p.size, p.size * 0.38); ctx.fill();
        ctx.strokeStyle = 'rgba(127,184,230,0.8)';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke();
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
      if (c.taken || c.hidden) continue;
      ctx.fillStyle = '#ffd23f';
      ellipse(ctx, x + c.x * sx, y + c.y * sy, 2.2 * k * pulse, 2.2 * k * pulse);
      ctx.fill();
    }
    for (let i = 0; i < g.items.length; i++) {
      const it = g.items[i];
      if (it.taken) continue;
      const mx = x + it.x * sx, my = y + it.y * sy, r2 = 2.8 * k;
      ctx.fillStyle = it.type === 'star' ? '#ffffff' : POWER_COLOR[it.type];
      ctx.strokeStyle = 'rgba(16,28,52,0.9)';
      ctx.lineWidth = 1 * k;
      ctx.beginPath();
      ctx.moveTo(mx, my - r2); ctx.lineTo(mx + r2, my); ctx.lineTo(mx, my + r2); ctx.lineTo(mx - r2, my);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const b = g.boss;
    if (b && !b.dead) {
      // บอส: สี่เหลี่ยมสีแดง
      const bx = x + (b.x + b.w / 2) * sx, by = y + (b.y + b.h / 2) * sy, r3 = 3.4 * k;
      ctx.fillStyle = '#ff3b3b';
      ctx.strokeStyle = 'rgba(16,28,52,0.9)';
      ctx.lineWidth = 1 * k;
      ctx.fillRect(bx - r3, by - r3, r3 * 2, r3 * 2);
      ctx.strokeRect(bx - r3, by - r3, r3 * 2, r3 * 2);
    }
    const p = g.deathAnim || g.player;
    ctx.fillStyle = CQ.getCharacter(p.ch).color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2 * k;
    ellipse(ctx, x + (p.x + p.w / 2) * sx, y + clamp(p.y + p.h / 2, 0, lv.h * T) * sy, 3 * k, 3 * k);
    ctx.fill();
    ctx.stroke();
  };

  Renderer.prototype.drawItem = function (it, time) {
    const ctx = this.ctx;
    if (it.x + 30 < this.cx || it.x - 30 > this.cx + this.viewW) return;
    const bob = Math.sin(time * 2.6 + it.phase) * 3;
    const pulse = 0.8 + Math.sin(time * 5 + it.phase) * 0.2;
    ctx.save();
    ctx.translate(it.x, it.y + bob);
    ctx.fillStyle = 'rgba(' + ITEM_GLOW[it.type] + ',0.32)';
    ellipse(ctx, 0, 0, 17 * pulse, 17 * pulse); ctx.fill();
    ctx.fillStyle = 'rgba(' + ITEM_GLOW[it.type] + ',0.25)';
    ellipse(ctx, 0, 0, 11, 11); ctx.fill();
    drawItemIcon(ctx, it.type, time);
    ctx.restore();
  };

  /**
   * จัดตำแหน่ง HUD และมินิแมพ (เรียกจาก main.js ตอนเริ่มเกมและเมื่อขนาดจอเปลี่ยน)
   * o = { P: ขนาดพิกเซล HUD (device px), x, y: มุมซ้ายบน, right: ขอบซ้ายของปุ่ม, vw: ความกว้างจอ (css px), timed }
   */
  Renderer.prototype.layoutHud = function (o) {
    const d = this.dpr;
    const ratio = this.level ? (this.level.h / this.level.w) * 1.5 : 0.08;
    const L = CQ.HUD.layout({ P: o.P, ox: Math.round(o.x * d), oy: Math.round(o.y * d), right: o.right * d, vw: o.vw * d, timed: o.timed, ratio: ratio, dpr: d });
    this.hud = L;
    this.minimapRect = { x: L.minimap.x / d, y: L.minimap.y / d, w: L.minimap.w / d, h: L.minimap.h / d };
  };

  Renderer.prototype.drawHud = function (g, time) {
    if (!this.hud) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    CQ.HUD.draw(ctx, g, this.hud, time);
    ctx.restore();
  };

  CQ.Renderer = Renderer;
})(window);
