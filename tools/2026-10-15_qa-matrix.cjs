const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,context,results,width,height,outputDir})=>{
 const dir=path.resolve(outputDir||'.logs/2026-10-15_remaining-qa');fs.mkdirSync(dir,{recursive:true});
 const shot=n=>page.screenshot({path:path.join(dir,`${width}x${height}-${n}.png`)});
 const failures=[];page.on('requestfailed',r=>{if(r.url().startsWith('http://127.0.0.1'))failures.push(r.url());});
 const bounds=async()=>{
  const boxes=await page.locator('#touch .tbtn').evaluateAll(es=>es.map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height).map(r=>({x:r.x,y:r.y,w:r.width,h:r.height})));
  for(const b of boxes)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width+1&&b.y+b.h<=height+1,'control outside viewport');
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'controls overlap');}
 };
 for(let index=0;index<3;index++){
  const id=['bobo','mew','aclaire'][index];
  await page.goto('http://127.0.0.1:8001/?seed=qa-matrix-2026-10-15');
  await page.locator('#btn-char').click();await page.locator('.char-card').nth(index).scrollIntoViewIfNeeded();await page.waitForTimeout(350);await shot(id+'-picker');await page.locator('.char-card').nth(index).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
  await page.waitForTimeout(350);await shot(id+'-title');
  await page.locator('#btn-minigames').click();await page.locator('#btn-mg-rps').click();await page.waitForTimeout(250);await shot(id+'-rps');
  assert.ok(await page.locator('#rps-me-avatar').evaluate(c=>c.width>0&&c.height>0));
  await page.locator('#btn-rps-exit').click();await page.locator('#btn-mg-rain').click();await page.locator('#btn-rain-start').click();await page.waitForTimeout(350);await shot(id+'-rain');
  await page.locator('#btn-rain-pause').click();await page.locator('#btn-rain-quit').click();await page.locator('#btn-mg-memory').click();
  // Visual deck fixture: ensure all three heroes appear; normal random decks may omit them.
  await page.evaluate(()=>{const original=CQ.MemoryRules.newGame;CQ.MemoryRules.newGame=opts=>{CQ.MemoryRules.newGame=original;return original({...opts,rng:()=>0.999});};});
  await page.locator('#mem-levels button').last().click();await page.waitForTimeout(250);await shot(id+'-memory-preview');
  const heroes=await page.locator('#mem-board canvas[data-hero]').evaluateAll(es=>es.map(c=>({id:c.dataset.hero,w:c.width,h:c.height,painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)})));
  for(const hero of ['bobo','mew','aclaire'])assert.ok(heroes.some(h=>h.id===hero&&h.painted),'Memory hero rendered '+hero);
  await page.locator('#btn-mem-exit').click();await page.locator('#btn-mg-back').click();
  results.push({width,height,id,sharedPortraits:'screenshots captured; RPS canvas and all Memory hero pixels present'});
  // Short real-input exploration of all stage/mode/character combinations on one viewport.
  if(width===844)for(const stage of ['grassland','forest','castle'])for(const mode of ['normal','timed']){
   await page.locator('.stage-'+stage).click();await page.locator('#btn-'+mode).click();
   const x=await page.evaluate(()=>CQ.debug.game.player.x);await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');await page.keyboard.down('KeyX');await page.waitForTimeout(650);await page.keyboard.up('Space');await page.waitForTimeout(350);await page.keyboard.up('ArrowRight');await page.keyboard.up('KeyX');
   const state=await page.evaluate(()=>({char:CQ.debug.charId,stage:CQ.debug.game.stage.theme,x:CQ.debug.game.player.x,state:CQ.debug.state}));assert.equal(state.char,id);assert.equal(state.stage,stage);assert.ok(state.x>x);assert.equal(state.state,'playing');
   await shot(`${id}-${stage}-${mode}-explore`);await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
   results.push({id,stage,mode,realInputExploration:'PASS: move/jump/fire 1 second, pause/home; not full-level completion'});
  }
  await page.locator('.stage-castle').click();await page.locator('#btn-normal').click();
  for(const size of ['standard','large']){
   await page.locator('#btn-pause').click();await page.locator(`input[value="${size}"]`).check();await page.locator('#btn-resume').click();await bounds();
  }
  // Arena fixture changes only position; real shots and boss pattern run normally.
  await page.evaluate(()=>{const g=CQ.debug.game;g.player.x=g.boss.x-180;g.player.y=g.boss.y+g.boss.h-g.player.h;});
  await page.waitForFunction(()=>CQ.debug.game.fires.length>0,{},{timeout:10000});await page.keyboard.down('KeyX');
  await page.waitForFunction(()=>CQ.debug.game.shots.length>0,{},{timeout:2000});await shot(id+'-castle-crossfire-large');await page.keyboard.up('KeyX');await bounds();
  results.push({width,height,id,castle:'PASS: original boss attacks + player shots; standard/large control bounds; staged arena position'});
 }
 assert.deepEqual(failures,[],'local resources load');
 fs.writeFileSync(path.join(dir,`results-${width}x${height}.json`),JSON.stringify(results,null,2));
};
