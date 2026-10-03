/*
 * Coin Quest — HUD แบบเกมคลาสสิก (pixel art) วาดลง canvas ของเกม ไม่ใช้ฟอนต์หรือไฟล์ภาพภายนอก
 *
 * ทุกอย่างวัดเป็น "พิกเซล HUD" แล้วขยายด้วย P (จำนวน device px ต่อ 1 พิกเซล HUD เป็นจำนวนเต็ม ภาพจึงคม)
 * กรอบเหรียญและเวลาอยู่มุมซ้ายบน แถบไอเทมอยู่ใต้กรอบ ส่วนปุ่มมุมขวาบนเป็นปุ่ม DOM ที่แต่งให้เข้าชุด (css/style.css)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  const K = '#140b20';      // เส้นขอบนอก
  const FILL = '#241a42';   // พื้นกรอบ
  const FILL2 = '#2f2457';
  const RIM = '#f1ecff';    // ขอบในด้านสว่าง
  const RIM2 = '#9b90c4';   // ขอบในด้านเงา

  // ตัวเลขพิกเซล 5x7
  const FONT = {
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    ':': ['..', '##', '##', '..', '##', '##', '..'],
    '.': ['..', '..', '..', '..', '..', '##', '##'],
    '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....']
  };

  // ไอคอน 9x9
  const ICONS = {
    coin: { m: { k: K, y: '#ffd23f', L: '#fff3a0', Y: '#d48a00' }, r: ['..kkkkk..', '.kyyyyyk.', 'kyLLLyyYk', 'kyLyyyyYk', 'kyLyyyyYk', 'kyyyyyyYk', 'kyyyyyYYk', '.kYYYYYk.', '..kkkkk..'] },
    clock: { m: { k: K, w: '#ffffff', W: '#c9c2e6' }, r: ['..kkkkk..', '.kwwwwwk.', 'kwwwkwwwk', 'kwwwkwwwk', 'kwwwkkwwk', 'kwwwwwwwk', 'kwwwwwwWk', '.kWWWWWk.', '..kkkkk..'] },
    star: { m: { k: K, y: '#ffd23f', L: '#fff3a0', Y: '#e09b00' }, r: ['....k....', '...kyk...', 'kkkkLykkk', 'kyLyyyyYk', '.kyyyyYk.', '..kyyyk..', '.kyyYyyk.', '.kyk.kYk.', '.kk...kk.'] },
    mush: { m: { k: K, r: '#ff4d6a', w: '#ffffff', s: '#f7e7c6', S: '#d9bf92' }, r: ['..kkkkk..', '.krrwrrk.', 'krwwrrwrk', 'krrrrrrrk', '.kkkkkkk.', '..kssSk..', '..kssSk..', '..kkkkk..', '.........'] },
    wing: { m: { k: K, w: '#ffffff', W: '#a9d4f5', y: '#ffd23f' }, r: ['.........', 'kk.....kk', 'kwk...kwk', 'kwWk.kWwk', 'kwwWkWwwk', '.kwwywwk.', '..kWWWk..', '...kkk...', '.........'] }
  };
  const POWER_COLOR = { wing: ['#bfe6ff', '#6fb8ef'], mush: ['#ff9db0', '#ff4d6a'], star: ['#fff3a0', '#ffc21a'] };
  const POWERS = ['wing', 'mush', 'star'];

  function textW(str) {
    let w = 0;
    for (let i = 0; i < str.length; i++) w += FONT[str[i]][0].length + 1;
    return w - 1;
  }

  const COIN_W = 4 + 9 + 3 + textW('00/00') + 5;
  const TIME_W = 4 + 9 + 3 + textW('00:00.0') + 5;
  const ROW_H = 17;     // ความสูงกรอบปกติ
  const TIMED_H = 23;   // กรอบเวลาโหมดจับเวลา (มีแถบเวลา)
  const POWER_W = 66, POWER_H = 15, GAP = 2;

  /** ขนาดพิกเซล HUD (device px) ตามขนาดจอ อย่างน้อย 2 css px */
  function pixelSize(cssW, cssH, dpr) {
    return Math.max(Math.round(Math.min(cssW, cssH) * dpr / 240), Math.round(2 * dpr), 2);
  }

  /**
   * จัดตำแหน่ง HUD และมินิแมพ (หน่วย device px)
   * o = { P, ox, oy: มุมซ้ายบนของ HUD, right: ขอบซ้ายของกลุ่มปุ่ม, vw: ความกว้างจอ, timed, ratio: สัดส่วนสูง/กว้างของมินิแมพ, dpr }
   */
  function layout(o) {
    const P = o.P;
    const rowH = o.timed ? TIMED_H : ROW_H;
    const gap = 6 * P;
    const L = { P: P, ox: o.ox, oy: o.oy, timed: o.timed, rowH: rowH, timeX: COIN_W + GAP, timeY: 0 };
    let rowRight = o.ox + (COIN_W + GAP + TIME_W) * P;
    if (rowRight + gap > o.right) {
      // จอแคบ: กรอบเวลาลงไปอยู่ใต้กรอบเหรียญ ไม่ให้ชนปุ่ม
      L.timeX = 0;
      L.timeY = ROW_H + GAP;
      rowRight = o.ox + Math.max(COIN_W, TIME_W) * P;
    }
    const bottom = L.timeY + rowH; // ขอบล่างของกรอบ (พิกเซล HUD)
    const space = o.right - gap - (rowRight + gap);
    if (space >= 160 * o.dpr) {
      // มินิแมพอยู่แถวเดียวกับกรอบ ระหว่างกรอบเวลากับปุ่ม
      const w = Math.min(340 * o.dpr, space);
      L.minimap = { x: rowRight + gap + (space - w) / 2, y: o.oy + (ROW_H * P) / 2 - (w * o.ratio) / 2, w: w, h: w * o.ratio };
      L.powersY = bottom + GAP;
    } else {
      // จอแคบ: มินิแมพอยู่ใต้กรอบ แถบไอเทมอยู่ใต้มินิแมพ
      const w = Math.min(300 * o.dpr, o.vw - o.ox * 2);
      L.minimap = { x: o.ox, y: o.oy + (bottom + 4) * P, w: w, h: w * o.ratio };
      L.powersY = Math.ceil((L.minimap.y + L.minimap.h - o.oy) / P) + 4;
    }
    return L;
  }

  function Painter(ctx, L) { this.ctx = ctx; this.L = L; }
  Painter.prototype.px = function (x, y, w, h, c) {
    const L = this.L;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(L.ox + x * L.P, L.oy + y * L.P, w * L.P, h * L.P);
  };
  /** กรอบหน้าต่างมุมตัด: ขอบดำ + ขอบในสว่าง/เงา + พื้นเข้ม */
  Painter.prototype.panel = function (x, y, w, h) {
    this.px(x + 1, y, w - 2, h, K);
    this.px(x, y + 1, w, h - 2, K);
    this.px(x + 1, y + 1, w - 2, h - 2, RIM);
    this.px(x + 2, y + h - 2, w - 3, 1, RIM2);
    this.px(x + w - 2, y + 2, 1, h - 3, RIM2);
    this.px(x + 2, y + 2, w - 4, h - 4, K);
    this.px(x + 3, y + 3, w - 6, h - 6, FILL);
    this.px(x + 3, y + 3, w - 6, 1, FILL2);
  };
  Painter.prototype.icon = function (name, x, y) {
    const ic = ICONS[name];
    for (let r = 0; r < ic.r.length; r++) {
      const row = ic.r[r];
      for (let c = 0; c < row.length; c++) if (row[c] !== '.') this.px(x + c, y + r, 1, 1, ic.m[row[c]]);
    }
  };
  /** ตัวเลขพิกเซลพร้อมเงาเข้มด้านล่างขวา คืนตำแหน่ง x ถัดไป */
  Painter.prototype.text = function (str, x, y, color) {
    for (let pass = 0; pass < 2; pass++) {
      let cx = x;
      for (let i = 0; i < str.length; i++) {
        const g = FONT[str[i]];
        for (let r = 0; r < g.length; r++) {
          for (let c = 0; c < g[r].length; c++) {
            if (g[r][c] !== '#') continue;
            if (pass === 0) this.px(cx + c + 1, y + r + 1, 1, 1, K);
            else this.px(cx + c, y + r, 1, 1, color);
          }
        }
        cx += g[0].length + 1;
      }
      if (pass === 1) return cx;
    }
    return x;
  };
  /** แถบแบบแถบเลือดเกมเก่า */
  Painter.prototype.bar = function (x, y, w, h, frac, cols) {
    this.px(x, y, w, h, K);
    this.px(x + 1, y + 1, w - 2, h - 2, '#3a2f60');
    const fw = Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, frac))));
    if (fw <= 0) return;
    this.px(x + 1, y + 1, fw, h - 2, cols[1]);
    this.px(x + 1, y + 1, fw, 1, cols[0]);
    for (let i = x + 6; i < x + 1 + fw; i += 6) this.px(i, y + 2, 1, h - 3, 'rgba(0,0,0,0.18)');
  };

  function fmt(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + d;
  }

  function timeColors(frac) {
    if (frac < 0.1) return ['#ffb0a0', '#ff4b3a'];
    if (frac < 0.35) return ['#ffe3a0', '#ff9b2a'];
    return ['#fff7b0', '#ffd23f'];
  }

  /** วาด HUD จากสถานะเกม g  (ctx ต้องไม่มี transform) */
  function draw(ctx, g, L, time) {
    const pt = new Painter(ctx, L);
    // เหรียญ
    pt.panel(0, 0, COIN_W, ROW_H);
    pt.icon('coin', 4, 4);
    const bump = g.bumpT != null && time - g.bumpT < 0.22;
    const x = pt.text((g.collected < 10 ? '0' : '') + g.collected, 16, bump ? 4 : 5, bump ? '#ffffff' : '#ffd23f');
    pt.text('/' + g.goal, x, 5, '#cfc8ea');
    // เวลา
    const timed = !!g.limit;
    const left = timed ? Math.max(0, g.limit - g.time) : 0;
    const warn = timed && left < 10;
    const ty = L.timeY;
    pt.panel(L.timeX, ty, TIME_W, L.rowH);
    pt.icon('clock', L.timeX + 4, ty + 4);
    pt.text(fmt(timed ? left : g.time), L.timeX + 16, ty + 5, warn && Math.floor(time * 4) % 2 === 0 ? '#ff6a5a' : '#ffffff');
    if (timed) {
      const frac = left / g.limit;
      pt.bar(L.timeX + 4, ty + 15, TIME_W - 8, 5, frac, timeColors(frac));
    }
    // ไอเทมที่ใช้งานอยู่ (กะพริบช่วง 2 วินาทีสุดท้าย)
    if (g.deathAnim) return;
    const pw = g.player.pw;
    let y = L.powersY;
    for (let i = 0; i < POWERS.length; i++) {
      const k = POWERS[i], t = pw[k];
      if (!(t > 0)) continue;
      if (t < 2 && Math.floor(time * 8) % 2 === 0) { y += POWER_H + 1; continue; }
      pt.panel(0, y, POWER_W, POWER_H);
      pt.icon(k, 3, y + 3);
      pt.bar(14, y + 5, POWER_W - 18, 5, t / CQ.PHYS.POWER_TIME, POWER_COLOR[k]);
      y += POWER_H + 1;
    }
  }

  CQ.HUD = { pixelSize: pixelSize, layout: layout, draw: draw };
})(typeof window !== 'undefined' ? window : globalThis);
