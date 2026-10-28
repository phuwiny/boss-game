const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async({page,width,height,out,results})=>{
 const shot=async name=>page.screenshot({path:path.join(out,`integration-${width}x${height}-${name}.png`)});
 await page.locator('#btn-rps-exit').click();
 await page.locator('#btn-mg-rain').click();
 await page.locator('#btn-rain-start').click();
 await page.waitForTimeout(250);
 await page.locator('#btn-rain-pause').click();
 await page.locator('#btn-rain-resume').click();
 await page.locator('#btn-rain-pause').click();
 await page.locator('#btn-rain-quit').click();
 await page.locator('#btn-mg-memory').click();
 await page.locator('#mem-levels button').first().click();
 await page.waitForTimeout(3300);
 await page.locator('#mem-board button').first().click();
 await shot('memory');
 await page.locator('#btn-mem-exit').click();
 await page.locator('#btn-mg-back').click();
 assert.equal(await page.locator('.stage-btn').count(),await page.evaluate(()=>CQ.STAGES.length)); // ปุ่มสเตจครบทุกสเตจ (ตอนนี้ 4)
 assert.equal(await page.evaluate(()=>CQ.STAGES.length),4);
 for(const stage of ['grassland','forest','castle']){
  await page.locator('.stage-'+stage).click();
  await shot(stage+'-title');
  for(const mode of ['normal','timed']){
   await page.locator('#btn-'+mode).click();
   assert.equal(await page.evaluate(()=>CQ.debug.game.stage.theme),stage);
   await page.locator('#btn-pause').click();
   await page.locator('input[value="large"]').check();
   await page.locator('#btn-resume').click();
   if(stage==='castle'&&width<1000){
    const boxes=await page.locator('#touch .tbtn').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(const b of boxes)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=height,JSON.stringify(b));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'controls overlap');}
    await page.locator('[data-btn="fire"]').click();
   }
   await shot(stage+'-'+mode);
   await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
  }
 }
 await page.locator('#screen-title summary').click();
 await page.locator('#btn-manual').click();
 assert.ok(page.url().endsWith('/manual.html'));
 assert.ok((await page.locator('body').innerText()).includes('Coin Quest'));
 results.push({width,height,integration:'PASS: all stages/modes, large controls, Rain, Memory, manual'});
};
