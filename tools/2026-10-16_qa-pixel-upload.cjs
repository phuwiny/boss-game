const assert=require('node:assert/strict');
module.exports=async({page,results})=>{
 const result=await page.evaluate(()=>{
  let samples=0,maxDelta=0;
  for(const id of ['bobo','mew','aclaire'])for(const pose of Object.keys(CQ.Sprites.POSES))for(const hue of [null,0,120,240]){
   const f=CQ.Sprites.build(id,pose,hue),w=f.w*f.density,h=f.h*f.density;
   const fast=document.createElement('canvas'),slow=document.createElement('canvas');fast.width=slow.width=w;fast.height=slow.height=h;
   const a=fast.getContext('2d'),b=slow.getContext('2d');CQ.Sprites.paint(a,f,0,0,f.density);
   f.px.forEach((color,i)=>{if(color){b.fillStyle=color;b.fillRect(i%w,Math.floor(i/w),1,1);}});
   const actual=a.getImageData(0,0,w,h).data,expected=b.getImageData(0,0,w,h).data;
   for(let i=0;i<actual.length;i++){if(i%4===3&&actual[i]!==expected[i])throw Error('alpha mismatch');maxDelta=Math.max(maxDelta,Math.abs(actual[i]-expected[i]));}
   samples++;
  }
  return {samples,maxChannelDelta:maxDelta};
 });
 assert.equal(result.samples,108);assert.ok(result.maxChannelDelta<=1,'pixel upload differs from Canvas CSS colors');
 results.push({pixelUpload:result});
};
