/*
 * Coin Quest — เสียง (สังเคราะห์ด้วย Web Audio API ไม่ต้องใช้ไฟล์เสียง)
 */
(function (root) {
  'use strict';
  const CQ = root.CQ = root.CQ || {};

  const store = {
    get: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  CQ.store = store;

  const SFX_VOL = 0.55;
  const MUSIC_VOL = 0.14;

  let ac = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuf = null;
  let sfxOn = store.get('coinquest.sfx') !== '0';
  let musicOn = store.get('coinquest.music') !== '0';

  function unlock() {
    if (!ac) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { return; }
      const master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
      sfxBus = ac.createGain();
      sfxBus.gain.value = sfxOn ? SFX_VOL : 0;
      sfxBus.connect(master);
      musicBus = ac.createGain();
      musicBus.gain.value = musicOn ? MUSIC_VOL : 0;
      musicBus.connect(master);
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  }

  function toneAt(t0, freq, dur, o) {
    o = o || {};
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const vol = o.vol || 0.2;
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function tone(freq, dur, o) {
    if (!ac || !sfxOn) return;
    toneAt(ac.currentTime + ((o && o.delay) || 0), freq, dur, o);
  }

  function noise(dur, vol, cutoff) {
    if (!ac || !sfxOn) return;
    const t0 = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const sfx = {
    jump: function () { tone(330, 0.15, { vol: 0.09, slide: 700 }); },
    land: function () { noise(0.06, 0.12, 500); },
    bonk: function () { tone(140, 0.08, { type: 'triangle', vol: 0.2 }); },
    coin: function () {
      tone(988, 0.08, { vol: 0.11 });
      tone(1319, 0.3, { vol: 0.11, delay: 0.075 });
    },
    stomp: function () {
      tone(260, 0.14, { type: 'triangle', vol: 0.35, slide: 70 });
      noise(0.08, 0.18, 1400);
    },
    spring: function () { tone(160, 0.38, { type: 'sine', vol: 0.32, slide: 880 }); },
    die: function () {
      tone(620, 0.55, { vol: 0.11, slide: 80 });
      noise(0.25, 0.15, 900);
    },
    checkpoint: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.18, { type: 'triangle', vol: 0.25, delay: i * 0.07 }); });
    },
    win: function () {
      const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.54], [1047, 0.66]];
      seq.forEach(function (n, i) { tone(n[0], i === seq.length - 1 ? 0.7 : 0.16, { vol: 0.13, delay: n[1] }); });
      seq.forEach(function (n) { tone(n[0] / 2, 0.2, { type: 'triangle', vol: 0.2, delay: n[1] }); });
    },
    click: function () { tone(660, 0.05, { type: 'triangle', vol: 0.15 }); },
    airjump: function () {
      tone(520, 0.16, { type: 'sine', vol: 0.18, slide: 1150 });
      noise(0.12, 0.08, 3000);
    },
    powerup: function () {
      [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(f, 0.12, { vol: 0.1, delay: i * 0.05 }); });
    },
    powerdown: function () {
      [784, 587, 440].forEach(function (f, i) { tone(f, 0.14, { type: 'triangle', vol: 0.2, delay: i * 0.09 }); });
    },
    zap: function () {
      tone(900, 0.18, { vol: 0.12, slide: 220 });
      noise(0.1, 0.2, 2500);
    },
    tick: function () { tone(1175, 0.07, { type: 'triangle', vol: 0.28 }); },
    // หมูป่าสลบ: เสียงกระแทกต่ำ + เสียงหวีดลงแบบมึนงง
    stun: function () {
      tone(180, 0.16, { type: 'triangle', vol: 0.35, slide: 60 });
      noise(0.08, 0.16, 1100);
      tone(1400, 0.3, { type: 'sine', vol: 0.08, slide: 700, delay: 0.08 });
    },
    // Aclaire กันตาย: เสียงโล่แตก
    guard: function () {
      tone(1568, 0.22, { type: 'triangle', vol: 0.22, slide: 784 });
      tone(1047, 0.3, { type: 'triangle', vol: 0.18, delay: 0.06 });
      noise(0.16, 0.14, 4000);
    },
    // Mew เริ่มลอยตัว
    float: function () { tone(660, 0.22, { type: 'sine', vol: 0.12, slide: 990 }); },
    // ── Boss Stage ──
    shoot: function (kind) {
      if (kind === 'wind') {
        noise(0.09, 0.1, 5000);
        tone(880, 0.08, { type: 'sine', vol: 0.09, slide: 1700 });
      } else if (kind === 'fire') {
        tone(240, 0.2, { type: 'sawtooth', vol: 0.08, slide: 120 });
        noise(0.16, 0.14, 1300);
      } else {
        tone(1250, 0.07, { vol: 0.05, slide: 1900 });
      }
    },
    hurt: function () {
      tone(520, 0.22, { vol: 0.12, slide: 200 });
      noise(0.12, 0.16, 1200);
    },
    heart: function () {
      [659, 880, 1175].forEach(function (f, i) { tone(f, 0.14, { type: 'triangle', vol: 0.24, delay: i * 0.07 }); });
    },
    rockCrack: function () { noise(0.1, 0.1, 2600); },
    rockBreak: function () {
      noise(0.22, 0.2, 700);
      tone(120, 0.16, { type: 'triangle', vol: 0.25, slide: 60 });
    },
    roar: function () {
      tone(110, 0.9, { type: 'sawtooth', vol: 0.14, slide: 55 });
      tone(82, 0.9, { type: 'square', vol: 0.08, slide: 45 });
      noise(0.5, 0.2, 500);
    },
    bossWind: function () { tone(160, 0.5, { type: 'sawtooth', vol: 0.06, slide: 320 }); },
    bossFire: function () {
      noise(0.35, 0.22, 900);
      tone(150, 0.3, { type: 'sawtooth', vol: 0.1, slide: 70 });
    },
    bossHit: function () { tone(190, 0.09, { type: 'square', vol: 0.1, slide: 110 }); },
    bossDown: function () {
      [0, 0.18, 0.36, 0.6].forEach(function (d) { tone(90, 0.4, { type: 'sawtooth', vol: 0.12, slide: 40, delay: d }); });
      noise(0.5, 0.3, 800);
    },
    timeup: function () {
      [784, 659, 523].forEach(function (f, i) { tone(f, 0.16, { type: 'triangle', vol: 0.28, delay: i * 0.13 }); });
      tone(392, 0.6, { vol: 0.12, delay: 0.39 });
    }
  };

  // ── ดนตรีประกอบ (ลูปสั้น ๆ 8 ห้อง) ─────────────────────────────
  const BPM = 132;
  const BASE_STEP = 60 / BPM / 2; // โน้ตเขบ็ต 1 ชั้น
  let STEP = BASE_STEP;
  const _ = 0;
  const MELODY = [
    72, 76, 79, 76, 84, _, 79, _,
    69, 72, 77, 72, 81, _, 77, _,
    67, 71, 74, 71, 79, _, 74, _,
    72, 76, 79, 84, 88, _, _, _,
    72, 76, 79, 76, 84, _, 81, _,
    77, _, 81, _, 79, _, 76, _,
    74, _, 77, _, 76, _, 74, _,
    72, _, 67, _, 72, _, _, _
  ];
  const ROOTS = [48, 53, 55, 48, 45, 53, 55, 48];
  const midi = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  let musicTimer = null;
  let nextTime = 0;
  let stepIdx = 0;

  function scheduleMusic() {
    while (nextTime < ac.currentTime + 0.2) {
      const m = MELODY[stepIdx];
      if (m) toneAt(nextTime, midi(m), STEP * 0.9, { type: 'square', vol: 0.06, bus: musicBus });
      const bar = Math.floor(stepIdx / 8);
      const beat = stepIdx % 8;
      if (beat % 2 === 0) {
        const r = ROOTS[bar] + (beat === 2 || beat === 6 ? 7 : 0);
        toneAt(nextTime, midi(r), STEP * 1.6, { type: 'triangle', vol: 0.22, bus: musicBus });
      }
      nextTime += STEP;
      stepIdx = (stepIdx + 1) % MELODY.length;
    }
  }

  function startMusic() {
    if (!ac || musicTimer) return;
    nextTime = ac.currentTime + 0.06;
    musicTimer = setInterval(scheduleMusic, 50);
    scheduleMusic();
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  /** เร่ง/ผ่อนจังหวะเพลง (ใช้ตอนได้ดาว) */
  function setTempo(mul) {
    STEP = BASE_STEP / (mul || 1);
  }

  function setSfx(on) {
    sfxOn = on;
    store.set('coinquest.sfx', on ? '1' : '0');
    if (sfxBus) sfxBus.gain.value = on ? SFX_VOL : 0;
  }

  function setMusic(on) {
    musicOn = on;
    store.set('coinquest.music', on ? '1' : '0');
    if (musicBus) musicBus.gain.value = on ? MUSIC_VOL : 0;
  }

  CQ.Audio = {
    unlock: unlock,
    sfx: sfx,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setTempo: setTempo,
    setSfx: setSfx,
    setMusic: setMusic,
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; }
  };
})(window);
