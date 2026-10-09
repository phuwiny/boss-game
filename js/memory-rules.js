/*
 * Coin Quest — มินิเกม "Memory Match" (จับคู่การ์ด): กติกา การสับไพ่ ความสามารถตัวละคร และการจัดอันดับสถิติ
 * ไม่ยุ่งกับ DOM จึงทดสอบใน Node ได้ (node tools/check-memory.js)
 *
 * ลำดับ: แจกการ์ดคว่ำ → เปิดให้ดูทั้งกระดานชั่วครู่ (preview) → เริ่มจับเวลา → เปิดทีละ 2 ใบ
 *   ภาพตรงกัน = จับคู่ได้ (เปิดค้าง) · ไม่ตรง = คว่ำกลับหลังครู่หนึ่ง (แตะใบใดก็ได้ระหว่างนั้น คู่เดิมคว่ำทันทีแล้วเปิดใบที่แตะ)
 *   จับครบทุกคู่ = ชนะ วัดผลจากเวลา (น้อยดีกว่า) แล้วดูจำนวนครั้งที่เปิด
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  const LEVELS = {
    easy: { id: 'easy', name: 'ง่าย', cols: 3, rows: 4 },
    normal: { id: 'normal', name: 'ปานกลาง', cols: 4, rows: 4 },
    hard: { id: 'hard', name: 'ยาก', cols: 4, rows: 5 }
  };
  const LEVEL_IDS = ['easy', 'normal', 'hard'];

  // หน้าการ์ด (ต้องมีอย่างน้อยเท่าจำนวนคู่ของระดับยากที่สุด)
  const FACES = ['bobo', 'mew', 'aclaire', 'coin', 'star', 'mush', 'heart', 'gem', 'turtle', 'boar', 'slime', 'fire'];

  const PREVIEW = 1.5;   // เปิดให้ดูทั้งกระดานตอนเริ่ม (วินาที)
  const MISS_SHOW = 0.8; // เปิดผิดคู่แล้วโชว์ค้างไว้กี่วินาทีก่อนคว่ำกลับ
  const PEEK_TIME = 1;   // Mew: ส่องดูทั้งกระดาน

  // ความสามารถของแต่ละตัวละครในมินิเกมนี้
  const PERKS = {
    bobo: { preview: 3, missShow: MISS_SHOW, peeks: 0, desc: 'จำเก่ง ดูกระดานตอนเริ่มได้ 3 วินาที (ตัวอื่น 1.5)' },
    mew: { preview: PREVIEW, missShow: MISS_SHOW, peeks: 1, desc: 'กดปุ่ม "ส่องดู" เปิดทั้งกระดาน 1 วินาทีได้ 1 ครั้ง' },
    aclaire: { preview: PREVIEW, missShow: 0.4, peeks: 0, desc: 'มือไว เปิดผิดแล้วการ์ดคว่ำกลับเร็วขึ้นเท่าตัว' }
  };

  function perksFor(charId) { return PERKS[charId] || PERKS.bobo; }
  function levelFor(id) { return LEVELS[id] || LEVELS.normal; }

  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  function newGame(opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;
    const lv = levelFor(opts.level);
    const perks = perksFor(opts.charId);
    const pairs = lv.cols * lv.rows / 2;
    const faces = shuffle(FACES.slice(), rng).slice(0, pairs);
    const deck = shuffle(faces.concat(faces), rng);
    return {
      level: lv,
      perks: perks,
      pairs: pairs,
      cards: deck.map(function (f) { return { face: f, up: false, matched: false }; }),
      open: [],          // ใบที่เปิดอยู่และยังไม่ได้จับคู่ (สูงสุด 2)
      hideT: 0,          // นับถอยหลังก่อนคว่ำคู่ที่ผิด
      previewT: perks.preview,
      peekT: 0,
      peeks: perks.peeks,
      t: 0,              // เวลาที่ใช้ (เริ่มนับหลัง preview)
      moves: 0,          // จำนวนครั้งที่เปิดครบ 2 ใบ
      matched: 0,
      done: false
    };
  }

  /** การ์ดใบนี้ควรแสดงหน้าหรือไม่ (รวม preview / ส่องดู) */
  function faceUp(s, i) {
    const c = s.cards[i];
    return c.up || c.matched || s.previewT > 0 || s.peekT > 0;
  }

  function hideMissed(s) {
    for (let k = 0; k < s.open.length; k++) s.cards[s.open[k]].up = false;
    s.open = [];
    s.hideT = 0;
  }

  /**
   * แตะการ์ดใบที่ i คืนรายการเหตุการณ์ { type: flip|match|miss|win, i, j }
   * แตะไม่ได้ (คืน []) ระหว่าง preview/ส่องดู หรือใบที่เปิดอยู่/จับคู่แล้ว
   */
  function flip(s, i) {
    const ev = [];
    const c = s.cards[i];
    if (s.done || !c || s.previewT > 0 || s.peekT > 0 || c.matched) return ev;
    // แตะระหว่างโชว์คู่ที่ผิด: คว่ำคู่นั้นทันที (แตะใบเดิมในคู่นั้นซ้ำก็ได้ จะเปิดใบนั้นใหม่)
    if (s.open.length >= 2) hideMissed(s);
    if (c.up) return ev;
    c.up = true;
    s.open.push(i);
    ev.push({ type: 'flip', i: i });
    if (s.open.length < 2) return ev;

    s.moves++;
    const a = s.open[0], b = s.open[1];
    if (s.cards[a].face === s.cards[b].face) {
      s.cards[a].matched = s.cards[b].matched = true;
      s.cards[a].up = s.cards[b].up = false;
      s.open = [];
      s.matched++;
      ev.push({ type: 'match', i: a, j: b, face: s.cards[a].face });
      if (s.matched >= s.pairs) {
        s.done = true;
        ev.push({ type: 'win' });
      }
    } else {
      s.hideT = s.perks.missShow;
      ev.push({ type: 'miss', i: a, j: b });
    }
    return ev;
  }

  /** Mew: ส่องดูทั้งกระดาน คืน true ถ้าใช้ได้ */
  function peek(s) {
    if (s.done || s.peeks <= 0 || s.previewT > 0 || s.peekT > 0) return false;
    s.peeks--;
    s.peekT = PEEK_TIME;
    if (s.open.length >= 2) hideMissed(s);
    return true;
  }

  /** เดินเวลา คืน 'start' เมื่อหมด preview (เริ่มจับเวลา) หรือ 'hide' เมื่อคู่ที่ผิดคว่ำกลับ */
  function step(s, dt) {
    if (s.done) return null;
    if (s.previewT > 0) {
      s.previewT = Math.max(0, s.previewT - dt);
      return s.previewT === 0 ? 'start' : null;
    }
    s.t += dt;
    if (s.peekT > 0) s.peekT = Math.max(0, s.peekT - dt);
    if (s.hideT > 0) {
      s.hideT -= dt;
      if (s.hideT <= 0) { hideMissed(s); return 'hide'; }
    }
    return null;
  }

  /** ดาว 1-3 จากจำนวนครั้งที่เปิด เทียบกับจำนวนคู่ */
  function stars(moves, pairs) {
    if (moves <= Math.ceil(pairs * 1.5)) return 3;
    if (moves <= pairs * 2.5) return 2;
    return 1;
  }

  /** a ดีกว่า b หรือไม่ (เวลาน้อยกว่า ถ้าเท่ากันดูจำนวนครั้งที่เปิด) */
  function isBetter(a, b) {
    if (!b) return true;
    if (a.time !== b.time) return a.time < b.time;
    return a.moves < b.moves;
  }

  CQ.MemoryRules = {
    LEVELS: LEVELS,
    LEVEL_IDS: LEVEL_IDS,
    FACES: FACES,
    PERKS: PERKS,
    PEEK_TIME: PEEK_TIME,
    perksFor: perksFor,
    levelFor: levelFor,
    newGame: newGame,
    faceUp: faceUp,
    flip: flip,
    peek: peek,
    step: step,
    stars: stars,
    isBetter: isBetter
  };
})(typeof window !== 'undefined' ? window : globalThis);
