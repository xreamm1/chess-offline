import {search} from './vendor/damka/src/engine/search.ts';
import {dbAddSlice,dbPieces} from './vendor/damka/src/engine/db.ts';
import {detailedOf} from './vendor/damka/src/engine/adapter.ts';
import {toSquare64} from './vendor/damka/src/engine/bitboard.ts';
import {CHECKERS} from './vendor/damka/src/engine/variant.ts';
let ready=Promise.resolve();
self.onmessage=async event=>{
 const data=event.data;
 try{
  if(data.type==='init'){
   ready=(async()=>{
   const wasm=Uint8Array.from(atob(data.marcher),c=>c.charCodeAt(0));
   const M=await (globalThis as any).createMarcher({instantiateWasm(imports:any,receive:any){WebAssembly.instantiate(wasm,imports).then(result=>receive(result.instance)).catch(error=>self.postMessage({type:'error',message:error.message}));return {}}});
   const lo=new BigUint64Array(65536),hi=new BigUint64Array(65536);
   for(let n=1;n<65536;n++){const rest=n&(n-1),bit=31-Math.clz32(n^rest);lo[n]=lo[rest]|(1n<<BigInt(toSquare64(bit)^56));hi[n]=hi[rest]|(1n<<BigInt(toSquare64(bit+16)^56))}
   const expand=(mask:number)=>lo[mask&65535]|hi[mask>>>16];
   (globalThis as any).__marcherRussianEval=(white:number,black:number,kings:number,side:number)=>M._wasm_nnue_eval(expand(white&~kings),expand(black&~kings),expand(white&kings),expand(black&kings),side+1);
   if(data.tables){let bin=atob(data.tables),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));bin='';const buffer=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),view=new DataView(buffer);let offset=0;while(offset<buffer.byteLength){const n=view.getUint32(offset,true);offset+=4;dbAddSlice(new Uint8Array(buffer,offset,n));offset+=n}}
   self.postMessage({type:'ready',pieces:dbPieces()})})();await ready;return;
  }
  await ready;
  if(data.type==='search'){const p=data.position;const result=search(p.white,p.black,p.kings,p.side,p.plies,{variant:CHECKERS,depth:Math.min(40,data.depth||24),budgetMs:Math.min(5000,data.budget||800),margin:0});self.postMessage({type:'result',id:data.id,move:detailedOf(p,result.m0,result.m1),depth:result.depth,score:result.score,nodes:result.nodes,pieces:dbPieces()})}
 }catch(e){self.postMessage({type:'error',id:data.id,message:e.message})}
};
