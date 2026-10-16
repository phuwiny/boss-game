const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({browser,page,width,height,out,results})=>{
 for(const [index,id] of ['bobo','mew','aclaire'].entries()){
  await page.locator('#btn-char').click();await page.locator('.char-card').nth(index).scrollIntoViewIfNeeded();await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`${width}x${height}-${id}-picker-settled.png`)});
  await page.locator('.char-card').nth(index).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`${width}x${height}-${id}-title-settled.png`)});
 }
 await page.evaluate(()=>{localStorage.setItem('coinquest.best.v3',JSON.stringify({time:9999,deaths:3}));localStorage.setItem('coinquest.timed.best.v1.bobo',JSON.stringify({coins:80,left:39}));});
 const before=await page.evaluate(()=>[localStorage.getItem('coinquest.best.v3'),localStorage.getItem('coinquest.timed.best.v1.bobo')]);
 await page.reload();await page.locator('#btn-normal').click();await page.locator('#btn-pause').click();await page.locator('input[value="large"]').check();await page.locator('#btn-home').click();await page.reload();
 assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('coinquest.best.v3'),localStorage.getItem('coinquest.timed.best.v1.bobo')]),before);
 assert.equal(await page.evaluate(()=>document.body.dataset.touchSize),'large');
 await page.locator('.play-guide summary').click();await page.locator('#btn-manual').click();assert.ok(page.url().endsWith('/manual.html'));assert.ok((await page.locator('body').innerText()).includes('Coin Quest'));
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<1000,isMobile:width<1000});
 await ctx.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('QA blocked storage');};Storage.prototype.setItem=()=>{throw Error('QA blocked storage');};});
 await ctx.route(/assets\/|fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8001/?seed=qa-resilience-2026-10-15');
 for(const stage of ['grassland','forest','castle']){
  await p.locator('.stage-'+stage).click();await p.waitForTimeout(100);await p.screenshot({path:path.join(out,`${width}x${height}-${stage}-blocked-assets.png`)});
  await p.locator('#btn-normal').click();assert.equal(await p.evaluate(()=>CQ.debug.game.stage.theme),stage);await p.locator('#btn-pause').click();await p.locator('input[value="large"]').check();await p.locator('#btn-home').click();
 }
 assert.deepEqual(errors,[]);await ctx.close();
 results.push({width,height,resilience:'PASS: all 3 stages start with assets/fonts/storage blocked; old records unchanged; setting reload and manual'});
 fs.writeFileSync(path.join(out,`results-${width}x${height}.json`),JSON.stringify(results,null,2));
};
