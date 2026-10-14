const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,results,width,height})=>{
 const dir=path.resolve('.logs/2026-10-14_boss-special');fs.mkdirSync(dir,{recursive:true});
 const save=()=>fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
 const shot=async name=>page.screenshot({path:path.join(dir,`${width}x${height}-${name}.png`)});
 const read=()=>page.evaluate(()=>{const g=CQ.debug.game,p=g.player,b=g.boss;return {state:CQ.debug.state,x:p.x,y:p.y,w:p.w,h:p.h,onGround:p.onGround,vy:p.vy,hp:p.hp,guard:p.guard,invuln:p.invuln,deaths:g.deaths,collected:g.collected,goal:g.goal,shots:g.shots.map(s=>({kind:s.kind,dmg:s.dmg})),boss:{x:b.x,y:b.y,hp:b.hp,dead:b.dead,windT:b.windT,count:b.count},fires:g.fires.map(f=>({x:f.x,y:f.y,vx:f.vx,vy:f.vy})),coins:g.coins.filter(c=>c.boss&&!c.taken&&!c.hidden).map(c=>({x:c.x,y:c.y}))};});
 const keys=new Set();
 const input=async wanted=>{for(const k of [...keys])if(!wanted.includes(k)){await page.keyboard.up(k);keys.delete(k);}for(const k of wanted)if(!keys.has(k)){await page.keyboard.down(k);keys.add(k);}};
 for(let index=0;index<3;index++){
  const id=['bobo','mew','aclaire'][index];
  await page.goto('http://127.0.0.1:8001/?seed=qa-boss-2026-10-14');
  await page.locator('#btn-char').click();await page.locator('.char-card').nth(index).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();await page.locator('.stage-castle').click();await page.locator('#btn-normal').click();
  // Controlled encounter setup only: skip traversal; HP, boss, damage and timers remain untouched.
  await page.evaluate(()=>{const g=CQ.debug.game;g.player.x=g.boss.x-120;g.player.y=g.boss.y+g.boss.h-g.player.h;});
  const lossStart=Date.now();let minHP=5,sawGuard=false;
  while(Date.now()-lossStart<45000){
   const s=await read();minHP=Math.min(minHP,s.hp);sawGuard ||=id==='aclaire'&&s.guard===0&&s.invuln>0;
   if(s.deaths){await shot(id+'-death');break;}
   await input(s.x<s.boss.x+24?['ArrowRight']:s.x>s.boss.x+44?['ArrowLeft']:[]);await page.waitForTimeout(100);
  }
  await input([]);assert.ok((await read()).deaths>=1,id+' HP depletion causes death');
  await page.waitForTimeout(1800);let s=await read();assert.equal(s.hp,5);assert.equal(s.boss.hp,50);assert.equal(s.state,'playing');if(id==='aclaire')assert.ok(sawGuard);
  results.push({id,loss:'PASS',minHP,guardObserved:sawGuard,setup:'position player near boss; original HP/damage/timers; keyboard contact; automatic respawn'});save();
  await page.locator('#btn-pause').click();await page.locator('#btn-restart').click();
  await page.evaluate(()=>{const g=CQ.debug.game;g.player.x=g.boss.x-150;g.player.y=g.boss.y+g.boss.h-g.player.h;g.coins.forEach(c=>{if(!c.boss)c.taken=true;});g.collected=g.coins.filter(c=>c.taken).length;});
  const start=Date.now();let damageSeen=false,shotsSeen=false,attackSeen=false,jumpUntil=0;const trace=[];
  while(Date.now()-start<90000){
   s=await read();trace.push({t:Date.now()-start,hp:s.hp,bossHP:s.boss.hp,x:s.x,bx:s.boss.x});damageSeen ||=s.boss.hp<50;shotsSeen ||=s.shots.length>0;attackSeen ||=s.boss.count>0;
   if(s.deaths>0)break;
   if(s.boss.dead)break;
   const d=s.boss.x-s.x;
   const incoming=s.fires.some(f=>f.x>s.x-20&&f.x<s.x+140&&f.vx<0&&Math.abs(f.y-(s.y+s.h/2))<50);
   if(incoming&&s.onGround)jumpUntil=Date.now()+180;
   const wanted=['KeyX'];if(d>160)wanted.push('ArrowRight');else if(d<100)wanted.push('ArrowLeft');
   // Face the boss again after retreating before resuming stationary fire.
   else if(keys.has('ArrowLeft'))wanted.push('ArrowRight');
   if(Date.now()<jumpUntil)wanted.push('Space');
   await input(wanted);await page.waitForTimeout(100);
  }
  await input([]);fs.writeFileSync(path.join(dir,id+'-combat-trace.json'),JSON.stringify(trace));
  s=await read();results.push({id,bossDead:s.boss.dead,hp:s.hp,deaths:s.deaths,damageSeen,shotsSeen,attackSeen,elapsed:Date.now()-start});save();
  assert.ok(s.boss.dead,id+' wins combat from full boss HP');await shot(id+'-boss-defeated');
  await page.waitForTimeout(1300);
  const collectStart=Date.now();
  while(Date.now()-collectStart<15000){
   s=await read();if(s.state==='won')break;
   const c=s.coins.sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];if(!c){await input([]);await page.waitForTimeout(500);continue;}
   const wanted=[];if(c.x>s.x+s.w/2+5)wanted.push('ArrowRight');else if(c.x<s.x+s.w/2-5)wanted.push('ArrowLeft');
   if(c.y<s.y+5&&s.onGround)wanted.push('Space');await input(wanted);await page.waitForTimeout(100);
  }
  await input([]);assert.equal((await read()).state,'won');await shot(id+'-result');await page.waitForTimeout(900);await page.locator('#btn-again').click();
  s=await read();assert.equal(s.hp,5);assert.equal(s.boss.hp,50);assert.equal(s.collected,0);
  results.push({id,resultAndReplay:'PASS',setup:'non-boss coins precollected before combat; boss coins collected with keyboard'});save();
 }
};
