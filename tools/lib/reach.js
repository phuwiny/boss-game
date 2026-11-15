/*
 * BFS ตรวจการเข้าถึงด้วยฟิสิกส์จริงของเกม (ใช้ร่วมกันโดย tools/check-level.js และ tools/check-haunted.js)
 *
 *   reach(CQ, lv, ch, targets, opts) -> { got: Set<index ของ targets>, standing: จำนวนตำแหน่งยืน }
 *
 * opts.start    {tx, ty} จุดเริ่ม (ค่าเริ่ม lv.start)
 * opts.sw       'purple' | 'orange' สถานะบล็อกสวิตช์ตอนเริ่ม (ค่าเริ่ม 'purple')
 * opts.toggles  สลับสวิตช์ได้ (โหม่ง/ยิง) (ค่าเริ่ม true)
 * opts.airJumps ลองกดกระโดดกลางอากาศด้วย (ค่าเริ่ม false — ใช้ตรวจทางลัดของ Mew เท่านั้น)
 * opts.ledgeFloat ลองเดินตกขอบพร้อมกดกระโดดค้าง (ลอยตัวทันทีที่ระดับขอบ) และกดกระโดดกลางอากาศหลังตกขอบ
 *                (ค่าเริ่ม false — ใช้ตรวจทางลัดของ Mew เท่านั้น ไม่ใช้กับกฎ 1/3 จึงไม่ทำให้การตรวจหลักช้าลง)
 * opts.bounds   {tx0, tx1} ไม่ไปยืนนอกช่วงคอลัมน์นี้ (±1 ช่อง) หรือ null
 *
 * node ใน BFS = ตำแหน่งยืน + สถานะสวิตช์ (sw) + บล็อกที่ค้าง pending
 * ด่านที่ไม่มีสวิตช์จะไม่แตะสถานะสวิตช์เลย (เร็วเท่าเดิม และผลเหมือนเดิมทุกตำแหน่ง)
 */
'use strict';

const HOLDS = [4, 14, 999];  // กดกระโดดค้างกี่เฟรม
const TURNS = [20, 45];      // เฟรมที่เปลี่ยนทิศกลางอากาศ
const AIR_AT = [25, 45];     // เฟรมที่กดกระโดดกลางอากาศ (opts.airJumps)

const input = function (dir, jump, pressed) {
  return { left: dir < 0, right: dir > 0, jump: jump, jumpPressed: pressed };
};
const clone = function (p) { return Object.assign({}, p); };

function reach(CQ, lv, ch, targets, opts) {
  opts = opts || {};
  const W = CQ.World, P = CQ.PHYS, Switches = CQ.Switches, TILE = CQ.TILE;
  const T = P.T, DT = P.DT, R = P.COIN_R;
  const startAt = opts.start || lv.start;
  const startSw = opts.sw || 'purple';
  const toggles = opts.toggles !== false;
  const bounds = opts.bounds || null;
  const hasSw = !!(lv.switches && lv.switches.length) || startSw !== 'purple';
  const ev = hasSw ? [] : null;
  const savedSw = lv.sw, savedPending = Array.from(lv.swPending || []);

  const targetIndex = new Map();
  targets.forEach(function (t, i) {
    const k = t.ty * lv.w + t.tx;
    if (!targetIndex.has(k)) targetIndex.set(k, []);
    targetIndex.get(k).push(i);
  });
  const got = new Set();
  const seen = new Set();
  const queue = [];

  const key = function (p) {
    const k = Math.round(p.x / 8) + ',' + Math.round(p.y) + ',' + (Math.abs(p.vx) > 150 ? Math.sign(p.vx) : 0);
    return hasSw ? k + ',' + lv.sw : k;
  };

  function collect(p) {
    const tx0 = Math.floor((p.x - R) / T), tx1 = Math.floor((p.x + p.w + R) / T);
    const ty0 = Math.floor((p.y - R) / T), ty1 = Math.floor((p.y + p.h + R) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const list = targetIndex.get(ty * lv.w + tx);
        if (!list || got.has(list[0])) continue;
        const cx = tx * T + T / 2, cy = ty * T + T / 2;
        if (W.overlap(p.x, p.y, p.w, p.h, cx - R, cy - R, R * 2, R * 2)) list.forEach(function (i) { got.add(i); });
      }
    }
  }

  // ── สถานะสวิตช์ (ทำเฉพาะด่านที่มีสวิตช์) ──
  function snapshot() { return { sw: lv.sw, pend: Array.from(lv.swPending) }; }
  function restore(s) {
    Switches.setState(lv, s.sw);
    for (let i = 0; i < s.pend.length; i++) lv.swPending.add(s.pend[i]);
  }
  /** หลังขยับ 1 สเต็ป: โหม่งสวิตช์ = สลับ, แล้วปล่อย pending ที่ไม่มีตัวทับ */
  function afterStep(p) {
    if (ev.length) {
      if (toggles) {
        for (let i = 0; i < ev.length; i++) {
          const e = ev[i];
          if (e.type === 'bonk' && W.tileAt(lv, e.tx, e.ty) === TILE.SWITCH) Switches.toggle(lv, [p]);
        }
      }
      ev.length = 0;
    }
    Switches.settle(lv, [p]);
  }

  function enqueue(p) {
    if (bounds) {
      const ctx = Math.floor((p.x + p.w / 2) / T);
      if (ctx < bounds.tx0 - 1 || ctx > bounds.tx1 + 1) return;
    }
    const k = key(p);
    if (seen.has(k)) return;
    seen.add(k);
    const q = clone(p);
    if (hasSw) q.swNode = snapshot();
    queue.push(q);
  }

  function simAir(p, dir1, turnAt, dir2, hold, pressFirst, airAt) {
    for (let i = 0; i < 1200; i++) {
      const dir = i < turnAt ? dir1 : dir2;
      W.stepPlayer(p, input(dir, i < hold, (pressFirst && i === 0) || i === airAt), lv, DT, ev);
      if (hasSw) afterStep(p);
      if (p.dead) return;
      collect(p);
      if (i > 1 && p.onGround) { enqueue(p); return; }
    }
  }

  function simWalk(s, dir) {
    const p = clone(s);
    for (let i = 0; i < 480; i++) {
      const beforeX = p.x;
      W.stepPlayer(p, input(dir, false, false), lv, DT, ev);
      if (hasSw) afterStep(p);
      if (p.dead) return;
      collect(p);
      if (!p.onGround) {
        const st = hasSw ? snapshot() : null;
        [dir, 0, -dir].forEach(function (d2) {
          if (st) restore(st);
          simAir(clone(p), dir, 0, d2, 0, false, -1);
          if (opts.ledgeFloat) {
            // ตกขอบโดยกดกระโดดค้าง (ไม่ได้กดใหม่ จึงไม่กระโดดจากพื้น) = ลอยตัวที่ระดับขอบทันที
            if (st) restore(st);
            simAir(clone(p), dir, 0, d2, 999, false, -1);
            if (opts.airJumps) {
              for (const at of AIR_AT) { // ตกขอบแล้วกดกระโดดกลางอากาศ (ค้างไว้ต่อ = ลอยต่อหลังจุดสูงสุด)
                if (st) restore(st);
                simAir(clone(p), dir, 0, d2, 999, false, at);
              }
            }
          }
        });
        return;
      }
      if (i % 4 === 3) enqueue(p);
      if (i > 20 && p.x === beforeX) { enqueue(p); return; } // ชนกำแพง
    }
    enqueue(p);
  }

  /** ยิงจากตำแหน่งยืนทั้งสองทิศ ถ้ากระสุนชนสวิตช์ก่อนชนของทึบอื่น = สลับได้จากตรงนี้
   *  สแกนด้วยสถานะสวิตช์ของ node นี้เสมอ (sim ก่อนหน้าอาจโหม่งสวิตช์จนสถานะเปลี่ยน) */
  function shoot(s) {
    const ty = Math.floor((s.y + 13) / T);
    const cx = s.x + s.w / 2, ctx = Math.floor(cx / T);
    const range = ch && ch.shot ? ch.shot.range : 0;
    for (const d of [-1, 1]) {
      restore(s.swNode); // ทิศก่อนหน้าอาจสลับไปแล้ว
      for (let tx = ctx; ; tx += d) {
        const dist = d > 0 ? tx * T - cx : cx - (tx + 1) * T;
        if (dist > range) break;
        if (!W.isSolid(lv, tx, ty)) continue;
        if (W.tileAt(lv, tx, ty) === TILE.SWITCH) {
          restore(s.swNode);
          Switches.toggle(lv, [s]);
          enqueue(s);
        }
        break;
      }
    }
  }

  try {
    if (hasSw) Switches.setState(lv, startSw);
    const start = W.makePlayer(startAt.tx, startAt.ty, ch);
    start.guard = 0; // ไม่นับการเดินผ่านหนามด้วยการกันตาย
    if (hasSw) Switches.setState(lv, startSw, [start]);
    for (let i = 0; i < 120 && !start.onGround; i++) {
      W.stepPlayer(start, input(0, false, false), lv, DT, ev);
      if (hasSw) afterStep(start);
    }
    enqueue(start);

    while (queue.length) {
      const s = queue.shift();
      const st = hasSw ? s.swNode : null; // ทุกชุด sim เริ่มจากสถานะสวิตช์ของ node นี้
      collect(s);
      if (st) restore(st);
      simWalk(s, -1);
      if (st) restore(st);
      simWalk(s, 1);
      for (const d1 of [-1, 0, 1]) {
        for (const hold of HOLDS) {
          if (st) restore(st);
          simAir(clone(s), d1, 9999, d1, hold, true, -1);
          for (const turn of TURNS) {
            for (const d2 of [-1, 0, 1]) {
              if (d2 === d1) continue;
              if (st) restore(st);
              simAir(clone(s), d1, turn, d2, hold, true, -1);
            }
          }
        }
        if (opts.airJumps) {
          for (const at of AIR_AT) {
            for (const d2 of [-1, 0, 1]) {
              if (st) restore(st);
              simAir(clone(s), d1, d2 === d1 ? 9999 : at, d2, 999, true, at);
            }
          }
        }
      }
      if (hasSw && toggles) shoot(s);
    }
  } finally {
    if (hasSw) {
      Switches.setState(lv, savedSw);
      savedPending.forEach(function (i) { lv.swPending.add(i); });
    }
  }

  return { got: got, standing: seen.size };
}

module.exports = { reach: reach };
