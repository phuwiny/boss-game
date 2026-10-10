/*
 * Coin Quest — ตัวสร้าง sprite ตัวละครแบบ pixel art (สไตล์ 16-bit)
 *
 * ไม่ใช้ไฟล์ภาพ: วาดรูปทรง (วงรี รูปหลายเหลี่ยม เส้นหนา) ลงตารางพิกเซล -> ลงเงา 3-4 ระดับตามทิศแสง (ซ้ายบน)
 * -> เส้นในระหว่างชิ้นส่วน -> เส้นขอบเข้มรอบตัว แล้ววางลายที่วาดมือ (ตา ปาก ปกเสื้อ) ทับ
 * พิกัดที่ส่งให้ฟังก์ชันวาดเป็นหน่วยของเกม: (0,0) = กึ่งกลางเท้า, y ติดลบขึ้นด้านบน
 * 1 พิกเซลของ sprite = UNIT หน่วยของเกม ตัวละครสูงราว 40 พิกเซล (hitbox ยังเป็น 20x28 เท่าเดิม)
 *
 * แก้หน้าตาตัวละครได้ที่ DEFS (สี = ชุดโทน l/b/s/d ของแต่ละส่วน) ไม่ยุ่งกับ DOM
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const UNIT = 0.85;

  const OUTLINE = '#2a1b30';
  const LIGHT = (function () { const v = [-0.5, -0.65, 0.58]; const l = Math.hypot(v[0], v[1], v[2]); return v.map(function (a) { return a / l; }); })();

  function Grid(w, h, unit, ax) {
    this.w = w; this.h = h; this.unit = unit; this.ax = ax;
    this.col = new Array(w * h).fill(null);
    this.z = new Array(w * h).fill(-1);
    this.part = new Array(w * h).fill(null);
    this.zc = 0;
    this.parts = {};
  }
  Grid.prototype.X = function (x) { return this.ax + x / this.unit; };
  Grid.prototype.Y = function (y) { return (this.h - 1) + y / this.unit; };
  /** จุดกลางของช่อง (cx, cy) เป็นพิกัดเกม */
  Grid.prototype.wx = function (cx) { return (cx + 0.5 - this.ax) * this.unit; };
  Grid.prototype.wy = function (cy) { return (cy + 0.5 - (this.h - 1)) * this.unit; };
  Grid.prototype.begin = function (name, opts) {
    this.zc++;
    this.cur = name;
    this.parts[name] = Object.assign({ z: this.zc }, opts || {});
  };
  Grid.prototype.set = function (x, y, color) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !color) return;
    const i = y * this.w + x;
    this.col[i] = color; this.part[i] = this.cur; this.z[i] = this.zc;
  };
  Grid.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.col[y * this.w + x];
  };
  Grid.prototype.partAt = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.part[y * this.w + x];
  };

  /** เลือกโทนสีจากความสว่าง  mat = { l: สว่าง, b: ปกติ, s: เงา, d: เงาเข้ม } */
  function tone(mat, I, th) {
    th = th || {};
    if (I > (th.l != null ? th.l : 0.8) && mat.l) return mat.l;
    if (I > (th.b != null ? th.b : 0.38)) return mat.b;
    if (I > (th.s != null ? th.s : 0.05) || !mat.d) return mat.s || mat.b;
    return mat.d;
  }
  function shadeN(nx, ny) {
    const d = nx * nx + ny * ny;
    const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, d)));
    return nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  }

  /** เติมพิกเซลตามเงื่อนไข inside(wx, wy) แล้วลงสีด้วย color(wx, wy, cx, cy) */
  Grid.prototype.fill = function (inside, color, clip) {
    for (let cy = 0; cy < this.h; cy++) {
      for (let cx = 0; cx < this.w; cx++) {
        const x = this.wx(cx), y = this.wy(cy);
        if (!inside(x, y)) continue;
        if (clip && !clip(x, y, cx, cy)) continue;
        this.set(cx, cy, color(x, y, cx, cy));
      }
    }
  };

  /** วงรี (หมุนได้) ลงเงาแบบทรงกลม  p = ความเหลี่ยม (2 = วงรี, >2 = สี่เหลี่ยมมุมมน) */
  Grid.prototype.ellipse = function (ex, ey, rx, ry, mat, o) {
    o = o || {};
    const rot = o.rot || 0, c = Math.cos(rot), s = Math.sin(rot), p = o.p || 2;
    const self = this;
    const local = function (x, y) {
      const dx = x - ex, dy = y - ey;
      return [(dx * c + dy * s) / rx, (-dx * s + dy * c) / ry];
    };
    this.fill(function (x, y) {
      const l = local(x, y);
      return Math.pow(Math.abs(l[0]), p) + Math.pow(Math.abs(l[1]), p) <= 1;
    }, function (x, y) {
      if (typeof mat === 'string') return mat;
      const l = local(x, y);
      return tone(mat, shadeN(l[0] * 0.95, l[1] * 0.95) + (o.bias || 0), o.th);
    }, o.clip);
    return self;
  };

  /** รูปหลายเหลี่ยม ลงเงาแบบทรงกระบอกแนวตั้ง (สว่างซ้าย เงาขวา) */
  Grid.prototype.poly = function (pts, mat, o) {
    o = o || {};
    const inside = function (x, y) {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    // หาขอบซ้าย/ขวาของแต่ละแถวเพื่อลงเงาทรงกระบอก
    const rows = {};
    for (let cy = 0; cy < this.h; cy++) {
      for (let cx = 0; cx < this.w; cx++) {
        if (!inside(this.wx(cx), this.wy(cy))) continue;
        const r = rows[cy] || (rows[cy] = [cx, cx]);
        r[0] = Math.min(r[0], cx); r[1] = Math.max(r[1], cx);
      }
    }
    let ymin = 1e9, ymax = -1e9;
    Object.keys(rows).forEach(function (k) { ymin = Math.min(ymin, +k); ymax = Math.max(ymax, +k); });
    this.fill(inside, function (x, y, cx, cy) {
      if (typeof mat === 'string') return mat;
      const r = rows[cy];
      const u = r[1] > r[0] ? ((cx - r[0]) / (r[1] - r[0])) * 2 - 1 : 0;
      const v = ymax > ymin ? ((cy - ymin) / (ymax - ymin)) * 2 - 1 : 0;
      return tone(mat, shadeN(u * 0.9, v * (o.vy != null ? o.vy : 0.35)) + (o.bias || 0), o.th);
    }, o.clip);
    return this;
  };

  /** เส้นหนาปลายมน (แขน ขา) ลงเงาตามแนวตั้งฉาก */
  Grid.prototype.capsule = function (x0, y0, x1, y1, r, mat, o) {
    o = o || {};
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
    const L = Math.sqrt(L2), px = -dy / L, py = dx / L;
    this.fill(function (x, y) {
      let t = ((x - x0) * dx + (y - y0) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      const qx = x0 + dx * t - x, qy = y0 + dy * t - y;
      return qx * qx + qy * qy <= r * r;
    }, function (x, y) {
      if (typeof mat === 'string') return mat;
      const u = ((x - x0) * px + (y - y0) * py) / r;
      const nx = px * u, ny = py * u;
      return tone(mat, shadeN(nx * 0.9, ny * 0.9) + (o.bias || 0), o.th);
    }, o.clip);
    return this;
  };

  /** วางลายพิกเซลวาดมือ (ตา ปาก) ที่ตำแหน่งช่อง (gx, gy) = มุมซ้ายบน */
  Grid.prototype.stamp = function (gx, gy, rows, map) {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const k = rows[r][c];
        if (k === '.' || k === ' ') continue;
        this.set(gx + c, gy + r, map[k]);
      }
    }
  };
  /** วางลายโดยให้จุด (wx, wy) เป็นกึ่งกลาง */
  Grid.prototype.stampAt = function (wx, wy, rows, map) {
    const gx = Math.round(this.X(wx) - rows[0].length / 2);
    const gy = Math.round(this.Y(wy) - rows.length / 2);
    this.stamp(gx, gy, rows, map);
  };

  /** แถบเงาวาวบนผม: ช่องของชิ้น part ที่อยู่ในวงแหวนรอบ (cx, cy) ด้านซ้ายบน */
  Grid.prototype.shine = function (part, cx, cy, r0, r1, a0, a1, color) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.partAt(x, y) !== part) continue;
        const dx = this.wx(x) - cx, dy = this.wy(y) - cy;
        const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        if (d >= r0 && d <= r1 && a >= a0 && a <= a1) this.col[y * this.w + x] = color;
      }
    }
  };

  /** เส้นในระหว่างชิ้นส่วน: ช่องของชิ้นที่ตั้ง line ซึ่งติดกับชิ้นที่อยู่ด้านหลัง จะเปลี่ยนเป็นสีเส้น */
  Grid.prototype.innerLines = function () {
    const out = this.col.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        const pn = this.part[i];
        const P = pn && this.parts[pn];
        if (!P || !P.line) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < 4; k++) {
          const xx = x + nb[k][0], yy = y + nb[k][1];
          if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
          const j = yy * this.w + xx;
          const qn = this.part[j];
          if (!qn || qn === pn) continue;
          if (P.lineSkip && P.lineSkip.indexOf(qn) >= 0) continue;
          if (this.z[j] < this.z[i]) { out[i] = P.line === true ? OUTLINE : P.line; break; }
        }
      }
    }
    this.col = out;
  };

  /** เส้นขอบด้านนอกรอบตัวละคร */
  Grid.prototype.outline = function () {
    const out = this.col.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.col[y * this.w + x]) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) out[y * this.w + x] = OUTLINE;
      }
    }
    this.col = out;
  };

  // ── ท่าทาง ─────────────────────────────────────────────────
  const POSES = {
    idle: { run: false, air: false, vy: 0, ph: 0, speed: 0, t: 1 },
    blink: { run: false, air: false, vy: 0, ph: 0, speed: 0, t: 1, blink: true },
    run1: { run: true, air: false, vy: 0, ph: 0, speed: 1, t: 1 },
    run2: { run: true, air: false, vy: 0, ph: Math.PI / 2, speed: 1, t: 1, bob: true },
    run3: { run: true, air: false, vy: 0, ph: Math.PI, speed: 1, t: 1 },
    run4: { run: true, air: false, vy: 0, ph: Math.PI * 1.5, speed: 1, t: 1, bob: true },
    jump: { run: false, air: true, vy: -500, ph: 0, speed: 0.7, t: 1 },
    fall: { run: false, air: true, vy: 500, ph: 0, speed: 0.7, t: 1 },
    dead: { run: false, air: false, vy: 0, ph: 0, speed: 0, t: 1, dead: true }
  };

  /** ตำแหน่งเท้า/มือ (หน่วยเกม) ตามท่า: back = ข้างหลัง, front = ข้างหน้า */
  function limbs(pose) {
    if (pose.run) {
      const a = pose.ph;
      const sw = function (k) { return Math.sin(a + k); };
      const lift = function (k) { return Math.max(0, Math.cos(a + k)); };
      return {
        footB: { x: sw(0) * 5.2 - 0.6, y: -1.2 - lift(0) * 3.4 },
        footF: { x: sw(Math.PI) * 5.2 + 0.6, y: -1.2 - lift(Math.PI) * 3.4 },
        handB: { x: -3.4 + sw(Math.PI) * 3.6, y: -9.8 + Math.abs(sw(Math.PI)) * 0.8 },
        handF: { x: 3.2 + sw(0) * 3.6, y: -9.8 + Math.abs(sw(0)) * 0.8 }
      };
    }
    if (pose.air && pose.vy < 0) return { footB: { x: -3, y: -2.5 }, footF: { x: 3.6, y: -5 }, handB: { x: -7, y: -18 }, handF: { x: 6.5, y: -19.5 } };
    if (pose.air) return { footB: { x: -4, y: -1.2 }, footF: { x: 4, y: -2.2 }, handB: { x: -8, y: -14.5 }, handF: { x: 7.6, y: -15 } };
    return { footB: { x: -2.6, y: -1.2 }, footF: { x: 2.8, y: -1.2 }, handB: { x: -4.6, y: -9.4 }, handF: { x: 4.4, y: -9.4 } };
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ── ลายตา (วาดมือ) ─────────────────────────────────────────
  function eyeStamps(iris, irisDark) {
    const map = { e: '#1f1530', g: iris, G: irisDark, w: '#ffffff', s: null };
    return {
      open: [['eee', 'eGw', 'GGg', 'ggg'], map],
      blink: [['...', '...', 'eee', '...'], map],
      dead: [['e.e', '.e.', 'e.e', '...'], map]
    };
  }

  // ── ตัวละคร ──────────────────────────────────────────────
  const MAT = {
    skin: { l: '#fff3e6', b: '#ffe0c8', s: '#f6b896', d: '#d98a6c' },
    skinBack: { b: '#f6c8a8', s: '#e2a483', d: '#c27a5e' }
  };

  function drawLegs(g, pose, L, o) {
    const hip = o.hipY;
    // ขาหลัง
    g.begin('legB', { line: true });
    g.capsule(-1.6, hip, L.footB.x, L.footB.y - 1.6, o.legR, o.legBack || o.leg);
    if (o.sock) g.capsule(L.footB.x, L.footB.y - 3.2, L.footB.x, L.footB.y - 1.4, o.legR + 0.05, o.sockBack || o.sock);
    g.ellipse(L.footB.x + 1.1, L.footB.y - 0.6, 3.1, 2, o.shoeBack || o.shoe, { p: 2.4 });
    // ขาหน้า
    g.begin('legF', { line: true });
    g.capsule(1.6, hip, L.footF.x, L.footF.y - 1.6, o.legR, o.leg);
    if (o.sock) g.capsule(L.footF.x, L.footF.y - 3.2, L.footF.x, L.footF.y - 1.4, o.legR + 0.05, o.sock);
    g.ellipse(L.footF.x + 1.1, L.footF.y - 0.6, 3.1, 2, o.shoe, { p: 2.4 });
  }

  function drawArm(g, name, hand, sleeveMat, skinMat, o) {
    o = o || {};
    const sx = o.sx != null ? o.sx : 0.6, sy = o.sy != null ? o.sy : -14.6;
    g.begin(name, { line: true, lineSkip: o.lineSkip });
    g.capsule(sx, sy, hand.x, hand.y, 1.45, skinMat);
    g.ellipse(hand.x, hand.y + 0.2, 1.7, 1.7, skinMat);
    const ang = Math.atan2(hand.y - sy, hand.x - sx);
    if (o.long) g.capsule(sx, sy, sx + Math.cos(ang) * 4.2, sy + Math.sin(ang) * 4.2, 2.1, sleeveMat);
    else g.ellipse(sx + Math.cos(ang) * 1.6, sy + Math.sin(ang) * 1.6, 2.7, 2.6, sleeveMat);
  }

  const DEFS = {
    // ─────────────── Bobo ───────────────
    bobo: function (g, pose, tint) {
      const body = tint.a;
      const band = { l: '#8db6ff', b: '#3a78ea', s: '#2a58c0', d: '#1d3f92' };
      const face = { l: '#fff1e0', b: '#ffd3ad', s: '#f2ae84', d: '#d98c66' };
      const feet = { l: '#8a4b33', b: '#5f2e1c', s: '#46200f', d: '#2f1408' };
      const L = (function () {
        if (pose.run) {
          const a = pose.ph;
          return [{ x: -4 + Math.sin(a) * 4.5, y: -3 - Math.max(0, Math.cos(a)) * 3 }, { x: 4 + Math.sin(a + Math.PI) * 4.5, y: -3 - Math.max(0, Math.cos(a + Math.PI)) * 3 }];
        }
        if (pose.air) return [{ x: -4, y: -4 }, { x: 6, y: -2.5 }];
        return [{ x: -5, y: -3 }, { x: 5, y: -3 }];
      })();
      const by = pose.bob ? -1 : 0;
      // ปลายผ้าคาดหัว
      const sp = pose.speed, sway = Math.sin(pose.t * 13) * (1 + sp * 1.5) * 0.5;
      g.begin('tails');
      g.capsule(-8, -20.5 + by, -(19 + sp * 5), -16 + sway + (1 - sp) * 5 + by, 1.5, band);
      g.capsule(-8, -19.5 + by, -(16.5 + sp * 4), -11 + sway * 0.8 + (1 - sp) * 4 + by, 1.5, band);
      g.begin('feet', { line: true });
      L.forEach(function (f) { g.ellipse(f.x, f.y, 4.6, 3, feet, { p: 2.2 }); });
      g.begin('body');
      const inBody = function (x, y) { const nx = x / 11, ny = (y + 15.5 - by) / 11.6; return Math.pow(Math.abs(nx), 2.6) + Math.pow(Math.abs(ny), 2.6) <= 1; };
      g.ellipse(0, -15.5 + by, 11, 11.6, body, { p: 2.6 });
      g.begin('face');
      g.ellipse(2.5, -9 + by, 7.6, 6.2, face, { clip: inBody, bias: 0.1 });
      g.begin('band');
      g.fill(function (x, y) { return y > -23.4 + by && y < -18.8 + by && inBody(x, y); }, function (x, y) {
        const ny = (y - (-21.1 + by)) / 2.3;
        return ny < -0.45 ? band.l : ny > 0.55 ? band.s : band.b;
      });
      // ตาโต (ขาว + ตาดำ)
      g.begin('eyes');
      const em = { w: '#ffffff', e: '#1f1530', W: '#dfe6f2', h: '#ffffff' };
      if (pose.dead) {
        [-0.6, 7].forEach(function (x) { g.stampAt(x, -14.6 + by, ['e...e', '.e.e.', '..e..', '.e.e.', 'e...e'], em); });
      } else if (pose.blink) {
        [-0.6, 7].forEach(function (x) { g.stampAt(x, -14 + by, ['.eee.'], em); });
      } else {
        [-0.6, 7].forEach(function (x) { g.stampAt(x, -14.8 + by, ['.www.', 'wwwww', 'wweew', 'wweew', 'wweew', '.Wee.'], em); });
        // จุดประกายในตา
        [-0.6, 7].forEach(function (x) { g.stampAt(x + 1.3, -16.6 + by, ['h'], { h: '#ffffff' }); });
      }
      g.begin('cheek');
      if (!pose.dead) g.stampAt(9.6, -9.6 + by, ['cc'], { c: '#ff8f8f' });
    },

    // ─────────────── Mew ───────────────
    mew: function (g, pose, tint) {
      const hair = { l: '#fff6b8', b: '#ffd84a', s: '#e8a923', d: '#b8780f' };
      const shirt = tint.a;
      const skirt = tint.b;
      const beret = { l: '#5c5a76', b: '#33313f', s: '#24222e', d: '#17151f' };
      const sock = { l: '#ffffff', b: '#f3f5fb', s: '#cfd6e6', d: '#aab3c8' };
      const shoe = { l: '#7b6688', b: '#4a3a52', s: '#33263a', d: '#21172a' };
      const L = limbs(pose);
      const by = pose.bob ? -1 : 0;
      const flow = pose.speed * 5;
      const lift = clamp(pose.vy / 900, -1, 1) * (pose.air ? 4 : 0);
      const HX = 1.5, HY = -23.2 + by, HR = 8;

      // ผมยาวด้านหลัง
      g.begin('hairBack');
      g.poly([[-2, -29 + by], [-7.5, -27 + by], [-10, -21 + by], [-10.5 - flow * 0.3, -14 + by], [-9.6 - flow, -7 - lift], [-7.2 - flow * 0.8, -5.6 - lift], [-5 - flow * 0.5, -8.5 - lift * 0.6], [-3, -15 + by]], hair, { bias: -0.08 });
      drawArm(g, 'armB', L.handB, shirt, MAT.skinBack, { sx: -3.4, sy: -15 + by });
      drawLegs(g, pose, L, { hipY: -6 + by, legR: 1.35, leg: MAT.skin, legBack: MAT.skinBack, sock: sock, shoe: shoe });
      // กระโปรง
      const fl = pose.air ? 1.3 : 0;
      g.begin('skirt', { line: true, lineSkip: ['legB', 'legF', 'hairBack', 'armB'] });
      g.poly([[-5.2, -11 + by], [5.2, -11 + by], [7.8 + fl, -4.3 - fl + by], [-7.8 - fl, -4.3 - fl + by]], skirt);
      g.begin('skirtTrim');
      g.fill(function (x, y) { return y > -5.4 - fl + by && y < -4.3 - fl + by && Math.abs(x) < 7.6 + fl; }, function () { return skirt.d; });
      // ลำตัว
      g.begin('torso', { line: true, lineSkip: ['skirt', 'skirtTrim', 'hairBack', 'armB'] });
      g.poly([[-5.3, -16.6 + by], [5.3, -16.6 + by], [5.6, -10.4 + by], [-5.6, -10.4 + by]], shirt);
      // ปกเสื้อสีขาว + โบว์
      g.begin('collar');
      const cm = { w: '#ffffff', W: '#d3dbf0', u: '#ffd23f', U: '#d39b00' };
      g.stampAt(0.6, -15.2 + by, ['wwwW.Wwww', '.wwWuWww.', '..wuUuw..', '...uUu...'], cm);
      drawArm(g, 'armF', L.handF, shirt, MAT.skin, { lineSkip: ['collar'], sx: 3.2, sy: -15 + by });
      // หัว
      g.begin('face', { line: true, lineSkip: ['hairBack', 'torso', 'collar', 'armF', 'armB'] });
      g.ellipse(HX, HY, HR, HR * 0.97, MAT.skin, { bias: 0.15 });
      // ผมด้านหน้า: คลุมหัวด้านบนและด้านหลัง + หน้าม้าเป็นแฉก
      g.begin('hairFront');
      const fringe = function (x) {
        const k = (x - HX) / HR; // -1..1
        const zig = Math.abs(((x - HX + 20) % 3.2) - 1.6) * 0.9; // แฉกหน้าม้า
        return HY - 1.9 - zig + Math.max(0, -k - 0.15) * 9;
      };
      g.ellipse(HX - 0.3, HY - 0.6, HR + 1.1, HR + 0.9, hair, {
        clip: function (x, y) {
          if (x < HX - 4.6) return true;                 // ด้านหลังหัวเป็นผมทั้งหมด
          if (x < HX - 2.8 && y < HY + 6.5) return true; // ผมข้างหู
          return y < fringe(x);
        }
      });
      // ปอยผมข้างหน้า
      g.capsule(HX + 8.4, HY - 2, HX + 8.7, HY + 3.2, 0.7, hair);
      g.shine('hairFront', HX - 0.5, HY - 0.5, 6.2, 7.6, -2.75, -1.25, hair.l);
      // หมวกเบเร่
      g.begin('beret', { line: true, lineSkip: ['hairFront'] });
      g.ellipse(HX - 1.4, HY - 7.6, 8.6, 3.6, beret, { rot: -0.2, p: 2.2 });
      g.capsule(HX - 1.6, HY - 11.2, HX - 1.2, HY - 12.4, 0.75, beret);
      // หน้า
      g.begin('features');
      const eyes = eyeStamps('#3fd17a', '#1a8a45');
      const ey = HY + 1.6;
      const pickM = pose.dead ? eyes.dead : pose.blink ? eyes.blink : eyes.open;
      g.stampAt(HX + 0.9, ey, pickM[0], pickM[1]);
      g.stampAt(HX + 5.6, ey, pickM[0], pickM[1]);
      g.stampAt(HX + 3.6, HY + 5.6, pose.dead ? ['mm'] : ['m'], { m: '#c0485a' });
      if (!pose.dead) { g.stampAt(HX + 7.3, HY + 4.4, ['c'], { c: '#ff8fa0' }); g.stampAt(HX - 1.4, HY + 4.4, ['c'], { c: '#ff8fa0' }); }
    },

    // ─────────────── Aclaire ───────────────
    // ผมส้มฟูทรงบ๊อบ + หางม้าสั้นด้านหลังศีรษะ เสื้อโปโลชมพูปกขาว กางเกงขาสั้นสีน้ำตาล
    aclaire: function (g, pose, tint) {
      const hair = { l: '#f9bd5a', b: '#e17e20', s: '#c85816', d: '#963711' };
      const shirt = tint.a;
      const shorts = tint.b;
      const shoe = { l: '#8a5034', b: '#6c3a25', s: '#56281a', d: '#421b14' };
      const L = limbs(pose);
      const by = pose.bob ? -1 : 0;
      const HX = 1.5, HY = -23.2 + by, HR = 8;
      // หางม้าสั้น ผูกด้านหลังศีรษะ ปลายชี้ลงและสะบัดตามการเคลื่อนไหว
      const bounce = pose.run ? Math.sin(pose.ph * 2) * 0.18 : 0;
      const ang = 0.15 + pose.speed * 0.4 + bounce + clamp(pose.vy / 900, -1, 1) * (pose.air ? 0.45 : 0);
      const tx = HX - 6.6, ty = HY - 5.6;
      g.begin('tail');
      const c = Math.cos(ang), s = Math.sin(ang);
      const R = function (px, py) { return [tx + px * c - py * s, ty + px * s + py * c]; };
      g.poly([R(1, -1.8), R(-2.6, -2.8), R(-5, -0.8), R(-5.6, 3), R(-4.4, 7.4), R(-3, 4.2), R(-1, 2), R(1, 1.8)], hair, { bias: -0.05 });
      drawArm(g, 'armB', L.handB, shirt, MAT.skinBack, { sx: -3.4, sy: -15 + by });
      drawLegs(g, pose, L, { hipY: -7 + by, legR: 1.55, leg: MAT.skin, legBack: MAT.skinBack, shoe: shoe, shoeBack: { b: shoe.s, s: shoe.d, d: shoe.d } });
      // กางเกงขาสั้น
      g.begin('hips', { line: true, lineSkip: ['legB', 'legF', 'armB', 'tail'] });
      g.poly([[-5.2, -11.2 + by], [5.2, -11.2 + by], [5.7, -5.6 + by], [0.4, -5.6 + by], [0, -6.8 + by], [-0.4, -5.6 + by], [-5.7, -5.6 + by]], shorts);
      // เสื้อโปโลแขนสั้น
      g.begin('torso', { line: true, lineSkip: ['hips', 'armB', 'tail'] });
      g.poly([[-5.4, -16.6 + by], [5.4, -16.6 + by], [5.8, -9.6 + by], [-5.8, -9.6 + by]], shirt);
      // ปกเสื้อสีขาว + กระดุม
      g.begin('collar');
      const cm = { w: '#ffffff', W: '#d9dde6', o: '#f9fbfa' };
      g.stampAt(1.4, -14.4 + by, ['wwwW.Wwww', '.wwW.Www.', '....o....', '.........', '....o....'], cm);
      drawArm(g, 'armF', L.handF, shirt, MAT.skin, { lineSkip: ['collar'], sx: 3.2, sy: -15 + by });
      // หัว
      g.begin('face', { line: true, lineSkip: ['tail', 'torso', 'armF', 'armB', 'collar'] });
      g.ellipse(HX, HY, HR, HR * 0.97, MAT.skin, { bias: 0.15 });
      // ผม: ฟูคลุมด้านหลังลงมาถึงคอ หน้าม้าหนาเป็นแฉก มีจอนยาวข้างแก้ม
      g.begin('hairFront');
      const fringe = function (x) {
        const k = (x - HX) / HR;
        const zig = Math.abs(((x - HX + 20) % 2.8) - 1.4) * 1.1;
        return HY - 0.8 - zig + Math.max(0, -k - 0.1) * 10;
      };
      g.ellipse(HX - 0.6, HY - 0.2, HR + 1.6, HR + 1.3, hair, {
        clip: function (x, y) {
          if (x < HX - 4.2) return y < HY + 7.2;          // ผมด้านหลังยาวลงมาถึงคอ
          if (x < HX - 3.2) return y < HY + 6.4;          // ผมข้างหู
          return y < fringe(x);
        }
      });
      // จอนผมข้างแก้มด้านหน้า
      g.capsule(HX + 8.3, HY - 3, HX + 8.6, HY + 5.4, 0.9, hair);
      g.shine('hairFront', HX - 0.8, HY - 0.4, 6.8, 8.4, -2.75, -1.25, hair.l);
      // ยางรัดผม
      g.begin('tie', { line: true, lineSkip: ['hairFront'] });
      g.ellipse(tx + 0.5, ty + 0.1, 1.2, 1.6, { l: '#ff9fbf', b: '#ed648d', s: '#c74b7a', d: '#a32e63' });
      // หน้า: ตาสีฟ้าเทา แก้มแดง
      g.begin('features');
      const eyes = eyeStamps('#8aa6c8', '#40486d');
      const ey = HY + 2;
      const pick = pose.dead ? eyes.dead : pose.blink ? eyes.blink : eyes.open;
      g.stampAt(HX + 1.2, ey, pick[0], pick[1]);
      g.stampAt(HX + 5.8, ey, pick[0], pick[1]);
      g.stampAt(HX + 4, HY + 5.8, pose.dead ? ['mm'] : ['m'], { m: '#c0485a' });
      if (!pose.dead) { g.stampAt(HX + 7.4, HY + 4.6, ['c'], { c: '#f3a38e' }); g.stampAt(HX - 1, HY + 4.6, ['c'], { c: '#f3a38e' }); }
    }
  };

  // สีที่เปลี่ยนได้ (เสื้อ/ตัว = a, กระโปรง/กางเกง = b) วาดเป็นรหัสชั่วคราวก่อน แล้วค่อยแทนด้วยสีจริง
  // จึงสร้างรูปทรงครั้งเดียวแล้วสลับสีรุ้งตอนได้ดาวได้ทันที
  const SLOT = { a: { l: '@a.l', b: '@a.b', s: '@a.s', d: '@a.d' }, b: { l: '@b.l', b: '@b.b', s: '@b.s', d: '@b.d' } };
  const NORMAL = {
    bobo: { a: { l: '#ffa47e', b: '#ff6a3d', s: '#e04e26', d: '#b8381a' }, b: { l: '#ffa47e', b: '#ff6a3d', s: '#e04e26', d: '#b8381a' } },
    mew: { a: { l: '#6a9cff', b: '#3563d8', s: '#24459e', d: '#182f70' }, b: { l: '#ffb36b', b: '#ff8a2a', s: '#db6617', d: '#a84a10' } },
    aclaire: { a: { l: '#f58bab', b: '#ed648d', s: '#c74b7a', d: '#a32e63' }, b: { l: '#8a5034', b: '#6c3a25', s: '#56281a', d: '#421b14' } }
  };
  function rainbow(h) {
    const tones = function (hh) {
      const c = function (l) { return 'hsl(' + hh + ',95%,' + l + '%)'; };
      return { l: c(78), b: c(60), s: c(45), d: c(32) };
    };
    return { a: tones(h), b: tones((h + 120) % 360) };
  }

  /**
   * สร้าง frame ของตัวละคร
   * @param hue ถ้าระบุ = สีเสื้อเปลี่ยนเป็นรุ้งตามเฉดนี้ (ตอนได้ดาว)
   * @returns {{w, h, ax, px}} px = สีของแต่ละช่อง (null = โปร่งใส), ax = ตำแหน่งกึ่งกลางเท้าตามแนวนอน,
   *          แถวล่างสุด (h-1) คือเส้นขอบใต้เท้า
   */
  const raw = {};
  function build(id, poseName, hue) {
    if (!DEFS[id]) id = 'bobo';
    if (!POSES[poseName]) poseName = 'idle';
    const key = id + '|' + poseName;
    let f = raw[key];
    if (!f) {
      const w = 54, h = 48, ax = 32;
      const g = new Grid(w, h, UNIT, ax);
      DEFS[id](g, Object.assign({}, POSES[poseName]), SLOT);
      g.innerLines();
      g.outline();
      f = raw[key] = { w: w, h: h, ax: ax, px: g.col };
    }
    const pal = hue != null ? rainbow(hue) : NORMAL[id];
    return {
      w: f.w, h: f.h, ax: f.ax,
      px: f.px.map(function (c) { return c && c.charAt(0) === '@' ? pal[c.charAt(1)][c.charAt(3)] : c; })
    };
  }

  /** ปีก (ไอเทมปีก) 2 จังหวะ: จุดต่อกับไหล่อยู่ขวาสุดแถวกลาง */
  const WING_MAP = { k: OUTLINE, w: '#ffffff', W: '#a9d4f5', B: '#6fa9da' };
  const WINGS = [
    ['.......kkk.', '.....kkwwwk', '...kkwwwwWk', '.kkwwwwwWWk', 'kwwwwwWWBk.', '.kWWWBBBk..', '..kkkkkk...'],
    ['...........', 'kkkk.......', 'kwwwkkk....', '.kwwwwwkkkk', '..kWwwwwwWk', '...kWWWBBk.', '....kkkkk..']
  ];

  /** วาดตาราง (frame หรือปีก) ลง ctx ช่องละ z พิกเซล */
  function paint(ctx, f, x, y, z) {
    for (let r = 0; r < f.h; r++) {
      for (let c = 0; c < f.w; c++) {
        const col = f.px[r * f.w + c];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * z, y + r * z, z, z);
      }
    }
  }

  function wing(i) {
    const rows = WINGS[i % WINGS.length];
    const px = [];
    rows.forEach(function (r) { for (let c = 0; c < r.length; c++) px.push(r[c] === '.' ? null : WING_MAP[r[c]]); });
    return { w: rows[0].length, h: rows.length, px: px };
  }

  CQ.Sprites = { UNIT: UNIT, POSES: POSES, build: build, wing: wing, paint: paint };
})(typeof window !== 'undefined' ? window : globalThis);
