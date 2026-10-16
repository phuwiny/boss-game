const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,width,height,results})=>{
 const dir=path.resolve('.logs/2026-10-15_results-qa');fs.mkdirSync(dir,{recursive:true});
 await page.goto('http://127.0.0.1:8001/?seed=qa-results-2026-10-15');
 await page.locator('#btn-char').click();await page.locator('.char-card').nth(2).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
 const stageResult=async mode=>{
  await page.evaluate(mode=>{
   const g=CQ.debug.game;
   if(mode==='timed'){g.time=g.limit-0.01;return;}
   // UI-only victory fixture; not evidence of defeating the boss or collecting the level.
   g.coins.forEach(c=>{c.taken=true;});g.collected=g.goal-1;
   const c=g.coins[0];c.taken=false;c.hidden=false;c.pop=null;c.x=g.player.x+g.player.w/2;c.y=g.player.y+g.player.h/2;
  },mode);
  await page.waitForFunction(()=>CQ.debug.state==='won',{},{timeout:3000});await page.waitForTimeout(900);
 };
 for(const stage of ['grassland','forest','castle'])for(const mode of ['normal','timed']){
  await page.locator('.stage-'+stage).click();await page.locator('#btn-'+mode).click();await stageResult(mode);
  assert.equal(await page.locator('#win-heading').innerText(),mode==='normal'?'ภารกิจสำเร็จ!':'หมดเวลา!');
  for(const selector of ['#win-heading','#win-sub','#win-time','#btn-again','#btn-win-home']){
   const r=await page.locator(selector).boundingBox();assert.ok(r&&r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,'result bounds '+selector);
  }
  await page.screenshot({path:path.join(dir,`${width}x${height}-${stage}-${mode}.png`)});
  await page.locator('#btn-again').click();assert.equal(await page.evaluate(()=>CQ.debug.state),'playing');assert.equal(await page.evaluate(()=>CQ.debug.game.collected),0);assert.ok(await page.evaluate(()=>CQ.debug.game.time<1));
  await stageResult(mode);await page.locator('#btn-win-home').click();assert.equal(await page.evaluate(()=>CQ.debug.state),'title');
  results.push({width,height,stage,mode,result:'PASS: staged result layout, replay reset, result home',fixture:mode==='timed'?'timer advanced to limit':'all but final coin staged; final coin overlaps player; Castle boss completion NOT asserted'});
 }
 fs.writeFileSync(path.join(dir,`results-${width}x${height}.json`),JSON.stringify(results,null,2));
};
