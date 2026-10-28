/*
 * Coin Quest — ภาพสเตจ 4 Haunted House (วาดด้วยโค้ดทั้งหมด)
 * เติม method ให้ CQ.Renderer.prototype — โหลดหลัง js/render.js
 * เป็นภาพชั่วคราวและเป็นภาพสำรองถาวรเมื่อภาพจริง (Codex) โหลดไม่ได้
 * สไตล์: pixel 16-bit เส้นขอบเข้ม เงา 3 ระดับ / ม่วงเข้ม-น้ำเงินกลางคืน + ส้มฟักทอง + เขียวผีเป็นสีเน้น
 * บล็อกสวิตช์แยกด้วยลาย ไม่ใช่สีอย่างเดียว: ม่วง = พระจันทร์เสี้ยว, ส้ม = สี่เหลี่ยมหน้าฟักทอง
 */
(function (root) {
  'use strict';
  const CQ = root.CQ;
  const Renderer = CQ.Renderer;
  const U = Renderer.util;
  const T = CQ.PHYS.T;
  const TILE = CQ.TILE;
  const rr = U.rr, ellipse = U.ellipse, hash = U.hash, rng = U.rng;
  const GROUND_ROW = 14;

  // ── สีบล็อกสวิตช์: [ขอบเข้ม, เงา, กลาง, สว่าง, ลาย] ──
  const BLOCK = {
    purple: { line: '#1d0f33', dark: '#4c2580', mid: '#7440b8', light: '#a274e6', mark: '#efe2ff' },
    orange: { line: '#3a1606', dark: '#a8460b', mid: '#e06d16', light: '#ffa23f', mark: '#ffe2b0' }
  };
  const LAMP = { purple: '#c48cff', orange: '#ffa340' };
  const GHOST_ALPHA = 0.33; // บล็อกโปร่ง: alpha สูงสุดของทุกพิกเซล (ข้อกำหนด ≤ 0.35)

  /** ลายพระจันทร์เสี้ยว + ดาวเล็ก (บล็อกม่วง) */
  function moonMark(c, P) {
    // เสี้ยว = วงกลมใหญ่ลบวงกลมเล็ก (clip แบบ evenodd ใช้ได้ทั้งบล็อกทึบและโปร่ง)
    c.save();
    c.beginPath();
    c.rect(0, 0, 32, 32);
    c.arc(19, 13, 7, 0, Math.PI * 2);
    c.clip('evenodd');
    c.fillStyle = P.mark;
    ellipse(c, 15, 16, 8, 8); c.fill();
    c.restore();
    c.fillStyle = P.mark;
    c.fillRect(22, 21, 2, 2);
    c.fillRect(24, 8, 1, 1);
  }

  /** ลายกรอบสี่เหลี่ยม + หน้าฟักทอง (บล็อกส้ม) */
  function squareMark(c, P, ink) {
    c.fillStyle = P.mark;
    c.fillRect(7, 7, 18, 2); c.fillRect(7, 23, 18, 2);
    c.fillRect(7, 7, 2, 18); c.fillRect(23, 7, 2, 18);
    c.fillStyle = ink;
    c.beginPath(); c.moveTo(11, 15); c.lineTo(13, 11); c.lineTo(15, 15); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(17, 15); c.lineTo(19, 11); c.lineTo(21, 15); c.closePath(); c.fill();
    c.fillRect(11, 18, 10, 3);
    c.fillStyle = P.mark;
    c.fillRect(13, 18, 2, 1); c.fillRect(17, 18, 2, 1); c.fillRect(15, 20, 2, 1);
  }

  function drawSwitchBlock(c, color, ghost) {
    const P = BLOCK[color];
    if (ghost) {
      // โปร่ง: พื้นจาง + เส้นประ + ลายจาง แล้วคูณ alpha ทั้งช่องให้ไม่เกิน GHOST_ALPHA
      c.fillStyle = P.mid;
      c.globalAlpha = 0.3;
      c.fillRect(2, 2, 28, 28);
      c.globalAlpha = 1;
      c.strokeStyle = P.light;
      c.lineWidth = 2;
      c.setLineDash([4, 3]);
      c.strokeRect(2, 2, 28, 28);
      c.setLineDash([]);
      c.globalAlpha = 0.8;
      if (color === 'purple') moonMark(c, P);
      else squareMark(c, P, P.light);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = 'rgba(0,0,0,' + GHOST_ALPHA + ')';
      c.fillRect(0, 0, 32, 32);
      c.globalCompositeOperation = 'source-over';
      return;
    }
    c.fillStyle = P.line;
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = P.mid;
    c.fillRect(1, 1, 30, 30);
    c.fillStyle = P.light;
    c.fillRect(1, 1, 30, 2); c.fillRect(1, 1, 2, 30);
    c.fillStyle = P.dark;
    c.fillRect(1, 29, 30, 2); c.fillRect(29, 3, 2, 28);
    c.fillStyle = P.line;
    [[4, 4], [26, 4], [4, 26], [26, 26]].forEach(function (b) { c.fillRect(b[0], b[1], 2, 2); });
    if (color === 'purple') moonMark(c, P);
    else squareMark(c, P, P.line);
  }

  /** กล่องสวิตช์: กรอบหิน + ไฟกลมสีตามสถานะ + สัญลักษณ์สถานะ (เสี้ยว/สี่เหลี่ยม) */
  function drawSwitchBox(c, sw) {
    c.fillStyle = '#140c22';
    c.fillRect(0, 0, 32, 32);
    c.fillStyle = '#4a3f5c';
    c.fillRect(1, 1, 30, 30);
    c.fillStyle = '#6d6182';
    c.fillRect(1, 1, 30, 2); c.fillRect(1, 1, 2, 30);
    c.fillStyle = '#2c2438';
    c.fillRect(1, 29, 30, 2); c.fillRect(29, 3, 2, 28);
    c.fillStyle = '#1b1328';
    c.fillRect(6, 6, 20, 20);
    const col = LAMP[sw] || LAMP.purple;
    c.fillStyle = sw === 'orange' ? 'rgba(255,163,64,0.35)' : 'rgba(196,140,255,0.35)';
    ellipse(c, 16, 16, 9.5, 9.5); c.fill();
    c.fillStyle = col;
    ellipse(c, 16, 16, 7, 7); c.fill();
    c.strokeStyle = '#140c22'; c.lineWidth = 1;
    ellipse(c, 16, 16, 7, 7); c.stroke();
    c.fillStyle = '#2a1640';
    if (sw === 'orange') c.fillRect(13, 13, 6, 6);
    else { ellipse(c, 15, 16, 4, 4); c.fill(); c.fillStyle = col; ellipse(c, 17, 14.5, 3.4, 3.4); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(12, 11, 2, 2);
    c.fillStyle = '#8c7aa6';
    [[3, 3], [27, 3], [3, 27], [27, 27]].forEach(function (b) { c.fillRect(b[0], b[1], 2, 2); });
  }

  /** พื้นบ้าน: ด้านบนเป็นแผ่นไม้เก่า ใต้ลงไปเป็นหินฐานโทนม่วง */
  function drawHauntedFloor(c, mask, v) {
    const top = mask & 1, left = mask & 2, right = mask & 4;
    c.fillStyle = '#1c1426';
    c.fillRect(0, 0, 32, 32);
    const off = v * 7;
    [[1 - off, 1, 20, 14], [23 - off, 1, 20, 14], [-9 + off, 17, 20, 14], [13 + off, 17, 20, 14], [35 + off, 17, 20, 14]].forEach(function (b) {
      c.fillStyle = '#33283f';
      c.fillRect(b[0], b[1], b[2], b[3]);
      c.fillStyle = '#3f3250';
      c.fillRect(b[0], b[1], b[2], 2);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b[0], b[1] + b[3] - 2, b[2], 2);
    });
    c.fillStyle = 'rgba(0,0,0,0.28)';
    if (left) c.fillRect(0, 0, 3, 32);
    if (right) c.fillRect(29, 0, 3, 32);
    if (top) {
      c.fillStyle = '#2a1a12';
      c.fillRect(0, 0, 32, 11);
      c.fillStyle = '#6b4a32';
      c.fillRect(0, 1, 32, 8);
      c.fillStyle = '#8e6646';
      c.fillRect(0, 1, 32, 2);
      c.fillStyle = '#4a3020';
      c.fillRect(0, 6, 32, 1);
      c.fillStyle = '#2a1a12';
      c.fillRect((v * 11 + 9) % 32, 1, 1, 8);
      c.fillRect((v * 11 + 25) % 32, 1, 1, 8);
      c.fillStyle = '#a8a0b8';
      c.fillRect((v * 11 + 5) % 32, 4, 1, 1);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0, 11, 32, 2);
    }
  }

  /** อิฐผนัง/เพดานบ้านผี top = ด้านบนโล่ง (มีขอบบัว) */
  function drawHauntedBrick(c, top, v) {
    c.fillStyle = '#150e1d';
    c.fillRect(0, 0, 32, 32);
    const bricks = [[1, 1, 14, 9], [17, 1, 14, 9], [1, 12, 6, 9], [9, 12, 14, 9], [25, 12, 6, 9], [1, 23, 14, 8], [17, 23, 14, 8]];
    bricks.forEach(function (b, i) {
      c.fillStyle = (i + v) % 3 === 1 ? '#352847' : '#3d2e52';
      c.fillRect(b[0], b[1], b[2], b[3]);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(b[0], b[1], b[2], 1);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b[0], b[1] + b[3] - 1, b[2], 1);
    });
    if (v === 2) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(10, 14, 5, 1); c.fillRect(14, 15, 1, 4); }
    if (top) {
      c.fillStyle = '#5c4d72';
      c.fillRect(0, 0, 32, 4);
      c.fillStyle = '#8c7aa6';
      c.fillRect(0, 0, 32, 1);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0, 4, 32, 1);
    }
  }

  /** แผ่นไม้ลอย (one-way) ไม้เก่ามีตะปู mask: 1 = ปลายซ้าย, 2 = ปลายขวา */
  function drawHauntedPlank(c, mask) {
    const l = (mask & 1) ? 3 : 0, r = (mask & 2) ? 3 : 0;
    c.fillStyle = '#2e1c14';
    rr(c, l, 0, 32 - l - r, 12, (l || r) ? 3 : 0); c.fill();
    c.fillStyle = '#5a3b2a';
    c.fillRect(l, 1, 32 - l - r, 8);
    c.fillStyle = '#7a5640';
    c.fillRect(l, 1, 32 - l - r, 2);
    c.fillStyle = 'rgba(20,10,6,0.5)';
    c.fillRect(l + 5, 6, 9, 1); c.fillRect(l + 17, 4, 7, 1);
    c.fillStyle = '#a8a0b8';
    c.fillRect(l + 2, 4, 1, 1); c.fillRect(30 - r - 2, 4, 1, 1);
    c.fillStyle = '#4a3a5e';
    if (l) c.fillRect(6, 12, 3, 6);
    if (r) c.fillRect(23, 12, 3, 6);
  }

  /** หนามเหล็กผี (โทนเทาอมม่วง) */
  function drawHauntedSpikes(c) {
    c.fillStyle = '#2a2336';
    c.fillRect(1, 29, 30, 3);
    for (let i = 0; i < 3; i++) {
      const x0 = 1 + i * 10;
      c.fillStyle = '#cfc8ea';
      c.beginPath(); c.moveTo(x0, 30); c.lineTo(x0 + 5, 13); c.lineTo(x0 + 5, 30); c.closePath(); c.fill();
      c.fillStyle = '#7f789c';
      c.beginPath(); c.moveTo(x0 + 5, 13); c.lineTo(x0 + 10, 30); c.lineTo(x0 + 5, 30); c.closePath(); c.fill();
    }
  }

  /** สไปรต์ช่องของสเตจ 4 (แคชตาม key ที่รวมสี+สถานะ) */
  Renderer.prototype.hauntedTileSprite = function (lv, tx, ty, t) {
    const W = CQ.World;
    if (t === TILE.PURPLE || t === TILE.ORANGE) {
      const color = t === TILE.PURPLE ? 'purple' : 'orange';
      const ghost = CQ.Switches.isGhost(lv, tx, ty);
      return this.sprite('hsw_' + color + (ghost ? '_ghost' : '_solid'), 32, 32, function (c) { drawSwitchBlock(c, color, ghost); });
    }
    if (t === TILE.SWITCH) {
      const sw = lv.sw === 'orange' ? 'orange' : 'purple';
      return this.sprite('hswitch_' + sw, 32, 32, function (c) { drawSwitchBox(c, sw); });
    }
    if (t === TILE.GROUND) {
      const solid = function (x, y) { return W.isSolid(lv, x, y); };
      let mask = 0;
      if (ty > 0 && !solid(tx, ty - 1)) mask |= 1;
      if (!solid(tx - 1, ty)) mask |= 2;
      if (!solid(tx + 1, ty)) mask |= 4;
      const v = (tx + ty) % 3;
      return this.sprite('hfloor' + mask + '_' + v, 32, 32, function (c) { drawHauntedFloor(c, mask, v); });
    }
    if (t === TILE.BRICK) {
      const top = ty > 0 && !W.isSolid(lv, tx, ty - 1);
      const v = hash(tx, ty) % 3;
      return this.sprite('hbrick' + (top ? 1 : 0) + '_' + v, 32, 32, function (c) { drawHauntedBrick(c, top, v); });
    }
    if (t === TILE.ONEWAY) {
      let mask = 0;
      if (W.tileAt(lv, tx - 1, ty) !== TILE.ONEWAY) mask |= 1;
      if (W.tileAt(lv, tx + 1, ty) !== TILE.ONEWAY) mask |= 2;
      return this.sprite('hplank' + mask, 32, 32, function (c) { drawHauntedPlank(c, mask); });
    }
    if (t === TILE.SPIKE) return this.sprite('hspike', 32, 32, drawHauntedSpikes);
    return null;
  };

  // ── ฉากหลัง parallax: ผนังวอลเปเปอร์เก่า หน้าต่างพระจันทร์ + เสา/ม่านใกล้ ๆ ──
  Renderer.prototype.buildHauntedLayers = function (mk) {
    const layers = {
      far: mk(1024, 320, function (c, w, h) {
        c.fillStyle = '#211832';
        c.fillRect(0, 0, w, h);
        // วอลเปเปอร์ลายทาง + จุดลายดอก
        for (let x = 0; x < w; x += 16) {
          c.fillStyle = '#271c3b';
          c.fillRect(x, 0, 8, h);
        }
        c.fillStyle = 'rgba(160,120,210,0.08)';
        for (let y = 14; y < h - 60; y += 28) {
          for (let x = (y / 28 % 2) * 16 + 4; x < w; x += 32) {
            c.fillRect(x, y, 4, 4); c.fillRect(x - 2, y + 2, 8, 1);
          }
        }
        for (let i = 0; i < 4; i++) {
          const x = i * 256 + 128;
          // หน้าต่างโค้ง + พระจันทร์
          c.fillStyle = '#10152e';
          c.beginPath();
          c.moveTo(x - 32, 200); c.lineTo(x - 32, 116); c.arc(x, 116, 32, Math.PI, 0); c.lineTo(x + 32, 200);
          c.closePath(); c.fill();
          const gl = c.createLinearGradient(x, 84, x, 200);
          gl.addColorStop(0, 'rgba(120,110,220,0.45)');
          gl.addColorStop(1, 'rgba(60,50,140,0.12)');
          c.fillStyle = gl; c.fill();
          c.strokeStyle = '#4a3a5e'; c.lineWidth = 5; c.stroke();
          c.fillStyle = 'rgba(255,236,190,0.18)';
          ellipse(c, x + 8, 116, 17, 17); c.fill();
          c.fillStyle = '#ffeec2';
          ellipse(c, x + 8, 116, 11, 11); c.fill();
          c.fillStyle = 'rgba(200,170,120,0.5)';
          ellipse(c, x + 5, 113, 2.5, 2.5); c.fill();
          ellipse(c, x + 11, 120, 1.8, 1.8); c.fill();
          c.fillStyle = '#211832';
          c.fillRect(x - 1.5, 84, 3, 116);
          c.fillRect(x - 32, 150, 64, 3);
          // ม่านขาด ๆ สองข้าง
          c.fillStyle = '#4a1f3c';
          c.beginPath(); c.moveTo(x - 42, 78); c.lineTo(x - 22, 78); c.lineTo(x - 26, 160); c.lineTo(x - 32, 150); c.lineTo(x - 36, 168); c.lineTo(x - 42, 160); c.closePath(); c.fill();
          c.beginPath(); c.moveTo(x + 22, 78); c.lineTo(x + 42, 78); c.lineTo(x + 42, 156); c.lineTo(x + 36, 168); c.lineTo(x + 30, 150); c.lineTo(x + 26, 160); c.closePath(); c.fill();
          c.fillStyle = '#5c4d72';
          c.fillRect(x - 46, 74, 92, 5);
          c.fillStyle = '#4a3a5e';
          c.fillRect(x - 36, 200, 72, 5);
          // กรอบรูปเก่าระหว่างหน้าต่าง
          const fx = i * 256;
          c.fillStyle = '#6b5226';
          c.fillRect(fx - 22, 104, 44, 54);
          c.fillStyle = '#2b2236';
          c.fillRect(fx - 17, 109, 34, 44);
          c.fillStyle = '#3e3150';
          ellipse(c, fx, 126, 8, 9); c.fill();
          c.fillRect(fx - 12, 136, 24, 17);
          c.fillStyle = '#9fffc8';
          c.fillRect(fx - 4, 124, 2, 2); c.fillRect(fx + 2, 124, 2, 2);
        }
        // ผนังไม้ช่วงล่าง (wainscot)
        c.fillStyle = '#2a1a22';
        c.fillRect(0, h - 70, w, 70);
        c.fillStyle = '#3a2630';
        c.fillRect(0, h - 70, w, 4);
        for (let x = 8; x < w; x += 64) {
          c.strokeStyle = '#1e1218'; c.lineWidth = 2;
          c.strokeRect(x, h - 56, 48, 40);
        }
      }),
      near: mk(900, 260, function (c, w, h) {
        const r = rng(91);
        for (let i = 0; i < 3; i++) {
          const x = (i + 0.5) * (w / 3);
          // เสาไม้แกะสลัก
          c.fillStyle = '#140d1c';
          c.fillRect(x - 18, 0, 36, h);
          c.fillStyle = '#21162c';
          c.fillRect(x - 18, 0, 5, h);
          for (let y = 30; y < h; y += 46) {
            c.fillStyle = '#2c2038';
            c.fillRect(x - 20, y, 40, 4);
          }
          // ใยแมงมุมมุมเสา
          c.strokeStyle = 'rgba(220,210,240,0.22)'; c.lineWidth = 1;
          const wx = x + 18;
          for (let k = 0; k < 4; k++) {
            c.beginPath(); c.moveTo(wx, 0); c.lineTo(wx + 34 * Math.cos(k * 0.45), 34 * Math.sin(k * 0.45)); c.stroke();
          }
          for (let k = 1; k <= 3; k++) {
            c.beginPath(); c.arc(wx, 0, k * 10, 0, Math.PI / 2 * 0.95); c.stroke();
          }
          // โคมระย้าห้อยระหว่างเสา
          const lx = x + w / 6 + (r() - 0.5) * 30;
          c.strokeStyle = '#140d1c'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(lx, 0); c.lineTo(lx, 40); c.stroke();
          c.fillStyle = '#140d1c';
          c.fillRect(lx - 16, 40, 32, 4);
          c.fillRect(lx - 16, 30, 3, 12); c.fillRect(lx + 13, 30, 3, 12); c.fillRect(lx - 1.5, 28, 3, 14);
          c.fillStyle = 'rgba(255,200,120,0.55)';
          ellipse(c, lx - 14.5, 27, 1.6, 2.6); c.fill();
          ellipse(c, lx + 14.5, 27, 1.6, 2.6); c.fill();
          ellipse(c, lx, 25, 1.6, 2.6); c.fill();
        }
        c.fillStyle = '#140e1e';
        c.fillRect(0, h - 24, w, 24);
      })
    };
    layers.far.fill = '#2a1a22';
    layers.near.fill = '#140e1e';
    return layers;
  };

  /** ท้องฟ้า (เห็นไกล ๆ เหนือฉากหลัง): ดวงดาวจาง + หมอกผีลอยช้า ๆ */
  Renderer.prototype.drawHauntedSky = function (time) {
    const ctx = this.ctx, vw = this.viewW, vh = this.viewH;
    for (let i = 0; i < this.clouds.length; i++) {
      const cl = this.clouds[i];
      let x = (cl.x - this.cx * 0.06 + time * cl.v * 0.6) % 2400;
      if (x < 0) x += 2400;
      x -= 200;
      if (x > vw + 80) continue;
      const y = (cl.y + Math.sin(time * 0.4 + i) * 10) % vh;
      ctx.fillStyle = 'rgba(150,255,200,' + (0.04 + 0.02 * Math.sin(time * 0.8 + i)).toFixed(3) + ')';
      ellipse(ctx, x, y, 46 * cl.s, 9 * cl.s); ctx.fill();
      ctx.fillStyle = 'rgba(230,220,255,' + (0.25 + 0.2 * Math.sin(time * 1.7 + i * 2)).toFixed(3) + ')';
      ctx.fillRect((x * 1.7 + 60) % (vw + 40), (cl.y * 0.6) % vh, 1.5, 1.5);
    }
  };

  // ── ของตกแต่ง ─────────────────────────────────────────────────
  /** เลือกของตกแต่งบนพื้น (เรียกจาก setLevel) r = 0..99 คงที่ต่อช่อง */
  Renderer.prototype.hauntedDecorAt = function (decor, x, y, r, flat, room, busy) {
    if (r < 9 && flat && room >= 4 && !busy) decor.push({ k: 'candelabra', x: x, y: y, back: true });
    else if (r < 16 && flat && room >= 4) decor.push({ k: 'portrait', x: x, y: y, back: true, v: r % 3 });
    else if (r < 21 && room >= 4) decor.push({ k: 'bat', x: x, y: y, back: true, ph: r });
    else if (r < 27) decor.push({ k: 'jacklamp', x: x - 6 + (r % 12), y: y, back: true });
    else if (r < 38) decor.push({ k: 'candle', x: x - 8 + (r % 16), y: y, s: 0.8 + (r % 3) * 0.15 });
  };

  function flame(ctx, x, y, s, time, seed) {
    const fl = Math.sin(time * 12 + seed) * 0.8 + Math.sin(time * 7.1 + seed * 0.3) * 0.5;
    ctx.fillStyle = 'rgba(255,190,110,0.18)';
    ellipse(ctx, x, y - 3 * s, 7 * s, 7 * s); ctx.fill();
    ctx.fillStyle = '#ff9a2a';
    ctx.beginPath();
    ctx.moveTo(x - 2.2 * s, y); ctx.quadraticCurveTo(x - 2 * s + fl * 0.4, y - 4 * s, x + fl * 0.5, y - 7 * s - fl * 0.4);
    ctx.quadraticCurveTo(x + 2.4 * s + fl * 0.3, y - 3.5 * s, x + 2.2 * s, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe9a0';
    ellipse(ctx, x + fl * 0.2, y - 2 * s, 1 * s, 1.8 * s); ctx.fill();
  }

  Renderer.prototype.drawHauntedDecor = function (d, time) {
    const ctx = this.ctx;
    switch (d.k) {
      case 'candle': {
        const s = d.s;
        ctx.fillStyle = '#e8e0cf';
        ctx.fillRect(d.x - 2 * s, d.y - 9 * s, 4 * s, 9 * s);
        ctx.fillStyle = '#c9bfa8';
        ctx.fillRect(d.x + 0.5 * s, d.y - 9 * s, 1.5 * s, 9 * s);
        ctx.fillStyle = '#e8e0cf';
        ellipse(ctx, d.x - 1.5 * s, d.y - 6 * s, 0.9 * s, 1.6 * s); ctx.fill(); // หยดเทียน
        flame(ctx, d.x, d.y - 9 * s, s, time, d.x);
        break;
      }
      case 'candelabra': {
        // เชิงเทียนสูง 3 กิ่ง
        ctx.fillStyle = '#3a3048';
        ctx.fillRect(d.x - 7, d.y - 3, 14, 3);
        ctx.fillRect(d.x - 1.5, d.y - 46, 3, 44);
        ctx.fillRect(d.x - 14, d.y - 46, 28, 3);
        ctx.fillRect(d.x - 14, d.y - 52, 3, 8); ctx.fillRect(d.x + 11, d.y - 52, 3, 8);
        ctx.fillStyle = '#5c4d72';
        ctx.fillRect(d.x - 1.5, d.y - 46, 1, 44);
        ctx.fillStyle = '#e8e0cf';
        ctx.fillRect(d.x - 14.5, d.y - 60, 4, 8); ctx.fillRect(d.x + 10.5, d.y - 60, 4, 8); ctx.fillRect(d.x - 2, d.y - 56, 4, 10);
        flame(ctx, d.x - 12.5, d.y - 60, 1, time, d.x);
        flame(ctx, d.x + 12.5, d.y - 60, 1, time, d.x + 3);
        flame(ctx, d.x, d.y - 56, 1.1, time, d.x + 7);
        break;
      }
      case 'portrait': {
        // กรอบรูปเก่าเอียงนิด ๆ บนผนัง ตาในรูปมองตาม (กะพริบเขียวจาง ๆ)
        ctx.save();
        ctx.translate(d.x, d.y - 74);
        ctx.rotate((d.v - 1) * 0.05);
        ctx.fillStyle = '#4a3618';
        ctx.fillRect(-15, -19, 30, 38);
        ctx.fillStyle = '#8a6a2c';
        ctx.fillRect(-14, -18, 28, 2); ctx.fillRect(-14, -18, 2, 36);
        ctx.fillStyle = '#251c30';
        ctx.fillRect(-11, -15, 22, 30);
        ctx.fillStyle = '#3c2f4e';
        ellipse(ctx, 0, -3, 6, 7); ctx.fill();
        ctx.fillRect(-8, 5, 16, 10);
        const blink = Math.sin(time * 0.9 + d.x) > 0.96;
        ctx.fillStyle = blink ? 'rgba(125,255,176,0.2)' : 'rgba(125,255,176,0.75)';
        ctx.fillRect(-3.5, -4, 2, 1.5); ctx.fillRect(1.5, -4, 2, 1.5);
        ctx.restore();
        break;
      }
      case 'jacklamp': {
        // โคมฟักทองตกแต่ง (เล็ก นิ่ง เรืองแสงอุ่น ๆ ไม่ใช่ศัตรู)
        const glow = 0.25 + 0.08 * Math.sin(time * 5 + d.x);
        ctx.fillStyle = 'rgba(255,170,60,' + glow.toFixed(3) + ')';
        ellipse(ctx, d.x, d.y - 5, 11, 8); ctx.fill();
        ctx.fillStyle = '#8a3d0e';
        ellipse(ctx, d.x, d.y - 4.5, 6.5, 4.5); ctx.fill();
        ctx.fillStyle = '#c45a14';
        ellipse(ctx, d.x, d.y - 4.5, 3.5, 4.2); ctx.fill();
        ctx.fillStyle = '#ffd36a';
        ctx.fillRect(d.x - 3, d.y - 6, 2, 1.5); ctx.fillRect(d.x + 1, d.y - 6, 2, 1.5);
        ctx.fillRect(d.x - 2.5, d.y - 3, 5, 1);
        ctx.fillStyle = '#3f5a2a';
        ctx.fillRect(d.x - 0.7, d.y - 10.5, 1.4, 2.5);
        break;
      }
      case 'bat': {
        // ค้างคาวบินวนช้า ๆ ไกล ๆ (ฉากหลัง)
        const t = time * 0.7 + d.ph;
        const bx = d.x + Math.sin(t) * 26, by = d.y - 104 + Math.sin(t * 2.1) * 8;
        const flap = Math.sin(time * 14 + d.ph) > 0;
        ctx.fillStyle = '#120b1a';
        ellipse(ctx, bx, by, 3, 2.4); ctx.fill();
        ctx.beginPath();
        if (flap) {
          ctx.moveTo(bx - 2, by); ctx.lineTo(bx - 9, by - 5); ctx.lineTo(bx - 7, by + 1); ctx.lineTo(bx - 4, by + 1);
          ctx.moveTo(bx + 2, by); ctx.lineTo(bx + 9, by - 5); ctx.lineTo(bx + 7, by + 1); ctx.lineTo(bx + 4, by + 1);
        } else {
          ctx.moveTo(bx - 2, by); ctx.lineTo(bx - 9, by + 4); ctx.lineTo(bx - 5, by + 2);
          ctx.moveTo(bx + 2, by); ctx.lineTo(bx + 9, by + 4); ctx.lineTo(bx + 5, by + 2);
        }
        ctx.fill();
        ctx.fillStyle = '#ff6a6a';
        ctx.fillRect(bx - 1.5, by - 1, 1, 1); ctx.fillRect(bx + 0.5, by - 1, 1, 1);
        break;
      }
    }
  };

  // ── แพลตฟอร์มเลื่อน + รางแนวตั้ง ──────────────────────────────
  Renderer.prototype.drawHauntedPlatform = function (pl) {
    const ctx = this.ctx;
    ctx.fillStyle = '#2e1c14';
    rr(ctx, pl.x, pl.y, pl.w, pl.h, 4); ctx.fill();
    ctx.fillStyle = '#5a3b2a';
    rr(ctx, pl.x + 2, pl.y + 1, pl.w - 4, pl.h - 4, 3); ctx.fill();
    ctx.fillStyle = '#7a5640';
    ctx.fillRect(pl.x + 5, pl.y + 2, pl.w - 10, 2);
    ctx.fillStyle = 'rgba(20,10,6,0.5)';
    ctx.fillRect(pl.x + pl.w / 3, pl.y + 2, 1, pl.h - 5);
    ctx.fillRect(pl.x + pl.w * 2 / 3, pl.y + 2, 1, pl.h - 5);
    ctx.fillStyle = '#4a3a5e';
    rr(ctx, pl.x, pl.y, 10, pl.h, 3); ctx.fill();
    rr(ctx, pl.x + pl.w - 10, pl.y, 10, pl.h, 3); ctx.fill();
    ctx.fillStyle = '#b9aed0';
    ellipse(ctx, pl.x + 5, pl.y + 7, 1.6, 1.6); ctx.fill();
    ellipse(ctx, pl.x + pl.w - 5, pl.y + 7, 1.6, 1.6); ctx.fill();
    if (pl.axis === 'y') {
      // ห่วงเกาะราง (กลางแผ่น) บอกว่าแผ่นนี้เลื่อนขึ้นลง
      ctx.fillStyle = '#4a3a5e';
      rr(ctx, pl.x + pl.w / 2 - 6, pl.y - 4, 12, 6, 2); ctx.fill();
      ctx.fillStyle = '#7dffb0';
      ctx.fillRect(pl.x + pl.w / 2 - 1, pl.y - 2, 2, 2);
    }
  };

  /** รางแนวตั้งของแพลตฟอร์ม axis 'y' (x คงที่ เลื่อนระหว่าง minY..maxY) */
  Renderer.prototype.drawVTrack = function (pl) {
    const ctx = this.ctx;
    const x = pl.x + pl.w / 2;
    if (x + 20 < this.cx || x - 20 > this.cx + this.viewW) return;
    const ya = pl.minY + 2, yb = pl.maxY + pl.h - 2;
    ctx.fillStyle = 'rgba(20,12,30,0.55)';
    ctx.fillRect(x - 3, ya, 6, yb - ya);
    ctx.strokeStyle = 'rgba(170,150,210,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x, ya); ctx.lineTo(x, yb); ctx.stroke();
    ctx.setLineDash([]);
    [ya, yb].forEach(function (y) {
      ctx.fillStyle = '#2c2438';
      ellipse(ctx, x, y, 5, 5); ctx.fill();
      ctx.fillStyle = '#8c7aa6';
      ellipse(ctx, x, y, 2, 2); ctx.fill();
    });
  };

  // ── ฟักทองผี ──────────────────────────────────────────────────
  const PUMPKIN_PAL = {
    phop: { line: '#4a1d05', dark: '#c85a10', mid: '#f08a24', light: '#ffb455', stem: '#3f7a2a' },
    pfire: { line: '#3d1203', dark: '#a8400c', mid: '#e0661a', light: '#f39a3c', stem: '#4a3a20' }
  };
  const PUMPKIN_WHITE = { line: '#ffd9b0', dark: '#ffffff', mid: '#ffffff', light: '#ffffff', stem: '#ffffff' };

  /**
   * phop = ฟักทองกระโดด (ส้มสด ใบเขียว หน้าทะเล้น) / pfire = ฟักทองยิงไฟ (ส้มเข้ม เถาม้วน ตาเรืองเขียวจาง)
   * windT > 0 = ตาเรืองแสงเขียว อ้าปาก ตัวสั่น (เตือนก่อนยิง) / flash > 0 = กะพริบขาว / dead = แตกเป็นสองซีก
   */
  Renderer.prototype.drawPumpkin = function (e, time) {
    const ctx = this.ctx;
    if (e.x + 50 < this.cx || e.x - 50 > this.cx + this.viewW) return;
    if (e.dead && e.deadT > 0.6) return;
    const fire = e.kind === 'pfire';
    const wind = fire && e.windT > 0 && !e.dead;
    const P = e.flash > 0 ? PUMPKIN_WHITE : PUMPKIN_PAL[e.kind];
    const w = e.w, h = e.h;
    let cx = e.x + w / 2;
    const by = e.y + h;
    if (wind) cx += Math.sin(time * 70) * 1.2;
    // ยืดหดตอนกระโดด / ย่อตัวก่อนกระโดด
    let sx = 1, sy = 1;
    if (!fire && !e.dead) {
      if (!e.onGround) { const k = Math.min(0.12, Math.abs(e.vy) / 4000); sx = 1 - k; sy = 1 + k; }
      else if (e.pause < 0.2) { sx = 1.1; sy = 0.88; }
    } else if (wind) { sx = 1.04; sy = 0.97; }
    ctx.save();
    if (e.dead && e.knock) {
      const t = e.deadT;
      ctx.globalAlpha = Math.max(0, 1 - t / 0.6);
      ctx.translate(cx + e.knock * 150 * t, by - h / 2 - 240 * t + 800 * t * t);
      ctx.rotate(e.knock * t * 10);
      ctx.translate(0, h / 2);
    } else {
      ctx.translate(cx, by);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ellipse(ctx, 0, 0, w * 0.5, 2.6); ctx.fill();
    }
    if (e.dead && !e.knock) {
      // แตกเป็นสองซีกแยกออกข้าง จางหายใน 0.6 วินาที
      const k = e.deadT / 0.6;
      ctx.globalAlpha = Math.max(0, 1 - k);
      [-1, 1].forEach(function (side) {
        ctx.save();
        ctx.translate(side * k * 10, 0);
        ctx.rotate(side * k * 0.8);
        ctx.beginPath();
        ctx.rect(side < 0 ? -w : 0, -h - 6, w, h + 6);
        ctx.clip();
        bodyShape(ctx, P, w, h);
        ctx.restore();
      });
      ctx.restore();
      return;
    }
    ctx.scale(sx, sy);
    bodyShape(ctx, P, w, h);
    stem(ctx, P, h, fire, e.t || 0);
    face(ctx, e, P, w, h, fire, wind, e.flash > 0);
    ctx.restore();
    if (wind) {
      // ประกายไฟผีรอบตัวตอนเตือน
      const k = 1 - e.windT / 0.6;
      ctx.fillStyle = 'rgba(125,255,176,' + (0.15 + 0.25 * k).toFixed(3) + ')';
      ellipse(ctx, cx + (e.face || 1) * w * 0.45, by - h * 0.45, 4 + k * 4, 4 + k * 4); ctx.fill();
    }
  };

  function bodyShape(ctx, P, w, h) {
    const rx = w / 2, ry = h / 2, cy = -ry;
    // กลีบข้างเข้ม + กลีบกลางสว่าง (เงา 3 ระดับ) แล้วตัดเส้นขอบเข้ม
    ctx.fillStyle = P.line;
    ellipse(ctx, 0, cy, rx + 1, ry + 1); ctx.fill();
    ctx.fillStyle = P.dark;
    ellipse(ctx, 0, cy, rx, ry); ctx.fill();
    ctx.fillStyle = P.mid;
    ellipse(ctx, -rx * 0.3, cy, rx * 0.55, ry * 0.95); ctx.fill();
    ellipse(ctx, rx * 0.3, cy, rx * 0.55, ry * 0.95); ctx.fill();
    ctx.fillStyle = P.light;
    ellipse(ctx, 0, cy, rx * 0.32, ry * 0.95); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-rx * 0.3, cy - ry * 0.9); ctx.quadraticCurveTo(-rx * 0.62, cy, -rx * 0.3, cy + ry * 0.9);
    ctx.moveTo(rx * 0.3, cy - ry * 0.9); ctx.quadraticCurveTo(rx * 0.62, cy, rx * 0.3, cy + ry * 0.9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, -rx * 0.55, cy - ry * 0.45, 2, 3); ctx.fill();
  }

  function stem(ctx, P, h, fire, t) {
    ctx.fillStyle = P.stem;
    ctx.fillRect(-1.6, -h - 4, 3.2, 5);
    ctx.strokeStyle = P.stem; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    if (fire) {
      // เถาม้วน
      ctx.beginPath(); ctx.moveTo(1, -h - 2); ctx.quadraticCurveTo(7, -h - 6, 6, -h - 1); ctx.quadraticCurveTo(5, -h + 1, 3.5, -h - 1); ctx.stroke();
    } else {
      // ใบไม้ไหว
      const a = Math.sin(t * 4) * 0.2;
      ctx.save(); ctx.translate(1.5, -h - 2); ctx.rotate(-0.5 + a);
      ctx.fillStyle = P === PUMPKIN_WHITE ? '#ffffff' : '#5fae3e';
      ellipse(ctx, 3.5, 0, 3.5, 1.8); ctx.fill();
      ctx.restore();
    }
  }

  function face(ctx, e, P, w, h, fire, wind, white) {
    const f = e.face < 0 ? -1 : 1;
    const fx = f * 2.5, ey = -h * 0.6;
    const ink = white ? '#ffd9b0' : P.line;
    // ตา: สามเหลี่ยม
    [-1, 1].forEach(function (s) {
      const x = fx + s * 4.5;
      if (wind) {
        ctx.fillStyle = 'rgba(125,255,176,0.45)';
        ellipse(ctx, x, ey + 1, 4.5, 4.5); ctx.fill();
      }
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.moveTo(x - 3, ey + 3); ctx.lineTo(x, ey - 2.5); ctx.lineTo(x + 3, ey + 3); ctx.closePath(); ctx.fill();
      if (white) return;
      ctx.fillStyle = wind ? '#7dffb0' : fire ? '#2f8f5a' : '#ffcf5a';
      if (wind) { ctx.beginPath(); ctx.moveTo(x - 2, ey + 2.4); ctx.lineTo(x, ey - 1.2); ctx.lineTo(x + 2, ey + 2.4); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(x - 0.6 + f * 0.6, ey + 0.6, 1.2, 1.4);
    });
    // ปาก
    const my = -h * 0.28;
    if (wind) {
      ctx.fillStyle = ink;
      ellipse(ctx, fx, my, 5, 3.6); ctx.fill();
      ctx.fillStyle = '#c9ffe4';
      ellipse(ctx, fx, my + 0.4, 3, 2); ctx.fill();
      return;
    }
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(fx - 6, my - 1.5);
    ctx.quadraticCurveTo(fx, my + 4.5, fx + 6, my - 1.5);
    ctx.lineTo(fx + 3.5, my - 0.5); ctx.lineTo(fx + 2, my + 0.8); ctx.lineTo(fx, my - 0.5);
    ctx.lineTo(fx - 2, my + 0.8); ctx.lineTo(fx - 3.5, my - 0.5);
    ctx.closePath(); ctx.fill();
    if (!fire && !white) {
      // phop ทะเล้น: แลบลิ้น
      ctx.fillStyle = '#ff6a8a';
      ellipse(ctx, fx + f * 2.2, my + 2.2, 1.6, 1.3); ctx.fill();
    }
  }

  // ── ความมืดสลัว (ข้อกำหนด §6.5) ───────────────────────────────
  // offscreen canvas ขนาด view (หน่วยโลก 1:1 แสงนุ่มอยู่แล้วจึงไม่ต้องละเอียดเท่าจอ) สร้างใหม่เฉพาะตอนขนาดเปลี่ยน
  // ทุกเฟรม: เติมสีม่วงเข้มโปร่ง แล้วเจาะแสงด้วย destination-out จากสไปรต์ gradient ที่แคชตามรัศมี
  const DARK_RGB = '20,8,36';
  const DARK_LIGHT = { fire: 2.5 * T, ball: 1.5 * T, sw: 1.5 * T, coin: 0.8 * T, decor: 2 * T };
  // บล็อกสวิตช์ (ทึบ + โปร่ง) เจาะความมืดเป็นสี่เหลี่ยมพอดีช่อง ขอบ/เส้นประจึงยังคมแม้อยู่นอกวงแสง
  const DARK_BLOCK_CUT = 0.45;

  /** สไปรต์แสงวงกลมรัศมี r (หน่วยโลก): กลางทึบ ค่อย ๆ จางถึงขอบ — สร้างครั้งเดียวต่อรัศมี */
  Renderer.prototype.lightSprite = function (r) {
    const cache = this.lightCache || (this.lightCache = {});
    const key = Math.round(r);
    let s = cache[key];
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = key * 2;
      const c = s.getContext('2d');
      const gr = c.createRadialGradient(key, key, 0, key, key, key);
      gr.addColorStop(0, 'rgba(0,0,0,1)');
      gr.addColorStop(0.45, 'rgba(0,0,0,0.85)');
      gr.addColorStop(0.75, 'rgba(0,0,0,0.4)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr;
      c.fillRect(0, 0, key * 2, key * 2);
      cache[key] = s;
    }
    return s;
  };

  /** วาดความมืดทับฉาก เรียกจาก render() หลังอนุภาค ก่อน flash/minimap/HUD เมื่อ g.stage.dark */
  Renderer.prototype.drawDarkness = function (g, time) {
    const dk = g.stage.dark;
    const vw = Math.ceil(this.viewW), vh = Math.ceil(this.viewH);
    let cv = this.darkCv;
    if (!cv || cv.width !== vw || cv.height !== vh) {
      cv = this.darkCv = document.createElement('canvas');
      cv.width = vw; cv.height = vh;
      this.darkCtx = cv.getContext('2d');
    }
    const c = this.darkCtx, ox = this.cx, oy = this.cy;
    const self = this;
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, vw, vh);
    c.fillStyle = 'rgba(' + DARK_RGB + ',' + dk.alpha + ')';
    c.fillRect(0, 0, vw, vh);
    c.globalCompositeOperation = 'destination-out';

    // เจาะแสงหนึ่งดวงที่ (wx, wy) โลก รัศมี r ความแรง a (0..1) ข้ามดวงที่อยู่นอกจอ
    function light(wx, wy, r, a) {
      const x = wx - ox, y = wy - oy;
      if (x + r < 0 || y + r < 0 || x - r > vw || y - r > vh) return;
      c.globalAlpha = a;
      c.drawImage(self.lightSprite(r), x - r, y - r, r * 2, r * 2);
    }

    // บล็อกสวิตช์ในจอ: สี่เหลี่ยมพอดีช่อง (path เดียว fill ครั้งเดียว)
    const lv = g.lv;
    const tx0 = Math.max(0, Math.floor(ox / T)), tx1 = Math.min(lv.w - 1, Math.floor((ox + vw) / T));
    const ty0 = Math.max(0, Math.floor(oy / T)), ty1 = Math.min(lv.h - 1, Math.floor((oy + vh) / T));
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,' + DARK_BLOCK_CUT + ')';
    c.beginPath();
    let any = false;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = lv.tiles[ty * lv.w + tx];
        if (t === TILE.PURPLE || t === TILE.ORANGE) { c.rect(tx * T - ox, ty * T - oy, T, T); any = true; }
      }
    }
    if (any) c.fill();

    // ของตกแต่งที่มีเปลวไฟ (เทียน เชิงเทียน โคมฟักทอง)
    for (let i = 0; i < this.decor.length; i++) {
      const d = this.decor[i];
      if (d.k === 'candle') light(d.x, d.y - 9 * d.s, DARK_LIGHT.decor, 0.75);
      else if (d.k === 'candelabra') light(d.x, d.y - 56, DARK_LIGHT.decor, 0.85);
      else if (d.k === 'jacklamp') light(d.x, d.y - 5, DARK_LIGHT.decor, 0.7);
    }
    // สวิตช์
    for (let i = 0; i < lv.switches.length; i++) {
      const s = lv.switches[i];
      light((s.tx + 0.5) * T, (s.ty + 0.5) * T, DARK_LIGHT.sw, 0.8);
    }
    // เหรียญที่ยังไม่เก็บ (เรืองจาง ๆ)
    for (let i = 0; i < g.coins.length; i++) {
      const co = g.coins[i];
      if (!co.taken && !co.hidden) light(co.x, co.y, DARK_LIGHT.coin, 0.5);
    }
    // ฟักทองยิงไฟ: สว่างขึ้นตอนเตือนก่อนยิง (windT > 0)
    for (let i = 0; i < g.enemies.length; i++) {
      const e = g.enemies[i];
      if (e.kind !== 'pfire' || (e.dead && e.deadT > 0.6)) continue;
      const wind = e.windT > 0 && !e.dead;
      light(e.x + e.w / 2, e.y + e.h / 2, DARK_LIGHT.fire * (wind ? 1.2 : 1), wind ? 1 : 0.85);
    }
    // ลูกไฟ
    if (g.fires) {
      for (let i = 0; i < g.fires.length; i++) light(g.fires[i].x, g.fires[i].y, DARK_LIGHT.ball, 0.9);
    }
    // ผู้เล่น (หรือร่างตอนตาย)
    const p = g.deathAnim || g.player;
    light(p.x + p.w / 2, p.y + p.h / 2, dk.radius, 1);

    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    const ctx = this.ctx;
    ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
    ctx.drawImage(cv, 0, 0, vw, vh);
  };

  // ── ลูกไฟผี (เขียวผี ต่างจากลูกไฟบอส) — ctx ถูก translate ไปที่ลูกไฟแล้ว ──
  Renderer.prototype.drawGhostFire = function (s, time) {
    const ctx = this.ctx, r = s.r;
    const fl = 1 + Math.sin(time * 34 + s.y) * 0.1;
    ctx.save();
    ctx.rotate(Math.atan2(s.vy, s.vx));
    ctx.fillStyle = 'rgba(125,255,176,0.28)';
    ellipse(ctx, -r * 0.5, 0, r * 2.2 * fl, r * 1.7 * fl); ctx.fill();
    // หางเป็นคลื่นแบบผี
    const wv = Math.sin(time * 20 + s.x * 0.1) * r * 0.25;
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(-r * 1.4, -r * 1.05 + wv, -r * 2.8 * fl, -r * 0.2 + wv);
    ctx.quadraticCurveTo(-r * 1.9, 0, -r * 2.5 * fl, r * 0.5 - wv);
    ctx.quadraticCurveTo(-r * 1.3, r * 1.05 - wv, 0, r);
    ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, true);
    ctx.fill();
    ctx.fillStyle = '#7dffb0';
    ellipse(ctx, 0, 0, r * 0.78, r * 0.78); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#c9ffe4';
    ellipse(ctx, 0, 0, r * 0.42, r * 0.42); ctx.fill();
    // ตาเล็ก ๆ ให้ดูเป็นผีน่ารัก (ตั้งตรงเสมอ)
    ctx.fillStyle = '#145a32';
    const d = s.vx < 0 ? -1 : 1;
    ctx.fillRect(d * r * 0.5 - 1.6, -r * 0.55, 1.3, 1.6);
    ctx.fillRect(d * r * 0.5 + 0.8, -r * 0.55, 1.3, 1.6);
  };
})(window);
