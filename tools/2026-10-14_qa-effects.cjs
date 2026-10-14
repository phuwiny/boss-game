const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,results,width,height})=>{
 const dir=path.resolve('.logs/2026-10-14_boss-special');fs.mkdirSync(dir,{recursive:true});
 const shot=async label=>page.screenshot({path:path.join(dir,`${width}x${height}-${label}.png`)});
 for(let i=0;i<3;i++){
  const id=['bobo','mew','aclaire'][i];await page.goto('http://127.0.0.1:8001/?seed=qa-effects-2026-10-14');
  await page.locator('#btn-char').click();await page.locator('.char-card').nth(i).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
  await page.locator('.stage-grassland').click();await page.locator('#btn-normal').click();
  // Visual fixtures: give existing power timers, then exercise real jump input.
  await page.evaluate(()=>{const p=CQ.debug.game.player;p.pw.wing=10;p.airJumps=p.airJumpsMax+1;});
  await page.waitForTimeout(300);await shot(id+'-wing-ground');
  await page.keyboard.down('Space');await page.waitForTimeout(240);await page.keyboard.up('Space');await page.waitForTimeout(100);await page.keyboard.down('Space');await page.waitForTimeout(120);
  assert.ok(await page.evaluate(()=>!CQ.debug.game.player.onGround));await shot(id+'-wing-airjump');
  if(id==='mew'){
   await page.waitForFunction(()=>CQ.debug.game.player.floating,{},{timeout:4000});await shot(id+'-floating');
   assert.ok(await page.evaluate(()=>CQ.debug.game.player.floatT<CQ.debug.game.player.floatMax));
  }
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>CQ.debug.game.player.onGround,{},{timeout:6000});
  await page.evaluate(()=>{const p=CQ.debug.game.player;p.pw.star=10;p.pw.wing=10;});
  await page.waitForTimeout(220);await shot(id+'-star-wing-right');
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(100);await page.keyboard.up('ArrowLeft');await shot(id+'-star-wing-left');
  assert.equal(await page.evaluate(()=>CQ.debug.game.player.face),-1);
  if(id==='aclaire'){
   await page.evaluate(()=>{const g=CQ.debug.game,p=g.player;p.pw.star=0;p.pw.wing=0;const e=g.enemies[0];e.x=p.x+p.w-2;e.y=p.y+p.h-e.h;e.vx=0;});
   await page.waitForFunction(()=>CQ.debug.game.player.guard===0,{},{timeout:3000});
   assert.ok(await page.evaluate(()=>CQ.debug.game.player.invuln>0&&!CQ.debug.game.player.dead));await shot('aclaire-guard-used');
   // Capture a visible blink phase too, so the guard review includes the sprite.
   await page.waitForTimeout(70);await shot('aclaire-guard-used-next-frame');
  }
  const ui=await page.evaluate(()=>{const c=document.querySelector('#game').getBoundingClientRect();return {canvas:{w:c.width,h:c.height},overflow:document.documentElement.scrollWidth>innerWidth};});assert.equal(ui.overflow,false);
  results.push({id,width,height,effects:'PASS',setup:'wing/star timers staged; jump, airjump, facing and Mew float activated by keyboard; Aclaire guard triggered by positioned real enemy',ui});
 }
 fs.writeFileSync(path.join(dir,`effects-${width}x${height}.json`),JSON.stringify(results,null,2));
};
