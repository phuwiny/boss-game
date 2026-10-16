/* Real-input normal-mode probe. Forecasts operate on copies, never on live state.
 * A timeout is incomplete coverage, not a passing completion test.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,width,height,results,stage=process.argv[4]||'grassland',character=process.argv[5]||'mew',mode='normal',outputRoot='.logs/2026-10-16_normal-liveplay-routing'})=>{
 assert.ok(['grassland','forest','castle'].includes(stage));assert.ok(['bobo','mew','aclaire'].includes(character));
 assert.ok(['normal','timed'].includes(mode));
 const dir=path.resolve(`${outputRoot}/${stage}-${character}`);fs.mkdirSync(dir,{recursive:true});
 const keys=new Set();
 const input=async wanted=>{for(const k of [...keys])if(!wanted.includes(k)){await page.keyboard.up(k);keys.delete(k);}for(const k of wanted)if(!keys.has(k)){await page.keyboard.down(k);keys.add(k);}};
 await page.goto('http://127.0.0.1:8001/?seed=qa-normal-2026-10-16');
 await page.locator('#btn-char').click();await page.locator('.char-card').nth(['bobo','mew','aclaire'].indexOf(character)).click();
 if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
 await page.locator('.stage-'+stage).click();await page.locator('#btn-'+mode).click();
 const started=Date.now(),trace=[],deferred={};let target=null,route=null,targetSince=0,lastSave=0,lastShot=0,maxX=0;
 try{
  while(Date.now()-started<240000){
   const s=await page.evaluate(()=>{const g=CQ.debug.game,p=g.player;return {state:CQ.debug.state,time:g.time,x:p.x,y:p.y,onGround:p.onGround,dead:p.dead,collected:g.collected,goal:g.goal,deaths:g.deaths,coins:g.coins.map((c,i)=>({...c,i})).filter(c=>!c.taken&&!c.hidden)};});
   const now=Date.now();maxX=Math.max(maxX,s.x);
   if(now-lastSave>5000){trace.push({...s,coins:undefined,ms:now-started,target});fs.writeFileSync(path.join(dir,'trace.json'),JSON.stringify(trace,null,2));lastSave=now;if(trace.length%4===1)console.log(JSON.stringify({stage,character,mode,...trace.at(-1)}));}
   if(now-lastShot>30000){await page.screenshot({path:path.join(dir,`${width}x${height}-${Math.floor((now-started)/1000)}s.png`)});lastShot=now;}
   if(s.state==='won')break;
   if(s.state!=='playing'||s.dead){route=null;await input([]);await page.waitForTimeout(150);continue;}
   if(target!==null&&now-targetSince>18000){deferred[target]=now+45000;target=null;}
   if(!s.coins.some(c=>c.i===target))target=null;
   if(target===null){const available=s.coins.filter(c=>!(deferred[c.i]>now));const c=(available.length?available:s.coins).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];if(c){target=c.i;targetSince=now;}}
   const action=await page.evaluate(({target,held,route})=>{
    const g=CQ.debug.game,W=CQ.World,dt=CQ.PHYS.DT;let t=g.coins[target];
    const boss=g.boss,p=g.player;
    if(boss&&!boss.dead&&Math.abs(boss.x+boss.w/2-p.x)<370){
     const facing=Math.sign(boss.x+boss.w/2-p.x)||1;
     const close=Math.abs(boss.x+boss.w/2-p.x)<125;
     const danger=g.fires.some(f=>Math.abs(f.x-p.x)<90&&Math.abs(f.y-(p.y+p.h/2))<45);
     return {dir:close?-facing:(p.face!==facing?facing:0),jump:danger&&p.onGround};
    }
    if(!t&&boss&&!boss.dead)t={x:boss.x-220,y:boss.y+boss.h-20};
    if(!t)return {dir:1,jump:true};
    // Deep-copy the player including the nested ride/power/stat objects.
    const original=JSON.stringify(g.player),base=structuredClone(g.player);
    // Platform trajectories are independent of player input. Forecast each once,
    // then let all candidate paths read the same immutable per-tick snapshots.
    const platforms=structuredClone(g.lv.platforms||[]),timeline=[];
    platforms.forEach((pl,i)=>{pl.qaIndex=i;});
    if(base.ride)base.ride.qaIndex=g.lv.platforms.indexOf(g.player.ride);
    for(let tick=0;tick<180;tick++){for(const pl of platforms)W.stepPlatform(pl,dt);timeline.push(platforms.map(pl=>({...pl})));}
    const lv={...g.lv,platforms:timeline[0]};
    // Route around a solid ceiling before approaching a coin above it.
    // A direct distance heuristic otherwise keeps jumping into its underside.
    if(route&&(route.target!==target||base.y+base.h<=route.roof))route=null;
    const tx=Math.floor((base.x+base.w/2)/32);
    for(let row=Math.floor(base.y/32)-1;!route&&row>=Math.floor(t.y/32);row--){
     if(!W.isSolid(lv,tx,row))continue;
     let left=tx,right=tx;
     while(left>0&&W.isSolid(lv,left-1,row))left--;
     while(right<lv.w-1&&W.isSolid(lv,right+1,row))right++;
     if(t.x<left*32||t.x>(right+1)*32)continue;
     const lx=left*32-30,rx=(right+1)*32+30;
     const edge=Math.abs(base.x-lx)<Math.abs(base.x-rx)?lx:rx;
     route={target,x:edge,y:row*32-40,roof:row*32};break;
    }
    if(route)t=route;
    const distance=p=>Math.hypot(Math.max(0,Math.abs(p.x+p.w/2-t.x)-p.w/2-8),Math.max(0,Math.abs(p.y+p.h/2-t.y)-p.h/2-8));
    const copy=p=>({...p,pw:{...p.pw},st:{...p.st},ride:p.ride?{...p.ride}:null});
    const actions=[];for(const dir of [-1,0,1])for(const jump of [false,true])actions.push({dir,jump});
    let beam=[{p:base,held,best:distance(base),cost:distance(base),travel:0,hit:null,first:null}],best=beam[0];
    for(let depth=0;depth<10;depth++){
     const next=[];
     for(const node of beam)for(const a of actions){
      const p=copy(node.p);let closest=node.best,risk=0,hit=node.hit;
      for(let tick=0;tick<18&&!p.dead;tick++){
       lv.platforms=timeline[depth*18+tick];
       if(p.ride&&p.ride.qaIndex>=0)p.ride=lv.platforms[p.ride.qaIndex];
       W.stepPlayer(p,{left:a.dir<0,right:a.dir>0,jump:a.jump,jumpPressed:tick===0&&a.jump&&!node.held},lv,dt,null);
       p.invuln=Math.max(0,p.invuln-dt);for(const key of ['star','wing','mush'])p.pw[key]=Math.max(0,p.pw[key]-dt);
       closest=Math.min(closest,distance(p));
       if(closest===0&&hit===null)hit=depth*18+tick;
       if(p.invuln<=0&&p.pw.star<=0)for(const e of g.enemies){if(!e.dead&&W.overlap(p.x,p.y,p.w,p.h,e.x,e.y,e.w,e.h)&&!(p.vy>0&&p.prevBottom<=e.y+8))risk+=8;}
      }
      if(p.dead)continue;
      const travel=node.travel+distance(p)*.025;
      const cost=closest*.65+distance(p)*.35+travel+risk+(p.onGround?0:2)+(hit===null?0:-1000+hit*.5);
      next.push({p,held:a.jump,best:closest,cost,travel,hit,first:node.first||a});
     }
     next.sort((a,b)=>a.cost-b.cost);const seen=new Set();beam=[];
     // Keep alternatives for every first action, including waiting for a ferry.
     // Otherwise the beam can discard all safe waits in favor of a doomed leap.
     const firsts=new Set();for(const n of next){const k=n.first.dir+','+n.first.jump;if(!firsts.has(k)){firsts.add(k);beam.push(n);}}
     for(const n of next){const k=[Math.round(n.p.x/10),Math.round(n.p.y/10),Math.round(n.p.vy/100),n.p.airJumps,n.held].join(',');if(!seen.has(k)){seen.add(k);beam.push(n);if(beam.length===20)break;}}
     if(!beam.length)break;best=beam[0];
    }
    if(JSON.stringify(g.player)!==original)throw new Error('Planner mutated live player');
    return {...(best.first||{dir:Math.sign(t.x-base.x),jump:!held}),route};
   },{target,held:keys.has('Space'),route});
   route=action.route;
   const wanted=[];if(action.dir)wanted.push(action.dir>0?'ArrowRight':'ArrowLeft');if(action.jump)wanted.push('Space');if(stage==='castle')wanted.push('KeyX');
   await input(wanted);await page.waitForTimeout(140);
  }
 }finally{await input([]);}
 const outcome=await page.evaluate(()=>{const g=CQ.debug.game;return {state:CQ.debug.state,time:g.time,limit:g.limit,collected:g.collected,goal:g.goal,deaths:g.deaths,bossDefeated:g.bossDefeated,remaining:g.coins.filter(c=>!c.taken).map(c=>({x:c.x,y:c.y,hidden:c.hidden}))};});
 const complete=outcome.state==='won'&&(outcome.collected===outcome.goal||(mode==='timed'&&outcome.limit>0&&outcome.time>=outcome.limit));
 results.push({stage,character,mode,...outcome,complete,maxX,input:'real keyboard; read-only live state; copied physics and moving-platform forecast; stationary enemy approximation'});
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
 if(complete)await page.waitForTimeout(900);
 await page.screenshot({path:path.join(dir,`${width}x${height}-final.png`)});
 if(complete){await page.locator('#btn-again').click();assert.equal(await page.evaluate(()=>CQ.debug.game.collected),0);await page.locator('#btn-pause').click();await page.locator('#btn-home').click();results.at(-1).replayAndHome=true;fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));}
 console.log(JSON.stringify({normalLiveplay:outcome,complete}));
};
