/*
 * Coin Quest — สุ่มวางเหรียญและไอเทม
 *
 * 1) buildPool: หาจุดที่วางของได้ทั้งหมดจากรูปร่างด่าน (เหนือพื้น/แผ่นไม้ 1-3 ช่อง ไม่ติดหนามหรือสปริง)
 *    ทุกจุดใน pool ถูกตรวจแล้วด้วย tools/check-level.js ว่าผู้เล่นเก็บได้จริง
 * 2) pick: เลือกจุดจาก pool ด้วยตัวสุ่มที่กำหนด seed ได้ (seed รายวัน = ทุกคนเจอแบบเดียวกันในวันเดียวกัน)
 *    โดยแบ่งด่านเป็นช่วง ๆ เพื่อให้ของกระจายทั่วทั้งด่าน
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const TILE = CQ.TILE;

  const COINS = 40;        // จำนวนเหรียญในฉาก
  const GOAL = 20;         // เก็บครบเท่านี้ = ชนะ
  const ITEMS = ['wing', 'wing', 'mush', 'mush', 'star', 'star'];
  const TIMED_COINS = 80;  // โหมดจับเวลา: จำนวนเหรียญในฉาก
  const TIMED_TIME = 120;  // โหมดจับเวลา: เวลาที่มี (วินาที)

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /** ตัวสุ่ม mulberry32 ที่ให้ผลเหมือนกันทุกเครื่องเมื่อ seed เดียวกัน */
  function makeRng(seed) {
    let s = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** seed ประจำวันตามวันที่ของเครื่องผู้เล่น เช่น "2026-10-03" */
  function dailySeed(date) {
    const d = date || new Date();
    const pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** seed ของแต่ละโหมด โหมดจับเวลาต่อท้ายเพื่อให้ตำแหน่งของต่างจากโหมดปกติในวันเดียวกัน */
  function modeSeed(seed, mode) {
    return mode === 'timed' ? seed + '|timed' : seed;
  }

  /**
   * หาจุดที่วางเหรียญ/ไอเทมได้
   * @param lv ด่านที่ parse แบบ staticPlatforms: true (รางแพลตฟอร์มถือเป็นแผ่นไม้)
   */
  function buildPool(lv) {
    const W = CQ.World;
    const tile = function (x, y) { return W.tileAt(lv, x, y); };
    const empty = function (x, y) { return tile(x, y) === TILE.EMPTY; };
    const track = new Set();
    lv.tracks.forEach(function (tr) {
      for (let x = tr.tx0; x <= tr.tx1; x++) track.add(tr.ty * lv.w + x);
    });
    const nearHazard = function (x, y) {
      for (let yy = y - 1; yy <= y + 1; yy++) {
        for (let xx = x - 1; xx <= x + 1; xx++) {
          const t = tile(xx, yy);
          if (t === TILE.SPRING || (t === TILE.SPIKE && yy >= y)) return true;
        }
      }
      return false;
    };
    const blocked = function (x, y) {
      const s = lv.start;
      if (Math.abs(x - s.tx) <= 2 && y >= s.ty - 3 && y <= s.ty) return true;
      return lv.checkpoints.some(function (c) { return x >= c.tx && x <= c.tx + 1 && y >= c.ty - 2 && y <= c.ty; });
    };

    const pool = [];
    for (let tx = 0; tx < lv.w; tx++) {
      for (let ty = 1; ty < lv.h; ty++) {
        const t = tile(tx, ty);
        if (t !== TILE.GROUND && t !== TILE.BRICK && t !== TILE.ONEWAY) continue;
        if (!empty(tx, ty - 1)) continue;
        const maxD = track.has(ty * lv.w + tx) ? 2 : 3;
        for (let d = 1; d <= maxD; d++) {
          const sy = ty - d;
          if (sy < 0 || !empty(tx, sy)) break;
          if (nearHazard(tx, sy) || blocked(tx, sy)) continue;
          pool.push({ tx: tx, ty: sy, d: d });
        }
      }
    }
    return pool;
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /**
   * เลือกตำแหน่งเหรียญและไอเทม
   * @returns {{coins: {tx,ty}[], items: {tx,ty,type}[]}}
   */
  function pick(pool, levelW, rng, opts) {
    opts = opts || {};
    const nCoins = opts.coins || COINS;
    const itemTypes = shuffle((opts.items || ITEMS).slice(), rng);
    const used = [];
    const farFrom = function (s, min) {
      for (let i = 0; i < used.length; i++) {
        if (Math.max(Math.abs(used[i].tx - s.tx), Math.abs(used[i].ty - s.ty)) < min) return false;
      }
      return true;
    };
    const take = function (cands, min) {
      for (let i = 0; i < cands.length; i++) {
        if (farFrom(cands[i], min)) { used.push(cands[i]); return cands[i]; }
      }
      return null;
    };
    const inRange = function (x0, x1) {
      return pool.filter(function (s) { return s.tx >= x0 && s.tx < x1; });
    };

    // เหรียญ: แบ่งด่านเป็นช่วง ช่วงละ 2 เหรียญ
    const coins = [];
    const segs = Math.ceil(nCoins / 2);
    const segW = levelW / segs;
    for (let s = 0; s < segs && coins.length < nCoins; s++) {
      const cands = shuffle(inRange(s * segW, (s + 1) * segW), rng);
      for (let k = 0; k < 2 && coins.length < nCoins; k++) {
        const c = take(cands, 3) || take(cands, 2);
        if (c) coins.push({ tx: c.tx, ty: c.ty });
      }
    }
    if (coins.length < nCoins) {
      const rest = shuffle(pool.slice(), rng);
      while (coins.length < nCoins) {
        const c = take(rest, 2) || take(rest, 1);
        if (!c) break;
        coins.push({ tx: c.tx, ty: c.ty });
      }
    }

    // ไอเทม: แบ่งด่านเป็นช่วงตามจำนวนไอเทม ช่วงละ 1 ชิ้น ไม่วางใกล้จุดเริ่มต้นเกินไป
    const items = [];
    const iw = levelW / itemTypes.length;
    for (let i = 0; i < itemTypes.length; i++) {
      const cands = shuffle(inRange(Math.max(i * iw, 8), (i + 1) * iw), rng);
      const s = take(cands, 3) || take(cands, 2) || take(shuffle(pool.slice(), rng), 2);
      if (s) items.push({ tx: s.tx, ty: s.ty, type: itemTypes[i] });
    }
    return { coins: coins, items: items };
  }

  CQ.Spawn = {
    COINS: COINS,
    GOAL: GOAL,
    ITEMS: ITEMS,
    TIMED_COINS: TIMED_COINS,
    TIMED_TIME: TIMED_TIME,
    makeRng: makeRng,
    dailySeed: dailySeed,
    modeSeed: modeSeed,
    buildPool: buildPool,
    pick: pick
  };
})(typeof window !== 'undefined' ? window : globalThis);
