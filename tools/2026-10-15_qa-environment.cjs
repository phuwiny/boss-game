const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,results})=>{
 const dir=path.resolve('.logs/2026-10-15_environment');fs.mkdirSync(dir,{recursive:true});
 for(const stage of ['grassland','forest','castle']){
  await page.goto('http://127.0.0.1:8001/?seed=qa-environment-2026-10-15');await page.locator('.stage-'+stage).click();await page.locator('#btn-normal').click();await page.locator('#btn-pause').click();
  const data=await page.evaluate(()=>{
   const g=CQ.debug.game,r=CQ.debug.renderer,lv=g.lv,T=32,targets=[];
   for(const [name,type] of Object.entries(CQ.TILE)){if(!type)continue;const i=lv.tiles.indexOf(type);if(i>=0)targets.push({name,x:(i%lv.w)*T,y:Math.floor(i/lv.w)*T});}
   if(lv.platforms.length)targets.push({name:'moving-platform',...lv.platforms[0]});
   const seen=new Set();for(const e of g.enemies){const kind=e.type||e.kind||'enemy';if(!seen.has(kind)){seen.add(kind);targets.push({name:'enemy-'+kind,x:e.x,y:e.y});}}
   if(g.checkpoints.length){const c=g.checkpoints[0];targets.push({name:'checkpoint',x:c.tx*T,y:c.ty*T});}
   const items=new Set();for(const it of g.items)if(!items.has(it.type)){items.add(it.type);targets.push({name:'item-'+it.type,x:it.x,y:it.y});}
   const sheet=document.createElement('canvas'),ctx=sheet.getContext('2d');sheet.width=844;sheet.height=Math.ceil(targets.length/2)*220;ctx.fillStyle='#f9f3df';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.font='14px sans-serif';
   const old={...r.cam};targets.forEach((t,i)=>{
    r.cam.x=Math.max(0,Math.min(lv.w*T-r.viewW,t.x-r.viewW/2));r.cam.y=Math.max(0,Math.min(r.camMaxY(),t.y-r.viewH/2));r.render(g,2);
    const x=(i%2)*422,y=Math.floor(i/2)*220;ctx.drawImage(document.querySelector('#game'),x,y+22,422,195);ctx.fillStyle='#34233e';ctx.fillText(t.name,x+8,y+16);
   });r.cam=old;
   return {url:sheet.toDataURL(),targets:targets.map(t=>({name:t.name,x:t.x,y:t.y}))};
  });
  fs.writeFileSync(path.join(dir,`${stage}-environment-sheet.png`),Buffer.from(data.url.split(',')[1],'base64'));results.push({stage,targets:data.targets,fixture:'paused world; camera positioned on existing objects; original renderer; no traversal claim'});
 }
 // Simulated safe insets on current Castle controls; not a real notched device test.
 await page.locator('input[value="large"]').check();await page.locator('#btn-resume').click();
 for(const [width,height] of [[360,640],[640,360]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{for(const side of ['l','r'])document.documentElement.style.setProperty('--safe-'+side,'24px');document.documentElement.style.setProperty('--safe-b','20px');});await page.waitForTimeout(300);
  const boxes=await page.locator('#touch .tbtn').evaluateAll(es=>es.map(e=>e.getBoundingClientRect()).filter(r=>r.width).map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom})));
  for(const b of boxes)assert.ok(b.x>=24&&b.right<=width-24&&b.bottom<=height-20,'simulated safe area');
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,'inset controls overlap');}
  await page.screenshot({path:path.join(dir,`${width}x${height}-castle-insets.png`)});results.push({width,height,insets:'PASS: simulated left/right 24px and bottom 20px; large Castle controls fit and separate'});
 }
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(results,null,2));
};
