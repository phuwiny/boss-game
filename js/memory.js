/*
 * Coin Quest — มินิเกม "Memory Match" หน้าจอ การ์ด และสถิติ
 * กติกาอยู่ใน js/memory-rules.js ส่วนการสลับหน้าจออยู่ใน js/main.js (เรียก CQ.Memory.frame ทุกเฟรม)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ;
  const R = CQ.MemoryRules;
  const Sound = CQ.Audio;
  const LEVEL_KEY = 'coinquest.memory.level';
  const BEST_KEY = 'coinquest.memory.best.'; // + ระดับ + '.' + id ตัวละคร
  const CHARS = { bobo: 1, mew: 1, aclaire: 1 };
  const SLIME_SVG = '<svg viewBox="0 0 32 26" aria-hidden="true"><path d="M3 24C1 24 1 21 2 18C4 9 10 2 16 2S28 9 30 18C31 21 31 24 29 24Z" fill="#5fd35a" stroke="#2b7a2b" stroke-width="2"/>' +
    '<ellipse cx="10" cy="9" rx="3" ry="2" fill="#c9f7c0"/><ellipse cx="12" cy="15" rx="2" ry="3" fill="#183018"/><ellipse cx="20" cy="15" rx="2" ry="3" fill="#183018"/></svg>';
  const FACE_INFO = {
    bobo: { name: 'Bobo' },
    mew: { name: 'Mew' },
    aclaire: { name: 'Aclaire' },
    coin: { name: 'เหรียญ', icon: '🪙' },
    star: { name: 'ดาว', icon: '⭐' },
    mush: { name: 'เห็ด', icon: '🍄' },
    heart: { name: 'หัวใจ', icon: '❤️' },
    gem: { name: 'เพชร', icon: '💎' },
    turtle: { name: 'เต่าปีศาจ', icon: '🐢' },
    boar: { name: 'หมูป่า', icon: '🐗' },
    slime: { name: 'สไลม์', svg: SLIME_SVG },
    fire: { name: 'ลูกไฟ', icon: '🔥' }
  };

  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    screen: $('screen-memory'),
    card: $('mem-card'),
    time: $('mem-time'),
    setup: $('mem-setup'),
    levels: $('mem-levels'),
    perk: $('mem-perk'),
    play: $('mem-play'),
    moves: $('mem-moves'),
    pairs: $('mem-pairs'),
    peek: $('btn-mem-peek'),
    board: $('mem-board'),
    msg: $('mem-msg'),
    result: $('mem-result'),
    resStars: $('mem-res-stars'),
    resTime: $('mem-res-time'),
    resSub: $('mem-res-sub'),
    resBest: $('mem-res-best'),
    resNew: $('mem-res-new')
  };

  let opts = {};
  let charId = 'bobo';
  let level = R.LEVELS[CQ.store.get(LEVEL_KEY)] ? CQ.store.get(LEVEL_KEY) : 'easy';
  let s = null;
  let mode = null; // setup | play | done
  let cardEls = [];
  let lastSec = -1;
  let boardH = 0;
  let cols = 4;     // จำนวนคอลัมน์ที่แสดงจริง (อาจสลับกับแถวในจอแนวนอน)

  function bestKey(lv, ch) { return BEST_KEY + lv + '.' + ch; }
  function loadBest(lv, ch) {
    try { return JSON.parse(CQ.store.get(bestKey(lv, ch))) || null; } catch (e) { return null; }
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60), sec = t - m * 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
  }

  function starText(n) { return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n); }

  function focusLater(el) {
    if (el) setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  // ── หน้าเลือกระดับ ───────────────────────────────────────────────
  function showSetup() {
    mode = 'setup';
    s = null;
    ui.card.classList.remove('playing');
    ui.setup.hidden = false;
    ui.play.hidden = true;
    ui.result.hidden = true;
    ui.time.textContent = '';
    const ch = CQ.getCharacter(charId);
    ui.perk.textContent = ch.name + ': ' + R.perksFor(charId).desc;
    let h = '';
    R.LEVEL_IDS.forEach(function (id) {
      const lv = R.LEVELS[id];
      const best = loadBest(id, charId);
      h += '<button class="btn mem-level' + (id === level ? ' btn-primary' : '') + '" type="button" data-level="' + id + '">' +
        '<b>' + lv.name + '</b><span>' + lv.cols + '×' + lv.rows + ' · ' + (lv.cols * lv.rows / 2) + ' คู่</span>' +
        '<small>' + (best ? 'สถิติ ' + fmtTime(best.time) + ' · ' + best.moves + ' ครั้ง' : 'ยังไม่มีสถิติ') + '</small></button>';
    });
    ui.levels.innerHTML = h;
    focusLater(ui.levels.querySelector('.btn-primary'));
  }

  // ── เริ่มเกม / กระดาน ───────────────────────────────────────────
  function faceHtml(f) {
    const info = FACE_INFO[f];
    if (CHARS[f]) return '<canvas class="mem-hero" data-hero="' + f + '" aria-hidden="true"></canvas>';
    if (info.svg) return '<span class="mem-svg">' + info.svg + '</span>';
    return '<span class="mem-emoji" aria-hidden="true">' + info.icon + '</span>';
  }

  function begin(lv) {
    Sound.unlock();
    level = lv || level;
    CQ.store.set(LEVEL_KEY, level);
    s = R.newGame({ level: level, charId: charId });
    mode = 'play';
    lastSec = -1;
    ui.card.classList.add('playing');
    ui.setup.hidden = true;
    ui.result.hidden = true;
    ui.play.hidden = false;
    let h = '';
    for (let i = 0; i < s.cards.length; i++) {
      h += '<button class="mem-card" type="button" data-i="' + i + '">' +
        '<span class="mem-inner"><span class="mem-back" aria-hidden="true"></span>' +
        '<span class="mem-face">' + faceHtml(s.cards[i].face) + '</span></span></button>';
    }
    ui.board.innerHTML = h;
    cardEls = Array.prototype.slice.call(ui.board.querySelectorAll('.mem-card'));
    ui.board.querySelectorAll('canvas[data-hero]').forEach(drawHero);
    ui.peek.hidden = !s.perks.peeks;
    say('จำตำแหน่งการ์ดไว้ให้ดี…');
    layout();
    sync();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  /** วาดตัวละครแบบ pixel art ลงการ์ด (ขยายจำนวนเต็มเท่า ภาพคม) */
  function drawHero(cv) {
    const fr = CQ.heroFrame(cv.getAttribute('data-hero'), 'idle');
    const k = 4;
    cv.width = fr.w * k;
    cv.height = fr.h * k;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(fr.c, 0, 0, fr.w * k, fr.h * k);
  }

  /**
   * ขนาดการ์ดให้กระดานพอดีจอโดยไม่ต้องเลื่อน (สัดส่วนการ์ด กว้าง:สูง = 4:5)
   * จอแนวนอนที่เตี้ยจะวางกระดานตะแคง (สลับแถว/คอลัมน์) ถ้าได้การ์ดใหญ่กว่า
   */
  function layout() {
    if (mode === 'setup' || !s) return;
    const gap = 8;
    ui.board.style.setProperty('--cw', '10px');
    const w = ui.board.clientWidth, h = ui.board.clientHeight;
    boardH = h;
    if (!w || !h) return;
    const fit = function (cols, rows) {
      return Math.floor(Math.min((w - gap * (cols - 1)) / cols, ((h - gap * (rows - 1)) / rows) * 0.8, 130));
    };
    const a = fit(s.level.cols, s.level.rows), b = fit(s.level.rows, s.level.cols);
    cols = b > a ? s.level.rows : s.level.cols;
    ui.board.style.setProperty('--cols', cols);
    ui.board.style.setProperty('--cw', Math.max(30, Math.max(a, b)) + 'px');
  }

  function say(text, cls) {
    ui.msg.textContent = text;
    ui.msg.className = 'mem-msg' + (cls ? ' ' + cls : '');
  }

  function sync() {
    for (let i = 0; i < cardEls.length; i++) {
      const el = cardEls[i], c = s.cards[i];
      const up = R.faceUp(s, i);
      el.classList.toggle('up', up);
      el.classList.toggle('matched', c.matched);
      el.disabled = c.matched;
      el.setAttribute('aria-label', up ? FACE_INFO[c.face].name + (c.matched ? ' (จับคู่แล้ว)' : '') : 'การ์ดคว่ำ ใบที่ ' + (i + 1));
    }
    ui.moves.textContent = s.moves;
    ui.pairs.textContent = s.matched + '/' + s.pairs;
    ui.peek.disabled = s.peeks <= 0 || s.previewT > 0 || s.peekT > 0 || s.done;
    ui.peek.textContent = s.peeks > 0 ? '👁️ ส่องดู' : '👁️ ใช้แล้ว';
  }

  function onCard(i) {
    if (mode !== 'play' || !s) return;
    const ev = R.flip(s, i);
    if (!ev.length) return;
    for (let k = 0; k < ev.length; k++) {
      const e = ev[k];
      if (e.type === 'flip') Sound.sfx.click();
      else if (e.type === 'match') {
        Sound.sfx.coin();
        [e.i, e.j].forEach(function (x) {
          cardEls[x].classList.remove('pop');
          void cardEls[x].offsetWidth; // เริ่มแอนิเมชันใหม่
          cardEls[x].classList.add('pop');
        });
        say('จับคู่ได้! ' + FACE_INFO[e.face].name, 'good');
      } else if (e.type === 'miss') {
        Sound.sfx.bonk();
        cardEls[e.i].classList.add('shake');
        cardEls[e.j].classList.add('shake');
        setTimeout(function () { cardEls.forEach(function (c) { c.classList.remove('shake'); }); }, 350);
        say('ไม่ตรงกัน ลองใหม่');
      } else if (e.type === 'win') {
        win();
      }
    }
    sync();
  }

  function win() {
    mode = 'done';
    const ch = CQ.getCharacter(charId);
    const result = { time: Math.round(s.t * 10) / 10, moves: s.moves };
    const prev = loadBest(level, charId);
    const isNew = R.isBetter(result, prev);
    if (isNew) CQ.store.set(bestKey(level, charId), JSON.stringify(Object.assign({ at: Date.now() }, result)));
    const best = isNew ? result : prev;
    const st = R.stars(s.moves, s.pairs);
    say('เก็บครบทุกคู่!', 'good');
    ui.resStars.textContent = starText(st);
    ui.resStars.setAttribute('aria-label', st + ' ดาว');
    ui.resTime.textContent = fmtTime(result.time);
    ui.resSub.textContent = s.level.name + ' · ' + ch.name + ' · เปิด ' + s.moves + ' ครั้ง (' + s.pairs + ' คู่)';
    ui.resBest.textContent = fmtTime(best.time) + ' · ' + best.moves + ' ครั้ง';
    ui.resNew.hidden = !isNew;
    setTimeout(function () {
      if (mode !== 'done' || !s) return;
      Sound.sfx.win();
      ui.result.hidden = false;
      focusLater($('btn-mem-again'));
    }, 700);
  }

  // ── อัปเดตทุกเฟรม (เรียกจาก main.js) ─────────────────────────────
  function frame(dt) {
    if (mode !== 'play' || !s) return;
    if (ui.board.clientHeight !== boardH) layout(); // ฟอนต์โหลดเสร็จ/ข้อความเปลี่ยนแล้วพื้นที่เปลี่ยน
    const peeking = s.peekT > 0;
    const r = R.step(s, dt);
    if (r === 'start') { say('เริ่ม! แตะการ์ดเพื่อเปิดทีละ 2 ใบ'); sync(); }
    else if (r === 'hide' || (peeking && s.peekT === 0)) sync();
    const sec = s.previewT > 0 ? 'p' + Math.ceil(s.previewT) : Math.floor(s.t * 10);
    if (sec !== lastSec) {
      lastSec = sec;
      ui.time.textContent = s.previewT > 0 ? 'จำ ' + Math.ceil(s.previewT) : fmtTime(s.t);
    }
  }

  // ── ปุ่มและคีย์บอร์ด ─────────────────────────────────────────────
  ui.board.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('.mem-card');
    if (!b) return;
    e.preventDefault();
    Sound.unlock();
    onCard(+b.getAttribute('data-i'));
  });

  ui.levels.addEventListener('click', function (e) {
    const b = e.target.closest && e.target.closest('[data-level]');
    if (!b) return;
    e.preventDefault();
    Sound.sfx.click();
    begin(b.getAttribute('data-level'));
  });

  // ลูกศรเลื่อน focus ไปการ์ดข้าง ๆ (Enter/Space เปิดการ์ด)
  root.addEventListener('keydown', function (e) {
    if (ui.screen.hidden || mode !== 'play') return;
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.code];
    if (!d) return;
    let i = cardEls.indexOf(document.activeElement);
    if (i < 0) i = d > 0 ? -d : cardEls.length; // ยังไม่มี focus: เริ่มจากต้นหรือท้ายกระดาน
    for (let j = i + d; j >= 0 && j < cardEls.length; j += d) {
      if (!cardEls[j].disabled) { cardEls[j].focus(); break; }
    }
  });

  function bind(id, fn) {
    $(id).addEventListener('click', function (e) {
      e.preventDefault();
      Sound.unlock();
      Sound.sfx.click();
      fn();
    });
  }
  bind('btn-mem-peek', function () { if (s && R.peek(s)) { Sound.sfx.zap(); say('ส่องดู!'); sync(); } });
  bind('btn-mem-again', function () { begin(level); });
  bind('btn-mem-levels', showSetup);
  bind('btn-mem-home', function () { if (opts.onExit) opts.onExit(); });
  root.addEventListener('resize', function () { if (!ui.screen.hidden) layout(); });

  // ── API ──────────────────────────────────────────────────────────
  CQ.Memory = {
    init: function (o) { opts.onExit = o.onExit; },
    /** เปิดหน้ามินิเกม (หน้าเลือกระดับ) ด้วยตัวละครที่เลือกไว้ */
    start: function (id) {
      charId = CQ.getCharacter(id).id;
      showSetup();
    },
    stop: function () { mode = null; s = null; },
    /** Esc: ระหว่างเล่นหรือจบเกม = กลับหน้าเลือกระดับ คืน false เมื่อให้ main.js ออกจากมินิเกม */
    escape: function () {
      if (mode === 'play' || mode === 'done') { showSetup(); return true; }
      return false;
    },
    frame: frame,
    layout: layout,
    get game() { return s; } // ใช้สำหรับทดสอบอัตโนมัติ/ดีบัก
  };
})(window);
