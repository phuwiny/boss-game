const assert=require('node:assert/strict');
require('../js/2026-10-15_character-art.js');require('../js/sprites.js');
const CQ=globalThis.CQ,S=CQ.Sprites,art=CQ.CharacterArt;
const baselineContext={};require('node:vm').runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../assets/characters/2026-10-15_character-art-v1.js'),'utf8'),baselineContext);
const baseline=baselineContext.CQ.CharacterArt;
function bounds(px,width,density){const points=px.map((c,i)=>c?[i%width/density,Math.floor(i/width)/density]:null).filter(Boolean);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
let checked=0;
assert.deepEqual(Object.keys(S.POSES).filter(p=>p.startsWith('run')),['run1','run2','run3','run4'],'original four run poses only');
for(const id of ['bobo','mew','aclaire'])for(const pose of Object.keys(S.POSES)){
 const f=S.build(id,pose),source=art.frames[id][pose];
 assert.equal(f.source,art.version,'approved raster art selected');
 assert.equal(f.density,2);assert.equal(f.px.length,108*96);assert.equal(f.ax,32);
 assert.ok(f.px.some(Boolean));
 assert.deepEqual(f.px,source.pixels.match(/.{3}/g).map(c=>art.palette[parseInt(c,16)]));
 const old=baseline.frames[id][pose].pixels.match(/.{3}/g).map(c=>baseline.palette[parseInt(c,16)]),before=bounds(old,54,1),after=bounds(f.px,108,2);
 assert.ok(before.every((v,i)=>Math.abs(v-after[i])<=1),id+'/'+pose+' keeps original visible bounds within sampling tolerance');
 const star=S.build(id,pose,120);assert.deepEqual(star.px.map(Boolean),f.px.map(Boolean));
 assert.notDeepEqual(star.px,f.px);
 for(let i=0;i<f.px.length;i++)if(source.mask[i]==='.')assert.equal(star.px[i],f.px[i],'star preserves face/hair/unmasked pixels');
 if(id==='mew')for(let i=0;i<f.px.length;i++)if(source.mask[i]!=='.'){
  const rgb=[1,3,5].map(n=>parseInt(f.px[i].slice(n,n+2),16));
  assert.ok(rgb[2]>rgb[0]*1.25&&rgb[2]>rgb[1]*1.1,'Mew star affects blue blouse, never orange hair');
 }
 checked++;
}
// Missing asset script and malformed frame must leave a playable procedural fallback.
delete CQ.CharacterArt;assert.notEqual(S.build('mew','idle').source,art.version);
CQ.CharacterArt={...art,frames:{...art.frames,bobo:{...art.frames.bobo,idle:{pixels:'bad',mask:'.'}}}};
assert.notEqual(S.build('bobo','idle').source,art.version);
CQ.CharacterArt=art;assert.equal(S.build('bobo','idle').source,art.version);
console.log(`PASS ${checked} raster frames, star masks, missing/malformed fallback`);
