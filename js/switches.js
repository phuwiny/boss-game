/*
 * Coin Quest — บล็อกสวิตช์ม่วง/ส้ม (สเตจ 4 Haunted House)
 * lv.sw = 'purple' | 'orange' (ฝั่งที่ทึบอยู่), lv.swPending = Set ของ index (ty * lv.w + tx)
 * บล็อกฝั่งที่เพิ่งเปลี่ยนมาทึบแต่มีตัวทับอยู่จะค้างเป็น "pending" (ยังโปร่ง) จนไม่มีตัวทับแล้วจึงทึบ
 * ไม่ยุ่งกับ DOM — world.js อ่าน lv.sw/lv.swPending ตรง ๆ ไม่ต้องพึ่งไฟล์นี้
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};
  const TILE = CQ.TILE;
  const T = 32;

  function colorTile(sw) { return sw === 'purple' ? TILE.PURPLE : TILE.ORANGE; }

  /** body = {x,y,w,h} ทับช่อง (tx,ty) หรือไม่ (ทับจริง ไม่นับแค่แตะขอบ) */
  function touches(b, tx, ty) {
    return b.x < (tx + 1) * T && b.x + b.w > tx * T && b.y < (ty + 1) * T && b.y + b.h > ty * T;
  }

  function anyTouch(bodies, tx, ty) {
    for (let i = 0; i < bodies.length; i++) if (touches(bodies[i], tx, ty)) return true;
    return false;
  }

  /** ใส่ pending ให้บล็อกสีที่ทึบอยู่ตอนนี้และมี body ทับอยู่ */
  function markPending(lv, bodies) {
    if (!bodies || !bodies.length) return;
    const want = colorTile(lv.sw);
    for (let ty = 0; ty < lv.h; ty++) {
      for (let tx = 0; tx < lv.w; tx++) {
        const i = ty * lv.w + tx;
        if (lv.tiles[i] === want && anyTouch(bodies, tx, ty)) lv.swPending.add(i);
      }
    }
  }

  /** สลับสถานะ แล้วคืนสถานะใหม่ ('purple' | 'orange') */
  function toggle(lv, bodies) {
    lv.sw = lv.sw === 'purple' ? 'orange' : 'purple';
    lv.swPending.clear();
    markPending(lv, bodies);
    return lv.sw;
  }

  /** ลบ pending ของบล็อกที่ไม่มี body ทับแล้ว (เรียกทุกเฟรม) */
  function settle(lv, bodies) {
    if (lv.swPending.size === 0) return;
    const list = bodies || [];
    lv.swPending.forEach(function (i) {
      const tx = i % lv.w, ty = (i - tx) / lv.w;
      if (!anyTouch(list, tx, ty)) lv.swPending.delete(i);
    });
  }

  /** ตั้งสถานะตรง ๆ (เช่น ตอนเกิดใหม่/เช็กพอยต์) ล้าง pending แล้วคำนวณใหม่จาก bodies */
  function setState(lv, sw, bodies) {
    lv.sw = sw;
    lv.swPending.clear();
    markPending(lv, bodies);
  }

  /** ช่องนี้เป็นบล็อกสีที่ไม่ทึบตอนนี้ (ฝั่งตรงข้าม หรือ pending) — ไว้ให้ renderer วาดเป็นเงาจาง */
  function isGhost(lv, tx, ty) {
    if (tx < 0 || tx >= lv.w || ty < 0 || ty >= lv.h) return false;
    const t = lv.tiles[ty * lv.w + tx];
    if (t !== TILE.PURPLE && t !== TILE.ORANGE) return false;
    return !CQ.World.isSolid(lv, tx, ty);
  }

  CQ.Switches = {
    toggle: toggle,
    settle: settle,
    setState: setState,
    isGhost: isGhost
  };
})(typeof window !== 'undefined' ? window : globalThis);
