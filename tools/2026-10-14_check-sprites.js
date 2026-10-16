const assert=require('node:assert/strict');require('../js/sprites.js');
const S=globalThis.CQ.Sprites;
let count=0;
for(const id of ['bobo','mew','aclaire'])for(const pose of Object.keys(S.POSES)){
 const f=S.build(id,pose),colored=S.build(id,pose,120);
 assert.equal(f.w,54);assert.equal(f.h,48);assert.equal(f.ax,32);assert.equal(f.px.length,54*48);
 assert.ok(f.px.some(Boolean));assert.ok(f.px.some(x=>x===null));assert.ok(!f.px.some(x=>x&&x.startsWith('@')));
 assert.equal(colored.px.length,f.px.length);assert.deepEqual(colored.px.map(Boolean),f.px.map(Boolean));
 assert.notDeepEqual(colored.px,f.px,'star recolors without changing silhouette');
 assert.deepEqual(S.build(id,pose),f,'cached frames deterministic');count++;
}
console.log('PASS '+count+' character/pose contracts including star palette and transparency');
