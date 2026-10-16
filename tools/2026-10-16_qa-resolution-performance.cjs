const fs=require('node:fs'),assert=require('node:assert/strict');
module.exports=async({page,results})=>{
 const baseline=fs.readFileSync('assets/characters/2026-10-15_character-art-v1.js','utf8');
 let variant='updated';
 const pattern='**/js/2026-10-15_character-art.js';
 await page.route(pattern,route=>variant==='baseline'?route.fulfill({status:200,contentType:'application/javascript',body:baseline}):route.continue());
 const rows=[];
 try{
  for(const [stage,id,index] of [['grassland','bobo',0],['forest','mew',1],['castle','aclaire',2]]){
   const rounds=[];
   for(let round=0;round<3;round++){
    const measurements={};
    for(const name of round%2?['updated','baseline']:['baseline','updated']){
     variant=name;
     await page.goto('http://127.0.0.1:8001/?seed=resolution-perf-2026-10-16');
     const density=await page.evaluate(()=>CQ.Sprites.build('bobo','idle').density||1);assert.equal(density,name==='baseline'?1:2);
     await page.locator('#btn-char').click();await page.locator('.char-card').nth(index).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
     await page.locator('.stage-'+stage).click();await page.locator('#btn-normal').click();await page.locator('#btn-pause').click();
     measurements[name]=await page.evaluate(async()=>{
      const g=CQ.debug.game,r=CQ.debug.renderer,render=r.render;
      r.render=()=>{};
      const intervals=[],submit=[];let previous;
      const stat=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],samples:a.length};};
      try{
       g.player.onGround=true;g.player.vx=120;g.player.pw.star=10;
       for(let i=0;i<160;i++){
        const now=await new Promise(requestAnimationFrame);
        if(i>=40)intervals.push(now-previous);previous=now;
        g.runPhase=i*Math.PI/2;
        const t=performance.now();render.call(r,g,i/60);if(i>=40)submit.push(performance.now()-t);
       }
      }finally{r.render=render;}
      return {frame:stat(intervals),submission:stat(submit)};
     });
    }
    rounds.push(measurements);
   }
   const ratios=rounds.map(m=>m.updated.frame.p95/m.baseline.frame.p95);
   const row={stage,id,rounds,ratios,withinBudget:ratios.every(r=>r<=1.2)};rows.push(row);results.push(row);
  }
 }finally{await page.unroute(pattern);}
 fs.writeFileSync('.logs/2026-10-16_resolution-performance.json',JSON.stringify({method:'same current renderer, archived v1 density1 vs density2 data, fresh navigation per sample, 40 warmup/120 measured RAF frames, alternating order; paused-state run/star fixture, not physical-device FPS',rows},null,2));
 assert.ok(rows.every(r=>r.withinBudget),'RAF p95 exceeds baseline +20%');
};
