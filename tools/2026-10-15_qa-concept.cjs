const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async args=>{
 const {page,width,height,results}=args,outputDir=args.outputDir||'.logs/2026-10-15_concept-qa';fs.mkdirSync(outputDir,{recursive:true});
 assert.equal(await page.evaluate(()=>CQ.Sprites.build('bobo','idle').source),'concept-2026-10-16-resolution');
 const contract=await page.evaluate(()=>['bobo','mew','aclaire'].every(id=>Object.keys(CQ.Sprites.POSES).every(p=>{const f=CQ.heroFrame(id,p);return f.w===54&&f.h===48&&f.ax===32&&f.c.width===108&&f.c.height===96;})));
 assert.ok(contract,'all frames retain logical size with 2x backing canvas');
 await require('./2026-10-15_qa-matrix.cjs')({...args,outputDir});
 if(width===360||width===844)await require('./2026-10-14_qa-effects.cjs')({...args,outputDir});
 if(width===844)await require('./2026-10-15_qa-followup.cjs')({...args,outputDir});
 // Fail the art data request on a fresh navigation, exercising actual fallback, not cache swapping.
 await page.route('**/js/2026-10-15_character-art.js',route=>route.abort());
 await page.goto('http://127.0.0.1:8001/?seed=concept-fallback');
 for(let i=0;i<3;i++){
  await page.locator('#btn-char').click();await page.locator('.char-card').nth(i).click();if(await page.locator('#btn-chars-ok').isVisible())await page.locator('#btn-chars-ok').click();
  const id=['bobo','mew','aclaire'][i];
  assert.equal(await page.evaluate(id=>CQ.Sprites.build(id,'idle').source||'fallback',id),'fallback');
  await page.locator('#btn-normal').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>CQ.debug.state),'playing');
  await page.screenshot({path:path.join(outputDir,`${width}x${height}-${id}-art-fallback.png`)});
  await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
 }
 await page.unroute('**/js/2026-10-15_character-art.js');await page.reload();
 assert.equal(await page.evaluate(()=>CQ.Sprites.build('aclaire','idle').source),'concept-2026-10-16-resolution');
 results.push({width,height,artFallback:'PASS all three characters; restored art after reload'});
 fs.writeFileSync(path.join(outputDir,`results-${width}x${height}.json`),JSON.stringify(results,null,2));
};
