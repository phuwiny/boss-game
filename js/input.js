/*
 * Coin Quest — การควบคุม: คีย์บอร์ด, ปุ่มสัมผัสบนมือถือ (multi-touch), จอยเกม (Gamepad API)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump'
  };

  const keys = { left: false, right: false, jump: false };
  const touch = { left: false, right: false, jump: false };
  const pointers = new Map();
  const listeners = { confirm: [], pause: [], firsttouch: [] };
  let jumpQueued = false;
  let prevJump = false;
  let padPrev = { jump: false, start: false };
  let touchSeen = false;

  function emit(name) { listeners[name].forEach(function (fn) { fn(); }); }

  root.addEventListener('keydown', function (e) {
    const act = KEYMAP[e.code];
    if (act) {
      e.preventDefault();
      if (act === 'jump' && !e.repeat && !keys.jump) jumpQueued = true;
      keys[act] = true;
    }
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); emit('pause'); }
    if (e.code === 'Space') emit('confirm');
    // Enter บนปุ่มที่ focus อยู่ให้เบราว์เซอร์กดปุ่มนั้นเอง (ไม่ส่ง confirm ซ้ำ)
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !(e.target && e.target.closest && e.target.closest('button'))) emit('confirm');
  });

  root.addEventListener('keyup', function (e) {
    const act = KEYMAP[e.code];
    if (act) keys[act] = false;
  });

  root.addEventListener('blur', reset);

  // ── ปุ่มสัมผัส: ติดตามนิ้วแต่ละนิ้ว ลากนิ้วข้ามปุ่มได้ ─────────────
  function buttonAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const b = el && el.closest ? el.closest('[data-btn]') : null;
    return b ? b.getAttribute('data-btn') : null;
  }

  function refreshTouch() {
    touch.left = touch.right = touch.jump = false;
    pointers.forEach(function (btn) { if (btn) touch[btn] = true; });
    document.querySelectorAll('[data-btn]').forEach(function (el) {
      el.classList.toggle('active', touch[el.getAttribute('data-btn')]);
    });
  }

  function bindTouch(container) {
    container.addEventListener('pointerdown', function (e) {
      const btn = buttonAt(e.clientX, e.clientY);
      if (!btn) return;
      e.preventDefault();
      if (e.target.releasePointerCapture) {
        try { e.target.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (btn === 'jump' && !touch.jump) jumpQueued = true;
      pointers.set(e.pointerId, btn);
      refreshTouch();
    });
    root.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      const btn = buttonAt(e.clientX, e.clientY);
      if (btn === 'jump' && pointers.get(e.pointerId) !== 'jump' && !touch.jump) jumpQueued = true;
      pointers.set(e.pointerId, btn);
      refreshTouch();
    });
    const end = function (e) {
      if (!pointers.delete(e.pointerId)) return;
      refreshTouch();
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    container.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  root.addEventListener('touchstart', function () {
    if (touchSeen) return;
    touchSeen = true;
    emit('firsttouch');
  }, { passive: true });

  // ── Gamepad ───────────────────────────────────────────────────
  function readPad() {
    const out = { left: false, right: false, jump: false, start: false };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      const b = function (n) { return !!(gp.buttons[n] && gp.buttons[n].pressed); };
      const ax = gp.axes[0] || 0;
      out.left = out.left || ax < -0.4 || b(14);
      out.right = out.right || ax > 0.4 || b(15);
      out.jump = out.jump || b(0) || b(1) || b(12);
      out.start = out.start || b(9);
    }
    return out;
  }

  /** อ่านสถานะปุ่มรวมทุกช่องทาง เรียกเฟรมละครั้ง */
  function poll() {
    const pad = readPad();
    if (pad.jump && !padPrev.jump) { jumpQueued = true; emit('confirm'); }
    if (pad.start && !padPrev.start) emit('pause');
    padPrev = pad;

    const jump = keys.jump || touch.jump || pad.jump;
    if (jump && !prevJump) jumpQueued = true;
    prevJump = jump;

    const state = {
      left: keys.left || touch.left || pad.left,
      right: keys.right || touch.right || pad.right,
      jump: jump,
      jumpPressed: jumpQueued
    };
    jumpQueued = false;
    return state;
  }

  function reset() {
    keys.left = keys.right = keys.jump = false;
    pointers.clear();
    refreshTouch();
    jumpQueued = false;
  }

  CQ.Input = {
    bindTouch: bindTouch,
    poll: poll,
    reset: reset,
    on: function (name, fn) { listeners[name].push(fn); }
  };
})(window);
