const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const play=require('./2026-10-16_qa-normal-liveplay.cjs');
module.exports=async({page,width,height,results})=>{
 const root='.logs/2026-10-16_remaining-liveplay-v3';fs.mkdirSync(root,{recursive:true});
 const cases={normal:[['grassland','bobo'],['grassland','aclaire'],['forest','bobo'],['forest','aclaire'],['castle','bobo'],['castle','mew']],timed:[['grassland','mew'],['grassland','aclaire'],['forest','bobo'],['forest','aclaire'],['castle','bobo'],['castle','mew']]};
 for(const [mode,pairs]of Object.entries(cases))for(const [stage,character]of pairs){
  if(process.argv[4]&&process.argv[4]!==`${mode}:${stage}:${character}`)continue;
  let prior=null;
  for(const previous of [root,'.logs/2026-10-16_remaining-liveplay-v2']){
   const file=path.join(previous,mode,`${stage}-${character}`,'results.json');
   if(fs.existsSync(file)){const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.complete&&saved.replayAndHome&&saved.errors?.length===0){prior={...saved,evidenceDirectory:path.dirname(file)};break;}}
  }
  if(prior){results.push(prior);console.log(JSON.stringify({retainedPass:{mode,stage,character}}));continue;}
  const errors=[],onError=e=>errors.push(e.message);page.on('pageerror',onError);
  console.log(JSON.stringify({starting:{mode,stage,character}}));
  try{await play({page,width,height,results,mode,stage,character,outputRoot:path.join(root,mode)});}
  finally{page.off('pageerror',onError);}
  const result=results.at(-1);result.errors=errors;
  result.evidenceDirectory=path.join(root,mode,`${stage}-${character}`);
  fs.writeFileSync(path.join(root,mode,`${stage}-${character}`,'results.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(results,null,2));
  assert.deepEqual(errors,[]);
 }
};
