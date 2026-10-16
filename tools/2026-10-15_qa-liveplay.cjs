const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,width,height,results})=>{
 const dir=path.resolve('.logs/2026-10-15_liveplay');fs.mkdirSync(dir,{recursive:true});
 const keys=new Set();
 const input=async wanted=>{for(const k of [...keys])if(!wanted.includes(k)){await page.keyboard.up(k);keys.delete(k);}for(const k of wanted)if(!keys.has(k)){await page.keyboard.down(k);keys.add(k);}};
 const cases=[['grassland','bobo',0],['forest','mew',1],['castle','aclaire',2]];
 for(const [stage,id,index] of cases){
  await page.goto('http://127.0.0.1:8001/?seed=qa-liveplay-2026-10-15');await page.locator('#btn-char').click();await page.locator('.char-card').nth(index).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();await page.locator('.stage-'+stage).click();await page.locator('#btn-timed').click();
  const started=Date.now(),trace=[];let maxX=0,jumpHeldUntil=0,jumpReleaseUntil=0,lastX=0,stuck=0,escapeUntil=0,lastSave=0;
  while(Date.now()-started<190000){
   // Only read game state; every action is a normal keyboard event.
   const s=await page.evaluate(()=>{const g=CQ.debug.game,p=g.player;return {state:CQ.debug.state,time:g.time,limit:g.limit,x:p.x,y:p.y,w:p.w,h:p.h,vy:p.vy,onGround:p.onGround,air:p.airJumps,dead:p.dead,hp:p.hp,guard:p.guard,collected:g.collected,deaths:g.deaths,levelWidth:g.lv.w*32,coins:g.coins.filter(c=>!c.taken&&!c.hidden).map(c=>({x:c.x,y:c.y})),boss:g.boss?{x:g.boss.x,hp:g.boss.hp,dead:g.boss.dead}:null};});
   maxX=Math.max(maxX,s.x);const now=Date.now();
   if(now-lastSave>2000){trace.push({ms:now-started,...s,coins:undefined});lastSave=now;fs.writeFileSync(path.join(dir,`${stage}-${id}-trace.json`),JSON.stringify(trace,null,2));}
   if(s.state==='won')break;
   if(s.state!=='playing'||s.dead){await input([]);await page.waitForTimeout(150);continue;}
   stuck=Math.abs(s.x-lastX)<1?stuck+1:0;lastX=s.x;
   if(stuck>12){escapeUntil=now+450;stuck=0;}
   const candidates=s.coins.filter(c=>c.x>=s.x-28);const target=candidates.sort((a,b)=>Math.abs(a.x-s.x)+Math.abs(a.y-s.y)*0.6-Math.abs(b.x-s.x)-Math.abs(b.y-s.y)*0.6)[0];
   let direction=now<escapeUntil?-1:1;
   if(s.x>s.levelWidth-100)direction=-1;
   if(target&&Math.abs(target.x-s.x)<65&&target.y<s.y-35)direction=target.x>s.x+s.w/2?1:-1;
   if(now>=jumpReleaseUntil&&now>=jumpHeldUntil&&s.onGround){jumpHeldUntil=now+280;jumpReleaseUntil=now+430;}
   if(!s.onGround&&s.air>0&&s.vy>10&&target&&target.y<s.y&&now>=jumpReleaseUntil){jumpHeldUntil=now+320;jumpReleaseUntil=now+520;}
   const wanted=[direction>0?'ArrowRight':'ArrowLeft'];if(now<jumpHeldUntil)wanted.push('Space');if(stage==='castle')wanted.push('KeyX');
   await input(wanted);await page.waitForTimeout(100);
  }
  await input([]);const outcome=await page.evaluate(()=>({state:CQ.debug.state,time:CQ.debug.game.time,limit:CQ.debug.game.limit,collected:CQ.debug.game.collected,deaths:CQ.debug.game.deaths,bossDefeated:CQ.debug.game.bossDefeated,levelWidth:CQ.debug.game.lv.w*32}));
  results.push({stage,id,mode:'timed',...outcome,maxX,wallSeconds:(Date.now()-started)/1000,input:'real keyboard; read-only debug; no game state writes'});fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
  assert.equal(outcome.state,'won');assert.ok(outcome.time>=outcome.limit||outcome.collected>=80);await page.waitForTimeout(900);await page.screenshot({path:path.join(dir,`${width}x${height}-${stage}-${id}-real-result.png`)});
  await page.locator('#btn-again').click();assert.equal(await page.evaluate(()=>CQ.debug.game.collected),0);assert.ok(await page.evaluate(()=>CQ.debug.game.time<1));await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
  console.log(JSON.stringify({completed:stage,...outcome,maxX}));
 }
};
