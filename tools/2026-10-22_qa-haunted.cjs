/* QA ของสเตจ 4 Haunted House ในเบราว์เซอร์จริง (Playwright Chromium)
 *   node tools/2026-10-22_qa-haunted.cjs [phase]      phase: logic (ค่าเริ่มต้น)
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
const PHASES = ['logic'];
const URL_BASE = 'http://127.0.0.1:8001/?seed=qa-haunted';

let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log('ok    ' + name);
  else { failed++; console.log('FAIL  ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }
}

function startServer() {
  const server = require('node:http').createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
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
  const r2 = await pauseAndReturn(page);
  const post2 = await page.evaluate(() => {
    const g = CQ.debug.game, p = g.player, T = CQ.PHYS.T, r = g.respawn;
    return { sw: g.lv.sw, fires: g.fires.length, shots: g.shots.length, atCp: Math.abs(p.x - (r.tx * T + (T - p.w) / 2)) < 0.01 };
  });
  check('return to room-2 checkpoint restores orange (was purple)', now === 'purple' && post2.sw === 'orange' && post2.atCp, { now, post2 });
  check('Focus 5: fires cleared on checkpoint return', r2.before.fires > 0 && post2.fires === 0, { before: r2.before, after: post2.fires });

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

(async () => {
  if (!PHASES.includes(phase)) { console.error('unknown phase: ' + phase + ' (use ' + PHASES.join('|') + ')'); process.exit(2); }
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    if (phase === 'logic') await logic(browser);
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
