const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
module.exports=async({page,results})=>{
 await page.addScriptTag({content:execFileSync('git',['show','HEAD:js/render.js'],{encoding:'utf8',windowsHide:true}).replace('CQ.Renderer = Renderer;', 'CQ.ReferenceRenderer = Renderer;')});
 await page.locator('#btn-rps-exit').click();await page.locator('#btn-mg-back').click();
 for(const stage of ['grassland','forest','castle']){
  await page.locator('.stage-'+stage).click();await page.locator('#btn-normal').click();
  await page.locator('#btn-pause').click();
  const result=await page.evaluate(async()=>{
   const g=CQ.debug.game,r=CQ.debug.renderer;
   const liveRender=r.render;
   // Suppress only the game's draw callback while the benchmark owns the canvas.
   r.render=()=>{};
   const old=Object.assign(Object.create(CQ.ReferenceRenderer.prototype),r);
   old.sprites={};old.setLevel(g.lv,g.stage.theme);old.cam={...r.cam};
   const targets={baseline:()=>CQ.ReferenceRenderer.prototype.render.call(old,g,1),updated:()=>liveRender.call(r,g,1)};
   const stats=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],samples:a.length};};
   const rounds=[];
   try{
    for(let round=0;round<3;round++){
     const measurements={};
     for(const key of round%2?['updated','baseline']:['baseline','updated']){
      const interval=[],submit=[];let previous;
      for(let i=0;i<140;i++){
       const now=await new Promise(requestAnimationFrame);
       if(i>=20)interval.push(now-previous);previous=now;
       const start=performance.now();targets[key]();if(i>=20)submit.push(performance.now()-start);
      }
      measurements[key]={frame:stats(interval),submission:stats(submit)};
     }
     rounds.push(measurements);
    }
   }finally{r.render=liveRender;}
   const ratio=rounds.map(m=>m.updated.frame.p95/m.baseline.frame.p95).sort((a,b)=>a-b);
   return {rounds,medianP95Ratio:ratio[1],worstP95Ratio:ratio[2],withinBudget:ratio.every(value=>value<=1.2)};
  });
  results.push({stage,...result});
  await page.locator('#btn-home').click();
 }
 assert.ok(results.filter(r=>r.stage).every(r=>r.withinBudget),'frame-time regression exceeds 20%');
};
