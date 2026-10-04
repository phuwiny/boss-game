/*
 * Coin Quest — มินิเกม "เป่า-ยิ้ง-ฉุบ Battle" (ผู้เล่น vs COM) หน้าจอและลำดับเฟส
 * กติกาอยู่ใน js/rps-rules.js ส่วนการสลับหน้าจออยู่ใน js/main.js
 */
(function (root) {
  'use strict';
  const CQ = root.CQ;
  const R = CQ.RPSRules;
  const Sound = CQ.Audio;

  const HAND_INFO = {
    scissors: { icon: '✌️', name: 'กรรไกร', hint: 'ชนะ กระดาษ' },
    paper: { icon: '✋', name: 'กระดาษ', hint: 'ชนะ ค้อน' },
    rock: { icon: '✊', name: 'ค้อน', hint: 'ชนะ กรรไกร' }
  };
  const ACTION_INFO = {
    attack: { icon: '⚔️', name: 'โจมตี', hint: 'ศัตรู -1 HP' },
    defend: { icon: '🛡️', name: 'ป้องกัน', hint: 'ลดดาเมจ 0.5' },
    charge: { icon: '⚡', name: 'ชาร์จพลัง', hint: 'ครั้งถัดไป +0.5' },
    heal: { icon: '💚', name: 'ฟื้นพลัง', hint: 'ตัวเอง +1 HP' }
  };
  const HEART_RECTS = '<rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="2" height="1"/>' +
    '<rect x="0" y="1" width="7" height="2"/><rect x="1" y="3" width="5" height="1"/>' +
    '<rect x="2" y="4" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/>';
  const HEART_SVG = '<svg viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">' + HEART_RECTS + '</svg>';

  const $ = function (id) { return document.getElementById(id); };
  const ui = {
    screen: $('screen-rps'),
    round: $('rps-round'),
    phases: $('rps-phases'),
    msg: $('rps-msg'),
    controls: $('rps-controls'),
    me: $('rps-me'),
    com: $('rps-com')
  };

  let s = null;
  let gen = 0;
  let opts = {};
  let charName = '';

  function later(ms, fn) {
    const g0 = gen;
    setTimeout(function () { if (g0 === gen && s) fn(); }, ms);
  }

  function fmt(n) { return n % 1 ? n.toFixed(1) : String(n); }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // ── แผงผู้เล่นแต่ละฝ่าย ──────────────────────────────────────────
  function buildFighter(el, isMe) {
    el.innerHTML =
      '<div class="rps-who">' +
        (isMe ? '<canvas class="rps-avatar" id="rps-me-avatar" aria-hidden="true"></canvas>'
              : '<span class="rps-avatar rps-avatar-com" aria-hidden="true">🤖</span>') +
        '<span class="rps-name"></span>' +
      '</div>' +
      '<div class="rps-hearts" role="img"></div>' +
      '<div class="rps-charge" role="img"></div>' +
      '<div class="rps-tags"></div>' +
      '<div class="rps-slot"></div>' +
      '<span class="rps-pop" aria-hidden="true"></span>';
  }

  function renderFighter(el, f, name, slot, tags) {
    el.querySelector('.rps-name').textContent = name;
    const hearts = el.querySelector('.rps-hearts');
    let h = '';
    for (let i = 0; i < R.MAX_HP; i++) {
      const fill = Math.max(0, Math.min(1, f.hp - i));
      h += '<span class="heart">' + HEART_SVG +
        '<span class="heart-fill" style="clip-path: inset(0 ' + ((1 - fill) * 100) + '% 0 0)">' + HEART_SVG + '</span></span>';
    }
    h += '<b class="rps-hp">' + fmt(f.hp) + '</b>';
    hearts.innerHTML = h;
    hearts.setAttribute('aria-label', 'HP ' + fmt(f.hp) + ' จาก ' + R.MAX_HP);

    const charge = el.querySelector('.rps-charge');
    let c = '<span class="rps-charge-label">ชาร์จ</span>';
    for (let i = 0; i < R.MAX_CHARGE; i++) c += '<i' + (i < f.charge ? ' class="on"' : '') + '>⚡</i>';
    c += f.charge ? '<span class="rps-charge-bonus">+' + fmt(f.charge * R.CHARGE_BONUS) + '</span>' : '';
    charge.innerHTML = c;
    charge.setAttribute('aria-label', 'ชาร์จ ' + f.charge + ' จาก ' + R.MAX_CHARGE);

    el.querySelector('.rps-tags').innerHTML = tags.map(function (t) {
      return '<span class="rps-tag ' + t[0] + '">' + esc(t[1]) + '</span>';
    }).join('');

    const slotEl = el.querySelector('.rps-slot');
    slotEl.className = 'rps-slot ' + slot.kind + (slot.fx ? ' ' + slot.fx : '');
    if (slot.kind === 'empty') {
      slotEl.innerHTML = '<span class="rps-card-q">?</span>';
    } else if (slot.kind === 'back') {
      slotEl.innerHTML = '<span class="rps-card-back">' + esc(slot.label || 'เลือกแล้ว') + '</span>';
    } else {
      const info = slot.info;
      slotEl.innerHTML = '<span class="rps-card-icon">' + info.icon + '</span><span class="rps-card-name">' + esc(info.name) + '</span>';
    }
  }

  function slotFor(who) {
    const p = s.phase;
    if (p === 'rps' || p === 'rps-shake' || p === 'rps-result') {
      const hand = s.hands[who];
      if (!hand) return { kind: 'empty' };
      if (p === 'rps-shake') return { kind: 'back', fx: 'shake', label: '' };
      return { kind: 'face', fx: p === 'rps-result' && s.winner === who ? 'win' : '', info: HAND_INFO[hand] };
    }
    const act = s.acts[who];
    if (!act) return { kind: 'empty' };
    if (p === 'battle' || p === 'battle-wait') return { kind: 'back', label: who === 'me' ? 'เลือกแล้ว' : 'COM เลือกแล้ว' };
    return { kind: 'face', fx: p === 'battle-reveal' ? 'flip' : '', info: ACTION_INFO[act] };
  }

  function tagsFor(who) {
    const f = s[who];
    const tags = [];
    const battle = s.phase === 'battle' || s.phase === 'battle-wait';
    if (s.winner && s.phase !== 'rps' && s.phase !== 'rps-shake' && s.phase !== 'over') {
      tags.push(s.winner === who ? ['t-win', 'ชนะเป่า · เลือกก่อน'] : ['t-lose', 'แพ้เป่า']);
    }
    if (battle && s.allowed[who] && !s.allowed[who].attack.ok) tags.push(['t-warn', 'ห้ามโจมตี']);
    if (f.healedLastTurn && s.phase !== 'summary' && s.phase !== 'over') tags.push(['t-cd', 'ฟื้นพลังรอ 1 เทิร์น']);
    return tags;
  }

  function render() {
    ui.round.textContent = 'รอบ ' + s.round;
    const stage = s.phase.indexOf('rps') === 0 ? 0 : s.phase.indexOf('battle') === 0 ? 1 : 2;
    Array.prototype.forEach.call(ui.phases.children, function (chip, i) {
      chip.classList.toggle('active', i === stage);
      chip.classList.toggle('done', i < stage);
    });
    renderFighter(ui.me, s.me, charName + ' (คุณ)', slotFor('me'), tagsFor('me'));
    renderFighter(ui.com, s.com, 'COM', slotFor('com'), tagsFor('com'));
    ui.me.classList.toggle('ko', s.me.hp <= 0);
    ui.com.classList.toggle('ko', s.com.hp <= 0);
  }

  function say(html, cls) {
    ui.msg.className = 'rps-msg' + (cls ? ' ' + cls : '');
    ui.msg.innerHTML = html;
  }

  /** list = [{ key, icon, name, hint, disabled, reason, primary, onClick }] */
  function setControls(list, kind) {
    const hadFocus = ui.controls.contains(document.activeElement);
    ui.controls.className = 'rps-controls' + (kind ? ' ' + kind : '');
    ui.controls.textContent = '';
    list.forEach(function (c, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = c.icon ? 'rps-choice' : 'btn' + (c.primary ? ' btn-primary' : ' btn-ghost');
      if (c.primary && c.icon) b.classList.add('btn-primary');
      b.disabled = !!c.disabled;
      b.dataset.key = String(i + 1);
      if (c.icon) {
        b.innerHTML = '<kbd class="rps-key">' + (i + 1) + '</kbd><span class="rps-choice-icon" aria-hidden="true">' + c.icon + '</span>' +
          '<span class="rps-choice-name">' + esc(c.name) + '</span>' +
          '<span class="rps-choice-hint">' + esc(c.disabled && c.reason ? c.reason : c.hint) + '</span>';
        b.setAttribute('aria-label', c.name + (c.disabled && c.reason ? ' (' + c.reason + ')' : ''));
      } else {
        b.textContent = c.name;
      }
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (b.disabled) return;
        Sound.unlock();
        Sound.sfx.click();
        c.onClick();
      });
      ui.controls.appendChild(b);
    });
    if (hadFocus || list.some(function (c) { return c.primary; })) {
      const first = ui.controls.querySelector('.btn-primary:not(:disabled)') || ui.controls.querySelector('button:not(:disabled)');
      if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    }
  }

  function lockControls() {
    ui.controls.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
  }

  function pop(el, delta) {
    const p = el.querySelector('.rps-pop');
    if (!delta) { p.className = 'rps-pop'; return; }
    p.textContent = (delta > 0 ? '+' : '−') + fmt(Math.abs(delta));
    p.className = 'rps-pop';
    void p.offsetWidth; // เริ่มแอนิเมชันใหม่
    p.className = 'rps-pop show ' + (delta > 0 ? 'up' : 'down');
  }

  // ── เฟส 1: เป่ายิ้งฉุบ ───────────────────────────────────────────
  function beginRps(again) {
    s.phase = 'rps';
    s.winner = null;
    s.hands = { me: null, com: null };
    s.acts = { me: null, com: null };
    s.allowed = { me: null, com: null };
    pop(ui.me, 0);
    pop(ui.com, 0);
    render();
    say(again ? '<b>เสมอ!</b> เป่าใหม่อีกครั้ง' : 'เลือกการ์ด <b>เป่า-ยิ้ง-ฉุบ</b> ผู้ชนะได้เลือก action ก่อน');
    setControls(R.HANDS.map(function (h) {
      const info = HAND_INFO[h];
      return { icon: info.icon, name: info.name, hint: info.hint, onClick: function () { pickHand(h); } };
    }), 'hands');
  }

  function pickHand(h) {
    if (s.phase !== 'rps') return;
    s.hands.me = h;
    s.hands.com = R.randomHand();
    s.phase = 'rps-shake';
    lockControls();
    render();
    say('เป่า… ยิ้ง… <b>ฉุบ!</b>');
    later(650, showRpsResult);
  }

  function showRpsResult() {
    const res = R.judge(s.hands.me, s.hands.com);
    s.phase = 'rps-result';
    if (res === 0) {
      render();
      Sound.sfx.bonk();
      say('<b>เสมอ!</b> ' + HAND_INFO[s.hands.me].name + ' เหมือนกัน');
      later(1100, function () { beginRps(true); });
      return;
    }
    s.winner = res > 0 ? 'me' : 'com';
    const loser = res > 0 ? 'com' : 'me';
    s[loser].losses++;
    s.allowed.me = R.allowedActions(s.me, s.winner === 'me' ? 'winner' : 'loser');
    s.allowed.com = R.allowedActions(s.com, s.winner === 'com' ? 'winner' : 'loser');
    render();
    const noAtk = !s.allowed[loser].attack.ok ? ' · ' + (loser === 'me' ? 'คุณ' : 'COM') + 'แพ้ครั้งแรก ห้ามโจมตี' : '';
    if (res > 0) {
      Sound.sfx.coin();
      say('<b>คุณชนะ!</b> ' + HAND_INFO[s.hands.me].name + ' ชนะ ' + HAND_INFO[s.hands.com].name + ' — ได้เลือก action ก่อน' + noAtk, 'good');
    } else {
      Sound.sfx.powerdown();
      say('<b>COM ชนะ!</b> ' + HAND_INFO[s.hands.com].name + ' ชนะ ' + HAND_INFO[s.hands.me].name + ' — COM เลือก action ก่อน' + noAtk, 'bad');
    }
    later(1500, beginBattle);
  }

  // ── เฟส 2: ต่อสู้ ────────────────────────────────────────────────
  function comPick() {
    s.acts.com = R.comAction(s.com, s.me, s.allowed.com, s.allowed.me);
  }

  function beginBattle() {
    s.phase = 'battle';
    if (s.winner === 'com') comPick();
    render();
    say(s.winner === 'com'
      ? 'COM เลือก action แล้ว (คว่ำการ์ดไว้) — <b>ถึงตาคุณ</b>'
      : '<b>คุณเลือกก่อน</b> — เลือก action ได้ทุกแบบ');
    const allowed = s.allowed.me;
    setControls(R.ACTIONS.map(function (a) {
      const info = ACTION_INFO[a];
      let hint = info.hint;
      if (a === 'attack') hint = 'ศัตรู -' + fmt(R.power(s.me, 1)) + ' HP';
      if (a === 'heal') hint = 'ตัวเอง +' + fmt(R.power(s.me, 1)) + ' HP';
      return { icon: info.icon, name: info.name, hint: hint, disabled: !allowed[a].ok, reason: allowed[a].reason, onClick: function () { pickAction(a); } };
    }), 'actions');
  }

  function pickAction(a) {
    if (s.phase !== 'battle' || !s.allowed.me[a].ok) return;
    s.acts.me = a;
    lockControls();
    if (!s.acts.com) {
      s.phase = 'battle-wait';
      render();
      say('COM กำลังเลือก action…');
      later(800, function () { comPick(); render(); later(350, reveal); });
    } else {
      render();
      later(300, reveal);
    }
  }

  function reveal() {
    s.phase = 'battle-reveal';
    render();
    say('เปิดการ์ด!');
    later(700, resolveBattle);
  }

  function lineFor(who, me, foe) {
    const name = who === 'me' ? 'คุณ' : 'COM';
    const foeName = who === 'me' ? 'COM' : 'คุณ';
    switch (me.action) {
      case 'attack':
        if (me.clash) return name + ' โจมตี';
        return name + ' โจมตี ' + fmt(me.power) + (foe.blocked ? ' → ' + foeName + ' ป้องกันไว้ เสีย ' + fmt(foe.dmg) : ' → ' + foeName + ' เสีย ' + fmt(foe.dmg)) + ' HP';
      case 'defend':
        return name + ' ป้องกัน' + (me.blocked ? '' : ' (ไม่ถูกโจมตี)');
      case 'charge':
        return name + ' ชาร์จพลัง (สะสม ' + s[who].charge + '/' + R.MAX_CHARGE + ')';
      case 'heal':
        return name + ' ฟื้นพลัง +' + fmt(me.heal) + ' HP';
    }
    return '';
  }

  function resolveBattle() {
    const rep = R.resolve(s.me, s.com, s.acts.me, s.acts.com);
    s.report = rep;
    s.phase = 'summary';
    render();
    pop(ui.me, rep.a.hp - rep.a.hpBefore);
    pop(ui.com, rep.b.hp - rep.b.hpBefore);
    const lines = [lineFor('me', rep.a, rep.b), lineFor('com', rep.b, rep.a)];
    if (rep.a.clash) lines.push('โจมตีชนกัน! ไม่มีใครเสีย HP');
    if (rep.a.dmg > 0 || rep.b.dmg > 0) Sound.sfx.stomp();
    else if (rep.a.blocked || rep.b.blocked || rep.a.clash) Sound.sfx.bonk();
    if (rep.a.heal || rep.b.heal) Sound.sfx.checkpoint();
    if (s.acts.me === 'charge' || s.acts.com === 'charge') Sound.sfx.zap();
    say('<span class="rps-sum-title">สรุปผลรอบ ' + s.round + '</span>' +
      lines.map(function (l) { return '<span class="rps-line">' + esc(l) + '</span>'; }).join(''));

    if (s.me.hp <= 0 || s.com.hp <= 0) {
      lockControls();
      ui.controls.textContent = '';
      later(1300, gameOver);
      return;
    }
    setControls([{ name: 'ไปรอบถัดไป', primary: true, onClick: nextRound }], 'next');
  }

  function nextRound() {
    if (s.phase !== 'summary') return;
    s.round++;
    beginRps(false);
  }

  function gameOver() {
    s.phase = 'over';
    render();
    const won = s.com.hp <= 0 && s.me.hp > 0;
    if (won) {
      Sound.sfx.win();
      say('<span class="rps-result">🏆 คุณชนะ!</span><span class="rps-line">ทำให้ COM หมด HP ได้ใน ' + s.round + ' รอบ</span>', 'good big');
    } else {
      Sound.sfx.die();
      say('<span class="rps-result">💀 คุณแพ้…</span><span class="rps-line">COM ชนะใน ' + s.round + ' รอบ ลองใหม่อีกครั้ง!</span>', 'bad big');
    }
    setControls([
      { name: 'เล่นอีกครั้ง', primary: true, onClick: function () { start(opts.charId); } },
      { name: 'กลับเมนูมินิเกม', onClick: function () { if (opts.onExit) opts.onExit(); } }
    ], 'next');
  }

  // ── API ──────────────────────────────────────────────────────────
  function start(charId) {
    gen++;
    opts.charId = charId;
    charName = CQ.getCharacter(charId).name;
    s = {
      me: R.newFighter(),
      com: R.newFighter(),
      round: 1,
      phase: 'rps',
      winner: null,
      hands: {},
      acts: {},
      allowed: {},
      report: null
    };
    beginRps(false);
  }

  function stop() {
    gen++;
    s = null;
  }

  // ปุ่มตัวเลข 1-4 เลือกการ์ด/action
  root.addEventListener('keydown', function (e) {
    if (!s || ui.screen.hidden || e.repeat) return;
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (!m) return;
    const b = ui.controls.querySelector('button[data-key="' + m[1] + '"]');
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  });

  buildFighter(ui.me, true);
  buildFighter(ui.com, false);

  CQ.RPS = {
    init: function (o) { opts.onExit = o.onExit; },
    start: start,
    stop: stop,
    get active() { return !!s; },
    get avatar() { return $('rps-me-avatar'); }
  };
})(window);
