/* QA ของสเตจ 4 Haunted House ในเบราว์เซอร์จริง (Playwright Chromium)
 *   node tools/2026-10-22_qa-haunted.cjs [phase]      phase: logic (ค่าเริ่มต้น) | visual | dark | perf | motion
 *   dark: วงแสง/หนาม/ขอบบล็อกสวิตช์/ฟักทองยิงไฟใต้ความมืด (QA_OUT เหมือน visual)
 *   perf: RAF p95 สเตจ 4 ≤ 1.2 × Castle ที่ 1366×768 และ 390×844 (CPU ช้า 4×) RAF ไม่ล็อก vsync
 *         QA_ROUNDS รอบ (ค่าเริ่มต้น 6) / QA_BUSY=<ms> ถ่วง render สเตจ 4 เพื่อตรวจว่า gate FAIL ได้จริง
 *   visual: QA_OUT=<โฟลเดอร์ screenshot> QA_BASE=<commit เทียบสเตจ 1–3, ค่าเริ่มต้น 3a7c233 = commit ก่อนเริ่มงานสเตจ 4 ทั้ง branch>
 *   motion: motion v2 สเตจ 4 (ยืด/หด เอน ฝุ่น hit-stop วิญญาณ ฉากไหว) + สเตจ 1 ต้องตรงกับ QA_BASE ทุกพิกเซล (QA_OUT เหมือน visual)
 * เปิด static server ของตัวเองที่ 127.0.0.1:8001 ตรวจผ่าน CQ.debug.game + กดคีย์บอร์ด/คลิกจริง
 * มี assertion ไหน FAIL จะจบด้วย exit code 1
 * Tooling only: no runtime dependency for the game.
 */
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
  playwright = require(path.resolve(path.dirname(process.execPath), '../node_modules/playwright'));
}
const { chromium } = playwright;
const root = path.resolve(__dirname, '..');
const phase = process.argv[2] || 'logic';
const PHASES = ['logic', 'visual', 'dark', 'perf', 'motion'];
const URL_BASE = 'http://127.0.0.1:8001/?seed=qa-haunted';
// visual/motion: สเตจ 1–3 ต้องตรงกับ commit ก่อนเริ่มงานสเตจ 4 ทุกพิกเซล (เสิร์ฟต้นไม้เก่าที่ /__baseline__/ ด้วย git show)
// 3a7c233 = แผนงานสเตจ 4 (ก่อนแก้ main.js/world.js/render.js ใด ๆ ของ branch) — อย่าใช้ commit กลาง branch
// เพราะจะซ่อนการเปลี่ยนแปลงของงานช่วงต้น (T1–T7) ที่อาจกระทบภาพสเตจ 1–3
const BASE = process.env.QA_BASE || '3a7c233';
const SHOTS = process.env.QA_OUT || path.join(require('node:os').tmpdir(), 'cq-haunted-visual');

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok    ' + name);
  else { failed++; console.log('FAIL  ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
}

function startServer() {
  const server = require('node:http').createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
    if (pathname.startsWith('/__baseline__/')) {
      const rel = pathname.slice('/__baseline__/'.length) || 'index.html';
      if (!/^[\w./-]+$/.test(rel) || rel.includes('..')) { res.writeHead(403).end(); return; }
      const out = require('node:child_process').spawnSync('git', ['show', BASE + ':' + rel], { cwd: root, maxBuffer: 64 << 20 });
      if (out.status !== 0) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', types[path.extname(rel)] || 'application/octet-stream');
      res.end(out.stdout);
      return;
    }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(8001, '127.0.0.1', () => resolve(server)));
}

/** เปิดเกมใหม่ เลือกสเตจแล้วกดเริ่มโหมดปกติ */
async function openStage(page, stage) {
  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.locator('.stage-' + stage).click();
  await page.waitForTimeout(150);
  const desc = await page.locator('#desc-normal').textContent();
  const timedTitle = await page.locator('#btn-timed').getAttribute('title');
  await page.locator('#btn-normal').click();
  await page.waitForFunction(() => CQ.debug.state === 'playing');
  await page.waitForTimeout(200);
  return { desc, timedTitle };
}

/** วางผู้เล่นยืนที่ช่อง (tx, ty) แบบเดียวกับ makePlayer */
const placeAt = (page, tx, ty) => page.evaluate(([tx, ty]) => {
  const g = CQ.debug.game, p = g.player, T = CQ.PHYS.T;
  p.x = tx * T + (T - p.w) / 2; p.y = (ty + 1) * T - p.h;
  p.vx = 0; p.vy = 0; p.ride = null;
}, [tx, ty]);

async function pauseAndReturn(page) {
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => CQ.debug.state === 'paused');
  const visible = await page.locator('#btn-checkpoint').isVisible();
  const before = await page.evaluate(() => ({ fires: CQ.debug.game.fires.length, shots: CQ.debug.game.shots.length }));
  if (visible) await page.locator('#btn-checkpoint').click();
  await page.waitForTimeout(60);
  return { visible, before };
}

async function logic(browser) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // ── เมนู + เริ่มเกม ──
  const menu = await openStage(page, 'haunted');
  check('menu: normal desc counts 40 fixed coins', menu.desc === 'เก็บให้ครบทั้ง 40 เหรียญในฉาก', menu.desc);
  check('menu: timed tooltip uses the fixed coin set', menu.timedTitle === 'ใช้เหรียญชุดเดียวกับโหมดปกติ 40 เหรียญ', menu.timedTitle);
  const start = await page.evaluate(() => {
    const g = CQ.debug.game;
    return { goal: g.goal, items: g.items.map(i => i.type).sort(), hpMax: g.player.hpMax, hp: g.player.hp, sw: g.lv.sw, bossClass: document.body.classList.contains('boss-stage'), pumpkins: g.enemies.filter(e => CQ.Pumpkin.isPumpkin(e.kind)).length, respawnSw: g.respawn.sw };
  });
  check('goal === 40', start.goal === 40, start.goal);
  check('items = heart×3 + mush', JSON.stringify(start.items) === JSON.stringify(['heart', 'heart', 'heart', 'mush']), start.items);
  check('hpMax === 5', start.hpMax === 5 && start.hp === 5, start);
  check('starts purple, respawn remembers purple', start.sw === 'purple' && start.respawnSw === 'purple', start);
  check('body.boss-stage on (touch fire button)', start.bossClass);
  check('pumpkins built with Pumpkin.makePumpkin', start.pumpkins > 0 && await page.evaluate(() => CQ.debug.game.enemies.filter(e => CQ.Pumpkin.isPumpkin(e.kind)).every(e => typeof e.windT === 'number')));

  // ── ยิงได้แม้ไม่มีบอส ──
  await page.keyboard.down('KeyX');
  const shot = await page.waitForFunction(() => CQ.debug.game.shots.length > 0, null, { timeout: 1000 }).then(() => true, () => false);
  await page.keyboard.up('KeyX');
  check('KeyX fires a shot (no boss)', shot);
  await page.waitForTimeout(400);

  // ── โหม่งสวิตช์แรกด้วยการกระโดดจริง ──
  const sw0 = await page.evaluate(() => CQ.debug.game.lv.switches.slice().sort((a, b) => a.tx - b.tx)[0]);
  const floorTy = await page.evaluate(([tx, ty]) => { const lv = CQ.debug.game.lv; let y = ty + 1; while (!CQ.World.isSolid(lv, tx, y + 1)) y++; return y; }, [sw0.tx, sw0.ty]);
  await placeAt(page, sw0.tx, floorTy);
  await page.waitForTimeout(120);
  await page.keyboard.down('Space');
  const flipped = await page.waitForFunction(() => CQ.debug.game.lv.sw === 'orange', null, { timeout: 1500 }).then(() => true, () => false);
  await page.keyboard.up('Space');
  check('jump-bonk on switch toggles to orange', flipped);
  // บังคับโหม่งซ้ำทันที (ภายใน 0.3 วินาที) → ต้องไม่สลับกลับ
  const re = await page.evaluate(([tx, ty]) => {
    const g = CQ.debug.game, p = g.player, T = CQ.PHYS.T;
    p.x = tx * T + (T - p.w) / 2; p.y = (ty + 1) * T + 2; p.vy = -400; p.onGround = false;
    p.bonkTx = -1; p.bonkTy = -1; // ต้องถูกตั้งใหม่จากการโหม่งครั้งที่ 2 จริง
    return g.swCD;
  }, [sw0.tx, sw0.ty]);
  await page.waitForTimeout(90);
  const afterRe = await page.evaluate(() => { const p = CQ.debug.game.player; return { sw: CQ.debug.game.lv.sw, bonkTx: p.bonkTx, bonkTy: p.bonkTy }; });
  check('second bonk really hit the switch (head hit)', afterRe.bonkTx === sw0.tx && afterRe.bonkTy === sw0.ty, afterRe);
  check('re-bonk within 0.3 s does not toggle back', re > 0 && afterRe.sw === 'orange', { swCD: re, after: afterRe });

  // ── สวิตช์โดนกระสุนผู้เล่น ──
  await page.waitForTimeout(350);
  const shotFlip = await page.evaluate(([tx, ty]) => {
    const g = CQ.debug.game, T = CQ.PHYS.T;
    g.player.x = 4 * T; g.player.y = 13 * T - g.player.h + T; g.player.vy = 0;
    g.shots.push({ x: tx * T - 12, y: ty * T + 16, vx: 400, vy: 0, r: 5, kind: 'light', dmg: 1, t: 0, life: 2 });
    return g.lv.sw;
  }, [sw0.tx, sw0.ty]);
  const shotFlipped = await page.waitForFunction(() => CQ.debug.game.lv.sw === 'purple' && CQ.debug.game.shots.length === 0, null, { timeout: 1000 }).then(() => true, () => false);
  check('player shot hitting a switch toggles it', shotFlip === 'orange' && shotFlipped);

  // ── ฟักทองยิงไฟ hp 3: ยิงโดน 3 ครั้งจึงแตก ──
  const pfShot = async () => {
    await page.evaluate(() => {
      const g = CQ.debug.game, e = g.enemies.find(en => en.qa === 'shotA');
      if (e && !e.dead) g.shots.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: 1, vy: 0, r: 5, kind: 'light', dmg: 1, t: 0, life: 2 });
    });
    await page.waitForTimeout(100);
    return page.evaluate(() => { const e = CQ.debug.game.enemies.find(en => en.qa === 'shotA'); return e ? { hp: e.hp, dead: e.dead } : { gone: true }; });
  };
  const tagged = await page.evaluate(() => {
    const g = CQ.debug.game, fires = g.enemies.filter(en => en.kind === 'pfire' && !en.dead), hop = g.enemies.find(en => en.kind === 'phop' && !en.dead);
    if (fires.length < 2 || !hop) return false;
    fires[0].qa = 'shotA'; fires[1].qa = 'stompF'; hop.qa = 'stompH';
    return true;
  });
  check('fixture: 2 pfire + 1 phop available', tagged);
  const h1 = await pfShot(), h2 = await pfShot(), h3 = await pfShot();
  check('pfire hit by a shot: hp 3 → 2, not dead', h1.hp === 2 && !h1.dead, h1);
  check('pfire 2nd shot: hp 1, not dead', h2.hp === 1 && !h2.dead, h2);
  check('pfire 3rd shot breaks it', !!(h3.dead || h3.gone), h3);

  // ── เหยียบหัวฟักทองแตกในครั้งเดียว (ทั้ง 2 แบบ) ──
  const stomp = async tag => {
    await page.evaluate(tag => {
      const g = CQ.debug.game, p = g.player, e = g.enemies.find(en => en.qa === tag);
      p.x = e.x + (e.w - p.w) / 2; p.y = e.y + 6 - p.h; p.vx = 0; p.vy = 150; p.onGround = false; p.ride = null; p.invuln = 0;
    }, tag);
    await page.waitForTimeout(100);
    return page.evaluate(tag => { const g = CQ.debug.game, e = g.enemies.find(en => en.qa === tag); return { dead: !e || e.dead, hp: e && e.hp, playerHp: g.player.hp, deathAnim: !!g.deathAnim }; }, tag);
  };
  const sh = await stomp('stompH');
  check('stomping a phop kills it', sh.dead && !sh.deathAnim, sh);
  const sf = await stomp('stompF');
  check('stomping a pfire (hp 3) kills it in one stomp', sf.dead && sf.hp === 3 && !sf.deathAnim, sf);
  await page.evaluate(() => { const p = CQ.debug.game.player; p.hp = 5; });

  // ── Review Focus 4: กลับเช็กพอยต์ (ยังไม่แตะเช็กพอยต์ = จุดเริ่ม) ──
  await page.evaluate(() => { const g = CQ.debug.game; CQ.Switches.setState(g.lv, 'orange', [g.player]); g.player.hp = 3; });
  const pre = await page.evaluate(() => ({ deaths: CQ.debug.game.deaths, hp: CQ.debug.game.player.hp }));
  const r1 = await pauseAndReturn(page);
  check('#btn-checkpoint visible on pause (haunted)', r1.visible);
  const post = await page.evaluate(() => {
    const g = CQ.debug.game, p = g.player, s = g.lv.start, T = CQ.PHYS.T;
    return { state: CQ.debug.state, atStart: Math.abs(p.x - (s.tx * T + (T - p.w) / 2)) < 0.01 && Math.abs(p.y - ((s.ty + 1) * T - p.h)) < 3, sw: g.lv.sw, deaths: g.deaths, hp: p.hp, invuln: p.invuln };
  });
  check('return: player at lv.start', post.atStart, post);
  check('return: switches reset to purple', post.sw === 'purple', post.sw);
  check('return: deaths unchanged', post.deaths === pre.deaths, [pre.deaths, post.deaths]);
  check('return: hp kept (3)', post.hp === pre.hp, [pre.hp, post.hp]);
  check('return: game resumed with invuln ≈ 1.5 s', post.state === 'playing' && post.invuln > 1.3 && post.invuln <= 1.5, post);

  // ── เช็กพอยต์ห้อง 2 จำสถานะสวิตช์ ──
  const cp = await page.evaluate(() => CQ.debug.game.checkpoints.slice().sort((a, b) => a.tx - b.tx)[0]);
  await page.evaluate(() => { const g = CQ.debug.game; CQ.Switches.setState(g.lv, 'orange', [g.player]); });
  await placeAt(page, cp.tx, cp.ty);
  const cpOn = await page.waitForFunction(tx => CQ.debug.game.checkpoints.find(c => c.tx === tx).active, cp.tx, { timeout: 1000 }).then(() => true, () => false);
  const remembered = await page.evaluate(() => CQ.debug.game.respawn.sw);
  check('room-2 checkpoint activates and remembers orange', cpOn && remembered === 'orange', remembered);
  await page.evaluate(() => { const g = CQ.debug.game; CQ.Switches.toggle(g.lv, [g.player]); g.player.x += 64; });
  const now = await page.evaluate(() => CQ.debug.game.lv.sw);
  // ── Review Focus 5: ลูกไฟค้างจอแล้วกลับเช็กพอยต์ ──
  await page.evaluate(() => { const g = CQ.debug.game; g.fires.push({ x: g.player.x + 300, y: g.player.y - 40, vx: 0, vy: 0, r: 8, kind: 'ghost', t: 0, life: 30 }); });
  // จดชุดตัวที่ส่งให้ Switches.setState (กลับเช็กพอยต์/เกิดใหม่ต้องใช้ผู้เล่น + ศัตรูที่ยังไม่ตาย เหมือนตอนสลับสวิตช์)
  await page.evaluate(() => {
    const S = CQ.Switches;
    if (!S.__qaOrig) S.__qaOrig = S.setState;
    S.setState = function (lv, sw, bodies) {
      const g = CQ.debug.game;
      window.__qaSetState = { n: bodies ? bodies.length : 0, live: 1 + g.enemies.filter(e => !e.dead).length, hasPlayer: !!bodies && bodies.indexOf(g.player) >= 0 };
      return S.__qaOrig.apply(this, arguments);
    };
  });
  const r2 = await pauseAndReturn(page);
  const bodiesReturn = await page.evaluate(() => window.__qaSetState);
  const post2 = await page.evaluate(() => {
    const g = CQ.debug.game, p = g.player, T = CQ.PHYS.T, r = g.respawn;
    return { sw: g.lv.sw, fires: g.fires.length, shots: g.shots.length, atCp: Math.abs(p.x - (r.tx * T + (T - p.w) / 2)) < 0.01 };
  });
  check('return to room-2 checkpoint restores orange (was purple)', now === 'purple' && post2.sw === 'orange' && post2.atCp, { now, post2 });
  check('Focus 5: fires cleared on checkpoint return', r2.before.fires > 0 && post2.fires === 0, { before: r2.before, after: post2.fires });
  check('return: Switches.setState gets player + live enemies', !!bodiesReturn && bodiesReturn.hasPlayer && bodiesReturn.live > 1 && bodiesReturn.n === bodiesReturn.live, bodiesReturn);
  await page.evaluate(() => { window.__qaSetState = null; });

  // ── ตายเพราะฟักทอง → เกิดใหม่ hp เต็ม + สวิตช์ตามเช็กพอยต์ ──
  const death = await page.evaluate(() => {
    const g = CQ.debug.game, p = g.player;
    CQ.Switches.setState(g.lv, 'purple', [p]);
    const e = g.enemies.find(en => en.kind === 'phop' && !en.dead);
    if (!e) return null;
    p.hp = 1; p.invuln = 0; p.guard = 0; p.pw.star = 0;
    p.x = e.x; p.y = e.y + e.h - p.h; p.vx = 0; p.vy = 0;
    return { deaths: g.deaths };
  });
  const died = death && await page.waitForFunction(() => !!CQ.debug.game.deathAnim, null, { timeout: 1000 }).then(() => true, () => false);
  check('touching a pumpkin at hp 1 → deathAnim', !!died, death);
  const back = died && await page.waitForFunction(() => !CQ.debug.game.deathAnim, null, { timeout: 3000 }).then(() => true, () => false);
  const post3 = await page.evaluate(() => { const g = CQ.debug.game; return { hp: g.player.hp, sw: g.lv.sw, deaths: g.deaths, fires: g.fires.length }; });
  check('respawn: hp 5 and switch state from checkpoint (orange)', !!back && post3.hp === 5 && post3.sw === 'orange', post3);
  const bodiesRespawn = await page.evaluate(() => { const r = window.__qaSetState; CQ.Switches.setState = CQ.Switches.__qaOrig; return r; });
  check('respawn: Switches.setState gets player + live enemies', !!bodiesRespawn && bodiesRespawn.hasPlayer && bodiesRespawn.live > 1 && bodiesRespawn.n === bodiesRespawn.live, bodiesRespawn);
  check('respawn: deaths +1', death && post3.deaths === death.deaths + 1, post3);

  // ── สเตจ 1–3: ไม่มีปุ่มกลับเช็กพอยต์ ──
  for (const st of ['grassland', 'forest', 'castle']) {
    await openStage(page, st);
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => CQ.debug.state === 'paused');
    const hidden = await page.locator('#btn-checkpoint').isHidden();
    check('stage ' + st + ': #btn-checkpoint hidden', hidden);
    await page.locator('#btn-resume').click();
    await page.waitForTimeout(250);
    if (st === 'castle') {
      await page.keyboard.down('KeyX');
      const fired = await page.waitForFunction(() => CQ.debug.game.shots.length > 0, null, { timeout: 1000 }).then(() => true, () => false);
      await page.keyboard.up('KeyX');
      check('stage castle: KeyX still fires a shot (regression)', fired);
    }
  }
  check('no console/page errors', errors.length === 0, errors);
  await context.close();
}

// ── visual ──────────────────────────────────────────────────────
// นาฬิกาเสมือน: requestAnimationFrame/performance.now/Math.random อยู่ในมือสคริปต์ทั้งหมด
// เกมเดินเฉพาะตอนเรียก window.__step(n) (1 เฟรม = 1/60 วินาที) ภาพจึงซ้ำได้ทุกพิกเซล
function freezeClock() {
  let now = 1000, q = [];
  Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = n => {
    for (let i = 0; i < n; i++) { now += 1000 / 60; const cbs = q; q = []; cbs.forEach(cb => cb(now)); }
  };
  let s = 0x2545f491;
  Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

async function frozenPage(browser, base) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  await context.addInitScript(freezeClock);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://127.0.0.1:8001' + base + '?seed=qa-haunted', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors };
}

async function startFrozen(page, stage) {
  await page.locator('.stage-' + stage).click();
  await page.evaluate(() => window.__step(2));
  await page.locator('#btn-normal').click();
  await page.waitForFunction(() => CQ.debug.state === 'playing');
  await page.evaluate(() => window.__step(2));
  // Grassland โหลดภาพ concept ตอนวาดเฟรมแรก รอให้โหลดเสร็จก่อนเดินต่อ
  await page.waitForFunction(() => { const im = CQ.debug.renderer.grasslandConcept; return !im || im.complete; });
  await page.evaluate(() => window.__step(90));
}

/** พิกเซลทั้ง canvas เกม (Buffer RGBA) */
async function canvasPixels(page) {
  const b64 = await page.evaluate(() => {
    const c = document.getElementById('game'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let s = '';
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}

async function visual(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });

  // ── สเตจ 1–3: ภาพต้องตรงกับ BASE ทุกพิกเซล ──
  for (const st of ['grassland', 'forest', 'castle']) {
    const shots = {};
    for (const [tag, base] of [['base', '/__baseline__/'], ['now', '/']]) {
      const { context, page, errors } = await frozenPage(browser, base);
      await startFrozen(page, st);
      shots[tag] = await canvasPixels(page);
      await page.screenshot({ path: path.join(SHOTS, st + '-' + tag + '.png') });
      check(st + ' (' + tag + '): no console/page errors', errors.length === 0, errors);
      await context.close();
    }
    let diff = 0;
    const a = shots.base, b = shots.now;
    if (a.length !== b.length) diff = -1;
    else for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) diff++;
    check(st + ': 844×390 canvas identical to ' + BASE + ' (0 px differ)', diff === 0, diff);
  }

  // ── สเตจ 4 ──
  const { context, page, errors } = await frozenPage(browser, '/');
  await startFrozen(page, 'haunted');
  await page.screenshot({ path: path.join(SHOTS, 'haunted-start.png') });

  const theme = await page.evaluate(() => {
    const r = CQ.debug.renderer, g = CQ.debug.game, T = CQ.PHYS.T;
    // ช่องว่างกลางห้อง 1 (5,8) อยู่ในจอเสมอ: ต้องเป็นฉากบ้านผีสิงโทนมืด ไม่ใช่ท้องฟ้า Grassland
    const c = document.getElementById('game').getContext('2d');
    const d = c.getImageData(Math.round((5.5 * T - r.cx) * r.S), Math.round((8.5 * T - r.cy) * r.S), 1, 1).data;
    return { id: r.theme && r.theme.id, rgb: [d[0], d[1], d[2]], lum: 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2], empty: g.lv.tiles[8 * g.lv.w + 5] === 0 };
  });
  check('haunted: renderer theme is haunted', theme.id === 'haunted', theme);
  check('haunted: room background is dark night/purple (lum < 90, b >= g)', theme.empty && theme.lum < 90 && theme.rgb[2] >= theme.rgb[1], theme);

  // อ่านสไปรต์บล็อกจาก tileSprite โดยตรง (alpha ของบล็อกเอง ไม่ปนพื้นหลัง)
  const blocks = () => page.evaluate(() => {
    const r = CQ.debug.renderer, lv = CQ.debug.game.lv, TILE = CQ.TILE;
    const find = t => { for (let i = 0; i < lv.tiles.length; i++) if (lv.tiles[i] === t) return { tx: i % lv.w, ty: Math.floor(i / lv.w) }; return null; };
    const stat = t => {
      const p = find(t), spr = p && r.tileSprite(lv, p.tx, p.ty, t);
      if (!spr || !spr.getContext) return null;
      const d = spr.getContext('2d').getImageData(0, 0, spr.width, spr.height).data;
      let sa = 0, ma = 0;
      const lum = [];
      for (let i = 0; i < d.length; i += 4) {
        sa += d[i + 3]; ma = Math.max(ma, d[i + 3]);
        lum.push((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * d[i + 3] / 255);
      }
      return { avgA: sa / (d.length / 4) / 255, maxA: ma / 255, ghost: CQ.Switches.isGhost(lv, p.tx, p.ty), lum: lum, w: spr.width };
    };
    const swp = find(TILE.SWITCH), sws = swp && r.tileSprite(lv, swp.tx, swp.ty, TILE.SWITCH);
    let swSig = null;
    if (sws && sws.getContext) {
      const d = sws.getContext('2d').getImageData(0, 0, sws.width, sws.height).data;
      swSig = 0; for (let i = 0; i < d.length; i++) swSig = (swSig * 31 + d[i]) >>> 0;
    }
    return { sw: lv.sw, P: stat(TILE.PURPLE), O: stat(TILE.ORANGE), swSig: swSig };
  });
  // ลายในภาพ grayscale: ลบค่าเฉลี่ยออกก่อน (ไม่นับความสว่างรวม) แล้ววัดความต่างเฉลี่ยต่อพิกเซล
  const patternDiff = (a, b) => {
    if (!a || !b || a.length !== b.length) return 0;
    const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
    let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs((a[i] - ma) - (b[i] - mb));
    return s / a.length;
  };
  const s1 = await blocks();
  const brief = s => s && { avgA: +s.avgA.toFixed(3), maxA: +s.maxA.toFixed(3), ghost: s.ghost };
  check('purple state: purple block sprite exists and is solid', !!s1.P && !s1.P.ghost && s1.P.avgA > 0.9, brief(s1.P));
  check('purple state: orange ghost sprite exists, max alpha <= 0.35', !!s1.O && s1.O.ghost && s1.O.maxA <= 0.351 && s1.O.avgA > 0, brief(s1.O));
  check('purple state: avg alpha purple (solid) > orange (ghost)', !!s1.P && !!s1.O && s1.P.avgA > s1.O.avgA, [brief(s1.P), brief(s1.O)]);

  await page.evaluate(() => { const g = CQ.debug.game; CQ.Switches.setState(g.lv, 'orange', []); window.__step(2); });
  await page.screenshot({ path: path.join(SHOTS, 'haunted-toggled.png') });
  const s2 = await blocks();
  check('orange state: avg alpha orange (solid) > purple (ghost)', !!s2.P && !!s2.O && s2.O.avgA > s2.P.avgA && !s2.O.ghost && s2.P.ghost, [brief(s2.P), brief(s2.O)]);
  check('orange state: purple ghost max alpha <= 0.35', !!s2.P && s2.P.maxA <= 0.351, brief(s2.P));
  const pd = patternDiff(s1.P && s1.P.lum, s2.O && s2.O.lum);
  check('grayscale: solid purple vs solid orange patterns differ (mean |Δ| > 6)', pd > 6, +pd.toFixed(2));
  check('switch sprite differs between purple and orange state', s1.swSig !== null && s2.swSig !== null && s1.swSig !== s2.swSig, [s1.swSig, s2.swSig]);
  await page.evaluate(() => { const g = CQ.debug.game; CQ.Switches.setState(g.lv, 'purple', []); window.__step(1); });

  // ── ฟักทอง: วาดเองด้วย render() ที่เวลาคงที่ แล้วอ่านพิกเซลในกรอบตัว ──
  const pumpkinView = (kind, patch) => page.evaluate(([kind, patch]) => {
    const r = CQ.debug.renderer, g = CQ.debug.game;
    const e = g.enemies.find(en => en.kind === kind && !en.dead);
    if (!e) return null;
    const saved = { windT: e.windT, flash: e.flash };
    Object.assign(e, patch);
    const want = r.clampCam(e.x - r.viewW / 2, e.y - r.viewH / 2);
    r.cam.x = want.x; r.cam.y = want.y;
    let slime = 0;
    const orig = r.drawSlime;
    r.drawSlime = function () { slime++; return orig.apply(this, arguments); };
    // ตรวจภาพตัวฟักทองเอง: ปิดความมืดชั่วคราว (ความมืดตรวจแยกใน phase dark)
    const dk = g.stage.dark;
    g.stage.dark = null;
    try { r.render(g, 5); } finally { g.stage.dark = dk; }
    r.drawSlime = orig;
    Object.assign(e, saved);
    const c = document.getElementById('game').getContext('2d');
    const x0 = Math.round((e.x - r.cx) * r.S), y0 = Math.round((e.y - r.cy) * r.S);
    const w = Math.round(e.w * r.S), h = Math.round(e.h * r.S);
    const d = c.getImageData(x0, y0, w, h).data;
    let orange = 0, white = 0, glow = 0, sig = 0;
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2];
      if (R > 170 && R > G + 40 && B < 120) orange++;
      if (R > 235 && G > 235 && B > 235) white++;
      if (G > 180 && G > R + 40 && G > B) glow++;
      sig = (sig * 31 + R + G * 7 + B * 13) >>> 0;
    }
    const n = d.length / 4;
    return { orange: orange / n, white: white / n, glow: glow / n, sig: sig, slime: slime };
  }, [kind, patch]);
  for (const kind of ['phop', 'pfire']) {
    const base = await pumpkinView(kind, { windT: 0, flash: 0 });
    check(kind + ': drawn as an orange pumpkin (not the slime fallback)', !!base && base.slime === 0 && base.orange > 0.2, base);
    if (kind === 'pfire') {
      await page.screenshot({ path: path.join(SHOTS, 'haunted-pumpkin.png') });
      const wind = await pumpkinView(kind, { windT: 0.3, flash: 0 });
      check('pfire windT > 0: glowing eyes (green glow pixels appear)', !!wind && wind.glow > base.glow && wind.sig !== base.sig, { base, wind });
      await page.screenshot({ path: path.join(SHOTS, 'haunted-pumpkin-windup.png') });
    }
    const flash = await pumpkinView(kind, { windT: 0, flash: 0.1 });
    check(kind + ' flash > 0: blinks white', !!flash && flash.white > base.white + 0.15, { base, flash });
  }

  // ── ลูกไฟผี: เขียว ไม่ใช่ส้มแบบลูกไฟ Aclaire/บอส ──
  const ghost = await page.evaluate(() => {
    const r = CQ.debug.renderer, g = CQ.debug.game;
    const wx = r.cam.x + r.viewW / 2, wy = r.cam.y + r.viewH / 2;
    g.fires.push({ x: wx, y: wy, vx: -200, vy: 0, r: 8, kind: 'ghost', t: 0, life: 4 });
    r.render(g, 5);
    g.fires.pop();
    const d = document.getElementById('game').getContext('2d').getImageData(Math.round((wx - r.cx) * r.S) - 2, Math.round((wy - r.cy) * r.S) - 2, 5, 5).data;
    let R = 0, G = 0, B = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; }
    return [R / 25, G / 25, B / 25].map(Math.round);
  });
  check('ghost fireball core is ghost green (g > r, g > b)', ghost[1] > ghost[0] + 20 && ghost[1] > ghost[2], ghost);

  // ── รางแนวตั้ง ──
  const vt = await page.evaluate(() => {
    const r = CQ.debug.renderer, g = CQ.debug.game;
    const pl = g.lv.platforms.find(p => p.axis === 'y');
    if (!pl || typeof r.drawVTrack !== 'function') return { pl: !!pl, fn: typeof r.drawVTrack };
    const want = r.clampCam(pl.x - r.viewW / 2, pl.minY - 40);
    r.cam.x = want.x; r.cam.y = want.y;
    let calls = 0;
    const orig = r.drawVTrack;
    r.drawVTrack = function () { calls++; return orig.apply(this, arguments); };
    r.render(g, 5);
    r.drawVTrack = orig;
    return { pl: true, fn: 'function', calls: calls };
  });
  check('vertical platform track drawn via drawVTrack', vt.fn === 'function' && vt.calls > 0, vt);
  await page.screenshot({ path: path.join(SHOTS, 'haunted-vtrack.png') });

  check('haunted visual: no console/page errors', errors.length === 0, errors);
  await context.close();
}

// ── dark ────────────────────────────────────────────────────────
// ความมืดสลัวของสเตจ 4: วาดเองด้วย render() ทั้งตอนเปิดความมืดและตอนปิด (g.stage.dark = null ชั่วคราว)
// แล้วเทียบความสว่างพิกเซลในกรอบเดียวกัน ปิด minimap/HUD ระหว่างวัดเพื่อไม่ให้ปนมุมจอ
async function dark(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { context, page, errors } = await frozenPage(browser, '/');
  await startFrozen(page, 'haunted');

  // probe(spec): spec.player = [wx, wy] ศูนย์กลางผู้เล่น (โลก), spec.cam = [wx, wy] จุดกลางจอ, spec.patch = { enemyIdx: { ... } }
  // spec.rects = [{ name, x, y, w, h }] (โลก), spec.circle = { name, x, y, r } (โลก)
  // คืน { on: {name: {lum, sd}}, off: {...} } — sd = ส่วนเบี่ยงเบนความสว่างในกรอบ (ความชัดของลาย/ขอบ)
  const probe = spec => page.evaluate(spec => {
    const r = CQ.debug.renderer, g = CQ.debug.game, p = g.player;
    const saved = { x: p.x, y: p.y, mm: g.showMinimap, dark: g.stage.dark, cam: { x: r.cam.x, y: r.cam.y } };
    const savedE = {};
    if (spec.player) { p.x = spec.player[0] - p.w / 2; p.y = spec.player[1] - p.h / 2; }
    Object.keys(spec.patch || {}).forEach(i => { const e = g.enemies[i]; savedE[i] = {}; Object.keys(spec.patch[i]).forEach(k => { savedE[i][k] = e[k]; e[k] = spec.patch[i][k]; }); });
    const c = spec.rawCam ? { x: spec.rawCam[0], y: spec.rawCam[1] } : r.clampCam(spec.cam[0] - r.viewW / 2, spec.cam[1] - r.viewH / 2);
    r.cam.x = c.x; r.cam.y = c.y;
    g.showMinimap = false;
    const ctx = document.getElementById('game').getContext('2d');
    const measure = () => {
      const out = {};
      (spec.rects || []).forEach(q => {
        const x0 = Math.round((q.x - r.cx) * r.S), y0 = Math.round((q.y - r.cy) * r.S);
        const w = Math.max(1, Math.round(q.w * r.S)), h = Math.max(1, Math.round(q.h * r.S));
        const d = ctx.getImageData(x0, y0, w, h).data;
        let s = 0, s2 = 0; const n = d.length / 4;
        for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; }
        out[q.name] = { lum: s / n, sd: Math.sqrt(Math.max(0, s2 / n - (s / n) * (s / n))) };
      });
      if (spec.circle) {
        const q = spec.circle, R = q.r * r.S, cxs = (q.x - r.cx) * r.S, cys = (q.y - r.cy) * r.S;
        const x0 = Math.max(0, Math.floor(cxs - R)), y0 = Math.max(0, Math.floor(cys - R));
        const w = Math.min(ctx.canvas.width - x0, Math.ceil(2 * R)), h = Math.min(ctx.canvas.height - y0, Math.ceil(2 * R));
        const d = ctx.getImageData(x0, y0, w, h).data;
        let s = 0, n = 0;
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
          const dx = x0 + xx + 0.5 - cxs, dy = y0 + yy + 0.5 - cys;
          if (dx * dx + dy * dy > R * R) continue;
          const i = (yy * w + xx) * 4;
          s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++;
        }
        out[q.name] = { lum: n ? s / n : 0, sd: 0 };
      }
      return out;
    };
    let res;
    try {
      g.stage.dark = null;
      r.render(g, 5);
      const off = measure();
      g.stage.dark = saved.dark;
      r.render(g, 5);
      res = { on: measure(), off: off, S: r.S, cx: r.cx, cy: r.cy };
    } finally {
      g.stage.dark = saved.dark;
      p.x = saved.x; p.y = saved.y; g.showMinimap = saved.mm;
      Object.keys(savedE).forEach(i => Object.assign(g.enemies[i], savedE[i]));
    }
    if (!spec.keepCam) { r.cam.x = saved.cam.x; r.cam.y = saved.cam.y; }
    return res;
  }, spec);
  const ratio = (a, b) => b > 0 ? +(a / b).toFixed(3) : 0;

  const info = await page.evaluate(() => {
    const r = CQ.debug.renderer, g = CQ.debug.game, lv = g.lv, T = CQ.PHYS.T, TILE = CQ.TILE;
    const lights = [];
    lv.switches.forEach(s => lights.push([(s.tx + 0.5) * T, (s.ty + 0.5) * T]));
    g.coins.forEach(c => { if (!c.taken) lights.push([c.x, c.y]); });
    g.enemies.forEach(e => { if (e.kind === 'pfire') lights.push([e.x + e.w / 2, e.y + e.h / 2]); });
    r.decor.forEach(d => { if (d.k === 'candle' || d.k === 'candelabra' || d.k === 'jacklamp') lights.push([d.x, d.y - 20]); });
    const far = (x, y, k) => lights.every(l => Math.hypot(l[0] - x, l[1] - y) > k * T);
    const cells = t => { const a = []; for (let i = 0; i < lv.tiles.length; i++) if (lv.tiles[i] === t) a.push({ tx: i % lv.w, ty: Math.floor(i / lv.w) }); return a; };
    const spike = cells(TILE.SPIKE).find(c => far((c.tx + 0.5) * T, (c.ty + 0.5) * T, 3.5));
    const ghost = cells(TILE.PURPLE).concat(cells(TILE.ORANGE)).find(c => CQ.Switches.isGhost(lv, c.tx, c.ty) && far((c.tx + 0.5) * T, (c.ty + 0.5) * T, 2.5));
    const solid = cells(TILE.PURPLE).concat(cells(TILE.ORANGE)).find(c => !CQ.Switches.isGhost(lv, c.tx, c.ty) && far((c.tx + 0.5) * T, (c.ty + 0.5) * T, 2.5));
    const pfIdx = g.enemies.findIndex(e => e.kind === 'pfire' && !e.dead);
    const pf = g.enemies[pfIdx];
    const p = g.player;
    return { T, viewW: r.viewW, viewH: r.viewH, fn: typeof r.drawDarkness, spike, ghost, solid, pfIdx, pf: pf && { x: pf.x + pf.w / 2, y: pf.y + pf.h / 2 }, player: [p.x + p.w / 2, p.y + p.h / 2] };
  });
  const T = info.T;
  check('drawDarkness is a Renderer method', info.fn === 'function', info.fn);

  // ── 1) วงแสงรอบผู้เล่น: กลางจอสว่างกว่ามุมไกลอย่างน้อย 1.4 เท่า ──
  {
    const [px, py] = info.player;
    // มุมจอที่ไกลจากผู้เล่นที่สุด: กรอบ 2×2 ช่อง ห่างขอบ 4 หน่วย
    const camC = await page.evaluate(([px, py]) => { const r = CQ.debug.renderer; return r.clampCam(px - r.viewW / 2, py - r.viewH / 2); }, [px, py]);
    const sx = px - camC.x, sy = py - camC.y;
    const cxw = sx < info.viewW / 2 ? camC.x + info.viewW - 4 - 2 * T : camC.x + 4;
    const cyw = sy < info.viewH / 2 ? camC.y + info.viewH - 4 - 2 * T : camC.y + 4;
    const a = await probe({ player: [px, py], cam: [px, py], circle: { name: 'near', x: px, y: py, r: 2 * T }, rects: [{ name: 'corner', x: cxw, y: cyw, w: 2 * T, h: 2 * T }] });
    const rr = ratio(a.on.near.lum, a.on.corner.lum);
    check('dark: lum around player (2 tiles) >= 1.4 × far corner', rr >= 1.4, { ratio: rr, on: a.on, off: a.off });
    check('dark: far corner is really dimmed (<= 0.8 × no-dark)', a.on.corner.lum <= 0.8 * a.off.corner.lum, { on: a.on.corner, off: a.off.corner });
    check('dark: player circle stays bright (>= 0.85 × no-dark)', a.on.near.lum >= 0.85 * a.off.near.lum, { on: a.on.near, off: a.off.near });
    await probe({ player: [px, py], cam: [px, py], keepCam: true });
    await page.screenshot({ path: path.join(SHOTS, 'dark-normal.png') });
  }

  // ── 2) หนามนอกวงแสงยังอ่านออก (≥ 35% ของตอนไม่มืด) ──
  if (!info.spike) check('fixture: a spike tile away from other lights', false);
  else {
    const s = info.spike, wx = (s.tx + 0.5) * T, wy = (s.ty + 0.5) * T;
    // ผู้เล่นห่างหนาม 8 ช่องแนวนอน (นอกวงแสง 5.5 ช่อง) กล้องอยู่กลางระหว่างสองจุด
    const pxw = wx + 8 * T, cam = [wx + 4 * T, wy - T];
    const b = await probe({ player: [pxw, wy - 16], cam: cam, keepCam: true, rects: [{ name: 'spike', x: s.tx * T + 1, y: s.ty * T + 12, w: T - 2, h: T - 12 }] });
    const rb = ratio(b.on.spike.lum, b.off.spike.lum);
    check('dark: spike outside the light keeps >= 35% brightness', rb >= 0.35, { ratio: rb, on: b.on.spike, off: b.off.spike, tile: s });
    check('dark: that spike is really outside the light (<= 0.9 × no-dark)', rb <= 0.9, rb);
    check('dark: spike edges still contrast (sd >= 0.4 × no-dark)', b.on.spike.sd >= 0.4 * b.off.spike.sd, { on: b.on.spike.sd, off: b.off.spike.sd });
    await page.screenshot({ path: path.join(SHOTS, 'dark-spikes.png') });
  }

  // ── 3) ขอบบล็อกสวิตช์ (ทั้งทึบและโปร่ง) นอกวงแสงยังชัด ──
  for (const [tag, cell] of [['ghost', info.ghost], ['solid', info.solid]]) {
    if (!cell) { check('fixture: ' + tag + ' switch block away from other lights', false); continue; }
    const wx = (cell.tx + 0.5) * T, wy = (cell.ty + 0.5) * T;
    const c = await probe({ player: [wx + 8 * T, wy], cam: [wx + 4 * T, wy], rects: [{ name: 'blk', x: cell.tx * T, y: cell.ty * T, w: T, h: T }] });
    const rc = ratio(c.on.blk.sd, c.off.blk.sd);
    check('dark: ' + tag + ' switch-block outline contrast outside the light >= 0.6 × no-dark', rc >= 0.6, { ratio: rc, on: c.on.blk, off: c.off.blk, cell });
  }

  // ── 4) ฟักทองยิงไฟ: มีแสงเอง และสว่างขึ้นตอนเตือน (windT) ──
  if (!info.pf) check('fixture: a fire pumpkin', false);
  else {
    const { x, y } = info.pf;
    // วงแหวนรอบตัว (ไม่รวมตัวฟักทองเองที่เปลี่ยนภาพตอนเตือน): กรอบเหนือหัว 1–2 ช่อง
    const ring = [{ name: 'ring', x: x - T, y: y - 2.2 * T, w: 2 * T, h: T }];
    const idle = await probe({ player: [x + 9 * T, y], cam: [x, y], patch: { [info.pfIdx]: { windT: 0 } }, rects: ring });
    const wind = await probe({ player: [x + 9 * T, y], cam: [x, y], keepCam: true, patch: { [info.pfIdx]: { windT: 0.5 } }, rects: ring });
    check('dark: fire pumpkin is a light source (ring >= 0.8 × no-dark)', idle.on.ring.lum >= 0.8 * idle.off.ring.lum, { on: idle.on.ring, off: idle.off.ring });
    check('dark: fire pumpkin brightens while winding up', wind.on.ring.lum > idle.on.ring.lum * 1.03, { idle: idle.on.ring.lum, wind: wind.on.ring.lum });
    await page.screenshot({ path: path.join(SHOTS, 'dark-pumpkin-windup.png') });
  }

  // ── 4b) กล้องเลยขอบด่าน: clampCam ยอมให้ขึ้นเหนือด่านได้ 3 ช่อง และการสั่นจอดันกล้องเลยขอบซ้ายได้
  //        แถบที่อยู่นอกด่านต้องมืดเหมือนส่วนอื่น (ไม่ใช่แถบสว่างโล่ง)
  {
    const edge = await page.evaluate(() => { const r = CQ.debug.renderer; return { minY: r.clampCam(0, -1e6).y, viewW: r.viewW, viewH: r.viewH }; });
    // เหนือด่าน: กล้องสูงสุดที่ clampCam ยอม ผู้เล่นอยู่ล่างขวาไกลจากแถบที่วัด
    const top = await probe({ player: [20 * T, 12 * T], rawCam: [4 * T, edge.minY], rects: [{ name: 'band', x: 4 * T + 8, y: edge.minY + 4, w: 6 * T, h: -edge.minY - 8 }] });
    const rt = ratio(top.on.band.lum, top.off.band.lum);
    check('dark: band above the level (camera at clampCam minY ' + edge.minY + ') is darkened (<= 0.8 × no-dark)', edge.minY < 0 && rt <= 0.8, { ratio: rt, on: top.on.band, off: top.off.band });
    await page.screenshot({ path: path.join(SHOTS, 'dark-above-level.png') });
    // เลยขอบซ้าย (เหมือนจอสั่น 12 หน่วยที่ขอบด่าน)
    const left = await probe({ player: [20 * T, 10 * T], rawCam: [-12, 4 * T], rects: [{ name: 'strip', x: -12, y: 5 * T, w: 10, h: 4 * T }] });
    const rl = ratio(left.on.strip.lum, left.off.strip.lum);
    check('dark: strip left of the level (screen shake) is darkened (<= 0.8 × no-dark)', rl <= 0.8, { ratio: rl, on: left.on.strip, off: left.off.strip });
    // เลยขอบเผื่อของแผนที่แสงไปไกล (กันพลาด): ต้องเติมสีมืดแทน ไม่ปล่อยโปร่ง
    const far = await probe({ player: [20 * T, 10 * T], rawCam: [-10 * T, 4 * T], rects: [{ name: 'strip', x: -10 * T + 4, y: 5 * T, w: 3 * T, h: 4 * T }] });
    const rf = ratio(far.on.strip.lum, far.off.strip.lum);
    check('dark: area far beyond the light-map padding is still darkened (<= 0.8 × no-dark)', rf <= 0.8, { ratio: rf, on: far.on.strip, off: far.off.strip });
  }

  // ── 5) แคช: offscreen canvas ใช้ซ้ำ ไม่สร้าง gradient ใหม่ทุกเฟรม ──
  const cache = await page.evaluate(() => {
    const r = CQ.debug.renderer, g = CQ.debug.game, P = CanvasRenderingContext2D.prototype;
    const origR = P.createRadialGradient, origL = P.createLinearGradient;
    const run = () => { let n = 0; P.createRadialGradient = function () { n++; return origR.apply(this, arguments); }; P.createLinearGradient = function () { n++; return origL.apply(this, arguments); }; try { r.render(g, 6); } finally { P.createRadialGradient = origR; P.createLinearGradient = origL; } return n; };
    r.render(g, 5);
    const cv1 = r.darkCv;
    const withDark = run();
    const cv2 = r.darkCv;
    const saved = g.stage.dark; g.stage.dark = null;
    let withoutDark;
    try { withoutDark = run(); } finally { g.stage.dark = saved; }
    return { same: !!cv1 && cv1 === cv2, withDark, withoutDark };
  });
  check('dark: offscreen canvas reused between frames', cache.same, cache);
  check('dark: no gradients created per frame by the darkness', cache.withDark === cache.withoutDark, cache);

  check('dark: no console/page errors', errors.length === 0, errors);
  await context.close();
}

// ── motion ──────────────────────────────────────────────────────
// motion v2 (เฉพาะ stage.motion === 'v2'): เล่นลำดับเดียวกันด้วยคีย์บอร์ดจริงบนนาฬิกาเสมือน
// ยืน → กระโดด → ลงพื้น → ออกตัววิ่งขวา → กลับตัวซ้าย → ศัตรูชน (พลาด)
// วัดกรอบภาพตัวละครจากความต่างของ render() ที่วาด/ไม่วาด hero (พิกเซลจอ canvas)
function installHeroBox() {
  window.__heroBox = function () {
    const r = CQ.debug.renderer, g = CQ.debug.game, c = document.getElementById('game'), ctx = c.getContext('2d');
    const p = g.deathAnim || g.player;
    const save = { inv: g.player.invuln, mm: g.showMinimap, shake: g.shake };
    g.player.invuln = 0; g.showMinimap = false; g.shake = 0;
    let a, b, x0, y0, w, h;
    const orig = r.drawHero;
    try {
      r.render(g, 5);
      x0 = Math.max(0, Math.floor((p.x - 40 - r.cx) * r.S)); y0 = Math.max(0, Math.floor((p.y - 50 - r.cy) * r.S));
      w = Math.max(1, Math.min(c.width - x0, Math.ceil((p.w + 80) * r.S))); h = Math.max(1, Math.min(c.height - y0, Math.ceil((p.h + 90) * r.S)));
      a = ctx.getImageData(x0, y0, w, h).data;
      r.drawHero = function () {};
      r.render(g, 5);
      b = ctx.getImageData(x0, y0, w, h).data;
    } finally {
      r.drawHero = orig;
      g.player.invuln = save.inv; g.showMinimap = save.mm; g.shake = save.shake;
    }
    r.render(g, 5); // คืนภาพที่มีตัวละครไว้ให้ screenshot
    let top = 1e9, bottom = -1, left = 1e9, right = -1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const i = (yy * w + xx) * 4;
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        if (yy < top) top = yy; if (yy > bottom) bottom = yy; if (xx < left) left = xx; if (xx > right) right = xx;
      }
    }
    if (bottom < 0) return null;
    return { top: y0 + top, bottom: y0 + bottom, left: x0 + left, right: x0 + right, h: bottom - top + 1, w: right - left + 1 };
  };
  // นับอนุภาคที่เพิ่งเกิด (ฝุ่น = สีครีมของ dust(), วิญญาณ = วงกลมขาวอมเขียว)
  window.__parts = function () {
    const g = CQ.debug.game, rgb = s => (/^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s || '') || []).slice(1).map(Number);
    let dust = 0, wisp = 0, wispUp = 0, wispLife = 0;
    g.particles.forEach(q => {
      if (q.kind !== 'circle') return;
      if (q.color === 'rgba(245,236,215,0.9)' && q.t <= 1 / 60 + 1e-6) dust++;
      const c = rgb(q.color);
      if (c.length === 3 && c[1] > c[0] && c[1] > c[2] && c[0] > 150) { wisp++; if (q.vy < 0) wispUp++; wispLife = Math.max(wispLife, q.life); }
    });
    return { dust, wisp, wispUp, wispLife };
  };
}

/** เล่นลำดับ motion บนหน้าที่เริ่มสเตจแล้ว คืนพิกเซลแต่ละจังหวะ + กรอบตัวละคร + ค่าที่วัด */
async function motionRun(page, tagShots) {
  await page.evaluate(installHeroBox);
  const px = {}, box = {}, info = {};
  const step = n => page.evaluate(n => window.__step(n), n);
  const snap = async tag => {
    px[tag] = await canvasPixels(page);
    box[tag] = await page.evaluate(() => window.__heroBox());
    if (tagShots) await page.screenshot({ path: path.join(SHOTS, tagShots + '-' + tag + '.png') });
  };
  // ภาพตัวละครเมื่อปิด motion ชั่วคราว (ท่าเดียวกัน) — ใช้เป็นตัวเทียบ
  const control = () => page.evaluate(() => {
    const g = CQ.debug.game, m = g.motion, ls = g.landSquash;
    if (!m) return null;
    const sv = { stretch: m.stretch, lean: m.lean };
    m.stretch = 0; m.lean = 0; g.landSquash = 0;
    try { return window.__heroBox(); } finally { m.stretch = sv.stretch; m.lean = sv.lean; g.landSquash = ls; }
  });
  const hitbox = () => page.evaluate(() => { const p = CQ.debug.game.player; return [p.w, p.h]; });

  info.hitbox0 = await hitbox();
  await snap('stand');
  // กระโดด: กดค้าง 1 เฟรม (2 สเต็ปฟิสิกส์)
  await page.keyboard.down('KeyZ');
  await step(1);
  info.jump = await page.evaluate(() => { const g = CQ.debug.game, p = g.player; return { vy: p.vy, onGround: p.onGround, motion: g.motion ? Object.assign({}, g.motion) : null }; });
  await snap('jump');
  info.jumpCtl = await control();
  info.hitboxJump = await hitbox();
  // รอจนลงพื้น (landSquash > 0)
  let landed = false;
  for (let i = 0; i < 150 && !landed; i++) {
    await step(1);
    landed = await page.evaluate(() => CQ.debug.game.player.onGround && CQ.debug.game.landSquash > 0);
  }
  info.landed = landed;
  info.landSquash = await page.evaluate(() => CQ.debug.game.landSquash);
  await snap('land');
  info.landCtl = await control();
  await page.keyboard.up('KeyZ');
  await step(30);
  // ออกตัวจากหยุดนิ่ง
  await page.keyboard.down('ArrowRight');
  await step(1);
  info.start = await page.evaluate(() => window.__parts());
  await snap('start');
  await step(30);
  info.run = await page.evaluate(() => { const g = CQ.debug.game, p = g.player; return { vx: p.vx, lean: g.motion ? g.motion.lean : null }; });
  await snap('run');
  // กลับตัวขณะวิ่ง
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowLeft');
  await step(1);
  info.turn = Object.assign(await page.evaluate(() => window.__parts()), await page.evaluate(() => { const p = CQ.debug.game.player; return { vx: p.vx, face: p.face }; }));
  await snap('turn');
  await page.keyboard.up('ArrowLeft');
  await step(20);
  // ศัตรูชนตอนพลังชีวิตเหลือ 1 → พลาด
  info.enemy = await page.evaluate(() => {
    const g = CQ.debug.game, p = g.player;
    const e = g.enemies.filter(en => !en.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (!e) return null;
    p.hp = 1; p.invuln = 0; p.guard = 0; p.pw.star = 0; p.vx = 0;
    e.x = p.x + (p.w - e.w) / 2; e.y = p.y + p.h - e.h; e.vx = 0;
    return e.kind;
  });
  await step(1);
  info.die0 = await page.evaluate(() => { const d = CQ.debug.game.deathAnim; return d && { y: d.y, startY: d.startY, hitStop: CQ.debug.game.hitStop }; });
  await step(4);
  info.die1 = await page.evaluate(() => { const d = CQ.debug.game.deathAnim; return d && { y: d.y, startY: d.startY }; });
  info.wisps1 = await page.evaluate(() => window.__parts());
  await snap('die1');
  await step(12);
  info.die2 = await page.evaluate(() => { const d = CQ.debug.game.deathAnim; return d && { y: d.y, startY: d.startY }; });
  info.wisps2 = await page.evaluate(() => window.__parts());
  await snap('die2');
  return { px, box, info };
}

const pxDiff = (a, b) => {
  if (!a || !b || a.length !== b.length) return -1;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++;
  return n;
};

async function motion(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });

  // ── สเตจ 1: ลำดับเดียวกันต้องได้ภาพตรงกับ BASE ทุกพิกเซลทุกจังหวะ (ไม่มี motion v2) ──
  const runs = {};
  for (const [tag, base] of [['base', '/__baseline__/'], ['now', '/']]) {
    const { context, page, errors } = await frozenPage(browser, base);
    await startFrozen(page, 'grassland');
    runs[tag] = await motionRun(page, tag === 'now' ? 'motion-grassland' : null);
    check('grassland (' + tag + '): no console/page errors', errors.length === 0, errors);
    await context.close();
  }
  for (const tag of Object.keys(runs.now.px)) {
    const d = pxDiff(runs.base.px[tag], runs.now.px[tag]);
    check('grassland ' + tag + ': canvas identical to ' + BASE + ' (0 px differ)', d === 0, d);
  }
  const gi = runs.now.info, bi = runs.base.info;
  check('grassland fixture: jumped, landed, ran, turned, died', gi.jump.vy < 0 && gi.landed && gi.run.vx > 120 && gi.turn.face === -1 && !!gi.die1, gi);
  check('grassland: hero box during jump same as baseline', JSON.stringify(runs.base.box.jump) === JSON.stringify(runs.now.box.jump), [runs.base.box.jump, runs.now.box.jump]);
  check('grassland: no hit-stop (deathAnim moved like baseline after 4 frames)', !!gi.die1 && gi.die1.y !== gi.die1.startY && JSON.stringify(gi.die1) === JSON.stringify(bi.die1), [bi.die1, gi.die1]);
  check('grassland: same particles as baseline (no extra dust / wisps)', JSON.stringify([gi.start, gi.turn.dust, gi.wisps1]) === JSON.stringify([bi.start, bi.turn.dust, bi.wisps1]), { base: [bi.start, bi.turn, bi.wisps1], now: [gi.start, gi.turn, gi.wisps1] });

  // ── สเตจ 4: motion v2 ──
  const { context, page, errors } = await frozenPage(browser, '/');
  await startFrozen(page, 'haunted');
  const st = await page.evaluate(() => CQ.debug.game.stage.motion);
  check('haunted: stage.motion === v2', st === 'v2', st);
  const h = await motionRun(page, 'motion-haunted');
  const hi = h.info, hb = h.box;
  check('haunted fixture: jumped, landed, ran right, turned left, enemy available', hi.jump.vy < 0 && hi.landed && hi.run.vx > 120 && hi.turn.face === -1 && hi.turn.vx > 120 && !!hi.enemy, hi);
  check('haunted: g.motion { stretch, lean } exists, stretch > 0 right after jump', !!hi.jump.motion && hi.jump.motion.stretch > 0 && hi.jump.motion.stretch <= 0.14 && typeof hi.jump.motion.lean === 'number', hi.jump.motion);
  check('haunted: hero >= 2 screen px taller rising than standing', !!hb.jump && !!hb.stand && hb.jump.h >= hb.stand.h + 2, { stand: hb.stand, jump: hb.jump });
  check('haunted: stretch (not the pose) makes it taller (>= +2 px vs same pose without motion)', !!hb.jump && !!hi.jumpCtl && hb.jump.h >= hi.jumpCtl.h + 2, { jump: hb.jump, ctl: hi.jumpCtl });
  check('haunted: stretch anchored at the feet (bottom row unchanged ±1)', !!hb.jump && !!hi.jumpCtl && Math.abs(hb.jump.bottom - hi.jumpCtl.bottom) <= 1, { jump: hb.jump, ctl: hi.jumpCtl });
  check('haunted: landing squash shorter (>= 2 px) and not narrower than same pose without motion', !!hb.land && !!hi.landCtl && hb.land.h <= hi.landCtl.h - 2 && hb.land.w >= hi.landCtl.w, { land: hb.land, ctl: hi.landCtl, landSquash: hi.landSquash });
  check('haunted: hitbox unchanged (p.w, p.h)', JSON.stringify(hi.hitbox0) === JSON.stringify(hi.hitboxJump), [hi.hitbox0, hi.hitboxJump]);
  check('haunted: start-from-standstill dust (>= 2 new dust particles)', hi.start.dust >= 2, hi.start);
  check('haunted: lean ≈ vx/(RUN·1.5)·0.08 while running right (0.03..0.08)', hi.run.lean > 0.03 && hi.run.lean <= 0.08, hi.run);
  check('haunted: turn-while-running dust (>= 2 new dust particles)', hi.turn.dust >= 2, hi.turn);
  check('haunted: kill() sets hit-stop 0.12', !!hi.die0 && Math.abs((hi.die0.hitStop || 0) - 0.12) < 0.02, hi.die0);
  check('haunted: deathAnim.y frozen ~0.06 s after kill (hit-stop)', !!hi.die1 && hi.die1.y === hi.die1.startY, hi.die1);
  check('haunted: deathAnim moves again after hit-stop', !!hi.die2 && hi.die2.y < hi.die2.startY, hi.die2);
  check('haunted: ghost wisps (white-green circles) rise for ~1 s', hi.wisps1.wisp >= 4 && hi.wisps1.wispUp === hi.wisps1.wisp && hi.wisps1.wispLife >= 0.9 && hi.wisps2.wisp >= 4, { die1: hi.wisps1, die2: hi.wisps2 });

  // ── ฉากไหว: ใยแมงมุม / ฟักทองหายใจ / เปลวเทียน (ปิดความมืดตอนวัด เทียบเวลา 5.0 กับ 5.6) ──
  const scene = await page.evaluate(() => {
    const r = CQ.debug.renderer, g = CQ.debug.game, ctx = document.getElementById('game').getContext('2d');
    const dk = g.stage.dark, mm = g.showMinimap;
    const region = (wx, wy, ww, wh, t) => {
      const want = r.clampCam(wx + ww / 2 - r.viewW / 2, wy + wh / 2 - r.viewH / 2);
      r.cam.x = want.x; r.cam.y = want.y;
      r.render(g, t);
      const d = ctx.getImageData(Math.round((wx - r.cx) * r.S), Math.round((wy - r.cy) * r.S), Math.round(ww * r.S), Math.round(wh * r.S)).data;
      let s = 0; for (let i = 0; i < d.length; i++) s = (s * 31 + d[i]) >>> 0;
      return s;
    };
    const out = {};
    g.stage.dark = null; g.showMinimap = false;
    const cam = { x: r.cam.x, y: r.cam.y };
    try {
      const webs = r.decor.filter(d => d.k === 'cobweb');
      out.webs = webs.length;
      if (webs[0]) { const w = webs[0]; out.web = region(w.x - 34, w.y, 68, 40, 5) !== region(w.x - 34, w.y, 68, 40, 5.6); }
      const e = g.enemies.find(en => en.kind === 'pfire' && !en.dead);
      if (e) { const wt = e.windT; e.windT = 0; out.pumpkin = region(e.x - 6, e.y - 10, e.w + 12, e.h + 12, 5) !== region(e.x - 6, e.y - 10, e.w + 12, e.h + 12, 5.6); e.windT = wt; }
      const c = r.decor.find(d => d.k === 'candle');
      if (c) out.candle = region(c.x - 10, c.y - 30, 20, 22, 5) !== region(c.x - 10, c.y - 30, 20, 22, 5.6);
    } finally { g.stage.dark = dk; g.showMinimap = mm; r.cam.x = cam.x; r.cam.y = cam.y; }
    return out;
  });
  check('haunted: cobweb decor exists in the level', scene.webs > 0, scene);
  check('haunted: cobweb sways over time', scene.web === true, scene);
  check('haunted: idle fire pumpkin "breathes" (body changes over time)', scene.pumpkin === true, scene);
  check('haunted: candle flame flickers', scene.candle === true, scene);
  check('haunted motion: no console/page errors', errors.length === 0, errors);
  await context.close();
}

// ── perf ────────────────────────────────────────────────────────
// RAF p95 สเตจ 4 (มีความมืด) เทียบ Castle ใน browser เดียวกัน ที่ 1366×768 และ 390×844 (มือถือ)
// วิธีเดียวกับ tools/2026-10-16_qa-resolution-performance.cjs: หยุดเกม แทน render ของ loop ด้วย noop
// แล้วเรียก render เองทุก RAF (40 เฟรมอุ่นเครื่อง + 120 เฟรมวัด) สลับลำดับสเตจทุกรอบ เปิดหน้าใหม่ทุกครั้ง
async function perf(browser) {
  const ROUNDS = +(process.env.QA_ROUNDS || 6);
  const sizes = [
    ['1366x768', { viewport: { width: 1366, height: 768 } }],
    ['390x844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, 4]
  ];
  // QA_BUSY=<ms>: ทดสอบความไวของ gate — ถ่วง render ของสเตจ 4 ด้วย busy-wait (ต้อง FAIL)
  const BUSY = +(process.env.QA_BUSY || 0);
  const errors = [];
  for (const [label, opts, cpu] of sizes) {
    const context = await browser.newContext(opts);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
    // มือถือ: จำลอง CPU ช้าลง 4 เท่า (CDP) ค้างอยู่ตลอดการนำทางของ page นี้
    if (cpu) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const pool = { haunted: { frame: [], sub: [] }, castle: { frame: [], sub: [] } };
    const roundsP95 = [];
    for (let round = 0; round < ROUNDS; round++) {
      const row = {};
      for (const st of round % 2 ? ['castle', 'haunted'] : ['haunted', 'castle']) {
        await openStage(page, st);
        await page.evaluate(() => { CQ.debug.game && document.getElementById('btn-pause') && document.getElementById('btn-pause').click(); });
        await page.waitForFunction(() => CQ.debug.state === 'paused', null, { timeout: 2000 }).catch(() => {});
        const m = await page.evaluate(async busy => {
          const g = CQ.debug.game, r = CQ.debug.renderer, render0 = r.render;
          const render = busy && g.stage.dark ? function () { const t = performance.now() + busy; while (performance.now() < t); return render0.apply(this, arguments); } : render0;
          r.render = () => {};
          // ซ่อนหน้าหยุดเกม (backdrop-filter blur ทับ canvas แพงกว่างานวาดหลายเท่า กลบความต่างระหว่างสเตจ)
          const pauseScreen = document.getElementById('screen-pause');
          pauseScreen.hidden = true;
          const intervals = [], sub = [];
          let prev;
          try {
            g.player.onGround = true; g.player.vx = 120;
            for (let i = 0; i < 160; i++) {
              const now = await new Promise(requestAnimationFrame);
              if (i >= 40) intervals.push(now - prev);
              prev = now;
              const t = performance.now();
              render.call(r, g, i / 60);
              if (i >= 40) sub.push(performance.now() - t);
            }
          } finally { r.render = render0; pauseScreen.hidden = false; }
          return { intervals, sub, dark: !!g.stage.dark, state: CQ.debug.state };
        }, BUSY);
        pool[st].frame.push(...m.intervals); pool[st].sub.push(...m.sub);
        row[st] = { p95: p95(m.intervals), sub95: p95(m.sub), dark: m.dark, state: m.state };
      }
      roundsP95.push(row);
    }
    const h = p95(pool.haunted.frame), c = p95(pool.castle.frame);
    const hs = p95(pool.haunted.sub), cs = p95(pool.castle.sub);
    console.log('      ' + label + ' rounds: ' + JSON.stringify(roundsP95));
    console.log('      ' + label + ' pooled RAF p95 haunted ' + h.toFixed(2) + ' ms / castle ' + c.toFixed(2) + ' ms (ratio ' + (h / c).toFixed(3) + '); render() p95 haunted ' + hs.toFixed(2) + ' ms / castle ' + cs.toFixed(2) + ' ms');
    check(label + ': haunted measured with darkness on', roundsP95.every(r => r.haunted.dark && r.haunted.state === 'paused' && r.castle.state === 'paused'), roundsP95);
    check(label + ': RAF p95 haunted <= 1.2 × castle', h <= 1.2 * c, { haunted: h, castle: c, ratio: +(h / c).toFixed(3) });
    await context.close();
  }
  check('perf: no page errors', errors.length === 0, errors);
}

function p95(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length * 0.95)];
}

(async () => {
  if (!PHASES.includes(phase)) { console.error('unknown phase: ' + phase + ' (use ' + PHASES.join('|') + ')'); process.exit(2); }
  const server = await startServer();
  // perf: ปลด vsync/จำกัดเฟรม ให้ RAF วัดงานจริง (ไม่ถูกปัดเป็น 16.7/33.4 ms)
  const browser = await chromium.launch(phase === 'perf' ? { args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] } : {});
  try {
    if (phase === 'logic') await logic(browser);
    else if (phase === 'visual') await visual(browser);
    else if (phase === 'dark') await dark(browser);
    else if (phase === 'perf') await perf(browser);
    else if (phase === 'motion') await motion(browser);
  } catch (e) {
    failed++;
    console.log('FAIL  exception — ' + (e && e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? '\n' + failed + ' check(s) FAILED' : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})();
