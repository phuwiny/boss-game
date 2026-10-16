/* Run with node tools/2026-10-13_browser-qa.cjs baseline|final|extended|resilience|preview.
 * PLAYWRIGHT_MODULE optionally points at an installed Playwright package.
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
const phase = process.argv[2] || 'baseline';
const assert = require('node:assert/strict');
const out = path.join(root, '.logs', '2026-10-13_screenshots');
fs.mkdirSync(out, { recursive: true });
const sizes = phase==='resolution-remaining' ? [[390,844],[640,360],[1366,768]] : ['extended','resilience'].includes(phase) ? [] : process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3].split('x').map(Number)] : [[360,640],[390,844],[640,360],[844,390],[1366,768]];
(async () => {
  const server = require('node:http').createServer((req,res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
    if(pathname.startsWith('/__baseline__/')) {
      const relative=pathname.slice('/__baseline__/'.length)||'index.html';
      if(!/^(index\.html|css\/style\.css|js\/[a-z-]+\.js|favicon\.svg)$/.test(relative)){res.writeHead(404).end();return;}
      const data=require('node:child_process').spawnSync('git',['show','HEAD:'+relative],{cwd:root,windowsHide:true});
      if(data.status!==0){res.writeHead(404).end();return;}
      res.setHeader('Content-Type',types[path.extname(relative)]||'application/octet-stream');res.end(data.stdout);return;
    }
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve => server.listen(8001,'127.0.0.1',resolve));
  if(phase==='preview') { console.log('Coin Quest preview: http://127.0.0.1:8001'); return; }
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const results = [];
  for (const [width,height] of sizes) {
    const context = await browser.newContext({ viewport:{width,height}, hasTouch:width<1000, isMobile:width<1000 });
    const page = await context.newPage();
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:8001', {waitUntil:'networkidle'});
    await page.screenshot({path:path.join(out, `${phase}-${width}x${height}-title.png`)});
    await page.locator('#btn-char').click();
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out, `${phase}-${width}x${height}-characters.png`)});
    await page.locator('#btn-chars-ok').click();
    await page.locator('#btn-timed').click();
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(out, `${phase}-${width}x${height}-game.png`)});
    await page.locator('#btn-pause').click();
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out, `${phase}-${width}x${height}-pause.png`)});
    await page.locator('#btn-home').click();
    await page.locator('#btn-minigames').click();
    await page.locator('#btn-mg-rps').click();
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out, `${phase}-${width}x${height}-rps.png`)});
    if (phase === 'concept') await require('./2026-10-15_qa-concept.cjs')({page,context,width,height,results});
    if (phase === 'resolution') await require('./2026-10-15_qa-concept.cjs')({page,context,width,height,results,outputDir:'.logs/2026-10-16_resolution-qa'});
    if (phase === 'resolution-remaining') await require('./2026-10-15_qa-concept.cjs')({page,context,width,height,results,outputDir:'.logs/2026-10-16_resolution-qa'});
    if (phase === 'resolution-performance') await require('./2026-10-16_qa-resolution-performance.cjs')({page,results});
    if (phase === 'pixel-upload') {
      await require('./2026-10-16_qa-pixel-upload.cjs')({page,results});
      await require('./2026-10-14_qa-effects.cjs')({page,results,width,height,outputDir:'.logs/2026-10-16_pixel-upload'});
    }
    if (phase === 'concept-effects') {
      const outputDir='.logs/2026-10-15_concept-qa/final-effects';
      await require('./2026-10-14_qa-effects.cjs')({page,results,width,height,outputDir});
      await require('./2026-10-15_qa-followup.cjs')({page,results,width,height,outputDir});
      await page.goto('http://127.0.0.1:8001/assets/characters/2026-10-15_animation-preview.html');
      await page.locator('#face').click();await page.locator('#star').click();await page.waitForTimeout(250);
      assert.equal(await page.locator('canvas').count(),3);
      await page.screenshot({path:path.join(outputDir,`${width}x${height}-animation-preview.png`),fullPage:true});
    }
    if (phase === 'liveplay') await require('./2026-10-15_qa-liveplay.cjs')({page,width,height,results});
    if (phase === 'normal-liveplay') await require('./2026-10-16_qa-normal-liveplay.cjs')({page,width,height,results});
    if (phase === 'remaining-liveplay') await require('./2026-10-16_qa-remaining-liveplay.cjs')({page,width,height,results});
    if (phase === 'minigames-complete') await require('./2026-10-15_qa-minigames.cjs')({page,width,height,results});
    if (phase === 'results') await require('./2026-10-15_qa-results.cjs')({page,width,height,results});
    if (phase === 'environment') await require('./2026-10-15_qa-environment.cjs')({page,results});
    if (phase === 'regression') {
      const currentOut=path.join(root,'.logs','2026-10-15_regression');fs.mkdirSync(currentOut,{recursive:true});
      await require('./2026-10-13_qa-flows.cjs')({page,context,width,height,out:currentOut,results});
      await require('./2026-10-15_qa-resilience.cjs')({browser,page,width,height,out:currentOut,results});
    }
    if (phase === 'matrix') await require('./2026-10-15_qa-matrix.cjs')({page,context,results,width,height});
    if (phase === 'followup') await require('./2026-10-15_qa-followup.cjs')({page,results,width,height});
    if (phase === 'effects') await require('./2026-10-14_qa-effects.cjs')({page,results,width,height});
    if (phase === 'boss-special') await require('./2026-10-14_qa-boss-special.cjs')({page,results,width,height});
    if (phase === 'performance') await require('./2026-10-14_qa-performance.cjs')({page,results});
    if (phase.startsWith('visual-')) await require('./2026-10-14_qa-visual.cjs')({page,context,width,height,out,results,phase});
    if (phase === 'integration' || phase === 'art-integration') await require('./2026-10-13_qa-integration.cjs')({page,context,width,height,out,results});
    if (phase === 'final') {
      const run = require('./2026-10-13_qa-flows.cjs');
      await run({page,context,width,height,out,results});
    }
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    results.push({width,height,errors});
    await context.close();
  }
  if(['extended','resilience'].includes(phase)) await require('./2026-10-13_qa-extended.cjs')({browser,out,results,quick:phase==='resilience'});
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(root,'.logs',`2026-10-13_${phase}-browser.json`),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1);});
