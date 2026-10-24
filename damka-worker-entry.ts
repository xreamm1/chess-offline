import {search,searchStats} from './vendor/damka/src/engine/search.ts';
import {dbAddSlice,dbPieces,dbStats} from './vendor/damka/src/engine/db.ts';
import {detailedOf,toBitPosition,fromBitPosition} from './vendor/damka/src/engine/adapter.ts';
import {toSquare64} from './vendor/damka/src/engine/bitboard.ts';
import {ttClear,ttIndex,ttMatches,metaOf as ttMeta,ttMove0,ttMove1,ttFlag,EXACT,ttEntries} from './vendor/damka/src/engine/tt.ts';
import {applyMove} from './vendor/damka/src/game/apply.ts';
import {CHECKERS} from './vendor/damka/src/engine/variant.ts';
let ready=Promise.resolve(),marcherBytes='',neuralPromise:Promise<any>|null=null,neural:any=null,lastEngine:string|null=null,neuralCalls=0;
function loadMarcher(){if(!neuralPromise)neuralPromise=(async()=>{
 const wasm=Uint8Array.from(atob(marcherBytes),c=>c.charCodeAt(0));marcherBytes='';
 const M=await (globalThis as any).createMarcher({instantiateWasm(imports:any,receive:any){WebAssembly.instantiate(wasm,imports).then(result=>receive(result.instance)).catch(error=>self.postMessage({type:'error',message:error.message}));return {}}});
 const lo=new BigUint64Array(65536),hi=new BigUint64Array(65536);
 for(let n=1;n<65536;n++){const rest=n&(n-1),bit=31-Math.clz32(n^rest);lo[n]=lo[rest]|(1n<<BigInt(toSquare64(bit)^56));hi[n]=hi[rest]|(1n<<BigInt(toSquare64(bit+16)^56))}
 const expand=(mask:number)=>lo[mask&65535]|hi[mask>>>16];
 neural=(white:number,black:number,kings:number,side:number)=>{neuralCalls++;return M._wasm_nnue_eval(expand(white&~kings),expand(black&~kings),expand(white&kings),expand(black&kings),side+1)};
})();return neuralPromise}
function variants(p:any,root:any){const out=[];for(let i=0;i<root.length&&i<24;i+=4){try{out.push({move:detailedOf(p,root[i],root[i+1]),score:root[i+2],bound:root[i+3]})}catch(e){}}return out}
function continuation(p:any,m0:number,m1:number){const out=[],seen=new Set();for(let i=0;i<12;i++){try{const move=detailedOf(p,m0,m1);out.push(move);p=toBitPosition(applyMove(fromBitPosition(p),move));const key=[p.white,p.black,p.kings,p.side,p.plies].join(':');if(seen.has(key))break;seen.add(key);const meta=ttMeta(p.side,p.plies,CHECKERS),base=ttIndex(p.white,p.black,p.kings,meta);if(!ttMatches(base,p.white,p.black,p.kings,meta)||ttFlag(base)!==EXACT)break;m0=ttMove0(base);m1=ttMove1(base)}catch(e){break}}return out}
self.onmessage=async event=>{
 const data=event.data;
 try{
  if(data.type==='init'){
   ready=(async()=>{marcherBytes=data.marcher;
    if(data.tables){let bin=atob(data.tables),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));bin='';const buffer=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),view=new DataView(buffer);let offset=0;while(offset<buffer.byteLength){const n=view.getUint32(offset,true);offset+=4;dbAddSlice(new Uint8Array(buffer,offset,n));offset+=n}}
    self.postMessage({type:'ready',pieces:dbPieces()});
   })();await ready;return;
  }
  await ready;
  if(data.type==='search'){
   const engine=data.engine==='damka'?'damka':'marcher-ru';
   if(engine==='marcher-ru')await loadMarcher();
   // Different evaluations cannot share cached scores or move bounds.
   if(lastEngine!==engine){ttClear();lastEngine=engine}
   (globalThis as any).__marcherOrdering=engine==='marcher-ru'?neural:null;neuralCalls=0;
   const p=data.position,started=performance.now(),before=dbStats();
   const metrics=()=>{const stats=searchStats(),db=dbStats();return {time:performance.now()-started,neuralCalls,reductions:stats.reductions,researches:stats.researches,ttProbes:stats.ttProbes,ttHits:stats.ttHits,hashBytes:ttEntries()*32,dbProbes:db.probes-before.probes,dbInflates:db.inflates-before.inflates,dbCacheBytes:db.cachedBytes}};
   (globalThis as any).__damkaIteration=(info:any)=>self.postMessage({type:'progress',id:data.id,engine,...info,...metrics(),variants:variants(p,info.root),pv:info.root.length?continuation(p,info.root[0],info.root[1]):[]});
   const result=search(p.white,p.black,p.kings,p.side,p.plies,{variant:CHECKERS,depth:Math.max(1,Math.min(40,data.depth??24)),budgetMs:Math.max(0,Math.min(5000,data.budget??800)),margin:0,russian:engine==='marcher-ru'});
   (globalThis as any).__damkaIteration=null;self.postMessage({type:'result',id:data.id,engine,...metrics(),variants:variants(p,result.root),pv:continuation(p,result.m0,result.m1),move:detailedOf(p,result.m0,result.m1),depth:result.depth,score:result.score,nodes:result.nodes,pieces:dbPieces()});
  }
 }catch(e){self.postMessage({type:'error',id:data.id,message:e.message})}
};
