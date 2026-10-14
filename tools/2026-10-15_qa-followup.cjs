const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({page,results,width,height})=>{
 const dir=path.resolve('.logs/2026-10-15_visual-followup');fs.mkdirSync(dir,{recursive:true});
 const shot=label=>page.screenshot({path:path.join(dir,`${width}x${height}-${label}.png`)});
 // Use the production frame generator and exact pixel painting, with foot anchors marked.
 for(const id of ['bobo','mew','aclaire']){
  const sheet=await page.evaluate(id=>{
   const poses=Object.keys(CQ.Sprites.POSES),c=document.createElement('canvas');c.width=1000;c.height=poses.length*116+32;
   const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#f9f3df';ctx.fillRect(0,0,c.width,c.height);
   const variants=[null,0,120,240];ctx.font='12px sans-serif';
   for(let v=0;v<4;v++)for(let side=0;side<2;side++){
    const col=v*2+side,x=col*125;ctx.fillStyle='#34233e';ctx.fillText(`${variants[v]===null?'normal':variants[v]} ${side?'left':'right'}`,x+4,18);
    poses.forEach((pose,row)=>{
     const f=CQ.Sprites.build(id,pose,variants[v]),base=32+row*116+91,anchor=x+62;
     ctx.strokeStyle='#c9bfa8';ctx.beginPath();ctx.moveTo(x,base);ctx.lineTo(x+124,base);ctx.stroke();
     ctx.save();ctx.translate(anchor,base);ctx.scale(side?-1:1,1);CQ.Sprites.paint(ctx,f,-f.ax*2,-(f.h-1)*2,2);ctx.restore();
     ctx.fillStyle='#34233e';ctx.fillText(pose,x+4,base+18);
    });
   }
   return {url:c.toDataURL(),frames:poses.length*8};
  },id);
  fs.writeFileSync(path.join(dir,`${id}-poses-directions-star.png`),Buffer.from(sheet.url.split(',')[1],'base64'));
  results.push({id,contactSheetFrames:sheet.frames});
 }
 const asset='**/assets/2026-10-14_castle-menu.webp',failures=[],requests=[];
 page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('request',r=>requests.push(r.url()));
 await page.route(asset,r=>r.abort());
 await page.goto('http://127.0.0.1:8001/?seed=qa-fallback-2026-10-15');
 await page.locator('.stage-castle').click();await page.waitForTimeout(300);await shot('castle-image-fallback');
 assert.ok(failures.some(f=>f.url.includes('2026-10-14_castle-menu.webp')),'image failure was exercised');
 assert.ok(!requests.some(u=>u.includes('/concepts/')),'concepts never requested');
 assert.ok(fs.statSync('assets/2026-10-14_castle-menu.webp').size<400000);
 await page.locator('#btn-normal').click();
 assert.equal(await page.evaluate(()=>CQ.debug.game.stage.theme),'castle');
 await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
 await page.unroute(asset);await page.reload();await page.waitForTimeout(300);
 const loaded=await page.evaluate(async()=>{const img=new Image();img.src='assets/2026-10-14_castle-menu.webp';await img.decode();return img.naturalWidth;});assert.ok(loaded>0);
 await shot('castle-image-restored');
 results.push({width,height,castleFallback:'PASS: image blocked, menu usable, Castle starts, restored asset decodes',assetBytes:fs.statSync('assets/2026-10-14_castle-menu.webp').size,failures,conceptRequests:0});
 fs.writeFileSync(path.join(dir,`results-${width}x${height}.json`),JSON.stringify(results,null,2));
};
