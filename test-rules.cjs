const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const context={};vm.runInNewContext(fs.readFileSync(__dirname+'/damka-rules.js','utf8'),context);const R=context.DamkaRules,pos=text=>R.fromBitPosition(R.parsePos(text));
assert.equal(R.legal(R.initial()).length,7);
for(const [text,count] of [['W:Wa1,g1:Bb2,d4',2],['W:Wa1:Bb2,d4,f6',3],['W:Wa1:Bb2,d2,f2,f4,d6',5]]){
 const p=pos(text),series=R.legal(p);assert(series.length>0);assert(series.every(m=>m.captures.length===count));
 assert(series.every(m=>R.squareName(m.from)==='a1'));
 for(const m of series){const next=R.apply(p,m);assert.equal(next.toMove,'black');assert.equal(next.board.filter(x=>x?.color==='black').length,0)}
}

let moves=R.legal(pos('W:Wc3:Bb2'));assert.equal(moves.length,1);assert.equal(R.squareName(moves[0].to),'a1');assert.equal(moves[0].captures.length,1);
moves=R.legal(pos('W:WKa1:Bc3'));assert.equal(moves.length,5);assert(moves.every(m=>m.captures.length===1));
moves=R.legal(pos('W:Wb6:Bc7,f6'));assert(moves.length>=1);assert(moves.every(m=>m.promotes&&m.captures.length===2&&R.squareName(m.path[0])==='d8'));
moves=R.legal(pos('W:Wc3:Bb4,d4,d6'));assert(moves.some(m=>m.captures.length===1));assert(moves.some(m=>m.captures.length===2));
const before=R.initial(),frozen=JSON.stringify(before);R.apply(before,R.legal(before)[0]);assert.equal(JSON.stringify(before),frozen);
function perft(p,d){if(!d)return 1;let n=0;for(const m of R.legal(p))n+=perft(R.apply(p,m),d-1);return n}
assert.equal(perft(R.initial(),6),37986);
assert.equal(R.outcome(pos('W:W:Bb6')),2);assert.equal(R.outcome(pos('B:WKa1:BKh8:30')),3);
console.log('PASS Russian mandatory/backward/flying/choice/crowning captures, immutable positions, perft6=37986, terminal outcomes');
