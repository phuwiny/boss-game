const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,width,height,out,results,phase})=>{
 await page.addScriptTag({content:require('node:child_process').execFileSync('git',['show','HEAD:js/render.js'],{encoding:'utf8',windowsHide:true}).replace('CQ.Renderer = Renderer;', 'CQ.ReferenceRenderer = Renderer;')});
 await page.locator('#btn-rps-exit').click();await page.locator('#btn-mg-back').click();
 for(const stage of ['grassland','forest','castle']){
  await page.locator('.stage-'+stage).click();await page.locator('#btn-normal').click();
  await page.waitForTimeout(1400);
  const timing=await page.evaluate(()=>{
   const g=CQ.debug.game,r=CQ.debug.renderer;
   const old=Object.assign(Object.create(CQ.ReferenceRenderer.prototype),r);
   old.sprites={};old.setLevel(g.lv,g.stage.theme);old.cam={...r.cam};
   const samples={baseline:[],updated:[]};
   // Same canvas, state, camera and fixed render time; alternate order to reduce scheduling bias.
   for(let i=0;i<220;i++)for(const key of i%2?['updated','baseline']:['baseline','updated']){
    const target=key==='baseline'?old:r;const start=performance.now();target.render(g,1);
    if(i>=20)samples[key].push(performance.now()-start);
   }
   const result={};for(const key of Object.keys(samples)){const a=samples[key].sort((a,b)=>a-b);result[key]={median:a[100],p95:a[190]};}
   r.render(g,1);return result;
  });
  await page.screenshot({path:path.join(out,`${phase}-${width}x${height}-${stage}.png`)});
  results.push({stage,width,height,timing});
  await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
 }
 const frames=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1260;c.height=540;const ctx=c.getContext('2d');ctx.fillStyle='#f9f3df';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;
  ['bobo','mew','aclaire'].forEach((id,row)=>Object.keys(CQ.Sprites.POSES).forEach((pose,col)=>{
   const f=CQ.Sprites.build(id,pose);ctx.fillStyle='#d5cbb4';ctx.fillRect(col*140, row*180+135,140,1);CQ.Sprites.paint(ctx,f,col*140+12,row*180+30,2);ctx.fillStyle='#34233e';ctx.font='12px sans-serif';ctx.fillText(id+' '+pose,col*140+8,row*180+155);
  }));return c.toDataURL();
 });
 require('fs').writeFileSync(path.join(out,`${phase}-${width}x${height}-poses.png`),Buffer.from(frames.split(',')[1],'base64'));
};
