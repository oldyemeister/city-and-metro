// Test-only builder for the optimized Wasm shipped in js/road-kernel.js.
// Node's built-in modules suffice; the release binary, its source and its Worker do not change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const release=new URL('../../../js/road-kernel.js',import.meta.url);
export const plainSHA256='58a691130b3df19c45cd9c1dfbad81813866129f4bdf37be83212d3c606337ac';
const hash=data=>createHash('sha256').update(data).digest('hex');
export function plainBytes(){
  const wrapper=fs.readFileSync(release,'utf8');
  const data=Buffer.from(wrapper.match(/const bytes='([A-Za-z0-9+/=]+)'/)[1],'base64');
  assert.equal(hash(data),plainSHA256,'Probe sites apply only to the verified production binary');
  return data;
}
function readU32(buf,at) {
  let result=0,shift=0,pos=at;
  for(;;){
    const byte=buf[pos++];
    assert.ok(byte!==undefined&&shift<=28);
    result+=(byte&127)*2**shift;
    if(byte<128)return [result,pos];
    shift+=7;
  }
}
function u32(value){
  const bytes=[];
  while(value>=128){bytes.push(value%128+128);value=Math.floor(value/128);}
  return Buffer.from([...bytes,value]);
}
const vec=parts=>Buffer.concat([u32(parts.length),...parts]);
const sized=bytes=>Buffer.concat([u32(bytes.length),bytes]);
const section=(id,bytes)=>Buffer.concat([Buffer.from([id]),sized(bytes)]);

// Absolute byte offsets in the pinned, stripped module as disassembled by Apple LLVM or V8.
// Each insertion pushes one i32 event and consumes it in a void callback. No existing
// control flow, numerics, loads, stores, table entries or inner-loop bodies are rewritten.
const site=[
  [0x27d4,0,'41002101'], // solve prologue before validation, dynamic checks and clears
  [0x3124,1,'02402018'], // after origin range check, before inlined tree's dist.fill(INF)
  [0x358e,2,'02402026'], // heap exhausted; dispatch into the all-zone winner search and acc seed
  [0x3828,3,'2039450d'], // before checking settled count and walking order backwards
  [0x3979,4,'41012101'], // after reverse loop, before increment/outer-loop bookkeeping
  [0x3991,5,'20010b'],   // final result read/return, including the zero-row case
];
export function instrumentedBytes(){
  const plain=plainBytes(),parts=[plain.subarray(0,8)];
  const sections=[];
  for(let at=8;at<plain.length;){
    const id=plain[at++],[length,start]=readU32(plain,at);
    sections.push({id,start,payload:plain.subarray(start,start+length)});
    at=start+length;
  }
  assert.deepEqual(sections.map(s=>s.id),[1,3,4,5,6,7,9,10,11]);
  for(const {id,start,payload} of sections){
    let next=payload;
    if(id===3){
      // Function 0 is init, used only by its export: llvm-objdump -d shows zero calls
      // to index 0, the ELEM segment has no index 0 and the module has no START section.
      // Import mark(i32)->() at index 0 and move only init's declaration and body to
      // index 49. All other indices (including direct and indirect callees) stay valid.
      const markImport=Buffer.concat([sized(Buffer.from('probe')),sized(Buffer.from('mark')),Buffer.from([0,7])]);
      parts.push(section(2,vec([markImport])));
      assert.equal(payload[0],49);assert.equal(payload[1],3);
      next=Buffer.concat([payload.subarray(0,1),payload.subarray(2),payload.subarray(1,2)]);
    }
    if(id===7){
      assert.equal(payload.toString('hex'),'04066d656d6f7279020004696e6974000003707472000605736f6c76650007');
      next=Buffer.from(payload);next[16]=49;
    }
    if(id===10){
      const [count,first]=readU32(payload,0),bodies=[];
      let at=first;
      for(let index=0;index<count;index++){
        const [length,pos]=readU32(payload,at);
        const body=payload.subarray(pos,pos+length);
        if(index===7){
          const pieces=[];let previous=0;
          for(const [offset,event,prefix] of site){
            const k=offset-start-pos;
            assert.equal(body.subarray(k,k+prefix.length/2).toString('hex'),prefix);
            pieces.push(body.subarray(previous,k),Buffer.from([0x41,event,0x10,0]));
            previous=k;
          }
          pieces.push(body.subarray(previous));bodies.push(sized(Buffer.concat(pieces)));
        }else bodies.push(sized(body));
        at=pos+length;
      }
      assert.equal(count,49);assert.equal(at,payload.length);
      bodies.push(bodies.shift());next=vec(bodies);
    }
    parts.push(section(id,next));
  }
  const result=Buffer.concat(parts);
  const module=new WebAssembly.Module(result);
  assert.deepEqual(WebAssembly.Module.imports(module),[{module:'probe',name:'mark',kind:'function'}]);
  assert.deepEqual(WebAssembly.Module.exports(module),WebAssembly.Module.exports(new WebAssembly.Module(plain)));
  return result;
}

export function createProbe(){
  const stage=['residual','tree','destinations','reverse','residual'];
  let phase=-1,last=0,totals;
  function reset(){
    assert.equal(phase,-1,'Only reset between completed solves');
    totals={tree:0,destinations:0,reverse:0,residual:0,blocks:0,origins:0};
  }
  reset();
  function mark(event){
    const now=performance.now();
    // The marker can run once per stage per origin. Keeping checks here detects bad
    // site mappings (e.g. a path bypassing a stage) independently of output equality.
    if(event===0){
      if(phase!==-1)throw Error('Nested solve');
    }else{
      if(phase<0)throw Error('Marker outside solve');
      totals[stage[phase]]+=now-last;
      const valid=event===1?(phase===0||phase===4):event===5?(phase===0||phase===4):phase===event-1;
      if(!valid)throw Error('Unexpected stage transition '+phase+' -> '+event);
    }
    if(event===4)totals.origins++;
    if(event===5)totals.blocks++;
    phase=event===5?-1:event;
    last=now;
  }
  return {imports:{probe:{mark}},reset,snapshot(){
    assert.equal(phase,-1,'Incomplete solve');return {...totals};
  }};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const plain=plainBytes(),observed=instrumentedBytes();
  console.log(JSON.stringify({plain:{bytes:plain.length,sha256:hash(plain)},observed:{bytes:observed.length,sha256:hash(observed)}}));
}
