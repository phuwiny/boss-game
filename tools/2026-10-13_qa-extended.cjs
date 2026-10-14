const assert=require('node:assert/strict');
const path=require('node:path');
module.exports=async({browser,out,results,quick})=>{
  // Asset/font failure and storage unavailable remain usable.
  const fallback=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,isMobile:true});
  await fallback.addInitScript(()=>{
    Storage.prototype.getItem=function(){throw new Error('Storage disabled');};
    Storage.prototype.setItem=function(){throw new Error('Storage disabled');};
  });
  await fallback.route(/assets\/|fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  let page=await fallback.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8001',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#title-landscape').evaluate(el=>getComputedStyle(el).visibility),'hidden','failed image hides broken-image icon');
  await page.screenshot({path:path.join(out,'final-fallback-title.png')});
  await page.locator('#btn-timed').click();
  assert.equal(await page.evaluate(()=>CQ.debug.state),'playing');
  await page.locator('#btn-pause').click();
  await page.locator('input[value="large"]').check();
  assert.equal(await page.evaluate(()=>document.body.dataset.touchSize),'large');
  assert.deepEqual(errors,[]);
  results.push({fallback:'PASS: missing art/font + blocked localStorage'});
  await fallback.close();

  const context=await browser.newContext({viewport:{width:640,height:360},hasTouch:true,isMobile:true});
  page=await context.newPage();
  await page.goto('http://127.0.0.1:8001',{waitUntil:'networkidle'});
  await page.evaluate(()=>{
    localStorage.setItem('coinquest.ui.v1','{bad');
    localStorage.setItem('coinquest.best.v3',JSON.stringify({time:9999,deaths:3}));
    localStorage.setItem('coinquest.timed.best.v1.bobo',JSON.stringify({coins:80,left:39}));
  });
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.body.dataset.touchSize),'standard');
  assert.equal(await page.locator('#best-normal').isVisible(),true);
  assert.equal(await page.locator('#best-timed').isVisible(),true);
  const y=await page.locator('#btn-normal').evaluate(el=>el.getBoundingClientRect().bottom);
  assert.ok(y<=360,'title with records fits');
  await page.screenshot({path:path.join(out,'final-640x360-title-records.png')});
  // Simulate insets; this does not claim real notched device testing.
  await page.evaluate(()=>{for(const x of ['l','r'])document.documentElement.style.setProperty('--safe-'+x,'24px');});
  await page.locator('#btn-timed').click();
  await page.locator('#btn-pause').click();
  await page.locator('input[value="large"]').check();
  await page.locator('#btn-resume').click();
  const boxes=await page.locator('#touch button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,bottom:r.bottom};}));
  assert.ok(boxes.every(b=>b.x>=24 && b.right<=616 && b.bottom<=360));
  await page.screenshot({path:path.join(out,'final-safe-insets-large-controls.png')});
  results.push({denseRecordsAndSimulatedInsets:'PASS'});
  await context.close();
  // Baseline result is a staged visual reference, not a gameplay completion.
  const visual=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const v=await visual.newPage();
  await v.goto('http://127.0.0.1:8001/__baseline__/',{waitUntil:'networkidle'});
  await v.locator('#btn-timed').click();
  await v.evaluate(()=>{CQ.debug.game.time=119.9;});
  await v.waitForFunction(()=>CQ.debug.state==='won');
  await v.waitForTimeout(350);
  await v.screenshot({path:path.join(out,'baseline-844x390-result-staged.png')});
  await v.goto('http://127.0.0.1:8001',{waitUntil:'networkidle'});
  await v.locator('#btn-char').click();
  await v.locator('.char-card').nth(1).click();
  await v.locator('#btn-chars-ok').click();
  await v.locator('#btn-normal').click();
  await v.waitForFunction(()=>CQ.debug.game.player.onGround);
  await v.keyboard.down('Space');await v.waitForTimeout(170);await v.keyboard.up('Space');await v.waitForTimeout(60);
  await v.keyboard.down('Space');await v.waitForTimeout(850);
  assert.ok(await v.evaluate(()=>CQ.debug.game.player.floatT<CQ.debug.game.player.floatMax),'Mew float activated with keyboard input');
  await v.screenshot({path:path.join(out,'final-mew-float.png')});
  await v.keyboard.up('Space');
  results.push({mewFloat:'PASS; input activated, screenshot captured',baselineResult:'staged visual reference'});
  await visual.close();
  if(quick) return;

  // Same host/browser/viewport samples, not a claim of phone FPS.
  for(const version of ['__baseline__/','']) {
    const ctx=await browser.newContext({viewport:{width:1366,height:768}});
    const p=await ctx.newPage();
    await p.goto('http://127.0.0.1:8001/'+version,{waitUntil:'networkidle'});
    await p.locator('#btn-timed').click();
    await p.waitForTimeout(600);
    const samples=await p.evaluate(()=>new Promise(resolve=>{
      const data=[];let before=performance.now();
      function tick(now){data.push(now-before);before=now;if(data.length===120)resolve(data);else requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    }));
    samples.sort((a,b)=>a-b);
    results.push({version:version?'baseline HEAD':'updated',frameTimingMs:{median:samples[60],p95:samples[114],samples:120}});
    await ctx.close();
  }

  // Complete an unmodified 120-second game with keyboard interaction.
  const play=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  page=await play.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8001',{waitUntil:'networkidle'});
  await page.locator('#btn-char').click();
  await page.locator('.char-card').nth(1).click();
  await page.locator('#btn-chars-ok').click();
  await page.locator('#btn-timed').click();
  const start=Date.now();let step=0;
  while(await page.evaluate(()=>CQ.debug.state)!=='won' && Date.now()-start<185000) {
    const direction=step%16<10?'ArrowRight':'ArrowLeft';
    await page.keyboard.down(direction);
    if(step%3!==0) await page.keyboard.down('Space');
    await page.waitForTimeout(450);
    await page.keyboard.up('Space');await page.keyboard.up(direction);
    await page.waitForTimeout(80);
    step++;
    if(step===30){await page.locator('#btn-pause').click();await page.waitForTimeout(350);await page.locator('#btn-resume').click();}
  }
  assert.equal(await page.evaluate(()=>CQ.debug.state),'won');
  await page.waitForTimeout(900);
  await page.screenshot({path:path.join(out,'final-844x390-result-real-play.png')});
  const outcome=await page.evaluate(()=>({coins:CQ.debug.game.collected,time:CQ.debug.game.time,deaths:CQ.debug.game.deaths}));
  assert.ok(outcome.time>=120 || outcome.coins===80);
  await page.locator('#btn-again').click();assert.equal(await page.evaluate(()=>CQ.debug.state),'playing');
  await page.locator('#btn-pause').click();await page.locator('#btn-home').click();
  assert.equal(await page.evaluate(()=>CQ.debug.state),'title');
  assert.deepEqual(errors,[]);
  results.push({realTimedPlay:'PASS',outcome,exploratorySeconds:(Date.now()-start)/1000,inputs:'keyboard direction/jump, pause/resume, retry/home; no state mutations'});
  await play.close();
};
