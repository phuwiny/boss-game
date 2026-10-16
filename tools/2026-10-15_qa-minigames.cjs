const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,width,height,results})=>{
 const dir=path.resolve('.logs/2026-10-15_minigames-complete');fs.mkdirSync(dir,{recursive:true});
 const save=()=>fs.writeFileSync(path.join(dir,`results-${width}x${height}.json`),JSON.stringify(results,null,2));
 const shot=n=>page.screenshot({path:path.join(dir,`${width}x${height}-${n}.png`)});
 for(const [index,id] of ['bobo','mew','aclaire'].entries()){
  await page.goto('http://127.0.0.1:8001/?seed=qa-minigames-2026-10-15');await page.locator('#btn-char').click();await page.locator('.char-card').nth(index).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
  await page.locator('#btn-minigames').click();await page.locator('#btn-mg-memory').click();await page.locator('#mem-levels button').first().click();
  // Remember face markup during the game's legitimate preview, then use normal clicks.
  const pairs=await page.locator('#mem-board .mem-face').evaluateAll(es=>{const groups={};es.forEach((e,i)=>{const key=e.innerHTML;(groups[key]??=[]).push(i);});return Object.values(groups);});
  assert.equal(pairs.length,6);assert.ok(pairs.every(p=>p.length===2));await page.waitForTimeout(3300);
  for(const pair of pairs)for(const i of pair)await page.locator('#mem-board button').nth(i).click();
  await page.locator('#mem-result').waitFor({state:'visible'});await shot(id+'-memory-result');assert.ok((await page.locator('#mem-res-sub').innerText()).includes('6'));
  const layout=await page.evaluate(()=>{const overlay=document.querySelector('#mem-result').getBoundingClientRect();return [...document.querySelectorAll('#mem-result .screen-title,#mem-result button')].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,top:r.top,bottom:r.bottom,limitTop:overlay.top,limitBottom:overlay.bottom};});});
  assert.ok(layout.every(r=>r.top>=r.limitTop&&r.bottom<=r.limitBottom),'Memory result clipped: '+JSON.stringify(layout));
  await page.locator('#btn-mem-again').click();assert.equal(await page.locator('#mem-result').isVisible(),false);assert.equal(await page.locator('#mem-board button').count(),12);
  await page.locator('#btn-mem-exit').click();results.push({id,memory:'PASS: remember visible preview, click all pairs, actual win/result/replay/exit; no state writes'});save();
 }
 if(process.argv[4]==='memory-only')return;
 // Current Aclaire selection: allow real random RPS rules to decide win/loss.
 await page.locator('#btn-mg-rps').click();const start=Date.now();let choices=0;
 while(Date.now()-start<240000){
  if(await page.locator('#rps-controls button').filter({hasText:'เล่นอีกครั้ง'}).isVisible())break;
  const available=page.locator('#rps-controls button:not(:disabled)');
  if(await available.count()){
   const attack=available.filter({hasText:'โจมตี'}),charge=available.filter({hasText:'ชาร์จ'});
   if(await attack.count())await attack.first().click();else if(await charge.count())await charge.first().click();else await available.first().click();choices++;
  }
  await page.waitForTimeout(250);
 }
 const again=page.locator('#rps-controls button').filter({hasText:'เล่นอีกครั้ง'});assert.ok(await again.isVisible(),'RPS reaches a real outcome');const outcome=await page.locator('#rps-msg').innerText();await shot('aclaire-rps-result');await again.click();assert.ok(await page.locator('.rps-choice').count());await page.locator('#btn-rps-exit').click();results.push({id:'aclaire',rps:'PASS: real rules outcome/replay/exit',outcome,choices,elapsedMs:Date.now()-start});save();
 await page.locator('#btn-mg-rain').click();await page.locator('#btn-rain-start').click();
 // Idle player is an intentional negative-path test: normal falling rocks deplete HP.
 await page.locator('#rain-over').waitFor({state:'visible',timeout:180000});await shot('aclaire-rain-result');const stats=await page.locator('#rain-over-stats').innerText();await page.locator('#btn-rain-again').click();assert.equal(await page.locator('#rain-over').isVisible(),false);await page.locator('#btn-rain-pause').click();await page.locator('#btn-rain-quit').click();results.push({id:'aclaire',rain:'PASS: natural idle loss, result, replay, pause/exit; no state writes',stats});save();
};
