const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function ({page,context,width,height,out,results}) {
  const shot = async name => {
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out,`final-${width}x${height}-${name}.png`)});
  };
  const state = () => page.evaluate(()=>CQ.debug.state);
  const bounds = async selectors => {
    const boxes = await page.evaluate(selectors=>selectors.map(selector=>{
      const el=document.querySelector(selector),r=el.getBoundingClientRect();
      return {selector,x:r.x,y:r.y,w:r.width,h:r.height};
    }),selectors);
    for(const b of boxes) {
      assert.ok(b.w>0 && b.h>0,`visible ${b.selector}`);
      assert.ok(b.x>=-1 && b.y>=-1 && b.x+b.w<=width+1 && b.y+b.h<=height+1,`viewport ${width}x${height}: ${JSON.stringify(b)}`);
    }
    return boxes;
  };
  await bounds(['#rps-controls']);
  await page.locator('.rps-choice').first().click();
  await page.waitForTimeout(1600);
  assert.ok((await page.locator('#rps-msg').innerText()).length>0);
  await page.locator('#btn-rps-exit').click();
  await page.locator('#btn-mg-back').click();
  await page.waitForTimeout(350);
  assert.equal(await state(),'title');
  await bounds(['#title-heading','#btn-char','#stage-pick','#btn-normal','#btn-timed']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#title-landscape').evaluate(el=>el.complete && el.naturalWidth>0),true);

  // Stage and character selection with reload persistence.
  await page.locator('.stage-forest').click();
  assert.equal(await page.locator('.stage-forest').getAttribute('aria-checked'),'true');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>CQ.debug.stageId),'forest');
  assert.ok((await page.locator('#title-landscape').getAttribute('src')).includes('forest'));
  await shot('forest-title');
  for (const [index,id] of ['bobo','mew','aclaire'].entries()) {
    await page.locator('#btn-char').click();
    await page.locator('.char-card').nth(index).click();
    if (await page.locator('#btn-chars-ok').isVisible()) await page.locator('#btn-chars-ok').click();
    await page.locator('#btn-normal').click();
    assert.equal(await page.evaluate(()=>CQ.debug.game.char.id),id);
    assert.equal(await page.evaluate(()=>CQ.debug.game.mode),'normal');
    await page.waitForFunction(()=>CQ.debug.game.player.onGround);
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await page.waitForTimeout(160);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowRight');
    if(id==='mew') {
      await page.waitForTimeout(50);
      const beforeJump=await page.evaluate(()=>({y:CQ.debug.game.player.y,vy:CQ.debug.game.player.vy,air:CQ.debug.game.player.airJumps}));
      await page.keyboard.down('Space');
      await page.waitForTimeout(60);
      const afterJump=await page.evaluate(()=>({y:CQ.debug.game.player.y,vy:CQ.debug.game.player.vy,air:CQ.debug.game.player.airJumps}));
      assert.ok(afterJump.y<beforeJump.y,'Mew air jump: '+JSON.stringify({beforeJump,afterJump}));
      await page.keyboard.up('Space');
    }
    if(id==='aclaire') assert.equal(await page.evaluate(()=>CQ.debug.game.player.guard),1);
    await page.locator('#btn-pause').click();
    await page.locator('#btn-home').click();
  }
  await page.locator('.stage-grassland').click();
  await page.locator('#btn-timed').click();
  assert.equal(await page.evaluate(()=>CQ.debug.game.mode),'timed');
  assert.equal(await page.evaluate(()=>CQ.debug.game.stage.id),'grassland');
  await page.locator('#btn-pause').click();
  assert.equal(await page.locator('#touch').isVisible(),false,'touch controls hidden while paused');
  await page.locator('input[value="large"]').check();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('coinquest.ui.v1')).touchSize),'large');
  for(const type of ['music','sound']) {
    const p=page.locator('#btn-pause-'+type),h=page.locator('#btn-'+type);
    const initial=await p.getAttribute('aria-pressed');
    await p.click();
    assert.notEqual(await p.getAttribute('aria-pressed'),initial);
    assert.equal(await h.getAttribute('aria-pressed'),await p.getAttribute('aria-pressed'));
    await p.click();
    assert.equal(await p.getAttribute('aria-pressed'),initial);
  }
  await shot('settings-large');
  if(width>=1000) {
    await page.locator('#btn-pause-fullscreen').click();
    await page.waitForFunction(()=>!!document.fullscreenElement);
    await page.locator('#btn-pause-fullscreen').click();
    await page.waitForFunction(()=>!document.fullscreenElement);
  }
  await page.locator('#btn-resume').click();
  assert.equal(await state(),'playing');
  if(width<1000) {
    const controlBoxes=await bounds(['[data-btn="left"]','[data-btn="right"]','[data-btn="jump"]','#btn-pause']);
    assert.equal(controlBoxes[0].w,80); assert.equal(controlBoxes[2].w,92);
    assert.ok(controlBoxes[1].x+controlBoxes[1].w<controlBoxes[2].x,'separate directional/jump targets');
    assert.equal(await page.locator('#btn-sound').isVisible(),false);
    const cdp = await context.newCDPSession(page);
    const point=(b,id)=>({x:b.x+b.w/2,y:b.y+b.h/2,id});
    const initial = await page.evaluate(()=>({x:CQ.debug.game.player.x,y:CQ.debug.game.player.y}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(controlBoxes[1],1),point(controlBoxes[2],2)]});
    await page.waitForTimeout(170);
    const afterTouch = await page.evaluate(()=>({x:CQ.debug.game.player.x,y:CQ.debug.game.player.y,active:[...document.querySelectorAll('#touch .active')].map(e=>e.dataset.btn)}));
    assert.ok(afterTouch.x>initial.x && afterTouch.y<initial.y,'simultaneous movement and jump: '+JSON.stringify({initial,afterTouch}));
    await shot('touch-pressed');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(controlBoxes[0],1),point(controlBoxes[2],2)]});
    assert.equal(await page.locator('[data-btn="left"]').evaluate(el=>el.classList.contains('active')),true);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await page.locator('#touch .active').count(),0);
    // Reset held input across an orientation change, then restore viewport.
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(controlBoxes[1],1)]});
    await page.setViewportSize({width:height,height:width});
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#touch .active').count(),0);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.setViewportSize({width,height});
    await cdp.detach();
  }
  // Staged visual state, explicitly not an end-to-end completion claim.
  await page.evaluate(()=>{
    const p=CQ.debug.game.player; p.pw.wing=10;p.pw.mush=10;p.pw.star=10;
  });
  await shot('dense-hud');
  const hud = await page.evaluate(()=>{
    const r=CQ.debug.renderer,L=r.hud,d=r.dpr,b=document.querySelector('#btn-pause').getBoundingClientRect();
    return {map:r.minimapRect,powerBottom:(L.oy+(L.powersY+64)*L.P)/d,button:{x:b.x,y:b.y,w:b.width,h:b.height}};
  });
  assert.ok(hud.map.x>=0 && hud.map.x+hud.map.w<=width,'minimap width');
  if(width<1000) assert.ok(hud.powerBottom<height-104,'dense power bars leave room for controls');
  await page.locator('#btn-pause').click();
  const pausedTime=await page.evaluate(()=>CQ.debug.game.time);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>CQ.debug.game.time),pausedTime);
  await page.locator('#btn-restart').click();
  assert.ok(await page.evaluate(()=>CQ.debug.game.time<1));
  await page.locator('#btn-pause').click();
  await page.locator('#btn-home').click();
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.body.dataset.touchSize),'large');
  await page.locator('#btn-normal').click();
  await page.locator('#btn-pause').click();
  // Native keyboard controls must not accidentally resume the game.
  await page.locator('input[value="standard"]').focus();
  await page.keyboard.press('Space');
  assert.equal(await state(),'paused');
  assert.equal(await page.evaluate(()=>document.body.dataset.touchSize),'standard');
  await page.locator('#btn-home').click();
  await page.locator('.play-guide summary').click();
  assert.equal(await page.locator('.play-guide').getAttribute('open'),'');
  await shot('help-open');
  await page.locator('.play-guide summary').click();
  assert.equal(await page.locator('.play-guide').getAttribute('open'),null);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.title-card').evaluate(el=>getComputedStyle(el).animationName),'none');
  // Storage/asset failure runs have their own isolated context.
  results.push({width,height,functional:'PASS',hud,checks:'stage/character persistence; both modes; Mew air jump; Aclaire guard; settings/toggles; native keyboard; touch cancel/rotate; fit; reduced motion'});
};
